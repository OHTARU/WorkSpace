'use client';

import { useState, useCallback } from 'react';
import { logger } from '@/lib/logger';

// 설정 상수
const SALT_LENGTH = 16;       // Salt 길이 (16바이트)
const IV_LENGTH = 12;         // AES-GCM IV 길이 (12바이트가 표준 권장)
const PBKDF2_ITERATIONS = 100000; // 키 파생 반복 횟수 (보안성 강화)

export interface EncryptedData {
  ciphertext: string; // 암호화된 데이터 (Base64)
  iv: string;         // 초기화 벡터 (Base64)
}

export interface ICryptoManager {
  encrypt: (plaintext: string) => Promise<EncryptedData | null>;
  decrypt: (encryptedBase64: string, ivBase64: string) => Promise<string | null>;
  unlock: (masterPassword: string, saltBase64: string, iterations?: number) => Promise<boolean>;
  lock: () => void;
  isUnlocked: () => boolean;
  generateSalt: () => string;
}

/**
 * [직접 구현] 빠르고 강력한 Web Crypto API 기반 암호화 훅
 * 
 * 외부 라이브러리 없이 브라우저 내장 API(window.crypto.subtle)를 직접 사용하여
 * 최고의 성능과 보안성을 제공합니다.
 */
export function useCrypto() {
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLocked, setIsLocked] = useState(true);

  // ==========================================
  // 1. 유틸리티 함수 (바이너리 <-> Base64 변환)
  // ==========================================

  // ArrayBuffer를 Base64 문자열로 변환
  const bufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Base64 문자열을 ArrayBuffer로 변환
  const base64ToBuffer = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  // 문자열을 UTF-8 바이트 배열로 변환
  const stringToBytes = (str: string): Uint8Array => {
    return new TextEncoder().encode(str);
  };

  // UTF-8 바이트 배열을 문자열로 변환
  const bytesToString = (bytes: ArrayBuffer): string => {
    return new TextDecoder().decode(bytes);
  };

  // ==========================================
  // 2. 핵심 암호화 로직 (Web Crypto API)
  // ==========================================

  /**
   * 랜덤 Salt 생성
   */
  const generateSalt = useCallback((): string => {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    return bufferToBase64(salt.buffer);
  }, []);

  /**
   * 키 파생 함수 (PBKDF2)
   * 사용자의 비밀번호로부터 강력한 암호화 키를 생성합니다.
   */
  const deriveKey = async (password: string, salt: Uint8Array, iterations: number = PBKDF2_ITERATIONS): Promise<CryptoKey> => {
    // 1. 비밀번호를 키 재료로 변환
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      stringToBytes(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    // 2. PBKDF2 알고리즘으로 AES-GCM 키 생성
    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 }, // AES-256 비트 키
      false, // 키 추출 불가 (메모리에서만 존재)
      ['encrypt', 'decrypt']
    );
  };

  /**
   * 마스터 비밀번호로 잠금 해제 (키 생성)
   */
  const unlock = useCallback(async (masterPassword: string, saltBase64: string, iterations?: number): Promise<boolean> => {
    try {
      const salt = base64ToBuffer(saltBase64);
      const key = await deriveKey(masterPassword, salt, iterations);

      setCryptoKey(key);
      setIsReady(true);
      setIsLocked(false);

      // 세션 스토리지에 플래그 설정 (새로고침 시 유지용 로직 등에서 사용 가능)
      sessionStorage.setItem('worksync_unlocked', 'true');

      return true;
    } catch (error) {
      logger.error('Unlock failed:', error);
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 잠금 (키 삭제)
   */
  const lock = useCallback(() => {
    setCryptoKey(null);
    setIsReady(false);
    setIsLocked(true);
    sessionStorage.removeItem('worksync_unlocked');
  }, []);

  const isUnlocked = useCallback((): boolean => {
    return cryptoKey !== null;
  }, [cryptoKey]);

  /**
   * 암호화 (AES-256-GCM)
   */
  const encrypt = useCallback(async (plaintext: string): Promise<EncryptedData | null> => {
    if (!cryptoKey) {
      logger.error('Encryption key is not set. Please unlock first.');
      return null;
    }

    try {
      // 1. 매번 새로운 랜덤 IV(초기화 벡터) 생성
      const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

      // 2. 암호화 수행
      const ciphertextBuffer = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        cryptoKey,
        stringToBytes(plaintext)
      );

      // 3. 결과 반환 (Base64 인코딩)
      return {
        ciphertext: bufferToBase64(ciphertextBuffer),
        iv: bufferToBase64(iv.buffer)
      };
    } catch (error) {
      logger.error('Encryption failed:', error);
      return null;
    }
  }, [cryptoKey]);

  /**
   * 복호화 (AES-256-GCM)
   */
  const decrypt = useCallback(async (encryptedBase64: string, ivBase64: string): Promise<string | null> => {
    if (!cryptoKey) {
      logger.error('Decryption key is not set. Please unlock first.');
      return null;
    }

    try {
      const encryptedData = base64ToBuffer(encryptedBase64);
      const iv = base64ToBuffer(ivBase64);

      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        cryptoKey,
        encryptedData
      );

      return bytesToString(decryptedBuffer);
    } catch (error) {
      // 복호화 실패 (비밀번호가 틀렸거나 데이터가 손상됨)
      logger.error('Decryption failed:', error);
      return null;
    }
  }, [cryptoKey]);

  /**
   * 비밀번호 검증용 (테스트 데이터를 복호화해봄으로써 검증)
   */
  const verifyMasterPassword = useCallback(async (
    masterPassword: string,
    saltBase64: string,
    testEncrypted: string,
    testIv: string,
    expectedValue: string
  ): Promise<boolean> => {
    try {
      const salt = base64ToBuffer(saltBase64);
      const tempKey = await deriveKey(masterPassword, salt); // 임시 키 생성

      const iv = base64ToBuffer(testIv);
      const encryptedData = base64ToBuffer(testEncrypted);

      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        tempKey,
        encryptedData
      );

      const decryptedText = bytesToString(decryptedBuffer);
      return decryptedText === expectedValue;
    } catch {
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    encrypt,
    decrypt,
    unlock,
    lock,
    isUnlocked,
    verifyMasterPassword,
    generateSalt,
    isReady,
    isLocked
  };
}