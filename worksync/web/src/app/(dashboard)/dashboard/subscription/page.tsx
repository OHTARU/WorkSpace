'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Check, Loader2, AlertCircle } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { useSearchParams } from 'next/navigation';
import type { Plan } from '@shared/types';

export default function SubscriptionPage() {
  const { plan: currentPlan, subscription, isLoading, refetch } = useSubscription();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const supabase = createClient();
  const searchParams = useSearchParams();

  // 결과 메시지 처리
  useEffect(() => {
    if (searchParams.get('success')) {
      toast.success('구독이 성공적으로 완료되었습니다!');
      refetch();
    } else if (searchParams.get('canceled')) {
      toast.error('구독 결제가 취소되었습니다.');
    }
  }, [searchParams, refetch]);

  // 플랜 목록 가져오기
  useEffect(() => {
    async function fetchPlans() {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) {
        console.error('Error fetching plans:', error);
      } else {
        setPlans(data || []);
      }
      setLoadingPlans(false);
    }
    fetchPlans();
  }, [supabase]);

  const handleCheckout = async (priceId: string | null, planName: string) => {
    if (!priceId) {
      toast.error('이 플랜은 현재 직접 결제할 수 없습니다.');
      return;
    }

    setCheckoutLoading(planName);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '결제 세션 생성에 실패했습니다.');
      }

      // Stripe Checkout 페이지로 리다이렉트
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message);
    } finally {
      setCheckoutLoading(null);
    }
  };

  if (isLoading || loadingPlans) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          구독 관리
        </h1>
        <p className="text-gray-600 text-lg">
          WorkSync의 모든 기능을 제한 없이 이용하고 생산성을 높이세요.
        </p>
      </div>

      {subscription && (
        <div className="mb-12 p-6 bg-primary-50 border border-primary-100 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold text-primary-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary-600" />
              현재 {currentPlan?.display_name} 플랜을 이용 중입니다
            </h2>
            <p className="text-primary-700 mt-1">
              다음 결제일: {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('ko-KR') : '정보 없음'}
            </p>
          </div>
          <div className="flex gap-3">
            {/* 여기에 Stripe Portal 연결 버튼 등을 추가할 수 있음 */}
            <span className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg">
              활성 상태
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {plans.map((plan) => {
          const isCurrent = currentPlan?.id === plan.id;
          const isFree = plan.name === 'free';
          
          return (
            <div 
              key={plan.id} 
              className={`card relative flex flex-col ${
                isCurrent ? 'border-2 border-primary-500 shadow-xl' : 'hover:shadow-md transition-shadow'
              }`}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    현재 이용 중
                  </span>
                </div>
              )}
              
              <div className="text-center mb-8 pt-4">
                <h3 className="text-xl font-bold text-gray-900">{plan.display_name}</h3>
                <p className="text-sm text-gray-500 mt-2 min-h-[40px]">{plan.description}</p>
                <div className="mt-6">
                  <span className="text-4xl font-bold text-gray-900">
                    ₩{plan.price_monthly.toLocaleString()}
                  </span>
                  <span className="text-gray-500 ml-1">/월</span>
                </div>
              </div>

              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900 mb-4 px-2">포함된 기능:</h4>
                <ul className="space-y-4 mb-8">
                  {Object.entries((plan.features as unknown as Record<string, boolean>) || {}).map(([key, value]) => (
                    value && (
                      <li key={key} className="flex items-start gap-3">
                        <div className="p-0.5 rounded-full bg-green-100 text-green-600 mt-0.5">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-sm text-gray-700">
                          {key === 'url_sync' ? 'URL 실시간 동기화' : 
                           key === 'password_manager' ? '보안 비밀번호 관리' : 
                           key}
                        </span>
                      </li>
                    )
                  ))}
                  {/* 제한 정보 표시 */}
                  <li className="flex items-start gap-3">
                    <div className="p-0.5 rounded-full bg-blue-100 text-blue-600 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm text-gray-700">
                      URL 저장: {plan.limits.urls === -1 ? '무제한' : `${plan.limits.urls}개`}
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="p-0.5 rounded-full bg-blue-100 text-blue-600 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm text-gray-700">
                      비밀번호 저장: {plan.limits.passwords === -1 ? '무제한' : `${plan.limits.passwords}개`}
                    </span>
                  </li>
                </ul>
              </div>

              <button 
                onClick={() => handleCheckout(plan.stripe_price_id_monthly, plan.name)}
                disabled={isCurrent || isFree || checkoutLoading === plan.name}
                className={`w-full py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                  isCurrent 
                    ? 'bg-gray-100 text-gray-400 cursor-default' 
                    : isFree
                    ? 'bg-gray-100 text-gray-600 cursor-default'
                    : 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-200 active:transform active:scale-[0.98]'
                }`}
              >
                {checkoutLoading === plan.name ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isCurrent ? (
                  '이용 중'
                ) : isFree ? (
                  '기본 플랜'
                ) : (
                  '업그레이드 하기'
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-16 p-6 bg-yellow-50 border border-yellow-100 rounded-2xl flex gap-4 items-start max-w-3xl mx-auto">
        <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-yellow-900">구독 안내 사항</h4>
          <ul className="text-sm text-yellow-800 mt-2 space-y-1 list-disc list-inside">
            <li>결제는 Stripe를 통해 안전하게 진행됩니다.</li>
            <li>구독 취소는 언제든지 가능하며, 결제된 기간까지는 기능이 유지됩니다.</li>
            <li>플랜 변경 시 즉시 반영되며, 차액은 Stripe 정책에 따라 처리됩니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}