'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCrypto } from '@/hooks/useCrypto';
import { useRateLimit } from '@/hooks/useRateLimit';
import { sanitizeText, sanitizeUrl } from '@/utils/sanitize';
import { Plus, Trash2, Eye, EyeOff, Copy, ExternalLink, Lock, Unlock, KeyRound } from 'lucide-react';
import { Modal } from '@/components/Modal';
import toast from 'react-hot-toast';
import { SkeletonPasswordItem, SkeletonList } from '@/components/Skeleton';
import type { Password } from '@shared/types';
import { 
  deriveKeyWebCrypto, 
  encryptWebCrypto, 
  decryptWebCrypto, 
  base64ToBuffer 
} from '@shared/utils/crypto';

interface DecryptedPassword extends Password {
  decryptedPassword?: string;
}

export default function PasswordsPage() {
  const [passwords, setPasswords] = useState<DecryptedPassword[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // 마스터 비밀번호 관련 상태
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmMasterPassword, setConfirmMasterPassword] = useState('');
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [encryptionSalt, setEncryptionSalt] = useState<string | null>(null);
  const [verifier, setVerifier] = useState<string | null>(null);

  // 폼 상태
  const [serviceName, setServiceName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [notes, setNotes] = useState('');

  const supabase = createClient();
  const { encrypt, decrypt, unlock, generateSalt, isReady, isLocked } = useCrypto();
  const rateLimit = useRateLimit('master_password_unlock', {
    maxAttempts: 5,
    windowMs: 60000, // 1분
    blockDurationMs: 300000, // 5분
  });

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (isReady && userId) {
      fetchPasswords();

      // Realtime 구독
      const channel = supabase
        .channel('passwords-web')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'passwords',
          filter: `user_id=eq.${userId}`,
        }, () => {
          fetchPasswords();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isReady, userId]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      setUserEmail(user.email || null);

      // 프로필에서 encryption_salt 및 verifier 가져오기
      const { data: profile } = await supabase
        .from('profiles')
        .select('encryption_salt, verifier')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.encryption_salt) {
        setEncryptionSalt(profile.encryption_salt);
        setVerifier(profile.verifier);
      }

      // 저장된 비밀번호가 있는지 확인
      const { count } = await supabase
        .from('passwords')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Salt가 없으면 처음 사용
      setIsFirstTime(!profile?.encryption_salt);
      setLoading(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    // Rate Limiting 체크
    if (rateLimit.isBlocked) {
      const remainingMinutes = Math.ceil(rateLimit.remainingBlockTimeMs / 60000);
      toast.error(`너무 많은 시도로 인해 차단되었습니다. ${remainingMinutes}분 후에 다시 시도하세요.`);
      return;
    }

    setUnlocking(true);

    try {
      // 처음 사용하는 경우 비밀번호 확인 및 Salt 생성
      if (isFirstTime) {
        if (masterPassword !== confirmMasterPassword) {
          toast.error('마스터 비밀번호가 일치하지 않습니다.');
          setUnlocking(false);
          return;
        }
        if (masterPassword.length < 8) {
          toast.error('마스터 비밀번호는 8자 이상이어야 합니다.');
          setUnlocking(false);
          return;
        }

        // 새 Salt 생성
        const newSalt = generateSalt();
        const saltBuffer = base64ToBuffer(newSalt);
        
        // 키 파생 및 Verifier 생성
        const key = await deriveKeyWebCrypto(masterPassword, saltBuffer);
        const verifierData = await encryptWebCrypto('WORKSYNC_VERIFIER', key);
        
        // 프로필 저장 (Upsert)
        try {
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({ 
              id: userId,
              email: userEmail || 'unknown@email.com',
              encryption_salt: newSalt,
              verifier: JSON.stringify(verifierData),
              updated_at: new Date().toISOString()
            });

          if (profileError) throw profileError;
        } catch (error) {
          console.error('Save failed, retrying without verifier...', error);
          // 컬럼 없음 에러 대비 재시도
          const { error: retryError } = await supabase
            .from('profiles')
            .upsert({ 
              id: userId,
              email: userEmail || 'unknown@email.com',
              encryption_salt: newSalt,
              updated_at: new Date().toISOString()
            });

          if (retryError) {
            toast.error('설정 저장에 실패했습니다.');
            setUnlocking(false);
            return;
          }
        }

        setEncryptionSalt(newSalt);
        await unlock(masterPassword, newSalt); // 앱 상태 잠금 해제
        
        toast.success('마스터 비밀번호가 설정되었습니다.');
        rateLimit.reset();
        setMasterPassword('');
        setConfirmMasterPassword('');
        setIsFirstTime(false);

      } else {
        // 기존 Salt로 unlock
        if (!encryptionSalt) {
          toast.error('암호화 설정을 찾을 수 없습니다.');
          setUnlocking(false);
          return;
        }

        const saltBuffer = base64ToBuffer(encryptionSalt);
        const key = await deriveKeyWebCrypto(masterPassword, saltBuffer);
        
        // 검증 로직
        let verified = false;

        if (verifier) {
          // A. Verifier로 검증
          try {
            const vData = JSON.parse(verifier);
            const decrypted = await decryptWebCrypto(vData.encrypted, vData.iv, key);
            if (decrypted === 'WORKSYNC_VERIFIER') verified = true;
          } catch (e) {
            console.error('Verifier check failed', e);
          }
        } else {
          // B. 기존 비밀번호로 검증 (Fallback)
          const { data: verifyData } = await supabase
            .from('passwords')
            .select('password_encrypted, iv')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle();

          if (verifyData) {
            try {
              const decrypted = await decryptWebCrypto(verifyData.password_encrypted, verifyData.iv, key);
              if (decrypted !== null) verified = true;
            } catch (e) { /* decrypt fail = wrong password */ }
          } else {
            // 저장된 비밀번호도 없으면 패스 (새로운 시작)
            verified = true;
          }

          // 검증 성공 시 Verifier 생성 및 저장 (마이그레이션)
          if (verified) {
            const newVerifier = await encryptWebCrypto('WORKSYNC_VERIFIER', key);
            await supabase.from('profiles').update({ 
              verifier: JSON.stringify(newVerifier) 
            }).eq('id', userId);
          }
        }

        if (verified) {
          await unlock(masterPassword, encryptionSalt);
          toast.success('비밀번호 관리자가 잠금 해제되었습니다.');
          rateLimit.reset();
          setMasterPassword('');
          setConfirmMasterPassword('');
        } else {
          // 실패
          const canContinue = rateLimit.recordAttempt();
          if (!canContinue) {
            const remainingMinutes = Math.ceil(rateLimit.remainingBlockTimeMs / 60000);
            toast.error(`최대 시도 횟수를 초과했습니다. ${remainingMinutes}분 동안 차단됩니다.`);
          } else {
            const remaining = rateLimit.remainingAttempts;
            toast.error(`비밀번호가 올바르지 않습니다. (남은 시도: ${remaining}회)`);
          }
        }
      }
    } catch (error) {
      console.error('Unlock error:', error);
      toast.error('오류가 발생했습니다.');
    } finally {
      setUnlocking(false);
    }
  };

  const fetchPasswords = async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('passwords')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('비밀번호 목록을 불러오는데 실패했습니다.');
    } else {
      setPasswords(data || []);
    }
  };

  const addPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!encrypt || !userId) return;

    // 입력값 Sanitization (XSS 방어)
    const sanitizedServiceName = sanitizeText(serviceName);
    const sanitizedUsername = sanitizeText(username);
    const sanitizedNotes = notes ? sanitizeText(notes) : null;
    const sanitizedUrl = websiteUrl ? sanitizeUrl(websiteUrl) : null;

    // 검증
    if (!sanitizedServiceName || !sanitizedUsername) {
      toast.error('입력값이 올바르지 않습니다.');
      return;
    }

    // 비밀번호 암호화
    const encrypted = await encrypt(password);
    if (!encrypted) {
      toast.error('암호화에 실패했습니다.');
      return;
    }

    const { error } = await supabase.from('passwords').insert({
      user_id: userId,
      service_name: sanitizedServiceName,
      username: sanitizedUsername,
      password_encrypted: encrypted.encrypted,
      iv: encrypted.iv,
      website_url: sanitizedUrl,
      notes: sanitizedNotes,
    });

    if (error) {
      toast.error('비밀번호 추가에 실패했습니다.');
    } else {
      toast.success('비밀번호가 안전하게 저장되었습니다!');
      setShowModal(false);
      resetForm();
      fetchPasswords();
      // 처음이었다면 상태 업데이트
      if (isFirstTime) setIsFirstTime(false);
    }
  };

  const deletePassword = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    const { error } = await supabase.from('passwords').delete().eq('id', id);

    if (error) {
      toast.error('삭제에 실패했습니다.');
    } else {
      // 캐시에서도 삭제 (메모리 누수 방지)
      setVisiblePasswords((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setPasswords((prev) => prev.filter((p) => p.id !== id));
      toast.success('삭제되었습니다.');
    }
  };

  const togglePasswordVisibility = async (id: string) => {
    const newVisible = new Set(visiblePasswords);

    if (newVisible.has(id)) {
      newVisible.delete(id);
      setVisiblePasswords(newVisible);
      return;
    }

    // 비밀번호 복호화
    const pw = passwords.find((p) => p.id === id);
    if (!pw || !decrypt) return;

    const decrypted = await decrypt(pw.password_encrypted, pw.iv);
    if (decrypted) {
      setPasswords((prev) =>
        prev.map((p) => (p.id === id ? { ...p, decryptedPassword: decrypted } : p))
      );
      newVisible.add(id);
      setVisiblePasswords(newVisible);
    } else {
      toast.error('복호화에 실패했습니다. 마스터 비밀번호를 확인하세요.');
    }
  };

  const copyPassword = async (id: string) => {
    const pw = passwords.find((p) => p.id === id);
    if (!pw || !decrypt) return;

    let passwordToCopy = pw.decryptedPassword;

    if (!passwordToCopy) {
      passwordToCopy = await decrypt(pw.password_encrypted, pw.iv);
    }

    if (passwordToCopy) {
      await navigator.clipboard.writeText(passwordToCopy);
      toast.success('비밀번호가 클립보드에 복사되었습니다.');
    } else {
      toast.error('복사에 실패했습니다.');
    }
  };

  const resetForm = () => {
    setServiceName('');
    setUsername('');
    setPassword('');
    setWebsiteUrl('');
    setNotes('');
  };

  if (loading) {
    return (
      <div>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">비밀번호 관리</h1>
          <div className="w-20 h-10 bg-gray-200 rounded-lg animate-pulse" />
        </div>
        <SkeletonList count={4}>
          <SkeletonPasswordItem />
        </SkeletonList>
      </div>
    );
  }

  // 잠금 상태인 경우 마스터 비밀번호 입력 화면 표시
  if (isLocked) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <div className="card">
          <div className="text-center mb-6">
            <div className="inline-flex p-4 bg-primary-100 rounded-full mb-4">
              <KeyRound className="text-primary-600" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isFirstTime ? '마스터 비밀번호 설정' : '비밀번호 관리자 잠금 해제'}
            </h1>
            <p className="text-gray-600 mt-2">
              {isFirstTime
                ? '비밀번호를 안전하게 암호화하기 위한 마스터 비밀번호를 설정하세요.'
                : '저장된 비밀번호를 보려면 마스터 비밀번호를 입력하세요.'}
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                마스터 비밀번호
              </label>
              <input
                type="password"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                className="input"
                placeholder="마스터 비밀번호 입력"
                required
                minLength={8}
              />
            </div>

            {isFirstTime && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  마스터 비밀번호 확인
                </label>
                <input
                  type="password"
                  value={confirmMasterPassword}
                  onChange={(e) => setConfirmMasterPassword(e.target.value)}
                  className="input"
                  placeholder="마스터 비밀번호 다시 입력"
                  required
                  minLength={8}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={unlocking}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              <Unlock size={20} />
              {unlocking ? '잠금 해제 중...' : '잠금 해제'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>주의:</strong> 마스터 비밀번호를 잊어버리면 저장된 비밀번호를 복구할 수 없습니다.
              {isFirstTime && ' 안전한 곳에 기록해두세요.'}
            </p>
          </div>

          {!isFirstTime && (
            <p className="text-xs text-gray-500 mt-4 text-center">
              동일한 마스터 비밀번호를 사용하면 PC와 모바일에서 모두 접근할 수 있습니다.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">비밀번호 관리</h1>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
            <Unlock size={12} />
            잠금 해제됨
          </span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          추가
        </button>
      </div>

      {/* 비밀번호 목록 */}
      <div className="space-y-3">
        {passwords.length === 0 ? (
          <div className="card text-center text-gray-500">
            저장된 비밀번호가 없습니다. 오른쪽 상단의 추가 버튼을 눌러 비밀번호를 저장하세요.
          </div>
        ) : (
          passwords.map((pw) => (
            <div key={pw.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{pw.service_name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{pw.username}</p>

                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 font-mono text-sm bg-gray-100 px-3 py-1.5 rounded">
                      {visiblePasswords.has(pw.id)
                        ? pw.decryptedPassword || '***'
                        : '••••••••••••'}
                    </div>
                    <button
                      onClick={() => togglePasswordVisibility(pw.id)}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                      title={visiblePasswords.has(pw.id) ? '숨기기' : '보기'}
                      aria-label={visiblePasswords.has(pw.id) ? '비밀번호 숨기기' : '비밀번호 보기'}
                    >
                      {visiblePasswords.has(pw.id) ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    <button
                      onClick={() => copyPassword(pw.id)}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                      title="복사"
                      aria-label="비밀번호 복사"
                    >
                      <Copy size={18} />
                    </button>
                  </div>

                  {pw.website_url && (
                    <a
                      href={pw.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-600 hover:underline mt-2 inline-flex items-center gap-1"
                    >
                      {pw.website_url}
                      <ExternalLink size={14} />
                    </a>
                  )}

                  {pw.notes && (
                    <p className="text-sm text-gray-500 mt-2">{pw.notes}</p>
                  )}
                </div>

                <button
                  onClick={() => deletePassword(pw.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  aria-label="삭제"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 추가 모달 */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        title="새 비밀번호 추가"
        maxWidth="md"
      >
        <form onSubmit={addPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              서비스명 *
            </label>
            <input
              type="text"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              className="input"
              placeholder="예: Google, Naver"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              아이디/이메일 *
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              placeholder="예: user@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호 *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="저장할 비밀번호"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              웹사이트 URL
            </label>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="input"
              placeholder="https://example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              메모
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input"
              rows={2}
              placeholder="추가 메모"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                resetForm();
              }}
              className="btn btn-secondary flex-1"
            >
              취소
            </button>
            <button type="submit" className="btn btn-primary flex-1">
              저장
            </button>
          </div>
        </form>

        <p className="text-xs text-gray-500 mt-4 text-center">
          비밀번호는 AES-256-GCM으로 암호화되어 안전하게 저장됩니다.
        </p>
      </Modal>
    </div>
  );
}
