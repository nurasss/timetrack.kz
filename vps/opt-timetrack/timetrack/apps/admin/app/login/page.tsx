'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import {
  Clock, Eye, EyeOff, AlertCircle, Mail, Lock,
  MapPin, Users, BarChart3, ShieldCheck,
} from 'lucide-react';
import { apiLogin } from '@/lib/api/service';
import { useAuthStore } from '@/lib/auth/store';

const schema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
});

type FormValues = z.infer<typeof schema>;

const HIGHLIGHTS = [
  { icon: MapPin, title: 'Геолокация и фото', text: 'Отметки только на рабочем месте' },
  { icon: Users, title: 'Учёт сотрудников', text: 'Графики, отделы, должности' },
  { icon: BarChart3, title: 'Отчёты и аналитика', text: 'Опоздания, переработки, табель' },
  { icon: ShieldCheck, title: 'Данные в Казахстане', text: 'Безопасное хранение на серверах РК' },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore(s => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormValues) {
    setError(null);
    try {
      const res = await apiLogin(data.email, data.password);
      setAuth(res.user, res.tokens.accessToken, res.tokens.refreshToken);
      const next = searchParams.get('next');
      router.push(next && next.startsWith('/') ? next : '/dashboard');
    } catch (e: any) {
      const msg = e.response?.data?.detail ?? e.message ?? 'Ошибка входа';
      setError(typeof msg === 'string' ? msg : 'Неверный email или пароль');
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left: brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-600 p-12 text-white">
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-cyan-300/20 blur-3xl" />

        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <Clock className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-xl font-bold">Timetrack<span className="text-cyan-200">.kz</span></span>
          </Link>
        </div>

        <div className="relative">
          <h1 className="text-3xl xl:text-4xl font-extrabold leading-tight">
            Учёт рабочего времени<br />без таблиц и хаоса
          </h1>
          <p className="mt-4 max-w-md text-white/80">
            Контролируйте посещаемость, опоздания и переработки в одном окне.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4 max-w-lg">
            {HIGHLIGHTS.map(h => (
              <div key={h.title} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                <h.icon className="h-5 w-5 text-cyan-200" />
                <p className="mt-2.5 text-sm font-semibold">{h.title}</p>
                <p className="mt-0.5 text-xs text-white/70 leading-snug">{h.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-sm text-white/60">
          © {new Date().getFullYear()} Timetrack.kz — система учёта рабочего времени
        </div>
      </div>

      {/* Right: login form */}
      <div className="flex flex-col bg-slate-50">
        {/* Mobile logo */}
        <div className="lg:hidden border-b border-slate-200 bg-white px-5 py-4">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-cyan-500">
              <Clock className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold text-slate-900">
              Timetrack<span className="text-brand-600">.kz</span>
            </span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900">С возвращением 👋</h2>
              <p className="mt-1.5 text-sm text-slate-500">Войдите в панель управления компанией</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              {error && (
                <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className="form-label">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    {...register('email')}
                    type="email"
                    className="form-input pl-10"
                    placeholder="name@company.kz"
                    autoComplete="email"
                    autoFocus
                  />
                </div>
                {errors.email && <p className="form-error">{errors.email.message}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="form-label mb-0">Пароль</label>
                  <Link href="/forgot-password" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                    Забыли пароль?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    className="form-input pl-10 pr-10"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="form-error">{errors.password.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary justify-center py-3 mt-2 text-base"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Вход...
                  </span>
                ) : 'Войти'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Нет аккаунта?{' '}
              <Link href="/register" className="font-semibold text-brand-600 hover:text-brand-700">
                Зарегистрировать компанию
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <LoginForm />
    </Suspense>
  );
}
