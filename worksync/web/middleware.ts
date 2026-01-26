import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// 간단한 인메모리 Rate Limiter (Edge Runtime 호환)
// 주의: 서버리스 환경에서는 인스턴스 간 상태가 공유되지 않으므로 완벽한 전역 제한은 아님.
// 하지만 단일 인스턴스에 대한 DoS 공격을 완화하는 데 도움됨.
const rateLimit = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1분
const RATE_LIMIT_MAX = 100; // 1분당 100회 요청

function checkRateLimit(ip: string) {
  const now = Date.now();
  const record = rateLimit.get(ip) || { count: 0, lastReset: now };

  if (now - record.lastReset > RATE_LIMIT_WINDOW) {
    record.count = 0;
    record.lastReset = now;
  }

  record.count++;
  rateLimit.set(ip, record);

  return record.count <= RATE_LIMIT_MAX;
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
    if (origin && host && !origin.includes(host)) {
      // 로컬 개발 환경(localhost) 예외 처리, Supabase Function 등 예외 필요 시 추가
      if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
         return new NextResponse(JSON.stringify({ message: 'Invalid Origin' }), { status: 403 });
      }
    }
  }

  // 2. Rate Limiting (API 요청에 대해)
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip = request.ip || 'unknown';
    if (!checkRateLimit(ip)) {
      return new NextResponse(JSON.stringify({ message: 'Too many requests' }), { 
        status: 429,
        headers: { 'Retry-After': '60' } 
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