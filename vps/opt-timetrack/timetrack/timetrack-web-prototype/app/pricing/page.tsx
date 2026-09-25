import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, ArrowRight, Zap, Users, Building2, BarChart3, Phone, MessageSquare } from 'lucide-react';
import { MarketingHeader } from '@/components/marketing/Header';
import { MarketingFooter } from '@/components/marketing/Footer';

export const metadata: Metadata = {
  title: 'Тарифы — Timetrack.kz',
  description: 'Выберите подходящий тариф для вашей компании. Начните с 14 дней бесплатно.',
};

const PLANS = [
  {
    id: 'starter',
    name: 'Starter 10',
    price: 4900,
    priceYearly: 4165,
    employees: 10,
    icon: Zap,
    color: 'border-slate-200',
    highlight: false,
    features: [
      'До 10 сотрудников',
      '1 локация',
      'Геолокация и фото',
      'Табель и отчёты',
      'Мобильное приложение',
      'Email-поддержка',
    ],
  },
  {
    id: 'team',
    name: 'Team 25',
    price: 11500,
    priceYearly: 9775,
    employees: 25,
    icon: Users,
    color: 'border-brand-500 ring-2 ring-brand-500/20',
    highlight: true,
    features: [
      'До 25 сотрудников',
      'До 3 локаций',
      'Геолокация и фото',
      'Полный табель и отчёты',
      'Заявки на отпуск/больничный',
      'Экспорт Excel и PDF',
      'Приоритетная поддержка',
    ],
  },
  {
    id: 'business',
    name: 'Business 50',
    price: 23000,
    priceYearly: 19550,
    employees: 50,
    icon: Building2,
    color: 'border-slate-200',
    highlight: false,
    features: [
      'До 50 сотрудников',
      'До 10 локаций',
      'Всё из Team 25',
      'Несколько ролей и уровней',
      'Настройка доступов',
      'API-интеграция',
      'Выделенный менеджер',
    ],
  },
  {
    id: 'scale',
    name: 'Scale 100',
    price: 44000,
    priceYearly: 37400,
    employees: 100,
    icon: BarChart3,
    color: 'border-slate-200',
    highlight: false,
    features: [
      'До 100 сотрудников',
      'Неограниченные локации',
      'Всё из Business 50',
      'Расширенная аналитика',
      'Интеграция с 1С',
      'Белая метка (по запросу)',
      'SLA 99.5%',
    ],
  },
];

