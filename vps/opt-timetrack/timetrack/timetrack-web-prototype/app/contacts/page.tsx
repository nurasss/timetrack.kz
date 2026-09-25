'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Phone, Mail, MapPin, Clock, CheckCircle2, MessageSquare } from 'lucide-react';
import { MarketingHeader } from '@/components/marketing/Header';
import { MarketingFooter } from '@/components/marketing/Footer';

const schema = z.object({
  name: z.string().min(2, 'Укажите ваше имя'),
  company: z.string().min(2, 'Укажите название компании'),
  phone: z.string().min(10, 'Укажите корректный номер телефона'),
  email: z.string().email('Укажите корректный email'),
  employeeCount: z.string().min(1, 'Укажите количество сотрудников'),
  comment: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function ContactsPage() {
  const [submitted, setSubmitted] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormValues) {
    // Mock submit — save to localStorage
    await new Promise(r => setTimeout(r, 800));
    const existing = JSON.parse(localStorage.getItem('tt_leads') ?? '[]');
    localStorage.setItem('tt_leads', JSON.stringify([
      ...existing,
      { ...data, submittedAt: new Date().toISOString(), id: `lead_${Date.now()}` }
    ]));
    toast.success('Заявка отправлена! Мы свяжемся с вами в течение рабочего дня.');
    setSubmitted(true);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />

      <section className="bg-white border-b border-slate-200 py-14 lg:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600 mb-3">Контакты</p>
          <h1 className="text-4xl font-extrabold text-slate-900 sm:text-5xl">
            Запросите демо
          </h1>
          <p className="mt-4 text-lg text-slate-500">
            Оставьте заявку — мы свяжемся с вами, покажем систему и настроим под вашу компанию.
          </p>
        </div>
      </section>

      <section className="py-16 bg-slate-50 flex-1">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">

            {/* Contact info */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <div className="card p-6">
                <h2 className="text-base font-bold text-slate-900 mb-5">Свяжитесь с нами</h2>
                <div className="flex flex-col gap-4">
                  {[
                    { icon: Phone, label: 'Телефон', value: '+7 700 911 12 13', href: 'tel:+77009111213' },
                    { icon: MessageSquare, label: 'WhatsApp', value: '+7 705 434 51 48', href: 'https://wa.me/77054345148' },
                    { icon: Mail, label: 'Email', value: 'hello@timetrack.kz', href: 'mailto:hello@timetrack.kz' },
                    { icon: MapPin, label: 'Адрес', value: 'г. Астана, пр. Республики 13, офис 401', href: undefined },
                    { icon: Clock, label: 'Режим работы', value: 'Пн–Пт: 09:00–18:00', href: undefined },
                  ].map(item => (
                    <div key={item.label} className="flex gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50">
                        <item.icon className="h-4 w-4 text-brand-600" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-0.5">{item.label}</p>
                        {item.href ? (
                          <a href={item.href} className="text-sm font-medium text-slate-800 hover:text-brand-600">
                            {item.value}
                          </a>
                        ) : (
                          <p className="text-sm font-medium text-slate-800">{item.value}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-6 bg-gradient-to-br from-brand-50 to-cyan-50 border-brand-100">
                <h3 className="text-sm font-bold text-slate-900 mb-3">Что будет после заявки</h3>
                <div className="flex flex-col gap-3">
                  {[
                    'Менеджер свяжется в течение рабочего дня',
                    'Покажем демо за 20 минут в Zoom',
                    'Предложим оптимальный тариф',
                    'Настроим систему за 1 день',
                  ].map((step, i) => (
                    <div key={step} className="flex items-start gap-2.5">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white text-xs font-bold">
                        {i + 1}
                      </div>
                      <p className="text-sm text-slate-600">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-3">
              {submitted ? (
                <div className="card p-10 flex flex-col items-center text-center gap-5">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Заявка отправлена!</h2>
                    <p className="text-slate-500">
                      Мы получили вашу заявку и свяжемся с вами в течение рабочего дня.
                    </p>
                  </div>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="btn-ghost text-sm"
                  >
                    Отправить ещё одну заявку
                  </button>
                </div>
              ) : (
                <div className="card p-6 lg:p-8">
                  <h2 className="text-lg font-bold text-slate-900 mb-6">Оставить заявку</h2>

                  <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <div>
                        <label className="form-label">Ваше имя *</label>
                        <input
                          {...register('name')}
                          className="form-input"
                          placeholder="Данияр Ахметов"
                        />
                        {errors.name && <p className="form-error">{errors.name.message}</p>}
                      </div>
                      <div>
                        <label className="form-label">Компания *</label>
                        <input
                          {...register('company')}
                          className="form-input"
                          placeholder="ТОО «Ваша компания»"
                        />
                        {errors.company && <p className="form-error">{errors.company.message}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <div>
                        <label className="form-label">Телефон *</label>
                        <input
                          {...register('phone')}
                          className="form-input"
                          placeholder="+7 700 000 00 00"
                          type="tel"
                        />
                        {errors.phone && <p className="form-error">{errors.phone.message}</p>}
                      </div>
                      <div>
                        <label className="form-label">Email *</label>
                        <input
                          {...register('email')}
                          className="form-input"
                          placeholder="name@company.kz"
                          type="email"
                        />
                        {errors.email && <p className="form-error">{errors.email.message}</p>}
                      </div>
                    </div>

                    <div>
                      <label className="form-label">Количество сотрудников *</label>
                      <select {...register('employeeCount')} className="form-input">
                        <option value="">Выберите...</option>
                        <option value="1-10">до 10 сотрудников</option>
                        <option value="11-25">11–25 сотрудников</option>
                        <option value="26-50">26–50 сотрудников</option>
                        <option value="51-100">51–100 сотрудников</option>
                        <option value="100+">более 100 сотрудников</option>
                      </select>
                      {errors.employeeCount && <p className="form-error">{errors.employeeCount.message}</p>}
                    </div>

                    <div>
                      <label className="form-label">Комментарий</label>
                      <textarea
                        {...register('comment')}
                        className="form-input resize-none"
                        rows={3}
                        placeholder="Расскажите о задаче или задайте вопрос..."
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="btn-primary justify-center py-3 text-base"
                    >
                      {isSubmitting ? 'Отправка...' : 'Отправить заявку'}
                    </button>

                    <p className="text-xs text-slate-400 text-center">
                      Нажимая кнопку, вы соглашаетесь с{' '}
                      <a href="#" className="underline hover:text-brand-600">политикой конфиденциальности</a>
                    </p>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
