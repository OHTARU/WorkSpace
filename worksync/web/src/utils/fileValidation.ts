/**
 * 파일 업로드 검증 유틸리티
 *
 * 보안 기능:
 * - 파일 크기 제한
 * - 파일 타입 검증 (MIME type + 확장자 + Magic Bytes)
 * - 악성 파일 방지
 */

/**
 * 파일 Magic Bytes (파일 시그니처)
 * 실제 파일 내용의 시작 바이트로 파일 타입을 검증
 */
const FILE_SIGNATURES: Record<string, number[][]> = {
  // 이미지 파일
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]], // GIF87a, GIF89a
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF (WebP 시작)
  'image/svg+xml': [], // SVG는 텍스트 기반이라 별도 처리 필요

  // 비디오 파일
  'video/mp4': [[0x00, 0x00, 0x00], [0x66, 0x74, 0x79, 0x70]], // ftyp (일부 MP4)
  'video/webm': [[0x1A, 0x45, 0xDF, 0xA3]],
  'video/quicktime': [[0x00, 0x00, 0x00]], // MOV도 ftyp 기반

  // 문서 파일
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
};

export interface FileValidationOptions {
  maxSizeBytes?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
  validateMagicBytes?: boolean;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  file?: File;
}

// 기본 설정
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const DEFAULT_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

/**
 * 파일의 Magic Bytes 읽기
 */
async function readMagicBytes(file: File, length: number = 12): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file.slice(0, length));
  });
}

/**
 * Magic Bytes가 시그니처와 일치하는지 확인
 */
function matchesSignature(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) return false;
  }
  return true;
}

/**
 * SVG 파일 내 위험 요소 검사 (XSS 방지)
 */
async function validateSvgSecurity(file: File): Promise<boolean> {
  const text = await file.text();

  // SVG 형식 확인
  if (!text.includes('<svg') && !text.includes('<?xml')) {
    return false;
  }

  // 위험 요소 패턴 검사
  const dangerousPatterns = [
    /<script/i,                    // 스크립트 태그
    /javascript:/i,                // javascript: 프로토콜
    /on\w+\s*=/i,                  // onclick, onerror 등 이벤트 핸들러
    /<iframe/i,                    // iframe 삽입
    /<object/i,                    // object 삽입
    /<embed/i,                     // embed 삽입
    /<foreignObject/i,             // foreignObject (HTML 삽입 가능)
    /data:\s*text\/html/i,         // data URI로 HTML 삽입
    /xlink:href\s*=\s*["']?javascript:/i,  // xlink:href로 JS 실행
    /href\s*=\s*["']?javascript:/i,        // href로 JS 실행
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(text)) {
      return false;
    }
  }

  return true;
}

/**
 * 파일의 실제 타입 검증 (Magic Bytes 기반)
 */
async function validateMagicBytesForType(file: File, mimeType: string): Promise<boolean> {
  const signatures = FILE_SIGNATURES[mimeType];

  // SVG는 텍스트 기반이므로 보안 검증 포함
  if (mimeType === 'image/svg+xml') {
    return validateSvgSecurity(file);
  }

  // 시그니처가 정의되지 않은 타입은 통과
  if (!signatures || signatures.length === 0) {
    return true;
  }

  try {
    const bytes = await readMagicBytes(file, 12);

    // 하나라도 일치하면 유효
    for (const signature of signatures) {
      if (matchesSignature(bytes, signature)) {
        return true;
      }
    }

    // MP4/MOV는 ftyp가 offset 4에 있을 수 있음
    if (mimeType === 'video/mp4' || mimeType === 'video/quicktime') {
      const ftypSignature = [0x66, 0x74, 0x79, 0x70]; // 'ftyp'
      if (matchesSignature(bytes.slice(4), ftypSignature)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * 파일 검증 (동기)
 */
export function validateFile(
  file: File,
  options: FileValidationOptions = {}
): FileValidationResult {
  const {
    maxSizeBytes = DEFAULT_MAX_SIZE,
    allowedTypes = DEFAULT_ALLOWED_TYPES,
    allowedExtensions = DEFAULT_ALLOWED_EXTENSIONS,
  } = options;

  // 1. 파일 크기 검증
  if (file.size > maxSizeBytes) {
    const maxMB = (maxSizeBytes / (1024 * 1024)).toFixed(1);
    const fileMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `파일 크기가 너무 큽니다. (최대 ${maxMB}MB, 현재 ${fileMB}MB)`,
    };
  }

  // 2. 파일이 비어있는지 확인
  if (file.size === 0) {
    return {
      valid: false,
      error: '빈 파일은 업로드할 수 없습니다.',
    };
  }

  // 3. MIME 타입 검증
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `지원하지 않는 파일 형식입니다. (허용: ${allowedTypes.join(', ')})`,
    };
  }

  // 4. 확장자 검증
  const fileExtension = getFileExtension(file.name);
  if (!allowedExtensions.includes(fileExtension)) {
    return {
      valid: false,
      error: `지원하지 않는 파일 확장자입니다. (허용: ${allowedExtensions.join(', ')})`,
    };
  }

  // 5. 파일명 검증 (경로 순회 공격 방지)
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    return {
      valid: false,
      error: '파일명이 올바르지 않습니다.',
    };
  }

  return {
    valid: true,
    file,
  };
}

/**
 * 파일 검증 (비동기 - Magic Bytes 포함)
 * MIME 타입과 확장자만으로는 부족하며, 실제 파일 내용을 검증합니다.
 */
export async function validateFileAsync(
  file: File,
  options: FileValidationOptions = {}
): Promise<FileValidationResult> {
  const { validateMagicBytes = true } = options;

  // 기본 검증 먼저 수행
  const basicResult = validateFile(file, options);
  if (!basicResult.valid) {
    return basicResult;
  }

  // Magic Bytes 검증
  if (validateMagicBytes) {
    const magicValid = await validateMagicBytesForType(file, file.type);
    if (!magicValid) {
      return {
        valid: false,
        error: '파일 내용이 확장자와 일치하지 않습니다. 파일이 위조되었을 수 있습니다.',
      };
    }
  }

  return {
    valid: true,
    file,
  };
}

/**
 * 이미지 파일 검증 (10MB 제한)
 */
export function validateImageFile(file: File): FileValidationResult {
  return validateFile(file, {
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
  });
}

/**
 * 문서 파일 검증 (50MB 제한)
 */
export function validateDocumentFile(file: File): FileValidationResult {
  return validateFile(file, {
    maxSizeBytes: 50 * 1024 * 1024, // 50MB
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ],
    allowedExtensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'],
  });
}

