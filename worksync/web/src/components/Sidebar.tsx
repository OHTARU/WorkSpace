'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
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
} from 'lucide-react';
import toast from 'react-hot-toast';

interface SidebarProps {
  user: {
    email?: string;
  };
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

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('로그아웃 되었습니다.');
    router.push('/login');
    router.refresh();
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-primary-600">WorkSync</h1>
        <p className="text-sm text-gray-500 mt-1 truncate">{user.email}</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 pb-4">
        <AdSenseBanner />
      </div>

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
  );
}
