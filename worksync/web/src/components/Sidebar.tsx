'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import { AdSenseBanner } from './AdSenseBanner';
import {
  Link2,
  Lock,
  CheckSquare,
  Clipboard,
  User,
  LogOut,
  LayoutDashboard,
  Crown,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface SidebarProps {
  user: {
    email?: string;
  };
  isOpen?: boolean;
  onClose?: () => void;
}

const menuItems = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/dashboard/urls', label: 'URL 동기화', icon: Link2 },
  { href: '/dashboard/passwords', label: '비밀번호 관리', icon: Lock },
  { href: '/dashboard/todos', label: 'To-Do 리스트', icon: CheckSquare },
  { href: '/dashboard/clipboard', label: '클립보드', icon: Clipboard },
  { href: '/dashboard/subscription', label: '구독 관리', icon: Crown },
  { href: '/dashboard/profile', label: '프로필', icon: User },
];

export default function Sidebar({ user, isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { isPro } = useSubscription();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('로그아웃 되었습니다.');
    router.push('/login');
    router.refresh();
  };

  const handleNavClick = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* 모바일 오버레이 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* 사이드바 */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col
          transform transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* 헤더 */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-primary-600">WorkSync</h1>
            <p className="text-sm text-gray-500 mt-1 truncate">{user.email}</p>
          </div>
          {/* 모바일 닫기 버튼 */}
          <button
            onClick={onClose}
            className="lg:hidden p-2 -mr-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            aria-label="메뉴 닫기"
          >
            <X size={20} />
          </button>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* 광고 배너 */}
        {!isPro && (
          <div className="px-4 pb-4 hidden lg:block">
            <AdSenseBanner />
          </div>
        )}

        {/* 로그아웃 버튼 */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="sidebar-link w-full text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut size={20} />
            <span>로그아웃</span>
          </button>
        </div>
      </aside>
    </>
  );
}
