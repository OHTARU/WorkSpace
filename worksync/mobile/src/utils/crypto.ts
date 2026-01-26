import 'react-native-get-random-values';
import 'text-encoding';
/**
 * 모바일용 AES-256-GCM 암호화/복호화 유틸리티
 *
 * @noble/ciphers와 @noble/hashes를 사용하여 순수 JS 환경(Expo Go)에서도
 * 동작하는 AES-256-GCM 암호화 및 PBKDF2 키 파생을 제공합니다.
 *
 * shared/utils/crypto.ts의 공통 상수와 인터페이스를 사용합니다.
 */

import { gcm } from '@noble/ciphers/aes';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
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
// ============================================

export class CryptoManager implements ICryptoManager {
  private key: Uint8Array | null = null;

  /**
   * PBKDF2로 키 파생 (Standard - JS)
   * @noble/hashes 사용
   */
  private async deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
    try {
      // pbkdf2는 동기적으로 동작하지만 InteractionManager로 감싸서 실행되므로
      // UI 블로킹을 최소화할 수 있음.
      const keyBuffer = pbkdf2(sha256, password, salt, { c: PBKDF2_ITERATIONS, dkLen: 32 });
      return keyBuffer;
    } catch (error) {
      console.error('Key derivation failed:', error);
      throw error;
    }
  }

  /**
   * PBKDF2로 키 파생 (Legacy - 이전 버전 버그 호환용)
   * 잘못 구현된 커스텀 루프 방식 (속도 개선 불가능, 마이그레이션용)
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
    const salt = new Uint8Array(SALT_LENGTH);
    crypto.getRandomValues(salt);
    return bufferToBase64(salt);
  }

  /**
   * 마스터 비밀번호로 잠금 해제 (Standard)
   */
  unlock(masterPassword: string, saltBase64: string): Promise<boolean> {
    return new Promise((resolve) => {
      // UI 렌더링을 차단하지 않도록 InteractionManager 사용
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
        }, 50); // 딜레이 단축
      });
    });
  }

  /**
   * 마스터 비밀번호로 잠금 해제 (Legacy)
   */
  unlockLegacy(masterPassword: string, saltBase64: string): Promise<boolean> {
    return new Promise((resolve) => {
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
   * 암호화 (AES-256-GCM - JS)
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
          
          // @noble/ciphers encrypt returns ciphertext + authTag (concatenated)
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
   * 복호화 (AES-256-GCM - JS)
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
          
          // @noble/ciphers decrypt expects ciphertext + authTag
          const decryptedBytes = aes256.decrypt(encryptedWithTag);
          const decrypted = new TextDecoder().decode(decryptedBytes);

          resolve(decrypted || null);
        } catch (error) {
          // Decryption failed (wrong key or corrupted data).
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
