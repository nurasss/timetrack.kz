'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, MapPin, Calendar, Clock,
  BarChart3, FileText, Settings, LogOut, ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth/store';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Обзор', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/employees', label: 'Сотрудники', icon: Users },
  { href: '/dashboard/locations', label: 'Локации', icon: MapPin },
  { href: '/dashboard/schedules', label: 'Графики', icon: Calendar },
  { href: '/dashboard/attendance', label: 'Отметки', icon: Clock },
  { href: '/dashboard/reports', label: 'Отчёты', icon: BarChart3 },
  { href: '/dashboard/leave-requests', label: 'Заявки', icon: FileText },
  { href: '/dashboard/settings', label: 'Настройки', icon: Settings },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  function handleLogout() {
    clearAuth();
    router.push('/login');
  }

  function isActive(item: typeof NAV_ITEMS[0]) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  return (
    <aside className="flex h-full w-60 flex-col border-r border-slate-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-slate-200 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-cyan-500">
          <Clock className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
        </div>
        <span className="font-bold text-slate-900">
          Timetrack<span className="text-brand-600">.kz</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'sidebar-link',
              isActive(item) && 'sidebar-link-active'
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-slate-200 p-3">
        <div className="mb-2 flex items-center gap-2.5 rounded-lg px-2 py-2">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
              {user?.fullName?.charAt(0) ?? '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">{user?.fullName}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="sidebar-link w-full text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <LogOut className="h-4 w-4" />
          Выйти
        </button>
      </div>
    </aside>
  );
}
