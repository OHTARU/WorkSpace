import 'react-native-get-random-values';
/**
 * 모바일용 AES-256-GCM 암호화/복호화 유틸리티
 *
 * @noble/ciphers를 사용하여 Web Crypto API와 호환되는
 * AES-256-GCM 암호화를 제공합니다.
 *
 * shared/utils/crypto.ts의 공통 상수와 인터페이스를 사용합니다.
 */

import { gcm } from '@noble/ciphers/aes';
import { randomBytes } from '@noble/ciphers/webcrypto';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha2';
import * as Crypto from 'expo-crypto';
import { InteractionManager } from 'react-native';

// 공통 상수 (shared/utils/crypto.ts와 동일)
const SALT_LENGTH = 32;
const IV_LENGTH = 12;
const PBKDF2_ITERATIONS = 100000;

// 공통 인터페이스 (shared/utils/crypto.ts와 동일)
interface EncryptedData {
  encrypted: string;
  iv: string;
}

interface ICryptoManager {
  unlock(masterPassword: string, saltBase64: string): Promise<boolean>;
  unlockLegacy(masterPassword: string, saltBase64: string): Promise<boolean>;
  lock(): void;
  isUnlocked(): boolean;
  encrypt(plaintext: string): Promise<EncryptedData | null>;
  decrypt(encryptedBase64: string, ivBase64: string): Promise<string | null>;
  generateSalt(): string;
}

// ============================================
// 공통 유틸리티 함수 (shared와 동일)
// ============================================

function stringToUint8Array(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(str);
}

function uint8ArrayToString(arr: Uint8Array): string {
  const decoder = new TextDecoder();
  return decoder.decode(arr);
}

function bufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ============================================
// 모바일 전용 CryptoManager
// ============================================

export class CryptoManager implements ICryptoManager {
  private key: Uint8Array | null = null;

  /**
   * PBKDF2로 키 파생 (Standard - Web Crypto 호환)
   */
  private async deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
    try {
      // @noble/hashes pbkdf2 사용 (Sync이지만 호환성 보장)
      const key = pbkdf2(sha256, password, salt, {
        c: PBKDF2_ITERATIONS,
        dkLen: 32
      });
      return key;
    } catch (error) {
      console.error('Key derivation failed:', error);
      throw error;
    }
  }

  /**
   * PBKDF2로 키 파생 (Legacy - 이전 버전 버그 호환용)
   * 잘못 구현된 커스텀 루프 방식
   */
  private async deriveKeyLegacy(password: string, salt: Uint8Array): Promise<Uint8Array> {
    try {
      // expo-crypto의 PBKDF2 사용
      const key = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        password + bufferToBase64(salt),
        { encoding: Crypto.CryptoEncoding.HEX }
      );

      // Hex 문자열을 Uint8Array로 변환 (32 bytes = 256 bits)
      const keyBytes = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        keyBytes[i] = parseInt(key.substr(i * 2, 2), 16);
      }

      // 추가 반복을 위해 PBKDF2 시뮬레이션
      let derivedKey = keyBytes;
      for (let i = 0; i < PBKDF2_ITERATIONS / 1000; i++) {
        const combined = new Uint8Array(derivedKey.length + salt.length);
        combined.set(derivedKey);
        combined.set(salt, derivedKey.length);

        const hash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          bufferToBase64(combined),
          { encoding: Crypto.CryptoEncoding.HEX }
        );

        for (let j = 0; j < 32; j++) {
          derivedKey[j] = parseInt(hash.substr(j * 2, 2), 16);
        }
      }

      return derivedKey;
    } catch (error) {
      console.error('Key derivation failed:', error);
      throw error;
    }
  }

  /**
   * 랜덤 Salt 생성 (Base64 문자열 반환)
   */
  generateSalt(): string {
    const salt = randomBytes(SALT_LENGTH);
    return bufferToBase64(salt);
  }

  /**
   * 마스터 비밀번호로 잠금 해제 (Standard)
   */
  unlock(masterPassword: string, saltBase64: string): Promise<boolean> {
    return new Promise((resolve) => {
      // UI 인터랙션이 완료된 후 실행
      InteractionManager.runAfterInteractions(() => {
        setTimeout(async () => {
          try {
            const salt = base64ToBuffer(saltBase64);
            this.key = await this.deriveKey(masterPassword, salt);
            resolve(true);
          } catch (error) {
            console.error('Crypto unlock failed:', error);
            resolve(false);
          }
        }, 100);
      });
    });
  }

  /**
   * 마스터 비밀번호로 잠금 해제 (Legacy)
   */
  unlockLegacy(masterPassword: string, saltBase64: string): Promise<boolean> {
    return new Promise((resolve) => {
      // UI 인터랙션이 완료된 후 실행
      InteractionManager.runAfterInteractions(() => {
        setTimeout(async () => {
          try {
            const salt = base64ToBuffer(saltBase64);
            this.key = await this.deriveKeyLegacy(masterPassword, salt);
            resolve(true);
          } catch (error) {
            console.error('Crypto unlock legacy failed:', error);
            resolve(false);
          }
        }, 100);
      });
    });
  }

  /**
   * 잠금
   */
  lock(): void {
    this.key = null;
  }

  /**
   * 잠금 해제 상태 확인
   */
  isUnlocked(): boolean {
    return this.key !== null;
  }

  /**
   * 암호화 (AES-256-GCM)
   */
  encrypt(plaintext: string): Promise<EncryptedData | null> {
    return new Promise((resolve) => {
      if (!this.key) {
        resolve(null);
        return;
      }

      requestAnimationFrame(() => {
        try {
          const iv = randomBytes(IV_LENGTH);
          const aesGcm = gcm(this.key!, iv);
          const plainBytes = stringToUint8Array(plaintext);
          const encrypted = aesGcm.encrypt(plainBytes);

          resolve({
            encrypted: bufferToBase64(encrypted),
            iv: bufferToBase64(iv)
          });
        } catch (error) {
          console.error('Encryption failed:', error);
          resolve(null);
        }
      });
    });
  }

  /**
   * 복호화 (AES-256-GCM)
   */
  decrypt(encryptedBase64: string, ivBase64: string): Promise<string | null> {
    return new Promise((resolve) => {
      if (!this.key) {
        resolve(null);
        return;
      }

      requestAnimationFrame(() => {
        try {
          const encrypted = base64ToBuffer(encryptedBase64);
          const iv = base64ToBuffer(ivBase64);
          const aesGcm = gcm(this.key!, iv);
          const decrypted = aesGcm.decrypt(encrypted);
          const result = uint8ArrayToString(decrypted);
          resolve(result || null);
        } catch (error) {
          // Decryption failed (wrong key or corrupted data).
          // This is expected during migration checks.
          resolve(null);
        }
      });
    });
  }
}

// 싱글톤 인스턴스 export
export const cryptoManager = new CryptoManager();

// 타입 export (다른 곳에서 사용할 수 있도록)
export type { EncryptedData, ICryptoManager };
