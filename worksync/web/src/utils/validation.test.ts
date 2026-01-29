import { describe, it, expect } from 'vitest';
import { validateMasterPassword } from '@shared/utils/validation';

describe('validateMasterPassword', () => {
  it('should return isValid: true for a valid strong password', () => {
    const result = validateMasterPassword('Password123!');
    expect(result.isValid).toBe(true);
  });

  it('should return isValid: false for a password shorter than 8 characters', () => {
    const result = validateMasterPassword('Pass1!');
    expect(result.isValid).toBe(false);
    expect(result.message).toContain('8자 이상');
  });

  it('should return isValid: false if uppercase letter is missing', () => {
    const result = validateMasterPassword('password123!');
    expect(result.isValid).toBe(false);
    expect(result.message).toContain('대문자');
  });

  it('should return isValid: false if lowercase letter is missing', () => {
    const result = validateMasterPassword('PASSWORD123!');
    expect(result.isValid).toBe(false);
    expect(result.message).toContain('소문자');
  });

  it('should return isValid: false if number is missing', () => {
    const result = validateMasterPassword('Password!');
    expect(result.isValid).toBe(false);
    expect(result.message).toContain('숫자');
  });

  it('should return isValid: false if special character is missing', () => {
    const result = validateMasterPassword('Password123');
    expect(result.isValid).toBe(false);
    expect(result.message).toContain('특수문자');
  });

  it('should accept different types of special characters', () => {
    const specialChars = ['@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+', '=', '-', '{', '}', '[', ']', '|', ':', ';', '"', "'", '<', '>', ',', '.', '?', '/'];
    specialChars.forEach(char => {
      const result = validateMasterPassword(`Password123${char}`);
      expect(result.isValid).toBe(true);
    });
  });
});
