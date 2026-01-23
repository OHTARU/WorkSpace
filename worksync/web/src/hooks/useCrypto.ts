'use client';

import { useState, useCallback } from 'react';
import {
  SALT_LENGTH,
  IV_LENGTH,
  PBKDF2_ITERATIONS,
  type EncryptedData,
  type ICryptoManager,
  bufferToBase64,
  base64ToBuffer,
  stringToUint8Array,
  uint8ArrayToString,
  deriveKeyWebCrypto,
  encryptWebCrypto,
  decryptWebCrypto,
} from '@shared/utils/crypto';
import { logger } from '@/lib/logger';

/**
 * 마스터 비밀번호 기반 암호화 키 관리 훅
 *
 * Web Crypto API를 사용하여 AES-256-GCM 암호화를 수행합니다.
 * shared/utils/crypto.ts의 공통 모듈을 사용합니다.
 */

export function useCrypto(): ICryptoManager & {
  verifyMasterPassword: (
    masterPassword: string,
    saltBase64: string,
    testEncrypted: string,
    testIv: string,
    expectedValue: string
  ) => Promise<boolean>;
  isReady: boolean;
  isLocked: boolean;
} {
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLocked, setIsLocked] = useState(true);

  /**
   * 랜덤 Salt 생성 (Base64 문자열)
   */
  const generateSalt = useCallback((): string => {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    return bufferToBase64(salt.buffer);
  }, []);

  /**
   * 마스터 비밀번호로 암호화 키 초기화
   */
  const unlock = useCallback(async (masterPassword: string, saltBase64: string): Promise<boolean> => {
    try {
      const salt = base64ToBuffer(saltBase64);
      const key = await deriveKeyWebCrypto(masterPassword, salt);

      setCryptoKey(key);
      setIsReady(true);
      setIsLocked(false);

      sessionStorage.setItem('worksync_unlocked', 'true');

      return true;
    } catch (error) {
      logger.error('Crypto unlock failed:', error);
      return false;
    }
  }, []);

  /**
   * 암호화 잠금
   */
  const lock = useCallback(() => {
    setCryptoKey(null);
    setIsReady(false);
    setIsLocked(true);
    sessionStorage.removeItem('worksync_unlocked');
  }, []);

  /**
   * 잠금 해제 상태 확인
   */
  const isUnlocked = useCallback((): boolean => {
    return cryptoKey !== null;
  }, [cryptoKey]);

  /**
   * 마스터 비밀번호 검증
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
      const key = await deriveKeyWebCrypto(masterPassword, salt);

      const decrypted = await decryptWebCrypto(testEncrypted, testIv, key);
      return decrypted === expectedValue;
    } catch {
      return false;
    }
  }, []);

  /**
   * 평문 암호화 (AES-256-GCM)
   */
  const encrypt = useCallback(async (plaintext: string): Promise<EncryptedData | null> => {
    if (!cryptoKey) return null;

    try {
      return await encryptWebCrypto(plaintext, cryptoKey);
    } catch (error) {
      logger.error('Encryption failed:', error);
      return null;
    }
  }, [cryptoKey]);

  /**
   * 암호문 복호화 (AES-256-GCM)
   */
  const decrypt = useCallback(async (encryptedBase64: string, ivBase64: string): Promise<string | null> => {
    if (!cryptoKey) return null;

    try {
      return await decryptWebCrypto(encryptedBase64, ivBase64, cryptoKey);
    } catch (error) {
      logger.error('Decryption failed:', error);
      return null;
    }
  }, [cryptoKey]);

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
