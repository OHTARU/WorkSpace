'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// 베타 버전: 모든 기능 무제한 사용 가능
// 출시 시 false로 변경
const BETA_MODE = false;

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

  const supabase = createClient();

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

      // 1. 플랜 정보 조회 (Free 플랜을 기본으로 가져옴)
      // 실제 구독 테이블(subscriptions) 조회가 실패하거나 없으면 Free 플랜 적용
      let currentPlan: Plan | null = null;
      let currentSubscription: Subscription | null = null;

      // DB에서 plan 정보 가져오기 시도 (subscriptions 테이블 연동이 되어 있다면)
      const { data: subData } = await supabase
        .from('subscriptions')
        .select(`*, plan:plans(*)`)
        .eq('user_id', user.id)
        .maybeSingle();

      if (subData) {
        currentSubscription = subData as unknown as Subscription;
        currentPlan = subData.plan as Plan;
      } else {
        // 구독 정보가 없으면 Free 플랜 정보 가져오기
        const { data: freePlan } = await supabase
          .from('plans')
          .select('*')
          .eq('name', 'free')
          .single();
          
        currentPlan = freePlan as Plan;
      }

      // 2. 사용량 조회
      const { data: usageData } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', user.id);

      // 사용량 매핑
      const usageMap: Record<string, UsageTracking> = {};
      usageData?.forEach((item) => {
        usageMap[item.feature] = item as UsageTracking;
      });

      // 베타 모드일 경우 플랜의 모든 제한을 무제한(-1)으로 설정
      const finalPlan = BETA_MODE && currentPlan 
        ? {
            ...currentPlan,
            limits: Object.keys(currentPlan.limits).reduce((acc, key) => ({
              ...acc,
              [key]: -1
            }), {} as PlanLimits)
          }
        : currentPlan;

      setState({
        subscription: currentSubscription,
        plan: finalPlan,
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
      const current = usage[feature]?.current_count || 0;

      // 베타 모드: 모든 기능 무제한
      if (BETA_MODE) {
        return { allowed: true, current, limit: -1, remaining: -1 };
      }

      // 플랜 정보가 로딩되지 않았으면 일단 차단 (안전하게)
      if (!plan) {
        return { allowed: false, current: 0, limit: 0, remaining: 0 };
      }

      const limit = (plan.limits[feature] ?? 0) as number;

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
      // 베타 모드: 모든 기능 활성화
      if (BETA_MODE) {
        return true;
      }
      return state.plan?.features[feature] ?? false;
    },
    [state.plan]
  );

  return {
    ...state,
    refetch: fetchSubscription,
    checkLimit,
    hasFeature,
    // 베타 모드: Pro 권한으로 취급
    isPro: BETA_MODE || state.plan?.name === 'pro',
    isBusiness: BETA_MODE || state.plan?.name === 'business',
    isFree: BETA_MODE ? false : (state.plan?.name === 'free' || !state.plan),
  };
}
