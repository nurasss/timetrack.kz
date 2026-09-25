import type { Metadata } from 'next';
import Link from 'next/link';
import {
  MapPin, Camera, FileSpreadsheet, AlertCircle, Clock, Calendar,
  Plane, Smartphone, WifiOff, Plug, BarChart3, Users, ArrowRight,
} from 'lucide-react';
import { MarketingHeader } from '@/components/marketing/Header';
import { MarketingFooter } from '@/components/marketing/Footer';

export const metadata: Metadata = {
  title: 'Возможности — Timetrack.kz',
};

const FEATURE_SECTIONS = [
  {
    icon: Clock,
    color: 'from-brand-500 to-brand-700',
    title: 'Учёт прихода и ухода',
    desc: 'Каждый приход и уход фиксируется с точным временем, фотографией и геолокацией. Никаких бумажных журналов.',
    points: ['Отметка через мобильное приложение', 'Автоопределение опоздания', 'История всех отметок', 'Ручная корректировка администратором'],
  },
  {
    icon: MapPin,
    color: 'from-cyan-500 to-cyan-700',
    title: 'Геофенсинг',
    desc: 'Система проверяет, находится ли сотрудник в радиусе разрешённой зоны. Отметка вне зоны фиксируется как нарушение.',
    points: ['Настраиваемый радиус для каждой точки', 'Уведомления о выходе за пределы зоны', 'Точность до 5 метров', 'Несколько офисов в одном аккаунте'],
  },
  {
    icon: Camera,
    color: 'from-violet-500 to-violet-700',
    title: 'Фото-подтверждение',
    desc: 'Сотрудник делает селфи при отметке. Фотографии хранятся привязанными к конкретной отметке.',
    points: ['Автоматическая фотосъёмка при отметке', 'Хранение фото в защищённом облаке', 'Просмотр из панели администратора', 'Настраиваемый срок хранения'],
  },
  {
    icon: FileSpreadsheet,
    color: 'from-emerald-500 to-emerald-700',
    title: 'Табель',
    desc: 'Автоматически формирует табель учёта рабочего времени по форме Т-13 или в своём формате.',
    points: ['Табель за любой период', 'Экспорт в Excel и PDF', 'Учёт выходных и праздников Казахстана', 'Разбивка по отделам и сотрудникам'],
  },
  {
    icon: BarChart3,
    color: 'from-amber-500 to-orange-600',
    title: 'Отчёты',
    desc: 'Наглядные отчёты по опозданиям, переработкам и отсутствиям для принятия решений.',
    points: ['Топ опаздывающих сотрудников', 'Отчёт по переработкам', 'Аналитика посещаемости', 'Фильтрация по отделу и периоду'],
  },
  {
    icon: Clock,
    color: 'from-teal-500 to-teal-700',
    title: 'Графики работы',
    desc: 'Настройте рабочее расписание для разных категорий сотрудников: пятидневка, сменная работа и другие.',
    points: ['Произвольные часы начала и конца', 'Поддержка 2/2, 5/2, 6/1 и других форматов', 'Индивидуальные допуски на опоздание', 'Назначение графиков сотрудникам'],
  },
  {
    icon: Calendar,
    color: 'from-rose-500 to-rose-700',
    title: 'Отпуска и отсутствия',
    desc: 'Управляйте заявками на отпуск, больничный и командировки прямо в системе.',
    points: ['Типы: отпуск, больничный, командировка, отгул', 'Согласование через приложение или панель', 'Интеграция с табелем', 'История всех заявок'],
  },
  {
    icon: Smartphone,
    color: 'from-blue-500 to-blue-700',
    title: 'Мобильное приложение',
    desc: 'Сотрудники используют мобильное приложение для отметок. Простой и понятный интерфейс.',
    points: ['Android и iOS', 'Интерфейс на русском и казахском', 'Уведомления о напоминаниях', 'История своих отметок'],
  },
  {
    icon: WifiOff,
    color: 'from-slate-500 to-slate-700',
    title: 'Offline-режим',
    desc: 'В следующей версии: отметки сохраняются локально при отсутствии интернета и синхронизируются при подключении.',
    points: ['Сохранение отметок без интернета', 'Автоматическая синхронизация', 'Защита от двойных записей', 'Метка об оффлайн-отметке в системе'],
    comingSoon: true,
  },
  {
    icon: Plug,
    color: 'from-indigo-400 to-indigo-600',
    title: 'Интеграции',
    desc: 'Планируемые интеграции: 1С, Bitrix24, Hikvision, корпоративные LDAP/AD.',
    points: ['1С:Предприятие — синхронизация сотрудников и зарплат', 'Bitrix24 CRM — учёт времени в задачах', 'Hikvision — привязка к турникетам', 'REST API для любых систем'],
    comingSoon: true,
  },
];

export default function FeaturesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />

      <section className="bg-white border-b border-slate-200 py-16 lg:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600 mb-3">Возможности</p>
          <h1 className="text-4xl font-extrabold text-slate-900 sm:text-5xl">
            Всё для контроля рабочего времени
          </h1>
          <p className="mt-5 text-lg text-slate-500">
            Современный инструмент, который заменяет бумажные журналы, пропускную систему и ручной табель.
          </p>
        </div>
      </section>

      <section className="py-16 lg:py-20 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-12">
            {FEATURE_SECTIONS.map((section, idx) => (
              <div
                key={section.title}
                className={`card p-6 lg:p-8 flex flex-col lg:flex-row gap-8 items-start ${section.comingSoon ? 'opacity-80' : ''}`}
              >
                {/* Icon */}
                <div className={`shrink-0 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${section.color} shadow-lg`}>
                  <section.icon className="h-7 w-7 text-white" />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-bold text-slate-900">{section.title}</h2>
                    {section.comingSoon && (
                      <span className="badge bg-amber-100 text-amber-700">Скоро</span>
                    )}
                  </div>
                  <p className="text-slate-500 mb-4">{section.desc}</p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {section.points.map(point => (
                      <li key={point} className="flex items-start gap-2 text-sm text-slate-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0 mt-1.5" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 bg-brand-600">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl font-extrabold text-white">Попробуйте Timetrack.kz бесплатно</h2>
          <p className="mt-3 text-brand-200">14 дней без ограничений, без привязки карты</p>
          <div className="mt-6">
            <Link href="/contacts" className="inline-flex items-center gap-2 bg-white text-brand-700 font-semibold rounded-lg px-7 py-3 hover:bg-brand-50 transition-colors text-sm">
              Начать бесплатно
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
