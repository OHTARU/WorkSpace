export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

export function validateMasterPassword(password: string): ValidationResult {
  if (password.length < 8) {
    return { isValid: false, message: '비밀번호는 8자 이상이어야 합니다.' };
  }

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>_\-+=/\\\[\]~`';]/.test(password);

  if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
    return {
      isValid: false,
      message: '비밀번호는 대문자, 소문자, 숫자, 특수문자를 모두 포함해야 합니다.',
    };
  }

  return { isValid: true };
}
