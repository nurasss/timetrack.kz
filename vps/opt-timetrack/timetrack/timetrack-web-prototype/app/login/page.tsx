'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Clock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { apiLogin } from '@/lib/api/mock-service';
import { useAuthStore } from '@/lib/auth/store';

const schema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
});

type FormValues = z.infer<typeof schema>;

const DEMO_USERS = [
  { label: 'Администратор', email: 'admin@timetrack.kz', password: 'password' },
  { label: 'HR-менеджер', email: 'hr@timetrack.kz', password: 'password' },
  { label: 'Руководитель', email: 'manager@timetrack.kz', password: 'password' },
];

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore(s => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormValues) {
    setError(null);
    try {
      const res = await apiLogin(data.email, data.password);
      setAuth(res.user, res.tokens.accessToken);
      router.push('/dashboard');
    } catch (e: any) {
      setError(e.message ?? 'Ошибка входа');
    }
  }

  function fillDemo(email: string, password: string) {
    setValue('email', email);
    setValue('password', password);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
      <div className="border-b border-slate-200 bg-white px-4 py-4">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-cyan-500">
            <Clock className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold text-slate-900">
            Timetrack<span className="text-brand-600">.kz</span>
          </span>
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Вход в систему</h1>
            <p className="mt-2 text-sm text-slate-500">Введите данные вашего аккаунта</p>
          </div>

          <div className="card p-6 lg:p-8">
            {/* Demo users */}
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Демо-аккаунты</p>
              <div className="flex flex-col gap-2">
                {DEMO_USERS.map(u => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => fillDemo(u.email, u.password)}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-sm hover:border-brand-300 hover:bg-brand-50 transition-colors text-left"
                  >
                    <div>
                      <p className="font-medium text-slate-800">{u.label}</p>
                      <p className="text-xs text-slate-500 font-mono">{u.email}</p>
                    </div>
                    <span className="text-xs text-brand-600 font-medium">Заполнить</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-slate-400">или введите вручную</span>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              {error && (
                <div className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className="form-label">Email</label>
                <input
                  {...register('email')}
                  type="email"
                  className="form-input"
                  placeholder="name@company.kz"
                  autoComplete="email"
                />
                {errors.email && <p className="form-error">{errors.email.message}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="form-label mb-0">Пароль</label>
                  <a href="#" className="text-xs text-brand-600 hover:text-brand-700">Забыли пароль?</a>
                </div>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    className="form-input pr-10"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="form-error">{errors.password.message}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary justify-center py-3 mt-2"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Вход...
                  </span>
                ) : 'Войти'}
              </button>
            </form>
          </div>

          <p className="mt-4 text-center text-xs text-slate-400">
            Нет аккаунта?{' '}
            <Link href="/contacts" className="text-brand-600 hover:text-brand-700 font-medium">
              Запросить демо
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
