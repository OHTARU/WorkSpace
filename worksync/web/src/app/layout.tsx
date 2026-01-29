import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { ClientErrorBoundary } from '@/components/ClientErrorBoundary';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'WorkSync - PC와 모바일의 완벽한 동기화',
  description: 'URL, 비밀번호, 할 일 목록, 클립보드를 PC와 모바일 간에 실시간으로 동기화하고 안전하게 관리하세요.',
  keywords: ['생산성', '동기화', '비밀번호관리', '클립보드공유', 'WorkSync'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5539584331662815"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <ClientErrorBoundary>
          {children}
        </ClientErrorBoundary>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
