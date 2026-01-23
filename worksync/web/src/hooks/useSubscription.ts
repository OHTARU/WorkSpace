'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import type {
  Subscription,
  Plan,
  UsageTracking,
  PlanLimits,
  PlanFeatures,
  UserSubscriptionState,
} from '@shared/types';

interface UseSubscriptionReturn extends UserSubscriptionState {
  refetch: () => Promise<void>;
  checkLimit: (feature: keyof PlanLimits) => {
    allowed: boolean;
    current: number;
    limit: number;
    remaining: number;
  };
  hasFeature: (feature: keyof PlanFeatures) => boolean;
  isPro: boolean;
  isBusiness: boolean;
  isFree: boolean;
}

export function useSubscription(): UseSubscriptionReturn {
  const [state, setState] = useState<UserSubscriptionState>({
    subscription: null,
    plan: null,
    usage: {},
    isLoading: true,
    error: null,
  });

  const supabase = createBrowserClient();

  const fetchSubscription = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: '로그인이 필요합니다.',
        }));
        return;
      }

      // 구독 + 플랜 정보 조회
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select(`*, plan:plans(*)`)
        .eq('user_id', user.id)
        .single();

      if (subError) throw subError;

      // 사용량 조회
      const { data: usageData, error: usageError } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', user.id);

      if (usageError) throw usageError;

      // 사용량 매핑
      const usageMap: Record<string, UsageTracking> = {};
      usageData?.forEach((item) => {
        usageMap[item.feature] = item as UsageTracking;
      });

      setState({
        subscription: subscription as Subscription,
        plan: subscription?.plan as Plan,
        usage: usageMap,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Subscription fetch error:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: '구독 정보를 불러올 수 없습니다.',
      }));
    }
  }, [supabase]);

  useEffect(() => {
    fetchSubscription();

    // 실시간 구독 상태 변경 감지
    const channel = supabase
      .channel('subscription-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
        },
        () => {
          fetchSubscription();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'usage_tracking',
        },
        () => {
          fetchSubscription();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSubscription, supabase]);

  // 사용량 제한 체크
  const checkLimit = useCallback(
    (feature: keyof PlanLimits) => {
      const { plan, usage } = state;

      if (!plan) {
        return { allowed: false, current: 0, limit: 0, remaining: 0 };
      }

      const limit = plan.limits[feature] as number;
      const current = usage[feature]?.current_count || 0;

      // -1은 무제한
      if (limit === -1) {
        return { allowed: true, current, limit: -1, remaining: -1 };
      }

      return {
        allowed: current < limit,
        current,
        limit,
        remaining: Math.max(0, limit - current),
      };
    },
    [state]
  );

  // 기능 활성화 여부 확인
  const hasFeature = useCallback(
    (feature: keyof PlanFeatures) => {
      return state.plan?.features[feature] ?? false;
    },
    [state.plan]
  );

  return {
    ...state,
    refetch: fetchSubscription,
    checkLimit,
    hasFeature,
    isPro: state.plan?.name === 'pro',
    isBusiness: state.plan?.name === 'business',
    isFree: state.plan?.name === 'free' || !state.plan,
  };
}
