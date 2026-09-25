'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Building2,
  CalendarClock,
  CircleHelp,
  Cpu,
  FileBarChart,
  Fingerprint,
  GitBranch,
  LayoutDashboard,
  MapPin,
  Settings,
  ShieldAlert,
  LogOut,
  Users,
  Workflow
} from 'lucide-react';
import { apiLogout } from '../../lib/api/service';
import { useAuthStore } from '../../lib/auth/store';

export const navItems = [
  { href: '/dashboard', label: 'Обзор', icon: LayoutDashboard },
  { href: '/today', label: 'Сегодня', icon: Activity },
  { href: '/employees', label: 'Сотрудники', icon: Users },
  { href: '/organization', label: 'Организация', icon: Building2 },
  { href: '/schedules', label: 'Графики', icon: GitBranch },
  { href: '/timesheets', label: 'Табель', icon: CalendarClock },
  { href: '/reports', label: 'Отчеты', icon: FileBarChart },
  { href: '/requests', label: 'Заявки', icon: Workflow },
  { href: '/locations', label: 'Локации', icon: MapPin },
  { href: '/devices', label: 'Устройства', icon: Cpu },
  { href: '/biometrics', label: 'Биометрия', icon: Fingerprint },
  { href: '/violations', label: 'Нарушения', icon: ShieldAlert },
  { href: '/integrations', label: 'Интеграции', icon: BarChart3 },
  { href: '/billing', label: 'Биллинг', icon: BadgeDollarSign },
  { href: '/settings', label: 'Настройки', icon: Settings },
  { href: '/support', label: 'Поддержка', icon: CircleHelp }
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  async function handleLogout() {
    await apiLogout();
    useAuthStore.getState().clearAuth();
    router.replace('/login');
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col bg-sidebar p-4 text-white lg:flex">
      <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-xl font-black text-slate-950">T</div>
          <div>
            <p className="text-xl font-black leading-none">Timetrack.kz</p>
            <p className="mt-1 text-xs text-slate-400">Компания</p>
          </div>
        </div>
        <div className="mt-4 rounded-lg bg-black/20 p-3">
          <p className="text-sm font-bold">Starter</p>
          <p className="mt-1 text-xs text-slate-400">0 сотрудников</p>
        </div>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={`sidebar-link ${active ? 'sidebar-link-active' : ''}`}>
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-bold">Администратор</p>
        <p className="mt-1 text-xs text-slate-400">Company Admin</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <Link href="/billing" className="text-xs font-black text-primary">Обновить тариф</Link>
          <button onClick={handleLogout} className="inline-flex items-center gap-1 text-xs font-black text-slate-300 hover:text-white">
            <LogOut size={14} />
            Выйти
          </button>
        </div>
      </div>
    </aside>
  );
}
