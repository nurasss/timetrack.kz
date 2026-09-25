import Link from 'next/link';
import {
  MapPin, Camera, FileSpreadsheet, AlertCircle, Building2,
  Globe, Smartphone, ChevronRight, CheckCircle2, TrendingUp,
  Users, Zap, Shield, Clock, ArrowRight,
} from 'lucide-react';
import { MarketingHeader } from '@/components/marketing/Header';
import { MarketingFooter } from '@/components/marketing/Footer';

const FEATURES = [
  { icon: MapPin, title: 'Геолокация', desc: 'Отметка только в пределах офиса. Геофенсинг с точностью до 5 метров.', color: 'bg-brand-100 text-brand-700' },
  { icon: Camera, title: 'Фото-подтверждение', desc: 'Селфи при приходе и уходе для исключения подмены сотрудников.', color: 'bg-cyan-100 text-cyan-700' },
  { icon: FileSpreadsheet, title: 'Автоматический табель', desc: 'Табель формируется сам. Экспорт в Excel и PDF одной кнопкой.', color: 'bg-emerald-100 text-emerald-700' },
  { icon: AlertCircle, title: 'Отчёты по опозданиям', desc: 'Сводка опозданий по сотрудникам и отделам за любой период.', color: 'bg-amber-100 text-amber-700' },
  { icon: Building2, title: 'Поддержка филиалов', desc: 'Несколько офисов и локаций в одном аккаунте.', color: 'bg-violet-100 text-violet-700' },
  { icon: Globe, title: 'RU / KZ интерфейс', desc: 'Полностью на русском и казахском языках.', color: 'bg-teal-100 text-teal-700' },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Добавьте сотрудников', desc: 'Импортируйте список из Excel или заполните вручную. Назначьте отдел, должность и рабочий график.' },
  { step: '02', title: 'Настройте офисы', desc: 'Укажите адреса и координаты офисов. Задайте радиус геозоны для каждой точки.' },
  { step: '03', title: 'Сотрудники отмечаются', desc: 'Мобильное приложение фиксирует геолокацию и фото. Всё автоматически.' },
  { step: '04', title: 'Вы получаете данные', desc: 'Табель, отчёты по опозданиям, уведомления — всё в реальном времени.' },
];

const FOR_WHOM = [
  { label: 'Ритейл', emoji: '🛒' },
  { label: 'HoReCa', emoji: '🍽️' },
  { label: 'Клиники', emoji: '🏥' },
  { label: 'Образование', emoji: '🎓' },
  { label: 'Производство', emoji: '🏭' },
  { label: 'Офисные команды', emoji: '💼' },
];

