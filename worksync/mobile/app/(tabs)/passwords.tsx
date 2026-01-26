import { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  AppState,
  AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import * as ScreenCapture from 'expo-screen-capture';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/contexts/AuthContext';
import { useSubscription } from '../../src/hooks/useSubscription';
import { cryptoManager } from '../../src/utils/crypto';

interface Password {
  id: string;
  service_name: string;
  username: string;
  password_encrypted: string;
  iv: string;
  website_url: string | null;
  notes: string | null;
  created_at: string;
}

// -----------------------------------------------------------------------------
// [최적화 1] PasswordItem 컴포넌트 분리 (memoization)
// 리스트 렌더링 성능을 위해 개별 아이템을 별도 컴포넌트로 분리하고 memo로 감쌉니다.
// -----------------------------------------------------------------------------
const PasswordItem = memo(({ 
  item, 
  isVisible, 
  decryptedPassword, 
  onToggleVisibility, 
  onCopy, 
  onEdit, 
  onDelete 
}: {
  item: Password,
  isVisible: boolean,
  decryptedPassword?: string,
  onToggleVisibility: (id: string) => void,
  onCopy: (id: string) => void,
  onEdit: (item: Password) => void,
  onDelete: (id: string, serviceName: string) => void
}) => {
  const copyToClipboard = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('복사됨', `${label}이(가) 클립보드에 복사되었습니다.`);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="globe-outline" size={24} color="#3B82F6" />
        <View style={styles.cardInfo}>
          <Text style={styles.serviceName}>{item.service_name}</Text>
          <TouchableOpacity onPress={() => copyToClipboard(item.username, '아이디')}>
            <Text style={styles.username}>{item.username}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onEdit(item)}
          >
            <Ionicons name="pencil" size={18} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onDelete(item.id, item.service_name)}
          >
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.passwordRow}>
        <Text style={styles.passwordLabel}>비밀번호:</Text>
        <Text style={styles.password} numberOfLines={1}>
          {isVisible
            ? decryptedPassword || '***'
            : '••••••••••••'}
        </Text>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => onToggleVisibility(item.id)}
        >
          <Ionicons
            name={isVisible ? 'eye-off' : 'eye'}
            size={20}
            color="#6B7280"
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => onCopy(item.id)}
        >
          <Ionicons name="copy-outline" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {item.website_url && (
        <Text style={styles.website} numberOfLines={1}>
          {item.website_url}
        </Text>
      )}

      {item.notes && (
        <Text style={styles.notes} numberOfLines={2}>
          {item.notes}
        </Text>
      )}
    </View>
  );
});

