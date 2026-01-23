/**
 * 조건부 로깅 유틸리티
 * 개발 환경에서만 로그를 출력합니다.
 */

import { env } from './env';

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

function shouldLog(): boolean {
  return env.IS_DEVELOPMENT;
}

function createLogger(level: LogLevel) {
  return (...args: unknown[]) => {
    if (shouldLog()) {
      console[level](...args);
    }
  };
}

export const logger = {
  log: createLogger('log'),
  info: createLogger('info'),
  warn: createLogger('warn'),
  error: createLogger('error'),
  debug: createLogger('debug'),
};

// 항상 로깅이 필요한 경우 (에러 바운더리, 크리티컬 에러 등)
export const criticalLogger = {
  error: (...args: unknown[]) => console.error(...args),
  warn: (...args: unknown[]) => console.warn(...args),
};
