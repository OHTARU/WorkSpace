/**
 * 환경변수 검증 및 타입 안전 접근
 * 필수 환경변수가 설정되지 않은 경우 명확한 에러 메시지를 제공합니다.
 */

function checkValue(value: string | undefined, key: string): string {
  if (!value) {
    throw new Error(
      `필수 환경변수 ${key}가 설정되지 않았습니다. .env.local 파일을 확인하세요.`
    );
  }
  return value;
}

// 환경변수 검증 (앱 시작 시 호출)
let envValidated = false;

export function validateEnv(): void {
  if (envValidated) return;

  const missing: string[] = [];
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push('NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  if (missing.length > 0) {
    throw new Error(
      `다음 필수 환경변수가 설정되지 않았습니다:\n${missing.map(k => `  - ${k}`).join('\n')}\n\n.env.local 파일을 확인하세요.`
    );
  }

  envValidated = true;
}

// 타입 안전한 환경변수 접근
export const env = {
  get SUPABASE_URL(): string {
    return checkValue(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL');
  },
  get SUPABASE_ANON_KEY(): string {
    return checkValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
  },
  get NODE_ENV(): string {
    return process.env.NODE_ENV || 'development';
  },
  get IS_DEVELOPMENT(): boolean {
    return this.NODE_ENV === 'development';
  },
  get IS_PRODUCTION(): boolean {
    return this.NODE_ENV === 'production';
  },
};
