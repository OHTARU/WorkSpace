/**
 * AES-256-GCM 암호화/복호화 공통 모듈
 *
 * 웹(Web Crypto API)과 모바일(@noble/ciphers)에서 공통으로 사용하는
 * 인터페이스, 상수, 유틸리티 함수를 제공합니다.
 *
 * [보안 주의사항]
 * 1. 마스터 키는 절대 서버나 DB에 저장하지 마세요.
 * 2. 마스터 키는 사용자의 비밀번호에서 PBKDF2로 파생하세요.
 * 3. 각 암호화마다 새로운 IV(초기화 벡터)를 생성해야 합니다.
 * 4. IV는 암호문과 함께 저장해도 안전합니다.
 */

// ============================================
// 공통 상수
// ============================================

/** Salt 길이 (256-bit) */
export const SALT_LENGTH = 32;

/** IV 길이 (GCM 권장: 12바이트) */
export const IV_LENGTH = 12;

/** PBKDF2 반복 횟수 (보안 강화) */
export const PBKDF2_ITERATIONS = 100000;

/** AES 키 길이 (256-bit) */
export const AES_KEY_LENGTH = 256;

// ============================================
// 공통 인터페이스
// ============================================

/** 암호화 결과 */
export interface EncryptedData {
  encrypted: string; // Base64 인코딩된 암호문
  iv: string;        // Base64 인코딩된 IV
}

/** 암호화 매니저 인터페이스 */
export interface ICryptoManager {
  /** 마스터 비밀번호로 잠금 해제 */
  unlock(masterPassword: string, saltBase64: string): Promise<boolean>;

  /** 잠금 */
  lock(): void;

  /** 잠금 해제 상태 확인 */
  isUnlocked(): boolean;

  /** 평문 암호화 */
  encrypt(plaintext: string): Promise<EncryptedData | null>;

  /** 암호문 복호화 */
  decrypt(encryptedBase64: string, ivBase64: string): Promise<string | null>;

  /** 랜덤 Salt 생성 (Base64 문자열 반환) */
  generateSalt(): string;
}

// ============================================
// 공통 유틸리티 함수
// ============================================

/**
 * 문자열을 Uint8Array로 변환
 */
export function stringToUint8Array(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

/**
 * Uint8Array를 문자열로 변환
 */
export function uint8ArrayToString(arr: Uint8Array): string {
  const decoder = new TextDecoder();
  return decoder.decode(arr);
}

/**
 * ArrayBuffer/Uint8Array를 Base64 문자열로 변환
 */
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Base64 문자열을 Uint8Array로 변환
 */
export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 랜덤 바이트 생성 (Salt용)
 * @param length 바이트 길이
 * @returns Base64 인코딩된 문자열
 */
export function generateRandomSaltBase64(length: number = SALT_LENGTH): string {
  const salt = crypto.getRandomValues(new Uint8Array(length));
  return bufferToBase64(salt);
}

/**
 * 랜덤 Salt 생성 (Uint8Array)
 */
export function generateSalt(length: number = SALT_LENGTH): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

// ============================================
// Web Crypto API 기반 함수 (브라우저 전용)
// ============================================

/**
 * PBKDF2로 키 파생 (Web Crypto API)
 */
export async function deriveKeyWebCrypto(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    stringToUint8Array(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * AES-256-GCM 암호화 (Web Crypto API)
 */
export async function encryptWebCrypto(
  plaintext: string,
  key: CryptoKey
): Promise<EncryptedData> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    stringToUint8Array(plaintext)
  );

  return {
    encrypted: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv),
  };
}

/**
 * AES-256-GCM 복호화 (Web Crypto API)
 */
export async function decryptWebCrypto(
  encryptedBase64: string,
  ivBase64: string,
  key: CryptoKey
): Promise<string> {
  const encryptedBuffer = base64ToBuffer(encryptedBase64);
  const iv = base64ToBuffer(ivBase64);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedBuffer
  );

  return uint8ArrayToString(new Uint8Array(decryptedBuffer));
}

// ============================================
// 레거시 호환 함수 (기존 코드 지원)
// ============================================

/** @deprecated deriveKeyWebCrypto 사용 권장 */
export const deriveKey = deriveKeyWebCrypto;

/** @deprecated encryptWebCrypto 사용 권장 */
export async function encrypt(
  plaintext: string,
  key: CryptoKey
): Promise<EncryptedData> {
  return encryptWebCrypto(plaintext, key);
}

/** @deprecated decryptWebCrypto 사용 권장 */
export async function decrypt(
  encryptedBase64: string,
  ivBase64: string,
  key: CryptoKey
): Promise<string> {
  return decryptWebCrypto(encryptedBase64, ivBase64, key);
}

/**
 * 마스터 키 생성 및 저장을 위한 헬퍼
 * @deprecated 직접 deriveKeyWebCrypto와 generateSalt 사용 권장
 */
export async function generateMasterKey(): Promise<{
  key: CryptoKey;
  salt: string;
}> {
  const salt = generateSalt();
  const randomPassword = bufferToBase64(crypto.getRandomValues(new Uint8Array(32)));
  const key = await deriveKeyWebCrypto(randomPassword, salt);

  return {
    key,
    salt: bufferToBase64(salt),
  };
}