export default function PasswordsScreen() {
  const [passwords, setPasswords] = useState<Password[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [decryptedPasswords, setDecryptedPasswords] = useState<Record<string, string>>({});
  const { user } = useAuth();
  const { checkLimit } = useSubscription();
  const appState = useRef(AppState.currentState);

  // 마스터 비밀번호 관련 상태
  const [isLocked, setIsLocked] = useState(true);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmMasterPassword, setConfirmMasterPassword] = useState('');
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [encryptionSalt, setEncryptionSalt] = useState<string | null>(null);
  const [verifier, setVerifier] = useState<string | null>(null);
  
  // 마스터 비밀번호 표시 여부
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [showConfirmMasterPassword, setShowConfirmMasterPassword] = useState(false);

  // 추가/수정 모달 상태
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    serviceName: '',
    username: '',
    password: '',
    websiteUrl: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  // -----------------------------------------------------------------------------
  // [최적화 2] AppState 감지로 백그라운드 진입 시 데이터 소거 (보안 강화)
  // -----------------------------------------------------------------------------
  useEffect(() => {
    // 화면 캡처 방지 활성화
    const enableScreenCaptureProtection = async () => {
      await ScreenCapture.preventScreenCaptureAsync();
    };
    enableScreenCaptureProtection();

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/active/) &&
        nextAppState.match(/inactive|background/)
      ) {
        // 백그라운드로 가면 즉시 잠금 및 데이터 소거
        lockAndClearData();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      // 컴포넌트 언마운트 시 캡처 방지 해제 (선택사항, 보통은 유지하거나 해제)
      ScreenCapture.allowScreenCaptureAsync();
    };
  }, []);

  const lockAndClearData = useCallback(() => {
    cryptoManager.lock();
    setIsLocked(true);
    setDecryptedPasswords({});
    setVisiblePasswords(new Set());
    // 마스터 비밀번호 입력 필드도 초기화 (선택사항)
    setMasterPassword('');
  }, []);

  useEffect(() => {
    checkPasswordsExist();
  }, [user]);

  useEffect(() => {
    if (!isLocked && user) {
      fetchPasswords();
    }
  }, [isLocked, user]);

  const checkPasswordsExist = async () => {
    if (!user) return;

    // 프로필에서 encryption_salt 및 verifier 가져오기
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('encryption_salt, verifier')
      .eq('id', user.id)
      .maybeSingle();

    console.log('[DEBUG] Profile query result:', {
      profile: profile ? 'EXISTS' : 'NULL',
      encryption_salt: profile?.encryption_salt || 'NULL',
      verifier: profile?.verifier ? 'EXISTS' : 'NULL',
      error: error?.message || 'NONE'
    });

    if (error) {
      console.error('Profile fetch error:', error);
    }

    if (profile?.encryption_salt) {
      setEncryptionSalt(profile.encryption_salt);
      setVerifier(profile.verifier);
      setIsFirstTime(false);
      console.log('[DEBUG] isFirstTime = false');
    } else {
      // salt가 없으면 처음 사용자
      setIsFirstTime(true);
      console.log('[DEBUG] isFirstTime = true (no salt found)');
    }

    setLoading(false);
    setShowUnlockModal(true);
  };

  const handleUnlock = async () => {
    if (!user) return;

    // 0. Rate Limit Check
    try {
      const rateLimitStr = await SecureStore.getItemAsync('rate_limit_master_pw');
      if (rateLimitStr) {
        const rateLimit = JSON.parse(rateLimitStr);
        const now = Date.now();

        if (rateLimit.blockedUntil && now < rateLimit.blockedUntil) {
          const remainingMins = Math.ceil((rateLimit.blockedUntil - now) / 60000);
          Alert.alert('접근 차단', `너무 많은 시도로 인해 차단되었습니다. ${remainingMins}분 후에 다시 시도하세요.`);
          return;
        }
        
        // 차단 시간 지났으면 초기화
        if (rateLimit.blockedUntil && now >= rateLimit.blockedUntil) {
          await SecureStore.deleteItemAsync('rate_limit_master_pw');
        }
      }
    } catch (e) {
      console.error('Rate limit check error:', e);
    }

    setUnlocking(true);

    if (isFirstTime) {
      if (masterPassword !== confirmMasterPassword) {
        Alert.alert('오류', '마스터 비밀번호가 일치하지 않습니다.');
        setUnlocking(false);
        return;
      }
      if (masterPassword.length < 8) {
        Alert.alert('오류', '마스터 비밀번호는 8자 이상이어야 합니다.');
        setUnlocking(false);
        return;
      }

      const newSalt = cryptoManager.generateSalt();
      const success = await cryptoManager.unlock(masterPassword, newSalt);
      if (!success) {
        Alert.alert('오류', '암호화 키 생성에 실패했습니다.');
        setUnlocking(false);
        return;
      }

      const verifierData = await cryptoManager.encrypt('WORKSYNC_VERIFIER');
      if (!verifierData) {
        Alert.alert('오류', '검증 토큰 생성에 실패했습니다.');
        setUnlocking(false);
        return;
      }

      try {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({ 
            id: user.id,
            email: user.email || 'unknown@email.com',
            encryption_salt: newSalt,
            verifier: JSON.stringify(verifierData),
            updated_at: new Date().toISOString()
          });

        if (profileError) {
          throw profileError;
        }
      } catch (error: any) {
        console.error('First save attempt failed:', error);
        
        const { error: retryError } = await supabase
          .from('profiles')
          .upsert({ 
            id: user.id,
            email: user.email || 'unknown@email.com',
            encryption_salt: newSalt,
            updated_at: new Date().toISOString()
          });

        if (retryError) {
          console.error('Retry save failed:', retryError);
          Alert.alert('오류', '설정 저장에 실패했습니다. DB 마이그레이션을 확인해주세요.');
          setUnlocking(false);
          return;
        }
      }

      setEncryptionSalt(newSalt);
      setIsLocked(false);
      setShowUnlockModal(false);
      setMasterPassword('');
      setConfirmMasterPassword('');
      setIsFirstTime(false);
      Alert.alert('성공', '마스터 비밀번호가 설정되었습니다.');
      await SecureStore.deleteItemAsync('rate_limit_master_pw');

    } else {
      if (!encryptionSalt) {
        Alert.alert('오류', '암호화 설정을 찾을 수 없습니다.');
        setUnlocking(false);
        return;
      }

      // 검증 헬퍼 함수
      const verifyKey = async () => {
        if (verifier) {
          try {
            const vData = JSON.parse(verifier);
            const decrypted = await cryptoManager.decrypt(vData.encrypted, vData.iv);
            return decrypted === 'WORKSYNC_VERIFIER';
          } catch { return false; }
        } else {
          try {
            const { data: verifyData } = await supabase
              .from('passwords')
              .select('password_encrypted, iv')
              .eq('user_id', user.id)
              .limit(1)
              .maybeSingle();
            
            if (!verifyData) return true; // 데이터 없으면 통과
            const decrypted = await cryptoManager.decrypt(verifyData.password_encrypted, verifyData.iv);
            return decrypted !== null;
          } catch { return false; }
        }
      };

      // 1. Standard 방식 시도
      await cryptoManager.unlock(masterPassword, encryptionSalt);
      let isVerified = await verifyKey();
      let migrationNeeded = false;

      // 2. Legacy 방식 시도 (Standard 실패 시)
      if (!isVerified) {
        console.log('Standard unlock failed, trying legacy...');
        await cryptoManager.unlockLegacy(masterPassword, encryptionSalt);
        isVerified = await verifyKey();
        if (isVerified) {
          migrationNeeded = true;
        }
      }

      if (isVerified) {
        if (migrationNeeded) {
          try {
            Alert.alert('보안 업데이트', 'PC 버전과의 호환성을 위해 암호화 방식을 업데이트합니다. 잠시만 기다려주세요.');
            
            const { data: allPasswords } = await supabase
              .from('passwords')
              .select('*')
              .eq('user_id', user.id);
            
            const decryptedList = [];
            if (allPasswords) {
              for (const p of allPasswords) {
                const plain = await cryptoManager.decrypt(p.password_encrypted, p.iv);
                if (plain) decryptedList.push({ ...p, plain });
              }
            }

            // Standard Key로 전환
            await cryptoManager.unlock(masterPassword, encryptionSalt);

            for (const item of decryptedList) {
              const enc = await cryptoManager.encrypt(item.plain);
              if (enc) {
                await supabase.from('passwords').update({
                  password_encrypted: enc.encrypted,
                  iv: enc.iv
                }).eq('id', item.id);
              }
            }

            const newVerifier = await cryptoManager.encrypt('WORKSYNC_VERIFIER');
            if (newVerifier) {
              const vStr = JSON.stringify(newVerifier);
              await supabase.from('profiles').update({ verifier: vStr }).eq('id', user.id);
              setVerifier(vStr);
            }
            
            console.log('Migration completed');
          } catch (e) {
            console.error('Migration failed', e);
            Alert.alert('오류', '보안 업데이트 중 오류가 발생했습니다. 나중에 다시 시도해주세요.');
            await cryptoManager.unlockLegacy(masterPassword, encryptionSalt);
          }
        } else {
            if (!verifier) {
               const newVerifier = await cryptoManager.encrypt('WORKSYNC_VERIFIER');
               if (newVerifier) {
                 const vStr = JSON.stringify(newVerifier);
                 await supabase.from('profiles').update({ verifier: vStr }).eq('id', user.id);
                 setVerifier(vStr);
               }
            }
        }

        setIsLocked(false);
        setShowUnlockModal(false);
        setMasterPassword('');
        setConfirmMasterPassword('');
        await SecureStore.deleteItemAsync('rate_limit_master_pw');
      } else {
        cryptoManager.lock();
        Alert.alert('오류', '비밀번호가 올바르지 않습니다.');

        try {
          const rateLimitStr = await SecureStore.getItemAsync('rate_limit_master_pw');
          let attempts = 0;
          if (rateLimitStr) {
            attempts = JSON.parse(rateLimitStr).attempts || 0;
          }
          
          attempts++;
          
          if (attempts >= 5) {
            await SecureStore.setItemAsync('rate_limit_master_pw', JSON.stringify({
              attempts,
              blockedUntil: Date.now() + 300000 // 5분 차단
            }));
            Alert.alert('경고', '비밀번호 입력 5회 실패로 5분간 차단됩니다.');
          } else {
            await SecureStore.setItemAsync('rate_limit_master_pw', JSON.stringify({
              attempts,
              blockedUntil: null
            }));
            Alert.alert('오류', `비밀번호가 틀렸습니다. (남은 기회: ${5 - attempts}회)`);
          }
        } catch (e) {
          console.error('Rate limit save error', e);
        }
      }
    }

    setUnlocking(false);
  };

  const fetchPasswords = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('passwords')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      Alert.alert('오류', '목록을 불러오는데 실패했습니다.');
    } else {
      setPasswords(data || []);
    }
    setRefreshing(false);
  }, [user]);

  const openAddModal = useCallback(() => {
    setEditingId(null);
    setFormData({
      serviceName: '',
      username: '',
      password: '',
      websiteUrl: '',
      notes: '',
    });
    setShowFormModal(true);
  }, []);

  const openEditModal = useCallback(async (item: Password) => {
    // 비밀번호 복호화
    const decrypted = await cryptoManager.decrypt(item.password_encrypted, item.iv);

    setEditingId(item.id);
    setFormData({
      serviceName: item.service_name,
      username: item.username,
      password: decrypted || '',
      websiteUrl: item.website_url || '',
      notes: item.notes || '',
    });
    setShowFormModal(true);
  }, []);

  const handleSave = async () => {
    if (!user) return;

    if (!formData.serviceName.trim() || !formData.username.trim() || !formData.password.trim()) {
      Alert.alert('오류', '서비스명, 아이디, 비밀번호는 필수입니다.');
      return;
    }

    // 새 항목 추가 시 구독 제한 체크
    if (!editingId) {
      const limit = checkLimit('passwords');
      if (!limit.allowed) {
        Alert.alert(
          '한도 도달',
          `비밀번호 저장 한도(${limit.limit}개)에 도달했습니다.\n\nPro로 업그레이드하면 무제한으로 저장할 수 있습니다.`,
          [
            { text: '확인', style: 'cancel' },
          ]
        );
        return;
      }
    }

    setSaving(true);

    try {
      // 비밀번호 암호화
      const encrypted = await cryptoManager.encrypt(formData.password);
      if (!encrypted) {
        Alert.alert('오류', '암호화에 실패했습니다.');
        setSaving(false);
        return;
      }

      if (editingId) {
        // 수정
        const { error } = await supabase
          .from('passwords')
          .update({
            service_name: formData.serviceName.trim(),
            username: formData.username.trim(),
            password_encrypted: encrypted.encrypted,
            iv: encrypted.iv,
            website_url: formData.websiteUrl.trim() || null,
            notes: formData.notes.trim() || null,
          })
          .eq('id', editingId);

        if (error) throw error;
        Alert.alert('성공', '비밀번호가 수정되었습니다.');
      } else {
        // 추가
        const { error } = await supabase.from('passwords').insert({
          user_id: user.id,
          service_name: formData.serviceName.trim(),
          username: formData.username.trim(),
          password_encrypted: encrypted.encrypted,
          iv: encrypted.iv,
          website_url: formData.websiteUrl.trim() || null,
          notes: formData.notes.trim() || null,
        });

        if (error) throw error;
        Alert.alert('성공', '비밀번호가 추가되었습니다.');

        // 처음이었다면 상태 업데이트
        if (isFirstTime) setIsFirstTime(false);
      }

      setShowFormModal(false);
      fetchPasswords();
      // 복호화된 비밀번호 캐시 초기화
      setDecryptedPasswords({});
      setVisiblePasswords(new Set());
    } catch (error) {
      Alert.alert('오류', '저장에 실패했습니다.');
    }

    setSaving(false);
  };

  const handleDelete = useCallback((id: string, serviceName: string) => {
    Alert.alert(
      '삭제 확인',
      `"${serviceName}" 비밀번호를 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('passwords').delete().eq('id', id);
            if (error) {
              Alert.alert('오류', '삭제에 실패했습니다.');
            } else {
              // 캐시에서도 삭제 (메모리 누수 방지)
              setDecryptedPasswords((prev) => {
                const { [id]: _, ...rest } = prev;
                return rest;
              });
              setVisiblePasswords((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
              fetchPasswords();
            }
          },
        },
      ]
    );
  }, [fetchPasswords]);

  const authenticateAndShow = useCallback(async (id: string) => {
    if (visiblePasswords.has(id)) {
      setVisiblePasswords((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }

    // 생체 인증 확인
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (hasHardware && isEnrolled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: '비밀번호를 확인하려면 인증해주세요',
        fallbackLabel: '비밀번호 사용',
      });

      if (!result.success) {
        return;
      }
    }

    // 비밀번호 복호화
    const pw = passwords.find((p) => p.id === id);
    if (!pw) return;

    const decrypted = await cryptoManager.decrypt(pw.password_encrypted, pw.iv);

    setDecryptedPasswords((prev) => ({
      ...prev,
      [id]: decrypted || '복호화 실패',
    }));

    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    // 10초 후 자동 숨김
    setTimeout(() => {
      setVisiblePasswords((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 10000);
  }, [passwords, visiblePasswords]);

  const copyPassword = useCallback(async (id: string) => {
    const pw = passwords.find((p) => p.id === id);
    if (!pw) return;

    let passwordToCopy = decryptedPasswords[id];

    if (!passwordToCopy || passwordToCopy === '복호화 실패') {
      passwordToCopy = (await cryptoManager.decrypt(pw.password_encrypted, pw.iv)) || '';
    }

    if (passwordToCopy) {
      await Clipboard.setStringAsync(passwordToCopy);
      Alert.alert('복사됨', '비밀번호가 클립보드에 복사되었습니다.');
    } else {
      Alert.alert('오류', '비밀번호 복호화에 실패했습니다.');
    }
  }, [passwords, decryptedPasswords]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <Text>로딩 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 잠금 해제 모달 */}
      <Modal
        visible={showUnlockModal && isLocked}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTop}>
                <TouchableOpacity 
                  onPress={() => setShowUnlockModal(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <View style={styles.iconCircle}>
                <Ionicons name="key" size={32} color="#3B82F6" />
              </View>
              <Text style={styles.modalTitle}>
                {isFirstTime ? '마스터 비밀번호 설정' : '비밀번호 관리자 잠금 해제'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {isFirstTime
                  ? '비밀번호를 안전하게 암호화하기 위한 마스터 비밀번호를 설정하세요.'
                  : 'PC에서 설정한 동일한 마스터 비밀번호를 입력하세요.'}
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.inputWithIcon}
                placeholder="마스터 비밀번호"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showMasterPassword}
                value={masterPassword}
                onChangeText={setMasterPassword}
              />
              <TouchableOpacity
                style={styles.inputIcon}
                onPress={() => setShowMasterPassword(!showMasterPassword)}
              >
                <Ionicons
                  name={showMasterPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>

            {isFirstTime && (
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.inputWithIcon}
                  placeholder="마스터 비밀번호 확인"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showConfirmMasterPassword}
                  value={confirmMasterPassword}
                  onChangeText={setConfirmMasterPassword}
                />
                <TouchableOpacity
                  style={styles.inputIcon}
                  onPress={() => setShowConfirmMasterPassword(!showConfirmMasterPassword)}
                >
                  <Ionicons
                    name={showConfirmMasterPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryButton, unlocking && styles.buttonDisabled]}
              onPress={handleUnlock}
              disabled={unlocking}
            >
              <Ionicons name="lock-open" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>
                {unlocking ? '잠금 해제 중...' : '잠금 해제'}
              </Text>
            </TouchableOpacity>

            <View style={styles.warningBox}>
              <Ionicons name="warning" size={16} color="#D97706" />
              <Text style={styles.warningText}>
                마스터 비밀번호를 잊어버리면 저장된 비밀번호를 복구할 수 없습니다.
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* 추가/수정 모달 */}
      <Modal
        visible={showFormModal}
        animationType="slide"
        transparent={true}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.formModalContent}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>
                {editingId ? '비밀번호 수정' : '새 비밀번호 추가'}
              </Text>
              <TouchableOpacity onPress={() => setShowFormModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll}>
              <Text style={styles.label}>서비스명 *</Text>
              <TextInput
                style={styles.input}
                placeholder="예: Google, Naver"
                placeholderTextColor="#9CA3AF"
                value={formData.serviceName}
                onChangeText={(text) => setFormData({ ...formData, serviceName: text })}
              />

              <Text style={styles.label}>아이디/이메일 *</Text>
              <TextInput
                style={styles.input}
                placeholder="예: user@example.com"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                keyboardType="email-address"
                value={formData.username}
                onChangeText={(text) => setFormData({ ...formData, username: text })}
              />

              <Text style={styles.label}>비밀번호 *</Text>
              <TextInput
                style={styles.input}
                placeholder="저장할 비밀번호"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
              />

              <Text style={styles.label}>웹사이트 URL</Text>
              <TextInput
                style={styles.input}
                placeholder="https://example.com"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                keyboardType="url"
                value={formData.websiteUrl}
                onChangeText={(text) => setFormData({ ...formData, websiteUrl: text })}
              />

              <Text style={styles.label}>메모</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="추가 메모"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                value={formData.notes}
                onChangeText={(text) => setFormData({ ...formData, notes: text })}
              />
            </ScrollView>

            <View style={styles.formButtons}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setShowFormModal(false)}
              >
                <Text style={styles.secondaryButtonText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, styles.flex1, saving && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.primaryButtonText}>
                  {saving ? '저장 중...' : '저장'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 잠금 상태 표시 */}
      {isLocked ? (
        <View style={styles.lockedContainer}>
          <Ionicons name="lock-closed" size={64} color="#D1D5DB" />
          <Text style={styles.lockedText}>비밀번호 관리자가 잠겨있습니다</Text>
          <TouchableOpacity
            style={styles.unlockPromptButton}
            onPress={() => setShowUnlockModal(true)}
          >
            <Text style={styles.unlockPromptText}>잠금 해제</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* 상태 바 */}
          <View style={styles.statusBar}>
            <View style={styles.statusBadge}>
              <Ionicons name="lock-open" size={14} color="#059669" />
              <Text style={styles.statusText}>잠금 해제됨</Text>
            </View>
            <View style={styles.statusActions}>
              {/* PC에서만 추가 가능하도록 버튼 제거됨 */}
              <TouchableOpacity
                style={styles.lockButton}
                onPress={lockAndClearData}
              >
                <Ionicons name="lock-closed" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
               style={styles.addButton}
               onPress={openAddModal}
             >
               <Ionicons name="add" size={24} color="#fff" />
             </TouchableOpacity>
          </View>

          <FlatList
            data={passwords}
            renderItem={({ item }) => (
              <PasswordItem 
                item={item} 
                isVisible={visiblePasswords.has(item.id)}
                decryptedPassword={decryptedPasswords[item.id]}
                onToggleVisibility={authenticateAndShow}
                onCopy={copyPassword}
                onEdit={openEditModal}
                onDelete={handleDelete}
              />
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  fetchPasswords();
                }}
              />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="lock-closed" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>저장된 비밀번호가 없습니다</Text>
                <Text style={styles.emptySubtext}>PC에서 비밀번호를 추가해주세요</Text>
              </View>
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  username: {
    fontSize: 14,
    color: '#3B82F6',
    marginTop: 2,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
  },
  passwordLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginRight: 8,
  },
  password: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#1F2937',
  },
  iconButton: {
    padding: 4,
    marginLeft: 8,
  },
  website: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 12,
  },
  notes: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  // 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalHeader: {
    marginBottom: 24,
  },
  modalHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  closeButton: {
    padding: 4,
  },
  iconCircle: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EBF5FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  // 폼 모달
  formModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    width: '92%',
    maxHeight: '85%',
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  formScroll: {
    maxHeight: 400,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    marginBottom: 12,
  },
  inputWithIcon: {
    flex: 1,
    padding: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  inputIcon: {
    padding: 14,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  formButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  flex1: {
    flex: 1,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 14,
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 14,
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
  },
  // 잠금 상태
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  lockedText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 24,
  },
  unlockPromptButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  unlockPromptText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // 상태 바
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  statusActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addButton: {
    backgroundColor: '#3B82F6',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
});