const ADD_ONS = [
  { name: 'Онбординг и настройка', price: 'от 30 000 ₸', desc: 'Полная настройка под вашу компанию, обучение администраторов' },
  { name: 'Интеграция с 1С', price: 'от 80 000 ₸', desc: 'Синхронизация с вашей бухгалтерией 1С:Предприятие' },
  { name: 'Интеграция с Bitrix24', price: 'от 50 000 ₸', desc: 'Подключение к вашей CRM-системе' },
  { name: 'Дополнительный сотрудник', price: '490 ₸/мес', desc: 'Сверх лимита вашего тарифа' },
];

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />

      {/* Hero */}
      <section className="bg-white border-b border-slate-200 py-16 lg:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600 mb-3">Тарифы</p>
          <h1 className="text-4xl font-extrabold text-slate-900 sm:text-5xl">
            Прозрачные цены,<br />без скрытых платежей
          </h1>
          <p className="mt-5 text-lg text-slate-500">
            Выберите подходящий план. При оплате на год — скидка 15%.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            14 дней бесплатного пробного периода
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-16 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map(plan => (
              <div
                key={plan.id}
                className={`relative card p-6 flex flex-col border-2 ${plan.color} ${plan.highlight ? 'bg-gradient-to-b from-brand-50/50 to-white' : ''}`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="badge bg-brand-600 text-white shadow-brand px-3 py-1">
                      Популярный
                    </span>
                  </div>
                )}

                <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg ${plan.highlight ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                  <plan.icon className="h-5 w-5" />
                </div>

                <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                <p className="text-sm text-slate-500 mb-4">до {plan.employees} сотрудников</p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {plan.price.toLocaleString('ru-RU')}
                    </span>
                    <span className="text-sm text-slate-500">₸/мес</span>
                  </div>
                  <p className="text-xs text-emerald-600 mt-1 font-medium">
                    {plan.priceYearly.toLocaleString('ru-RU')} ₸/мес при оплате за год
                  </p>
                </div>

                <ul className="flex-1 flex flex-col gap-2.5 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/contacts"
                  className={plan.highlight ? 'btn-primary text-center justify-center' : 'btn-secondary text-center justify-center'}
                >
                  Начать
                </Link>
              </div>
            ))}
          </div>

          {/* Enterprise */}
          <div className="mt-8 card p-6 lg:p-8 border-2 border-slate-900 bg-slate-900">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div>
                <h3 className="text-xl font-bold text-white">Enterprise 250+</h3>
                <p className="text-slate-300 mt-1">Для крупных компаний с особыми требованиями</p>
                <ul className="mt-4 grid grid-cols-2 gap-2">
                  {['Неограниченные сотрудники', 'Выделенные серверы', 'Custom интеграции', 'SLA 99.9%', 'Персональный менеджер', 'On-premise вариант'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                      <Check className="h-3.5 w-3.5 text-brand-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="shrink-0 flex flex-col items-start lg:items-end gap-3">
                <span className="text-2xl font-bold text-white">Индивидуально</span>
                <Link href="/contacts" className="btn-primary">
                  Обсудить проект
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Add-ons */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-extrabold text-slate-900">Дополнительные услуги</h2>
            <p className="mt-2 text-slate-500">Расширьте возможности системы</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ADD_ONS.map(addon => (
              <div key={addon.name} className="card p-5 flex flex-col">
                <p className="text-base font-semibold text-slate-900 mb-2">{addon.name}</p>
                <p className="text-sm text-slate-500 flex-1 leading-relaxed">{addon.desc}</p>
                <p className="mt-4 text-lg font-bold text-brand-700">{addon.price}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-slate-50 border-t border-slate-200">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-extrabold text-slate-900 text-center mb-10">Часто задаваемые вопросы</h2>
          <div className="flex flex-col gap-5">
            {[
              { q: 'Как начать пробный период?', a: 'Оставьте заявку на сайте, мы создадим аккаунт и поможем настроить систему. Никакой привязки карты не нужно.' },
              { q: 'Можно ли изменить тариф?', a: 'Да, тариф можно повысить или снизить в любой момент. При повышении доплата рассчитывается пропорционально.' },
              { q: 'Как оплатить?', a: 'Принимаем безналичный перевод, Kaspi Pay и банковские карты. Для юрлиц выставляем счёт.' },
              { q: 'Где хранятся данные?', a: 'Все данные хранятся на серверах в Казахстане. Мы соблюдаем требования закона РК о персональных данных.' },
            ].map(item => (
              <div key={item.q} className="card p-5">
                <p className="font-semibold text-slate-900 mb-2">{item.q}</p>
                <p className="text-sm text-slate-500 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 bg-brand-600">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl font-extrabold text-white">Есть вопросы по тарифам?</h2>
          <p className="mt-3 text-brand-200">Позвоните или напишите — подберём оптимальный вариант</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <a href="tel:+77009111213" className="btn-secondary bg-transparent border-brand-400 text-white hover:bg-white/10">
              <Phone className="h-4 w-4" />
              +7 700 911 12 13
            </a>
            <a href="https://wa.me/77054345148" target="_blank" rel="noopener noreferrer" className="btn-secondary bg-transparent border-brand-400 text-white hover:bg-white/10">
              <MessageSquare className="h-4 w-4" />
              +7 705 434 51 48 (WhatsApp)
            </a>
            <Link href="/contacts" className="bg-white text-brand-700 font-semibold rounded-lg px-5 py-2.5 text-sm hover:bg-brand-50 transition-colors">
              Написать нам
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
