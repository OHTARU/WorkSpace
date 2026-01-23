'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getStripe } from '@/lib/stripe/client';
import {
  Crown,
  Check,
  X,
  Sparkles,
  CreditCard,
  Calendar,
  AlertCircle,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { UsageBar } from '@/components/subscription/UsageBar';
import type { Plan, Subscription, UsageTracking, BillingCycle } from '@shared/types';

export default function SubscriptionPage() {
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [usage, setUsage] = useState<Record<string, UsageTracking>>({});
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');

  const supabase = createClient();

  useEffect(() => {
    // 결제 결과 처리
    if (searchParams.get('success') === 'true') {
      toast.success('구독이 성공적으로 완료되었습니다!');
    } else if (searchParams.get('canceled') === 'true') {
      toast.error('결제가 취소되었습니다.');
    }

    fetchData();
  }, [searchParams]);

  const fetchData = async () => {
    try {
      // 플랜 목록 조회
      const { data: plansData } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (plansData) {
        setPlans(plansData as Plan[]);
      }

      // 현재 구독 정보 조회
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('*, plan:plans(*)')
          .eq('user_id', user.id)
          .single();

        if (subData) {
          setSubscription(subData as unknown as Subscription);
          setCurrentPlan(subData.plan as Plan);
        }

        // 사용량 조회
        const { data: usageData } = await supabase
          .from('usage_tracking')
          .select('*')
          .eq('user_id', user.id);

        if (usageData) {
          const usageMap: Record<string, UsageTracking> = {};
          usageData.forEach((item) => {
            usageMap[item.feature] = item as UsageTracking;
          });
          setUsage(usageMap);
        }
      }
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    try {
      setCheckoutLoading(planId);

      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: planId,
          billing_cycle: billingCycle,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '결제 세션 생성에 실패했습니다.');
      }

      // Stripe Checkout으로 이동
      const stripe = await getStripe();
      if (stripe) {
        await stripe.redirectToCheckout({ sessionId: data.session_id });
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(
        error instanceof Error ? error.message : '결제 처리 중 오류가 발생했습니다.'
      );
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '포털 접속에 실패했습니다.');
      }

      window.location.href = data.url;
    } catch (error) {
      console.error('Portal error:', error);
      toast.error('결제 관리 페이지를 열 수 없습니다.');
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR').format(price);
  };

  const getYearlyDiscount = (monthly: number, yearly: number) => {
    const expectedYearly = monthly * 12;
    const discount = Math.round(((expectedYearly - yearly) / expectedYearly) * 100);
    return discount;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">구독 관리</h1>
      <p className="text-gray-600 mb-8">
        플랜을 업그레이드하여 더 많은 기능을 이용하세요.
      </p>

      {/* 현재 플랜 정보 */}
      {currentPlan && (
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  currentPlan.name === 'free'
                    ? 'bg-gray-100'
                    : currentPlan.name === 'pro'
                      ? 'bg-blue-100'
                      : 'bg-purple-100'
                }`}
              >
                <Crown
                  className={`w-6 h-6 ${
                    currentPlan.name === 'free'
                      ? 'text-gray-500'
                      : currentPlan.name === 'pro'
                        ? 'text-blue-500'
                        : 'text-purple-500'
                  }`}
                />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  현재 플랜: {currentPlan.display_name}
                </h2>
                <p className="text-sm text-gray-500">
                  {subscription?.status === 'active' ? (
                    subscription.current_period_end ? (
                      <>
                        다음 결제일:{' '}
                        {new Date(subscription.current_period_end).toLocaleDateString(
                          'ko-KR'
                        )}
                      </>
                    ) : (
                      '활성 구독'
                    )
                  ) : subscription?.status === 'past_due' ? (
                    <span className="text-red-500">결제 실패 - 결제 정보를 확인해주세요</span>
                  ) : (
                    '무료 플랜'
                  )}
                </p>
              </div>
            </div>
            {subscription?.stripe_customer_id && (
              <button
                onClick={handleManageSubscription}
                className="btn btn-secondary flex items-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                결제 관리
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* 사용량 현황 */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">사용량 현황</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UsageBar
                label="URL"
                current={usage['urls']?.current_count || 0}
                limit={currentPlan.limits.urls}
              />
              <UsageBar
                label="비밀번호"
                current={usage['passwords']?.current_count || 0}
                limit={currentPlan.limits.passwords}
              />
              <UsageBar
                label="프로젝트"
                current={usage['projects']?.current_count || 0}
                limit={currentPlan.limits.projects}
              />
              <UsageBar
                label="클립보드"
                current={usage['clipboards']?.current_count || 0}
                limit={currentPlan.limits.clipboards}
              />
            </div>
          </div>

          {subscription?.cancel_at_period_end && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-800 font-medium">
                  구독 취소가 예약되었습니다
                </p>
                <p className="text-sm text-yellow-600">
                  {subscription.current_period_end &&
                    `${new Date(subscription.current_period_end).toLocaleDateString('ko-KR')}까지 이용 가능합니다.`}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 결제 주기 선택 */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <button
          onClick={() => setBillingCycle('monthly')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            billingCycle === 'monthly'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          월간 결제
        </button>
        <button
          onClick={() => setBillingCycle('yearly')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            billingCycle === 'yearly'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          연간 결제
          <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
            최대 17% 할인
          </span>
        </button>
      </div>

      {/* 플랜 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrentPlan = currentPlan?.id === plan.id;
          const price =
            billingCycle === 'yearly' && plan.price_yearly
              ? plan.price_yearly
              : plan.price_monthly;
          const discount =
            billingCycle === 'yearly' && plan.price_yearly
              ? getYearlyDiscount(plan.price_monthly, plan.price_yearly)
              : 0;

          return (
            <div
              key={plan.id}
              className={`card relative ${
                plan.name === 'pro'
                  ? 'border-2 border-blue-500 shadow-lg'
                  : 'border border-gray-200'
              }`}
            >
              {plan.name === 'pro' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-blue-500 text-white text-xs font-medium px-3 py-1 rounded-full">
                    추천
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">{plan.display_name}</h3>
                <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-gray-900">
                    {plan.name === 'free' ? '무료' : `₩${formatPrice(price)}`}
                  </span>
                  {plan.name !== 'free' && (
                    <span className="text-gray-500">
                      /{billingCycle === 'yearly' ? '년' : '월'}
                    </span>
                  )}
                  {discount > 0 && (
                    <p className="text-sm text-green-600 mt-1">{discount}% 할인</p>
                  )}
                </div>
              </div>

              {/* 기능 목록 */}
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2 text-sm">
                  {plan.limits.urls === -1 ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <span className="w-5 h-5 text-center text-gray-400">
                      {plan.limits.urls}
                    </span>
                  )}
                  <span>URL 저장 {plan.limits.urls === -1 ? '무제한' : `${plan.limits.urls}개`}</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  {plan.limits.passwords === -1 ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <span className="w-5 h-5 text-center text-gray-400">
                      {plan.limits.passwords}
                    </span>
                  )}
                  <span>
                    비밀번호 저장 {plan.limits.passwords === -1 ? '무제한' : `${plan.limits.passwords}개`}
                  </span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  {plan.limits.projects === -1 ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <span className="w-5 h-5 text-center text-gray-400">
                      {plan.limits.projects}
                    </span>
                  )}
                  <span>
                    프로젝트 {plan.limits.projects === -1 ? '무제한' : `${plan.limits.projects}개`}
                  </span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <span className="w-5 h-5 text-center text-gray-400">
                    {plan.limits.devices === -1 ? '∞' : plan.limits.devices}
                  </span>
                  <span>
                    기기 연결 {plan.limits.devices === -1 ? '무제한' : `${plan.limits.devices}대`}
                  </span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  {plan.features.browser_extension ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <X className="w-5 h-5 text-gray-300" />
                  )}
                  <span className={!plan.features.browser_extension ? 'text-gray-400' : ''}>
                    브라우저 확장
                  </span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  {plan.features.file_sync ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <X className="w-5 h-5 text-gray-300" />
                  )}
                  <span className={!plan.features.file_sync ? 'text-gray-400' : ''}>
                    파일 동기화 ({plan.limits.file_storage_mb}MB)
                  </span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  {plan.features.ads_free ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <X className="w-5 h-5 text-gray-300" />
                  )}
                  <span className={!plan.features.ads_free ? 'text-gray-400' : ''}>
                    광고 제거
                  </span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  {plan.features.priority_support ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <X className="w-5 h-5 text-gray-300" />
                  )}
                  <span className={!plan.features.priority_support ? 'text-gray-400' : ''}>
                    우선 고객지원
                  </span>
                </li>
              </ul>

              {/* 버튼 */}
              {isCurrentPlan ? (
                <button disabled className="btn btn-secondary w-full">
                  현재 플랜
                </button>
              ) : plan.name === 'free' ? (
                <button disabled className="btn btn-secondary w-full">
                  기본 플랜
                </button>
              ) : (
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={checkoutLoading === plan.id}
                  className={`btn w-full flex items-center justify-center gap-2 ${
                    plan.name === 'pro' ? 'btn-primary' : 'btn-secondary'
                  }`}
                >
                  {checkoutLoading === plan.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      {currentPlan && currentPlan.sort_order < plan.sort_order
                        ? '업그레이드'
                        : '시작하기'}
                    </>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div className="mt-12">
        <h2 className="text-xl font-bold text-gray-900 mb-6">자주 묻는 질문</h2>
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-medium text-gray-900 mb-2">
              언제든지 플랜을 변경할 수 있나요?
            </h3>
            <p className="text-sm text-gray-600">
              네, 언제든지 플랜을 업그레이드하거나 다운그레이드할 수 있습니다. 업그레이드 시
              즉시 적용되며, 다운그레이드 시 현재 결제 기간이 끝날 때 적용됩니다.
            </p>
          </div>
          <div className="card">
            <h3 className="font-medium text-gray-900 mb-2">환불 정책은 어떻게 되나요?</h3>
            <p className="text-sm text-gray-600">
              결제 후 7일 이내에 요청하시면 전액 환불이 가능합니다. 그 이후에는 남은 기간에
              대해 비례 환불이 적용됩니다.
            </p>
          </div>
          <div className="card">
            <h3 className="font-medium text-gray-900 mb-2">
              구독을 취소하면 데이터는 어떻게 되나요?
            </h3>
            <p className="text-sm text-gray-600">
              구독을 취소해도 데이터는 삭제되지 않습니다. 무료 플랜의 제한을 초과하는 데이터는
              읽기 전용으로 유지되며, 다시 업그레이드하면 모든 기능을 사용할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
