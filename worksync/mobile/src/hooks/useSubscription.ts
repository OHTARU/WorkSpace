import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Plan {
  id: string;
  name: string;
  display_name: string;
  limits: {
    urls: number;
    passwords: number;
    projects: number;
    clipboards: number;
    devices: number;
    clipboard_history_days: number;
    file_storage_mb: number;
  };
  features: Record<string, boolean>;
}

interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  plan?: Plan;
}

interface UsageTracking {
  feature: string;
  current_count: number;
}

interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
}

interface UseSubscriptionReturn {
  plan: Plan | null;
  subscription: Subscription | null;
  usage: Record<string, UsageTracking>;
  isLoading: boolean;
  error: string | null;
  checkLimit: (feature: string) => LimitCheckResult;
  hasFeature: (feature: string) => boolean;
  refetch: () => Promise<void>;
  isPro: boolean;
  isBusiness: boolean;
  isFree: boolean;
}

export function useSubscription(): UseSubscriptionReturn {
  const { user } = useAuth();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Record<string, UsageTracking>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // 1. 구독 정보 조회
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('*, plan:plans(*)')
        .eq('user_id', user.id)
        .single();

      let currentPlan: Plan | null = null;
      let currentSubscription: Subscription | null = null;

      if (subData?.plan) {
        currentSubscription = subData as unknown as Subscription;
        currentPlan = subData.plan as Plan;
      } else {
        // Free 플랜 기본 적용
        const { data: freePlan } = await supabase
          .from('plans')
          .select('*')
          .eq('name', 'free')
          .single();

        if (freePlan) {
          currentPlan = freePlan as Plan;
        }
      }

      // 2. 사용량 조회
      const { data: usageData } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', user.id);

      const usageMap: Record<string, UsageTracking> = {};
      usageData?.forEach((item) => {
        usageMap[item.feature] = item;
      });

      setPlan(currentPlan);
      setSubscription(currentSubscription);
      setUsage(usageMap);
    } catch (err) {
      console.error('Subscription fetch error:', err);
      setError('구독 정보를 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();

    // Realtime 구독 상태 변경 감지
    if (user) {
      const channel = supabase
        .channel('subscription-changes-mobile')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'usage_tracking',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchSubscription();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchSubscription, user]);

  // 제한 체크 함수
  const checkLimit = useCallback(
    (feature: string): LimitCheckResult => {
      if (!plan) {
        return { allowed: false, current: 0, limit: 0, remaining: 0 };
      }

      const limit = plan.limits[feature as keyof typeof plan.limits] ?? 0;
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
    [plan, usage]
  );

  // 기능 활성화 여부 확인
  const hasFeature = useCallback(
    (feature: string): boolean => {
      return plan?.features[feature] ?? false;
    },
    [plan]
  );

  return {
    plan,
    subscription,
    usage,
    isLoading,
    error,
    checkLimit,
    hasFeature,
    refetch: fetchSubscription,
    isPro: plan?.name === 'pro',
    isBusiness: plan?.name === 'business',
    isFree: plan?.name === 'free' || !plan,
  };
}