const STATS = [
  { value: '2 мин', label: 'Время настройки для нового сотрудника' },
  { value: '98%', label: 'Точность геолокации в городских условиях' },
  { value: '0 ₸', label: 'Стоимость специального оборудования' },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-white">
        {/* Mesh gradient background */}
        <div className="absolute inset-0 bg-hero-mesh opacity-60" />
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-brand-100/40 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-cyan-100/40 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-24 sm:px-6 lg:px-8 lg:pt-32 lg:pb-36">
          <div className="mx-auto max-w-3xl text-center">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
              Новый сервис для Казахстана
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Учёт рабочего времени{' '}
              <span className="gradient-text">без бумажных табелей</span>
            </h1>

            <p className="mt-6 text-lg text-slate-600 leading-relaxed sm:text-xl">
              Timetrack.kz помогает фиксировать приход, уход, опоздания и переработки
              через мобильное приложение, геолокацию и фото-подтверждение.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link href="/contacts" className="btn-primary text-base px-7 py-3 shadow-lg shadow-brand-500/25">
                Запросить демо
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/features" className="btn-secondary text-base px-7 py-3">
                Смотреть возможности
              </Link>
            </div>

            <p className="mt-5 text-sm text-slate-400">
              14 дней бесплатно · Без привязки карты · Поддержка на русском
            </p>
          </div>

          {/* Hero dashboard preview */}
          <div className="mt-16 relative mx-auto max-w-5xl">
            <div className="rounded-2xl border border-slate-200 bg-white p-1 shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/5">
              <div className="rounded-xl bg-slate-50 p-6">
                {/* Mock dashboard preview */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[
                    { label: 'Сотрудников', value: '47', color: 'text-brand-700 bg-brand-50 border-brand-100' },
                    { label: 'Сегодня отметились', value: '38', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
                    { label: 'Опоздания', value: '4', color: 'text-amber-700 bg-amber-50 border-amber-100' },
                  ].map(card => (
                    <div key={card.label} className={`rounded-lg border p-3 ${card.color}`}>
                      <p className="text-2xl font-bold">{card.value}</p>
                      <p className="text-xs font-medium mt-0.5 opacity-80">{card.label}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {[
                    { name: 'Айдос Мусаев', time: '09:02', status: 'Вовремя', color: 'text-emerald-700 bg-emerald-100' },
                    { name: 'Мадина Касенова', time: '09:17', status: 'Опоздание', color: 'text-amber-700 bg-amber-100' },
                    { name: 'Данияр Сейткали', time: '08:55', status: 'Вовремя', color: 'text-emerald-700 bg-emerald-100' },
                  ].map(row => (
                    <div key={row.name} className="flex items-center justify-between rounded-lg bg-white px-4 py-2.5 border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-brand-400 to-cyan-400 flex items-center justify-center text-white text-xs font-bold">
                          {row.name.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-slate-700">{row.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500">{row.time}</span>
                        <span className={`badge ${row.color}`}>{row.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {STATS.map(s => (
              <div key={s.label} className="text-center">
                <p className="text-4xl font-extrabold text-brand-700">{s.value}</p>
                <p className="mt-2 text-sm text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-600 mb-3">Возможности</p>
            <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Всё что нужно для учёта времени
            </h2>
            <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
              Готовый инструмент без долгого внедрения. Настроить за день, использовать с первого дня.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(f => (
              <div key={f.title} className="group card p-6 hover:shadow-card-hover transition-shadow">
                <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl ${f.color}`}>
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link href="/features" className="btn-secondary">
              Все возможности
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Kiosk / Tablet terminal */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-brand-600 mb-3">Планшет-терминал</p>
              <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
                Планшет на входе вместо дорогого СКУД-терминала
              </h2>
              <p className="mt-4 text-lg text-slate-500 leading-relaxed">
                Обычный Android-планшет на ресепшене или у входа на склад работает как точка
                отметки: камера включена постоянно, сотрудник подходит — система находит лицо
                и фиксирует приход без турникетов и пропусков.
              </p>
              <ul className="mt-8 flex flex-col gap-3">
                {[
                  'Не нужен специальный биометрический терминал — подойдёт обычный планшет',
                  'Liveness-проверка (моргание, поворот головы) отличает живого человека от фото',
                  'Если сотрудник не распознан — кнопка «Позвать администратора»',
                  'Подходит для проходной, склада и цехов, где не у всех есть смартфон',
                ].map(point => (
                  <li key={point} className="flex items-start gap-3 text-slate-600 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* Kiosk device mock preview */}
            <div className="flex items-center justify-center">
              <div className="w-full max-w-sm rounded-2xl bg-navy-900 border border-navy-600 p-5 shadow-2xl">
                <div className="mb-4 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-brand-500" />
                  <span className="text-xs text-slate-400">Офис Алматы · Терминал у входа</span>
                </div>
                <div className="flex aspect-square flex-col items-center justify-center gap-3 rounded-xl border border-navy-600 bg-navy-800">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-brand-500 bg-brand-600/20">
                    <CheckCircle2 className="h-8 w-8 text-brand-400" />
                  </div>
                  <p className="text-sm font-semibold text-white">Алексей Петров</p>
                  <p className="text-xs font-medium text-brand-400">Приход отмечен · 08:56</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-600 mb-3">Как работает</p>
            <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Запустите за один день
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((step, idx) => (
              <div key={step.step} className="relative">
                {idx < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden lg:block absolute top-5 left-full w-full h-px bg-gradient-to-r from-brand-200 to-transparent z-0" />
                )}
                <div className="relative z-10">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white text-sm font-bold shadow-brand">
                    {step.step}
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For whom */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-600 mb-3">Для кого</p>
            <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Подходит любому бизнесу
            </h2>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            {FOR_WHOM.map(item => (
              <div
                key={item.label}
                className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-5 py-3.5 shadow-card hover:border-brand-200 hover:shadow-card-hover transition-all"
              >
                <span className="text-2xl">{item.emoji}</span>
                <span className="text-sm font-semibold text-slate-700">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* No equipment */}
      <section className="py-16 bg-gradient-to-br from-brand-600 to-cyan-600">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
                Без дорогого оборудования
              </h2>
              <p className="mt-4 text-lg text-brand-100">
                Не нужны турникеты, терминалы и биометрические сканеры. Только смартфон сотрудника.
              </p>
              <ul className="mt-8 flex flex-col gap-3">
                {[
                  'Работает на любом Android или iOS телефоне',
                  'Фото при отметке заменяет биометрию',
                  'Геолокация подтверждает нахождение в офисе',
                  'Возможность работы без интернета с синхронизацией',
                ].map(point => (
                  <li key={point} className="flex items-start gap-3 text-brand-100 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-brand-300 shrink-0 mt-0.5" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center justify-center">
              <div className="flex gap-4">
                <div className="text-center">
                  <div className="rounded-2xl bg-white/10 border border-white/20 p-6 backdrop-blur">
                    <Smartphone className="h-16 w-16 text-white mx-auto mb-3" />
                    <p className="text-sm font-semibold text-white">Мобильное приложение</p>
                    <p className="text-xs text-brand-200 mt-1">Android & iOS</p>
                  </div>
                </div>
                <div className="text-center">
                  <div className="rounded-2xl bg-white/10 border border-white/20 p-6 backdrop-blur">
                    <TrendingUp className="h-16 w-16 text-white mx-auto mb-3" />
                    <p className="text-sm font-semibold text-white">Веб-панель</p>
                    <p className="text-xs text-brand-200 mt-1">Для руководителей</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Kazakhstan ready */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="card p-8 lg:p-12 border-brand-100 bg-gradient-to-br from-brand-50 to-cyan-50">
            <div className="flex flex-col lg:flex-row gap-8 items-center">
              <div className="text-5xl lg:text-6xl">🇰🇿</div>
              <div className="flex-1">
                <h2 className="text-2xl font-extrabold text-slate-900 mb-3">
                  Готово для Казахстана
                </h2>
                <p className="text-slate-600 leading-relaxed">
                  Учитываем казахстанское трудовое законодательство, государственные праздники,
                  поддерживаем оба государственных языка и локальные форматы документов.
                  Серверы в Казахстане, данные не покидают страну.
                </p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                {['Трудовой кодекс РК', 'Казахский и русский', 'Серверы в KZ', 'Kaspi Pay готово'].map(item => (
                  <div key={item} className="flex items-center gap-2 text-sm font-medium text-brand-700">
                    <CheckCircle2 className="h-4 w-4 text-brand-500" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 bg-slate-900">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            Готовы начать?
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Оставьте заявку и мы настроим систему под вашу компанию за один рабочий день.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contacts" className="btn-primary text-base px-8 py-3">
              Запросить демо
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/pricing" className="btn-secondary bg-transparent border-slate-600 text-slate-300 hover:bg-slate-800 hover:border-slate-500 text-base px-8 py-3">
              Смотреть тарифы
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
