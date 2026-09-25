import Link from 'next/link';
import { ArrowRight, CheckCircle2, MapPin, ShieldCheck, Timer } from 'lucide-react';

const features = [
  { icon: Timer, title: 'Учет времени', text: 'Приходы, уходы, опоздания и ранние уходы в едином журнале.' },
  { icon: MapPin, title: 'Геозоны', text: 'Проверка локации сотрудника через GPS и радиус офиса.' },
  { icon: ShieldCheck, title: 'Контроль доступа', text: 'Роли, JWT-авторизация и изоляция данных каждой компании.' }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#07111D] text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-xl font-black text-slate-950">T</div>
          <span className="text-xl font-black">Timetrack.kz</span>
        </div>
        <Link href="/login" className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950">Войти</Link>
      </header>
      <main>
        <section className="mx-auto grid min-h-[620px] max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
              <CheckCircle2 size={16} className="text-primary" />
              B2B SaaS для компаний Казахстана
            </div>
            <h1 className="text-5xl font-black leading-tight lg:text-6xl">Timetrack.kz</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Рабочий MVP для учета сотрудников, отметок, табеля, заявок и отчетов. Backend, база данных и API уже входят в продуктовый контур.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-4 font-black text-slate-950">
                Войти в кабинет <ArrowRight size={18} />
              </Link>
              <Link href="/register" className="rounded-2xl border border-white/15 px-6 py-4 font-bold text-white">Подключить компанию</Link>
            </div>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="rounded-3xl bg-[#F3F6FA] p-5 text-slate-950">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-500">Сегодня</p>
                  <h2 className="text-2xl font-black">0 на работе</h2>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-black text-emerald-700">0%</span>
              </div>
              <div className="grid gap-3">
                {['Данных пока нет', 'Добавьте сотрудников', 'Первые отметки появятся здесь'].map((item) => (
                  <div key={item} className="rounded-2xl bg-white p-4 text-sm font-bold shadow-sm">{item}</div>
                ))}
              </div>
            </div>
          </div>
        </section>
        <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-14 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <Icon className="text-primary" size={24} />
                <h2 className="mt-5 text-xl font-black">{feature.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">{feature.text}</p>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
