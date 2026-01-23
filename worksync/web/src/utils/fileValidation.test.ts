import { describe, it, expect } from 'vitest';
import { validateImageFile, validateFile, formatFileSize } from './fileValidation';

describe('파일 검증 유틸리티', () => {
  // Mock File 생성 헬퍼
  function createMockFile(
    name: string,
    size: number,
    type: string
  ): File {
    const blob = new Blob(['x'.repeat(size)], { type });
    return new File([blob], name, { type });
  }

  describe('validateImageFile', () => {
    it('10MB 이하 이미지 파일은 통과', () => {
      const file = createMockFile('test.jpg', 5 * 1024 * 1024, 'image/jpeg'); // 5MB

      const result = validateImageFile(file);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('정확히 10MB 이미지 파일은 통과', () => {
      const file = createMockFile('test.png', 10 * 1024 * 1024, 'image/png'); // 10MB

      const result = validateImageFile(file);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('10MB 초과 이미지 파일은 거부', () => {
      const file = createMockFile('test.jpg', 11 * 1024 * 1024, 'image/jpeg'); // 11MB

      const result = validateImageFile(file);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('파일 크기가 너무 큽니다');
      expect(result.error).toContain('10.0MB');
    });

    it('지원하는 이미지 타입: JPEG', () => {
      const file = createMockFile('test.jpg', 1024, 'image/jpeg');

      const result = validateImageFile(file);

      expect(result.valid).toBe(true);
    });

    it('지원하는 이미지 타입: PNG', () => {
      const file = createMockFile('test.png', 1024, 'image/png');

      const result = validateImageFile(file);

      expect(result.valid).toBe(true);
    });

    it('지원하는 이미지 타입: GIF', () => {
      const file = createMockFile('test.gif', 1024, 'image/gif');

      const result = validateImageFile(file);

      expect(result.valid).toBe(true);
    });

    it('지원하는 이미지 타입: WebP', () => {
      const file = createMockFile('test.webp', 1024, 'image/webp');

      const result = validateImageFile(file);

      expect(result.valid).toBe(true);
    });

    it('지원하지 않는 파일 타입은 거부', () => {
      const file = createMockFile('test.txt', 1024, 'text/plain');

      const result = validateImageFile(file);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('지원하지 않는 파일 형식');
    });

    it('잘못된 확장자는 거부', () => {
      const file = createMockFile('test.exe', 1024, 'image/jpeg');

      const result = validateImageFile(file);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('지원하지 않는 파일 확장자');
    });

    it('빈 파일은 거부', () => {
      const file = createMockFile('test.jpg', 0, 'image/jpeg');

      const result = validateImageFile(file);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('빈 파일');
    });
  });

  describe('보안 검증', () => {
    it('경로 순회 공격 방지: ../ 포함', () => {
      const file = createMockFile('../test.jpg', 1024, 'image/jpeg');

      const result = validateImageFile(file);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('파일명이 올바르지 않습니다');
    });

    it('경로 순회 공격 방지: / 포함', () => {
      const file = createMockFile('path/test.jpg', 1024, 'image/jpeg');

      const result = validateImageFile(file);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('파일명이 올바르지 않습니다');
    });

    it('경로 순회 공격 방지: \\ 포함', () => {
      const file = createMockFile('path\\test.jpg', 1024, 'image/jpeg');

      const result = validateImageFile(file);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('파일명이 올바르지 않습니다');
    });
  });

  describe('validateFile - 커스텀 옵션', () => {
    it('커스텀 크기 제한 적용', () => {
      const file = createMockFile('test.jpg', 3 * 1024 * 1024, 'image/jpeg'); // 3MB

      const result = validateFile(file, {
        maxSizeBytes: 2 * 1024 * 1024, // 2MB 제한
        allowedTypes: ['image/jpeg'],
        allowedExtensions: ['.jpg'],
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('2.0MB');
    });

    it('커스텀 타입 제한 적용', () => {
      const file = createMockFile('test.png', 1024, 'image/png');

      const result = validateFile(file, {
        allowedTypes: ['image/jpeg'], // PNG 불허
        allowedExtensions: ['.jpg'],
      });

      expect(result.valid).toBe(false);
    });
  });

  describe('formatFileSize', () => {
    it('Bytes 단위', () => {
      expect(formatFileSize(500)).toBe('500 Bytes');
    });

    it('KB 단위', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('MB 단위', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(10 * 1024 * 1024)).toBe('10 MB');
      expect(formatFileSize(10.5 * 1024 * 1024)).toBe('10.5 MB');
    });

    it('0 바이트', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
    });
  });

  describe('실제 시나리오', () => {
    it('프로필 사진 업로드 시나리오 (5MB PNG)', () => {
      const file = createMockFile('profile.png', 5 * 1024 * 1024, 'image/png');

      const result = validateImageFile(file);

      expect(result.valid).toBe(true);
      expect(result.file).toBe(file);
    });

    it('프로필 사진 업로드 실패 시나리오 (15MB)', () => {
      const file = createMockFile('profile.jpg', 15 * 1024 * 1024, 'image/jpeg');

      const result = validateImageFile(file);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('10.0MB');
      expect(result.error).toContain('15.0MB');
    });

    it('악성 파일 업로드 시도 (EXE를 JPG로 위장)', () => {
      const file = createMockFile('virus.jpg.exe', 1024, 'application/x-msdownload');

      const result = validateImageFile(file);

      expect(result.valid).toBe(false);
    });
  });
});
