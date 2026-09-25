'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Plus,
  Search,
  ShieldCheck,
  UserCircle
} from 'lucide-react';
import { tokenStorage } from '../../lib/api/client';
import { apiGetMe } from '../../lib/api/service';
import { useAuthStore } from '../../lib/auth/store';
import { navItems, Sidebar } from './Sidebar';

const publicRoutes = new Set(['/', '/login', '/register', '/forgot-password']);

const routeTitles: Record<string, string> = {
  '/dashboard': 'Обзор компании',
  '/today': 'Оперативный день',
  '/employees': 'Сотрудники',
  '/organization': 'Организация',
  '/schedules': 'Графики и смены',
  '/timesheets': 'Табель',
  '/reports': 'Отчеты',
  '/requests': 'Заявки',
  '/locations': 'Локации',
  '/devices': 'Устройства',
  '/biometrics': 'Биометрия',
  '/violations': 'Нарушения',
  '/integrations': 'Интеграции',
  '/billing': 'Биллинг',
  '/settings': 'Настройки',
  '/support': 'Поддержка',
  '/onboarding': 'Onboarding'
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authState, setAuthState] = useState<'checking' | 'ready'>('checking');
  const clearAuth = useAuthStore(state => state.clearAuth);

  useEffect(() => {
    if (publicRoutes.has(pathname)) {
      setAuthState('ready');
      return;
    }

    let cancelled = false;

    async function verifySession() {
      try {
        if (!tokenStorage.getAccess()) {
          throw new Error('Missing access token');
        }
        await apiGetMe();
        if (!cancelled) setAuthState('ready');
      } catch {
        clearAuth();
        if (!cancelled) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        }
      }
    }

    setAuthState('checking');
    void verifySession();

    return () => {
      cancelled = true;
    };
  }, [pathname, router, clearAuth]);

  if (publicRoutes.has(pathname)) {
    return <>{children}</>;
  }

  if (authState === 'checking') {
    return (
      <div className="grid min-h-screen place-items-center bg-[#07111D] text-white">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-xl font-black text-slate-950">T</div>
          <p className="text-sm font-bold text-slate-300">Проверяем сессию...</p>
        </div>
      </div>
    );
  }

  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    return <>{children}</>;
  }

  const title = Object.entries(routeTitles).find(([route]) => pathname === route || pathname.startsWith(`${route}/`))?.[1] ?? 'Timetrack.kz';
  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
          <div className="flex min-h-[72px] flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <Building2 size={14} />
                <span>Компания</span>
                <span>/</span>
                <span>Все филиалы</span>
              </div>
              <h2 className="mt-1 text-xl font-black text-slate-950">{title}</h2>
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2 lg:max-w-3xl">
              <div className="input-shell min-w-[180px] flex-1">
                <Search size={17} className="text-slate-400" />
                <input suppressHydrationWarning className="w-full bg-transparent outline-none" placeholder="Поиск сотрудников, отчетов, устройств" />
              </div>
              <button className="hidden h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 xl:inline-flex">
                <CalendarDays size={16} />
                Июнь 2026
              </button>
              <button className="inline-flex h-10 w-10 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-black text-slate-950 transition hover:bg-emerald-400 sm:w-auto sm:px-3">
                <Plus size={16} />
                <span className="hidden sm:inline">Добавить</span>
              </button>
              <button className="control w-10 px-0" aria-label="Уведомления">
                <Bell size={16} />
              </button>
              <button className="hidden h-10 w-10 items-center justify-center rounded-lg border border-line bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 md:inline-flex" aria-label="Помощь">
                <CircleHelp size={16} />
              </button>
              <button className="hidden h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 md:inline-flex">
                <ShieldCheck size={16} />
                RU
                <ChevronDown size={14} />
              </button>
              <button className="control w-10 px-0" aria-label="Профиль">
                <UserCircle size={18} />
              </button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto border-t border-line px-4 py-2 lg:hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${active ? 'bg-primary text-slate-950' : 'bg-slate-100 text-slate-600'}`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </header>
        <main className="overflow-x-hidden p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
