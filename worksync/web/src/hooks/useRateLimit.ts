'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { logger } from '@/lib/logger';

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
}

interface RateLimitState {
  attempts: number;
  blockedUntil: number | null;
  lastAttempt: number | null;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 60000, // 1분
  blockDurationMs: 300000, // 5분
};

/**
 * Rate Limiting Hook
 *
 * 사용 사례:
 * - 마스터 비밀번호 입력 시도 제한
 * - 로그인 시도 제한
 * - API 요청 제한
 *
 * 보안 기능:
 * - 일정 시간 내 최대 시도 횟수 제한
 * - 초과 시 일정 시간 동안 차단
 * - localStorage에 상태 저장하여 새로고침 후에도 유지
 */
export function useRateLimit(
  key: string,
  config: Partial<RateLimitConfig> = {}
) {
  const { maxAttempts, windowMs, blockDurationMs } = config;

  const fullConfig = useMemo(() => ({
    maxAttempts: maxAttempts ?? DEFAULT_CONFIG.maxAttempts,
    windowMs: windowMs ?? DEFAULT_CONFIG.windowMs,
    blockDurationMs: blockDurationMs ?? DEFAULT_CONFIG.blockDurationMs,
  }), [maxAttempts, windowMs, blockDurationMs]);

  const storageKey = `rate_limit_${key}`;

  const [state, setState] = useState<RateLimitState>(() => {
    if (typeof window === 'undefined') {
      return { attempts: 0, blockedUntil: null, lastAttempt: null };
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // 차단 시간이 지났으면 초기화
        if (parsed.blockedUntil && parsed.blockedUntil < Date.now()) {
          return { attempts: 0, blockedUntil: null, lastAttempt: null };
        }
        return parsed;
      }
    } catch (error) {
      logger.error('Rate limit state loading failed:', error);
    }

    return { attempts: 0, blockedUntil: null, lastAttempt: null };
  });

  // 상태를 localStorage에 저장
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      logger.error('Rate limit state saving failed:', error);
    }
  }, [state, storageKey]);

  // 차단 시간 확인
  const isBlocked = useCallback((): boolean => {
    if (!state.blockedUntil) return false;

    const now = Date.now();
    if (now < state.blockedUntil) {
      return true;
    }

    // 차단 시간이 지났으면 상태 초기화
    setState({ attempts: 0, blockedUntil: null, lastAttempt: null });
    return false;
  }, [state.blockedUntil]);

  // 남은 차단 시간 (밀리초)
  const getRemainingBlockTime = useCallback((): number => {
    if (!state.blockedUntil) return 0;
    const remaining = state.blockedUntil - Date.now();
    return Math.max(0, remaining);
  }, [state.blockedUntil]);

  // 시도 기록
  const recordAttempt = useCallback((): boolean => {
    const now = Date.now();

    // 이미 차단된 경우
    if (isBlocked()) {
      return false;
    }

    // 윈도우 시간이 지났으면 초기화
    if (state.lastAttempt && now - state.lastAttempt > fullConfig.windowMs) {
      setState({
        attempts: 1,
        blockedUntil: null,
        lastAttempt: now,
      });
      return true;
    }

    // 시도 횟수 증가
    const newAttempts = state.attempts + 1;

    // 최대 시도 횟수 초과
    if (newAttempts >= fullConfig.maxAttempts) {
      setState({
        attempts: newAttempts,
        blockedUntil: now + fullConfig.blockDurationMs,
        lastAttempt: now,
      });
      return false;
    }

    // 정상 시도 기록
    setState({
      attempts: newAttempts,
      blockedUntil: null,
      lastAttempt: now,
    });
    return true;

  }, [state, fullConfig, isBlocked]);

  // 초기화
  const reset = useCallback(() => {
    setState({ attempts: 0, blockedUntil: null, lastAttempt: null });
  }, []);

  return {
    isBlocked: isBlocked(),
    attempts: state.attempts,
    remainingAttempts: Math.max(0, fullConfig.maxAttempts - state.attempts),
    remainingBlockTimeMs: getRemainingBlockTime(),
    recordAttempt,
    reset,
  };
}
