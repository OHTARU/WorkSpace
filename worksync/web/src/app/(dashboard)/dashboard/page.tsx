import { createClient } from '@/lib/supabase/server';
import { Link2, Lock, CheckSquare, Clipboard, ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 구독 및 플랜 정보 가져오기
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*, plan:plans(*)')
    .eq('user_id', user?.id)
    .maybeSingle();

  let plan = (subscription as any)?.plan;
  if (!plan) {
    const { data: freePlan } = await supabase
      .from('plans')
      .select('*')
      .eq('name', 'free')
      .single();
    plan = freePlan;
  }

  // 통계 데이터 가져오기
  const [urlsResult, passwordsResult, projectsResult, clipboardsResult] = await Promise.all([
    supabase.from('urls').select('id', { count: 'exact' }).eq('user_id', user?.id),
    supabase.from('passwords').select('id', { count: 'exact' }).eq('user_id', user?.id),
    supabase.from('projects').select('id', { count: 'exact' }).eq('user_id', user?.id),
    supabase.from('clipboards').select('id', { count: 'exact' }).eq('user_id', user?.id),
  ]);

  // 베타 모드 설정 (useSubscription.ts와 동일하게 유지)
  const BETA_MODE = false;
  
  const limits = plan?.limits || {};
  
  const stats = [
    {
      label: '저장된 URL',
      value: urlsResult.count || 0,
      limit: BETA_MODE ? -1 : limits.urls,
      icon: Link2,
      color: 'bg-blue-500',
      href: '/dashboard/urls',
    },
    {
      label: '저장된 비밀번호',
      value: passwordsResult.count || 0,
      limit: BETA_MODE ? -1 : limits.passwords,
      icon: Lock,
      color: 'bg-green-500',
      href: '/dashboard/passwords',
    },
    {
      label: '생성된 프로젝트',
      value: projectsResult.count || 0,
      limit: BETA_MODE ? -1 : limits.projects,
      icon: CheckSquare,
      color: 'bg-yellow-500',
      href: '/dashboard/todos',
    },
    {
      label: '클립보드 항목',
      value: clipboardsResult.count || 0,
      limit: BETA_MODE ? -1 : limits.clipboards,
      icon: Clipboard,
      color: 'bg-purple-500',
      href: '/dashboard/clipboard',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
          <p className="text-gray-500 mt-1">
            현재 이용 중인 플랜: <span className="font-semibold text-primary-600">{plan?.display_name || 'Free'}</span>
          </p>
        </div>
        <Link href="/dashboard/subscription" className="text-sm font-medium text-primary-600 hover:underline flex items-center gap-1">
          플랜 업그레이드 <ArrowRight size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const percentage = stat.limit === -1 ? 0 : Math.min(100, (stat.value / stat.limit) * 100);
          
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="card hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="text-white" size={24} />
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                </div>
              </div>
              
              {/* 사용량 바 */}
              <div className="mt-auto">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>사용량</span>
                  <span>{stat.limit === -1 ? '무제한' : `${stat.value} / ${stat.limit}`}</span>
                </div>
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${stat.color} transition-all duration-500`}
                    style={{ width: `${stat.limit === -1 ? '0' : percentage}%` }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">빠른 시작</h2>
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0 text-sm font-bold">1</div>
              <p className="text-gray-600">URL을 추가하면 모바일에서 실시간으로 확인할 수 있습니다.</p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0 text-sm font-bold">2</div>
              <p className="text-gray-600">비밀번호는 암호화되어 안전하게 저장됩니다.</p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0 text-sm font-bold">3</div>
              <p className="text-gray-600">To-Do 리스트로 프로젝트를 체계적으로 관리하세요.</p>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0 text-sm font-bold">4</div>
              <p className="text-gray-600">클립보드에 텍스트나 이미지를 저장하면 기기 간 즉시 공유됩니다.</p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-primary-600 to-blue-700 text-white border-none shadow-xl">
          <h2 className="text-xl font-bold mb-2">WorkSync Pro</h2>
          <p className="text-primary-100 mb-6 text-sm leading-relaxed">
            Pro 플랜으로 업그레이드하고 모든 저장 한도를 해제하세요. 
            더 많은 기기 연결과 고급 보안 기능을 이용할 수 있습니다.
          </p>
          <ul className="space-y-2 mb-8 text-sm">
            <li className="flex items-center gap-2">
              <Check size={16} className="text-blue-300" /> 모든 항목 무제한 저장
            </li>
            <li className="flex items-center gap-2">
              <Check size={16} className="text-blue-300" /> 광고 없는 쾌적한 환경
            </li>
            <li className="flex items-center gap-2">
              <Check size={16} className="text-blue-300" /> 우선 고객 지원
            </li>
          </ul>
          <Link 
            href="/dashboard/subscription" 
            className="inline-block w-full text-center py-3 bg-white text-primary-600 rounded-xl font-bold hover:bg-primary-50 transition-colors"
          >
            업그레이드 알아보기
          </Link>
        </div>
      </div>
    </div>
  );
}