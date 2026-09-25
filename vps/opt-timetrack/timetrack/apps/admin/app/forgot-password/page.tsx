'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Clock, AlertCircle, CheckCircle2, Mail, ArrowLeft } from 'lucide-react';
import { apiForgotPassword, apiResetPassword } from '@/lib/api/service';

const schema = z.object({
  email: z.string().email('Введите корректный email'),
});
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormValues) {
    setError(null);
    try {
      await apiForgotPassword(data.email);
      setSentTo(data.email);
      setSent(true);
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      if (typeof detail === 'string') setError(detail);
      else setError('Ошибка. Попробуйте позже.');
    }
  }

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResetting(true);
    try {
      await apiResetPassword(sentTo, code.trim(), newPassword);
      setResetComplete(true);
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Неверный или просроченный код');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
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
          <div className="mb-6">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
              <ArrowLeft className="h-4 w-4" />
              Вернуться к входу
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Восстановление пароля</h1>
            <p className="mt-1 text-sm text-slate-500">
              Введите email — мы отправим код для сброса пароля
            </p>
          </div>

          <div className="card p-6">
            {resetComplete ? (
              <div className="text-center text-sm text-slate-700">Пароль изменён. <Link href="/login" className="text-brand-600 hover:underline">Войти</Link></div>
            ) : sent ? (
              <div className="flex flex-col items-center text-center py-4 gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-7 w-7 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Код восстановления запрошен</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Если аккаунт существует, код отправлен на <span className="font-medium text-slate-700">{sentTo}</span>.
                  </p>
                </div>
                {error && <p role="alert" className="form-error">{error}</p>}
                <form onSubmit={submitReset} className="flex w-full flex-col gap-3 text-left">
                  <label htmlFor="reset-code" className="form-label">Шестизначный код</label>
                  <input id="reset-code" className="form-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => setCode(event.target.value)} />
                  <label htmlFor="reset-password" className="form-label">Новый пароль</label>
                  <input id="reset-password" className="form-input" type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={event => setNewPassword(event.target.value)} />
                  <button type="submit" disabled={resetting} className="btn-primary justify-center py-3">{resetting ? 'Сохраняем...' : 'Изменить пароль'}</button>
                </form>
                <p className="text-xs text-slate-400">
                  Не пришло? Проверьте папку «Спам» или{' '}
                  <button
                    type="button"
                    onClick={() => setSent(false)}
                    className="text-brand-600 hover:underline"
                  >
                    попробуйте снова
                  </button>
                  .
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                {error && (
                  <div className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div>
                  <label className="form-label">
                    <Mail className="inline h-3.5 w-3.5 mr-1 text-slate-400" />
                    Email
                  </label>
                  <input
                    {...register('email')}
                    type="email"
                    className="form-input"
                    placeholder="name@company.kz"
                    autoComplete="email"
                    autoFocus
                  />
                  {errors.email && <p className="form-error">{errors.email.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary justify-center py-3"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Отправляем...
                    </span>
                  ) : 'Отправить код'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
