'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Clock, Eye, EyeOff, AlertCircle, CheckCircle2, Building2, User, Mail, Phone, Lock } from 'lucide-react';
import { apiRegisterCompany, apiResendVerification, apiVerifyEmail } from '@/lib/api/service';
import { useAuthStore } from '@/lib/auth/store';

const schema = z.object({
  company_name: z.string().min(2, 'Минимум 2 символа'),
  full_name: z.string().min(2, 'Минимум 2 символа'),
  email: z.string().email('Введите корректный email'),
  phone: z.string().min(10, 'Введите телефон').optional().or(z.literal('')),
  password: z.string().min(8, 'Минимум 8 символов'),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, {
  message: 'Пароли не совпадают',
  path: ['confirm'],
});

type FormValues = z.infer<typeof schema>;

const PERKS = [
  '14 дней бесплатно без привязки карты',
  'Настройка за 1 день',
  'Поддержка на русском языке',
  'Данные хранятся в Казахстане',
];

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore(s => s.setAuth);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormValues) {
    setError(null);
    try {
      await apiRegisterCompany({
        company_name: data.company_name,
        email: data.email,
        password: data.password,
        full_name: data.full_name,
        phone: data.phone || undefined,
      });
      setPendingEmail(data.email);
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      if (typeof detail === 'string') setError(detail);
      else if (Array.isArray(detail)) setError(detail[0]?.msg ?? 'Ошибка регистрации');
      else setError('Ошибка регистрации. Попробуйте позже.');
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setVerifying(true);
    try {
      const res = await apiVerifyEmail(pendingEmail, verificationCode.trim());
      setAuth(res.user, res.tokens.accessToken, res.tokens.refreshToken);
      router.push('/dashboard');
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Неверный или просроченный код');
    } finally {
      setVerifying(false);
    }
  }

  async function resendCode() {
    try {
      await apiResendVerification(pendingEmail);
      setError(null);
    } catch {
      setError('Не удалось запросить новый код. Попробуйте позже.');
    }
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

      <div className="flex flex-1 items-start justify-center px-4 py-12">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

          {/* Left: benefits */}
          <div className="hidden lg:flex flex-col gap-8 pt-4">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">
                Начните учёт рабочего<br />времени уже сегодня
              </h1>
              <p className="mt-3 text-slate-500">
                Зарегистрируйте компанию и получите доступ ко всем функциям бесплатно на 14 дней.
              </p>
            </div>
            <ul className="flex flex-col gap-3">
              {PERKS.map(p => (
                <li key={p} className="flex items-center gap-3 text-slate-700">
                  <CheckCircle2 className="h-5 w-5 text-brand-600 shrink-0" />
                  <span className="text-sm font-medium">{p}</span>
                </li>
              ))}
            </ul>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Что входит в пробный период</p>
              {['Все тарифные функции', 'До 50 сотрудников', 'До 5 локаций', 'Поддержка 24/7'].map(f => (
                <div key={f} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                  <span className="text-sm text-slate-600">{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: form */}
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Регистрация компании</h2>
              <p className="mt-1 text-sm text-slate-500">Заполните данные и получите доступ</p>
            </div>

            <div className="card p-6">
              {pendingEmail ? (
                <form onSubmit={verifyCode} className="flex flex-col gap-4">
                  <p className="text-sm text-slate-600">Если аккаунт создан, код подтверждения отправлен на {pendingEmail}.</p>
                  {error && <p role="alert" className="form-error">{error}</p>}
                  <label htmlFor="verification-code" className="form-label">Шестизначный код</label>
                  <input id="verification-code" className="form-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={verificationCode} onChange={event => setVerificationCode(event.target.value)} />
                  <button type="submit" disabled={verifying} className="btn-primary justify-center py-3">{verifying ? 'Проверяем...' : 'Подтвердить email'}</button>
                  <button type="button" onClick={resendCode} className="text-sm text-brand-600 hover:underline">Отправить код повторно</button>
                  <button type="button" onClick={() => setPendingEmail('')} className="text-sm text-slate-500 hover:underline">Изменить email</button>
                </form>
              ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                {error && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}

                <div>
                  <label className="form-label">
                    <Building2 className="inline h-3.5 w-3.5 mr-1 text-slate-400" />
                    Название компании
                  </label>
                  <input
                    {...register('company_name')}
                    type="text"
                    className="form-input"
                    placeholder="ТОО «Моя компания»"
                  />
                  {errors.company_name && <p className="form-error">{errors.company_name.message}</p>}
                </div>

                <div>
                  <label className="form-label">
                    <User className="inline h-3.5 w-3.5 mr-1 text-slate-400" />
                    Ваше имя
                  </label>
                  <input
                    {...register('full_name')}
                    type="text"
                    className="form-input"
                    placeholder="Иванов Иван"
                    autoComplete="name"
                  />
                  {errors.full_name && <p className="form-error">{errors.full_name.message}</p>}
                </div>

                <div>
                  <label className="form-label">
                    <Mail className="inline h-3.5 w-3.5 mr-1 text-slate-400" />
                    Email
                  </label>
                  <input
                    {...register('email')}
                    type="email"
                    className="form-input"
                    placeholder="director@company.kz"
                    autoComplete="email"
                  />
                  {errors.email && <p className="form-error">{errors.email.message}</p>}
                </div>

                <div>
                  <label className="form-label">
                    <Phone className="inline h-3.5 w-3.5 mr-1 text-slate-400" />
                    Телефон <span className="text-slate-400 font-normal">(необязательно)</span>
                  </label>
                  <input
                    {...register('phone')}
                    type="tel"
                    className="form-input"
                    placeholder="+7 (___) ___-__-__"
                    autoComplete="tel"
                  />
                  {errors.phone && <p className="form-error">{errors.phone.message}</p>}
                </div>

                <div>
                  <label className="form-label">
                    <Lock className="inline h-3.5 w-3.5 mr-1 text-slate-400" />
                    Пароль
                  </label>
                  <div className="relative">
                    <input
                      {...register('password')}
                      type={showPass ? 'text' : 'password'}
                      className="form-input pr-10"
                      placeholder="Минимум 8 символов"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="form-error">{errors.password.message}</p>}
                </div>

                <div>
                  <label className="form-label">
                    <Lock className="inline h-3.5 w-3.5 mr-1 text-slate-400" />
                    Повторите пароль
                  </label>
                  <input
                    {...register('confirm')}
                    type={showPass ? 'text' : 'password'}
                    className="form-input"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                  {errors.confirm && <p className="form-error">{errors.confirm.message}</p>}
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Регистрируясь, вы соглашаетесь с{' '}
                  <a href="/offer.html" className="text-brand-600 hover:underline">условиями использования</a>{' '}
                  и{' '}
                  <a href="/privacy.html" className="text-brand-600 hover:underline">политикой конфиденциальности</a>.
                </p>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary justify-center py-3"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Регистрация...
                    </span>
                  ) : 'Создать аккаунт бесплатно'}
                </button>
              </form>
              )}
            </div>

            <p className="mt-4 text-center text-sm text-slate-500">
              Уже есть аккаунт?{' '}
              <Link href="/login" className="text-brand-600 hover:text-brand-700 font-medium">
                Войти
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
