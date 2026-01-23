'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { User, Mail, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { env } from '@/lib/env';
import type { Profile } from '@shared/types';

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      toast.error('프로필을 불러오는데 실패했습니다.');
    } else if (data) {
      setProfile(data);
      setDisplayName(data.display_name || '');
    }
    setLoading(false);
  };

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', profile.id);

    if (error) {
      toast.error('프로필 수정에 실패했습니다.');
    } else {
      toast.success('프로필이 수정되었습니다!');
      fetchProfile();
    }

    setSaving(false);
  };

  const deleteAccount = async () => {
    if (deleteConfirm !== '회원탈퇴') {
      toast.error('"회원탈퇴"를 정확히 입력해주세요.');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    try {
      // Edge Function 호출하여 계정 완전 삭제
      const response = await fetch(
        `${env.SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '계정 삭제에 실패했습니다.');
      }

      // 로그아웃
      await supabase.auth.signOut();

      toast.success('계정이 삭제되었습니다.');
      router.push('/login');
    } catch (error) {
      console.error('Account deletion error:', error);
      const message = error instanceof Error ? error.message : '계정 삭제에 실패했습니다.';
      toast.error(message);
    }
  };

  if (loading) {
    return <div className="text-center py-8">로딩 중...</div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">프로필 설정</h1>

      {/* 프로필 정보 */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">기본 정보</h2>

        <form onSubmit={updateProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Mail size={16} className="inline mr-2" />
              이메일
            </label>
            <input
              type="email"
              value={profile?.email || ''}
              className="input bg-gray-100"
              disabled
            />
            <p className="text-xs text-gray-500 mt-1">이메일은 변경할 수 없습니다.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User size={16} className="inline mr-2" />
              표시 이름
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input"
              placeholder="표시될 이름을 입력하세요"
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>

      {/* 계정 정보 */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">계정 정보</h2>

        <div className="space-y-3 text-sm text-gray-600">
          <p>
            <span className="font-medium">가입일:</span>{' '}
            {profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString('ko-KR')
              : '-'}
          </p>
          <p>
            <span className="font-medium">최근 수정:</span>{' '}
            {profile?.updated_at
              ? new Date(profile.updated_at).toLocaleDateString('ko-KR')
              : '-'}
          </p>
        </div>
      </div>

      {/* 위험 구역 */}
      <div className="card border-red-200 bg-red-50/50">
        <h2 className="text-lg font-semibold text-red-700 mb-4 flex items-center gap-2">
          <AlertTriangle size={20} />
          위험 구역
        </h2>

        <p className="text-sm text-gray-600 mb-4">
          계정을 삭제하면 모든 데이터(URL, 비밀번호, To-Do, 클립보드)가 영구적으로 삭제됩니다.
          이 작업은 되돌릴 수 없습니다.
        </p>

        <button
          onClick={() => setShowDeleteModal(true)}
          className="btn btn-danger"
        >
          계정 삭제
        </button>
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-red-600 mb-4 flex items-center gap-2">
              <AlertTriangle size={24} />
              정말 삭제하시겠습니까?
            </h2>

            <p className="text-gray-600 mb-4">
              이 작업은 되돌릴 수 없습니다. 모든 데이터가 영구적으로 삭제됩니다.
              계속하려면 아래에 <strong>"회원탈퇴"</strong>를 입력하세요.
            </p>

            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="input mb-4"
              placeholder="회원탈퇴"
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirm('');
                }}
                className="btn btn-secondary flex-1"
              >
                취소
              </button>
              <button
                onClick={deleteAccount}
                disabled={deleteConfirm !== '회원탈퇴'}
                className="btn btn-danger flex-1 disabled:opacity-50"
              >
                영구 삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
