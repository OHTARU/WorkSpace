import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { ClientErrorBoundary } from '@/components/ClientErrorBoundary';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'WorkSync - Cross-Device Sync',
  description: 'PC와 모바일 간의 데이터 연동 서비스',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <ClientErrorBoundary>
          {children}
        </ClientErrorBoundary>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
