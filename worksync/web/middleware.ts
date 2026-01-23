import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

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