/**
 * 파일 확장자 추출
 */
function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return '';
  return fileName.substring(lastDot).toLowerCase();
}

/**
 * 파일을 Base64로 변환
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as base64'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * 이미지 크기 조정
 */
export function resizeImage(
  file: File,
  maxWidth: number,
  maxHeight: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // 비율 유지하면서 크기 조정
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob'));
            }
          },
          file.type,
          0.9
        );
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      if (typeof e.target?.result === 'string') {
        img.src = e.target.result;
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * 파일 업로드 진행률 추적
 */
export class FileUploadTracker {
  private onProgress?: (progress: number) => void;
  private onComplete?: (url: string) => void;
  private onError?: (error: Error) => void;

  constructor(callbacks: {
    onProgress?: (progress: number) => void;
    onComplete?: (url: string) => void;
    onError?: (error: Error) => void;
  }) {
    this.onProgress = callbacks.onProgress;
    this.onComplete = callbacks.onComplete;
    this.onError = callbacks.onError;
  }

  async upload(file: File, uploadUrl: string): Promise<void> {
    try {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && this.onProgress) {
          const progress = (e.loaded / e.total) * 100;
          this.onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          if (this.onComplete) {
            this.onComplete(xhr.responseText);
          }
        } else {
          if (this.onError) {
            this.onError(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      });

      xhr.addEventListener('error', () => {
        if (this.onError) {
          this.onError(new Error('Upload failed'));
        }
      });

      const formData = new FormData();
      formData.append('file', file);

      xhr.open('POST', uploadUrl);
      xhr.send(formData);
    } catch (error) {
      if (this.onError) {
        this.onError(error as Error);
      }
    }
  }
}

/**
 * 파일 크기를 사람이 읽기 쉬운 형식으로 변환
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
