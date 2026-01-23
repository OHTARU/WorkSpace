import { createClient } from '@/lib/supabase/server';
import { Link2, Lock, CheckSquare, Clipboard } from 'lucide-react';

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 통계 데이터 가져오기
  const [urlsResult, passwordsResult, todosResult, clipboardsResult] = await Promise.all([
    supabase.from('urls').select('id', { count: 'exact' }).eq('user_id', user?.id),
    supabase.from('passwords').select('id', { count: 'exact' }).eq('user_id', user?.id),
    supabase.from('todos').select('id', { count: 'exact' }).eq('user_id', user?.id).eq('is_completed', false),
    supabase.from('clipboards').select('id', { count: 'exact' }).eq('user_id', user?.id),
  ]);

  const stats = [
    {
      label: '저장된 URL',
      value: urlsResult.count || 0,
      icon: Link2,
      color: 'bg-blue-500',
      href: '/dashboard/urls',
    },
    {
      label: '저장된 비밀번호',
      value: passwordsResult.count || 0,
      icon: Lock,
      color: 'bg-green-500',
      href: '/dashboard/passwords',
    },
    {
      label: '진행 중인 To-Do',
      value: todosResult.count || 0,
      icon: CheckSquare,
      color: 'bg-yellow-500',
      href: '/dashboard/todos',
    },
    {
      label: '클립보드 항목',
      value: clipboardsResult.count || 0,
      icon: Clipboard,
      color: 'bg-purple-500',
      href: '/dashboard/clipboard',
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">대시보드</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <a
              key={stat.label}
              href={stat.href}
              className="card hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="text-white" size={24} />
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                </div>
              </div>
            </a>
          );
        })}
      </div>

      <div className="mt-8 card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">빠른 시작</h2>
        <div className="space-y-3 text-gray-600">
          <p>1. URL을 추가하면 모바일에서 실시간으로 확인할 수 있습니다.</p>
          <p>2. 비밀번호는 암호화되어 안전하게 저장됩니다.</p>
          <p>3. To-Do 리스트로 프로젝트를 체계적으로 관리하세요.</p>
          <p>4. 클립보드에 텍스트를 저장하면 모바일에서 바로 사용할 수 있습니다.</p>
        </div>
      </div>
    </div>
  );
}
