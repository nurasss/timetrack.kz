'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/features', label: 'Возможности' },
  { href: '/pricing', label: 'Тарифы' },
  { href: '/contacts', label: 'Контакты' },
];

export function MarketingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-cyan-500 shadow-brand/30 shadow-md group-hover:shadow-lg transition-shadow">
              <Clock className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold text-slate-900">
              Timetrack
              <span className="text-brand-600">.kz</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="btn-ghost text-sm">
              Войти
            </Link>
            <Link href="/contacts" className="btn-primary text-sm py-2">
              Запросить демо
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            onClick={() => setMobileOpen(v => !v)}
            aria-label="Меню"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <nav className="flex flex-col gap-1 p-4">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <hr className="my-2 border-slate-200" />
            <Link href="/login" className="rounded-lg px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Войти
            </Link>
            <Link href="/contacts" className="btn-primary text-center mt-1">
              Запросить демо
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
