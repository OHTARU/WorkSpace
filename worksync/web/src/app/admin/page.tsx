import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { PlanChangeButton } from './PlanChangeButton';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check if admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold text-red-600 mb-4">접근 권한이 없습니다</h1>
        <p className="text-gray-600 mb-8">관리자만 접근할 수 있는 페이지입니다.</p>
        <Link href="/dashboard" className="text-primary-600 hover:underline">
          대시보드로 돌아가기
        </Link>
      </div>
    );
  }

  // Fetch all profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  // Fetch all subscriptions with plans
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('*, plan:plans(*)');

  // Fetch usage tracking for all users
  const { data: usage } = await supabase
    .from('usage_tracking')
    .select('*');

  // Combine data
  const users = profiles?.map(profile => {
    const sub = subscriptions?.find(s => s.user_id === profile.id);
    const planName = (sub?.plan as any)?.name || 'free'; // Default to free if no sub
    
    const userUsage = usage?.filter(u => u.user_id === profile.id) || [];
    const getUsage = (feature: string) => userUsage.find(u => u.feature === feature)?.current_count || 0;

    return {
      ...profile,
      planName,
      usage: {
        urls: getUsage('urls'),
        passwords: getUsage('passwords'),
        projects: getUsage('projects'),
        clipboards: getUsage('clipboards'),
      }
    };
  }) || [];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/profile" className="p-2 hover:bg-gray-200 rounded-full transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">관리자 대시보드</h1>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg shadow-sm text-sm text-gray-600">
            총 사용자: <span className="font-bold text-primary-600">{users.length}</span>명
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
                  <th className="px-6 py-4">사용자 (Email)</th>
                  <th className="px-6 py-4">가입일</th>
                  <th className="px-6 py-4">현재 플랜</th>
                  <th className="px-6 py-4 text-center">URL</th>
                  <th className="px-6 py-4 text-center">비밀번호</th>
                  <th className="px-6 py-4 text-center">프로젝트</th>
                  <th className="px-6 py-4 text-center">클립보드</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{user.email}</div>
                      <div className="text-xs text-gray-400">{user.display_name}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-6 py-4">
                      <PlanChangeButton userId={user.id} currentPlanName={user.planName} />
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-600">
                      {user.usage.urls}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-600">
                      {user.usage.passwords}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-600">
                      {user.usage.projects}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-600">
                      {user.usage.clipboards}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
