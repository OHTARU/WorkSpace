import 'react-native-get-random-values';
import 'text-encoding';
/**
 * 모바일용 AES-256-GCM 암호화/복호화 유틸리티
 *
 * @noble/ciphers와 @noble/hashes를 사용하여 순수 JS 환경(Expo Go)에서도
 * 동작하는 AES-256-GCM 암호화 및 PBKDF2 키 파생을 제공합니다.
 *
 * Web Crypto API와 호환되도록 구현되었습니다.
 */

import { gcm } from '@noble/ciphers/aes';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
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

function bufferToBase64(buffer: Uint8Array | ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
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
// 모바일 전용 CryptoManager (JS Implementation)
// Web Crypto API와 호환
// ============================================

export class CryptoManager implements ICryptoManager {
  private key: Uint8Array | null = null;

  /**
   * PBKDF2로 키 파생 (Standard - Web Crypto API 호환)
   * @noble/hashes 사용, password를 명시적으로 UTF-8 인코딩
   */
  private async deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
    try {
      // Web Crypto API와 동일하게 password를 UTF-8 바이트로 변환
      const passwordBytes = new TextEncoder().encode(password);
      const keyBuffer = pbkdf2(sha256, passwordBytes, salt, {
        c: PBKDF2_ITERATIONS,
        dkLen: 32
      });
      return keyBuffer;
    } catch (error) {
      console.error('Key derivation failed:', error);
      throw error;
    }
  }

  /**
   * 랜덤 Salt 생성 (Base64 문자열 반환)
   */
  generateSalt(): string {
    const salt = new Uint8Array(SALT_LENGTH);
    crypto.getRandomValues(salt);
    return bufferToBase64(salt);
  }

  /**
   * 마스터 비밀번호로 잠금 해제
   */
  unlock(masterPassword: string, saltBase64: string): Promise<boolean> {
    return new Promise((resolve) => {
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
        }, 50);
      });
    });
  }

  /**
   * Legacy unlock (호환성을 위해 유지, Standard와 동일)
   */
  unlockLegacy(masterPassword: string, saltBase64: string): Promise<boolean> {
    return this.unlock(masterPassword, saltBase64);
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
   * 암호화 (AES-256-GCM - Web Crypto API 호환)
   */
  encrypt(plaintext: string): Promise<EncryptedData | null> {
    return new Promise((resolve) => {
      const key = this.key;
      if (!key) {
        resolve(null);
        return;
      }

      requestAnimationFrame(() => {
        try {
          const iv = new Uint8Array(IV_LENGTH);
          crypto.getRandomValues(iv);

          const aes256 = gcm(key, iv);
          const plaintextBytes = new TextEncoder().encode(plaintext);

          // @noble/ciphers encrypt: ciphertext + authTag (Web Crypto API와 동일)
          const encryptedWithTag = aes256.encrypt(plaintextBytes);

          resolve({
            encrypted: bufferToBase64(encryptedWithTag),
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
   * 복호화 (AES-256-GCM - Web Crypto API 호환)
   */
  decrypt(encryptedBase64: string, ivBase64: string): Promise<string | null> {
    return new Promise((resolve) => {
      const key = this.key;
      if (!key) {
        resolve(null);
        return;
      }

      requestAnimationFrame(() => {
        try {
          const encryptedWithTag = base64ToBuffer(encryptedBase64);
          const iv = base64ToBuffer(ivBase64);

          const aes256 = gcm(key, iv);

          // @noble/ciphers decrypt: ciphertext + authTag (Web Crypto API와 동일)
          const decryptedBytes = aes256.decrypt(encryptedWithTag);
          const decrypted = new TextDecoder().decode(decryptedBytes);

          resolve(decrypted || null);
        } catch (error) {
          // Decryption failed (wrong key or corrupted data)
          console.error('Decryption failed:', error);
          resolve(null);
        }
      });
    });
  }
}

// 싱글톤 인스턴스 export
export const cryptoManager = new CryptoManager();

// 타입 export
export type { EncryptedData, ICryptoManager };
