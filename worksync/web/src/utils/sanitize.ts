import DOMPurify from 'dompurify';
import { logger } from '@/lib/logger';

/**
 * XSS 방어를 위한 입력값 Sanitization 유틸리티
 *
 * 사용 사례:
 * - 사용자 입력 텍스트 정제
 * - HTML 콘텐츠 정제
 * - URL 검증
 */

/**
 * 기본 텍스트 Sanitization
 * HTML 태그 제거 및 특수 문자 이스케이프
 */
export function sanitizeText(input: string): string {
  if (!input) return '';

  // HTML 태그 제거
  const cleaned = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // 모든 태그 제거
    ALLOWED_ATTR: [], // 모든 속성 제거
  });

  // 추가 정제: 제어 문자 제거
  return cleaned.replace(/[\x00-\x1F\x7F]/g, '').trim();
}

/**
 * HTML 콘텐츠 Sanitization
 * 안전한 HTML 태그만 허용
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });
}

/**
 * SSRF 공격 방지를 위한 내부 IP 체크
 * 내부 네트워크 주소로의 요청을 차단
 */
function isInternalUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // localhost 및 루프백 주소
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.localhost')
    ) {
      return true;
    }

    // 사설 IP 대역 (RFC 1918)
    // 10.0.0.0 - 10.255.255.255
    // 172.16.0.0 - 172.31.255.255
    // 192.168.0.0 - 192.168.255.255
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);

    if (match) {
      const [, a, b, c, d] = match.map(Number);

      // 10.x.x.x
      if (a === 10) return true;

      // 172.16.x.x - 172.31.x.x
      if (a === 172 && b >= 16 && b <= 31) return true;

      // 192.168.x.x
      if (a === 192 && b === 168) return true;

      // 169.254.x.x (Link-local)
      if (a === 169 && b === 254) return true;

      // 127.x.x.x (Loopback)
      if (a === 127) return true;

      // 0.x.x.x
      if (a === 0) return true;

      // 유효하지 않은 IP 범위
      if (a > 255 || b > 255 || c > 255 || d > 255) return true;
    }

    // 내부 도메인 패턴
    const internalPatterns = [
      /^.*\.local$/,
      /^.*\.internal$/,
      /^.*\.corp$/,
      /^.*\.lan$/,
      /^.*\.intranet$/,
      /^metadata\.google\.internal$/,
      /^169\.254\.169\.254$/, // AWS/GCP metadata endpoint
    ];

    for (const pattern of internalPatterns) {
      if (pattern.test(hostname)) return true;
    }

    return false;
  } catch {
    // URL 파싱 실패 시 안전하게 차단
    return true;
  }
}

/**
 * URL Sanitization 및 검증
 * XSS 공격을 위한 javascript: 등의 프로토콜 차단
 * SSRF 공격을 위한 내부 IP/호스트 차단
 */
export function sanitizeUrl(url: string, options?: { allowInternal?: boolean }): string | null {
  if (!url) return null;

  const trimmed = url.trim();

  // 위험한 프로토콜 차단
  const dangerousProtocols = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'about:',
  ];

  const lowerUrl = trimmed.toLowerCase();
  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      logger.warn('Dangerous URL protocol detected:', protocol);
      return null;
    }
  }

  // 안전한 프로토콜만 허용
  const safeProtocols = ['http://', 'https://', 'mailto:', 'tel:'];
  const hasProtocol = safeProtocols.some(protocol =>
    lowerUrl.startsWith(protocol)
  );

  let finalUrl = trimmed;
  if (!hasProtocol && !trimmed.startsWith('/')) {
    // 프로토콜이 없으면 https:// 추가
    finalUrl = `https://${trimmed}`;
  }

  // SSRF 방지: 내부 IP/호스트 차단 (옵션으로 비활성화 가능)
  if (!options?.allowInternal && isInternalUrl(finalUrl)) {
    logger.warn('Internal URL detected (SSRF prevention):', finalUrl);
    return null;
  }

  return DOMPurify.sanitize(finalUrl, { ALLOWED_URI_REGEXP: /^https?:/ });
}

/**
 * URL이 내부 주소인지 확인하는 public 함수
 */
export function checkInternalUrl(url: string): boolean {
  return isInternalUrl(url);
}

/**
 * 이메일 Sanitization
 * 기본 이메일 형식 검증 및 정제
 */
export function sanitizeEmail(email: string): string | null {
  if (!email) return null;

  const cleaned = sanitizeText(email).toLowerCase();

  // 기본 이메일 형식 검증
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(cleaned)) {
    return null;
  }

  return cleaned;
}

/**
 * 파일명 Sanitization
 * 경로 순회 공격 방지 및 특수 문자 제거
 */
export function sanitizeFileName(fileName: string): string | null {
  if (!fileName) return null;

  // 경로 순회 공격 방지
  const cleaned = fileName.replace(/\.\.\//g, '').replace(/\\/g, '');

  // 안전한 문자만 허용 (영문, 숫자, 하이픈, 언더스코어, 점)
  const safeFileName = cleaned.replace(/[^a-zA-Z0-9._-]/g, '_');

  // 길이 제한 (255자)
  return safeFileName.substring(0, 255);
}

/**
 * 숫자 Sanitization
 * 숫자가 아닌 문자 제거 및 범위 검증
 */
export function sanitizeNumber(
  input: string | number,
  min?: number,
  max?: number
): number | null {
  const num = typeof input === 'number' ? input : parseFloat(input);

  if (isNaN(num) || !isFinite(num)) {
    return null;
  }

  if (min !== undefined && num < min) {
    return min;
  }

  if (max !== undefined && num > max) {
    return max;
  }

  return num;
}

/**
 * JSON Sanitization
 * JSON 파싱 및 안전성 검증
 */
export function sanitizeJson<T = any>(jsonString: string): T | null {
  try {
    const parsed = JSON.parse(jsonString);

    // 함수나 심볼 같은 위험한 타입 제거
    const sanitized = JSON.parse(JSON.stringify(parsed));

    return sanitized;
  } catch (error) {
    logger.error('JSON parsing failed:', error);
    return null;
  }
}

/**
 * SQL Injection 방지를 위한 문자열 이스케이프
 * (주의: 이것만으로는 불충분하며, Prepared Statement를 사용해야 함)
 */
export function escapeSql(input: string): string {
  if (!input) return '';

  return input
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x00/g, '\\0')
    .replace(/\x1a/g, '\\Z');
}

/**
 * 배치 Sanitization
 * 여러 입력값을 한 번에 정제
 */
export function sanitizeBatch<T extends Record<string, any>>(
  data: T,
  fieldTypes: Partial<Record<keyof T, 'text' | 'html' | 'url' | 'email' | 'number'>>
): Partial<T> {
  const sanitized: Partial<T> = {};

  for (const key in data) {
    const value = data[key];
    const type = fieldTypes[key] || 'text';

    switch (type) {
      case 'text':
        sanitized[key] = sanitizeText(String(value)) as T[Extract<keyof T, string>];
        break;
      case 'html':
        sanitized[key] = sanitizeHtml(String(value)) as T[Extract<keyof T, string>];
        break;
      case 'url':
        sanitized[key] = sanitizeUrl(String(value)) as T[Extract<keyof T, string>];
        break;
      case 'email':
        sanitized[key] = sanitizeEmail(String(value)) as T[Extract<keyof T, string>];
        break;
      case 'number':
        sanitized[key] = sanitizeNumber(value) as T[Extract<keyof T, string>];
        break;
      default:
        sanitized[key] = value;
    }
  }

  return sanitized;
}
