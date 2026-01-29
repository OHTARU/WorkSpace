import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ============================================
// Rate Limiting 설정
// ============================================

// Upstash Redis 기반 Rate Limiter (서버리스 환경에서도 전역 상태 유지)
let ratelimit: Ratelimit | null = null;

// Upstash 환경 변수가 있으면 Redis 기반 rate limiter 사용
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'), // 1분당 100회
    analytics: true,
    prefix: 'worksync:ratelimit',
  });
}

// Fallback: 인메모리 Rate Limiter (Upstash 미설정 시)
const memoryRateLimit = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1분
const RATE_LIMIT_MAX = 100; // 1분당 100회 요청

function checkMemoryRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = memoryRateLimit.get(ip) || { count: 0, lastReset: now };

  if (now - record.lastReset > RATE_LIMIT_WINDOW) {
    record.count = 0;
    record.lastReset = now;
  }

  record.count++;
  memoryRateLimit.set(ip, record);

  return record.count <= RATE_LIMIT_MAX;
}

// 통합 Rate Limit 체크 함수
async function checkRateLimit(ip: string): Promise<{ success: boolean; remaining?: number }> {
  // Upstash Redis가 설정되어 있으면 사용
  if (ratelimit) {
    const result = await ratelimit.limit(ip);
    return { success: result.success, remaining: result.remaining };
  }

  // Fallback: 인메모리
  return { success: checkMemoryRateLimit(ip) };
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // 1. CSRF 보호: Origin 검증 (API 요청인 경우)
  if (request.nextUrl.pathname.startsWith('/api/') && request.method !== 'GET') {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');

    // Origin 헤더가 존재하고, Host와 다르면 차단 (CSRF 공격 가능성)
    if (origin && host) {
      try {
        const originUrl = new URL(origin);
        const isLocalDev = process.env.NODE_ENV === 'development' &&
          (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1');

                  // 프로덕션: 정확한 호스트 매칭 필요
                  // 개발: localhost 예외 허용
                  if (!isLocalDev && originUrl.host !== host) {
                    return new NextResponse(JSON.stringify({ message: 'Invalid Origin' }), {
                      status: 403,
                      headers: { 'Content-Type': 'application/json' }
                    });
                  }      } catch {
        // URL 파싱 실패 시 차단
        return new NextResponse(JSON.stringify({ message: 'Invalid Origin' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }

  // 2. Rate Limiting (API 요청에 대해)
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               request.ip ||
               'unknown';

    const { success, remaining } = await checkRateLimit(ip);

    if (!success) {
      return new NextResponse(JSON.stringify({ message: 'Too many requests' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
          'X-RateLimit-Remaining': '0'
        }
      });
    }
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // 세션 갱신 시도
  try {
    const { 
      data: { user }, 
      error,
    } = await supabase.auth.getUser();

    // 보호된 라우트 접근 제어
    const path = request.nextUrl.pathname;
    const isProtectedRoute = path.startsWith('/dashboard') || path.startsWith('/api/user');
    const isAuthRoute = path.startsWith('/login') || path.startsWith('/signup');

    // 1. 비로그인 상태로 보호된 페이지 접근 시 -> 로그인 페이지로
    if (isProtectedRoute && !user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // 2. 로그인 상태로 로그인/회원가입 페이지 접근 시 -> 대시보드로
    if (isAuthRoute && user) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // 토큰 에러가 발생했다면 (DB 초기화 등으로 인한 불일치)
    if (error) {
       // 쿠키를 지우고 로그인 페이지로 보낼 수도 있지만, 
       // 일단 getUser() 실패는 비로그인으로 간주되므로 위 로직에서 처리됨.
    }

  } catch (e) {
    // 예상치 못한 에러 발생 시 (토큰 파싱 에러 등)
    // 안전하게 로그인 페이지로 리다이렉트
    console.error('Middleware Auth Error:', e);
    const path = request.nextUrl.pathname;
    if (path.startsWith('/dashboard')) {
        return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};