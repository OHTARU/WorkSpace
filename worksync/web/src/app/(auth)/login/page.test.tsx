import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from './page';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

// Next.js router mock
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// react-hot-toast mock
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Supabase client mock
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithPassword: vi.fn(),
    },
  })),
}));

describe('LoginPage - 인증 플로우 통합 테스트', () => {
  const mockPush = vi.fn();
  const mockRefresh = vi.fn();
  const mockSignInWithPassword = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useRouter as any).mockReturnValue({
      push: mockPush,
      refresh: mockRefresh,
    });

    const { createClient } = require('@/lib/supabase/client');
    createClient.mockReturnValue({
      auth: {
        signInWithPassword: mockSignInWithPassword,
      },
    });
  });

  describe('UI 렌더링', () => {
    it('로그인 폼이 올바르게 렌더링', () => {
      render(<LoginPage />);

      expect(screen.getByText('WorkSync')).toBeInTheDocument();
      expect(screen.getByLabelText(/이메일/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/비밀번호/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /로그인/i })).toBeInTheDocument();
    });

    it('회원가입 링크가 표시됨', () => {
      render(<LoginPage />);

      const signupLink = screen.getByText(/회원가입/i);
      expect(signupLink).toBeInTheDocument();
      expect(signupLink.closest('a')).toHaveAttribute('href', '/signup');
    });
  });

  describe('입력값 검증', () => {
    it('이메일과 비밀번호 입력 필드가 required', () => {
      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/이메일/i);
      const passwordInput = screen.getByLabelText(/비밀번호/i);

      expect(emailInput).toBeRequired();
      expect(passwordInput).toBeRequired();
    });

    it('사용자 입력이 상태에 반영됨', () => {
      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/이메일/i) as HTMLInputElement;
      const passwordInput = screen.getByLabelText(/비밀번호/i) as HTMLInputElement;

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      expect(emailInput.value).toBe('test@example.com');
      expect(passwordInput.value).toBe('password123');
    });
  });

  describe('로그인 성공 시나리오', () => {
    it('올바른 인증 정보로 로그인 성공', async () => {
      mockSignInWithPassword.mockResolvedValue({ error: null });

      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/이메일/i);
      const passwordInput = screen.getByLabelText(/비밀번호/i);
      const submitButton = screen.getByRole('button', { name: /로그인/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSignInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });

      expect(toast.success).toHaveBeenCalledWith('로그인 성공!');
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
      expect(mockRefresh).toHaveBeenCalled();
    });

    it('로그인 중 버튼 비활성화', async () => {
      mockSignInWithPassword.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ error: null }), 100))
      );

      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/이메일/i);
      const passwordInput = screen.getByLabelText(/비밀번호/i);
      const submitButton = screen.getByRole('button', { name: /로그인/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      // 로딩 중 상태 확인
      expect(screen.getByRole('button', { name: /로그인 중.../i })).toBeDisabled();

      await waitFor(() => {
        expect(mockSignInWithPassword).toHaveBeenCalled();
      });
    });
  });

  describe('로그인 실패 시나리오', () => {
    it('잘못된 인증 정보로 로그인 실패', async () => {
      const errorMessage = 'Invalid login credentials';
      mockSignInWithPassword.mockResolvedValue({
        error: { message: errorMessage },
      });

      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/이메일/i);
      const passwordInput = screen.getByLabelText(/비밀번호/i);
      const submitButton = screen.getByRole('button', { name: /로그인/i });

      fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(errorMessage);
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it('네트워크 에러 발생 시 에러 메시지 표시', async () => {
      mockSignInWithPassword.mockResolvedValue({
        error: { message: 'Network error' },
      });

      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/이메일/i);
      const passwordInput = screen.getByLabelText(/비밀번호/i);
      const submitButton = screen.getByRole('button', { name: /로그인/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Network error');
      });
    });
  });

  describe('보안 요구사항', () => {
    it('비밀번호 입력 필드가 type="password"', () => {
      render(<LoginPage />);

      const passwordInput = screen.getByLabelText(/비밀번호/i);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('이메일 형식 검증', () => {
      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/이메일/i);
      expect(emailInput).toHaveAttribute('type', 'email');
    });
  });
});
