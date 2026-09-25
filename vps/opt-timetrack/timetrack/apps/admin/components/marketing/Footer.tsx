import Link from 'next/link';
import { Clock, Mail, Phone, MessageSquare } from 'lucide-react';

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-1 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-cyan-500">
                <Clock className="h-4 w-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-lg font-bold text-slate-900">
                Timetrack<span className="text-brand-600">.kz</span>
              </span>
            </Link>
            <p className="text-sm text-slate-500 leading-relaxed">
              Современный учёт рабочего времени для казахстанских компаний.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <a href="tel:+77009111213" className="flex items-center gap-2 text-sm text-slate-500 hover:text-brand-600">
                <Phone className="h-3.5 w-3.5" />
                +7 700 911 12 13
              </a>
              <a href="https://wa.me/77054345148" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-slate-500 hover:text-brand-600">
                <MessageSquare className="h-3.5 w-3.5" />
                +7 705 434 51 48 (WhatsApp)
              </a>
              <a href="mailto:hello@timetrack.kz" className="flex items-center gap-2 text-sm text-slate-500 hover:text-brand-600">
                <Mail className="h-3.5 w-3.5" />
                hello@timetrack.kz
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Продукт</h3>
            <ul className="flex flex-col gap-3">
              {[
                { href: '/features', label: 'Возможности' },
                { href: '/pricing', label: 'Тарифы' },
                { href: '/contacts', label: 'Запросить демо' },
              ].map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-slate-500 hover:text-brand-600 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Компания</h3>
            <ul className="flex flex-col gap-3">
              {[
                { href: '#', label: 'О нас' },
                { href: '#', label: 'Блог' },
                { href: '#', label: 'Вакансии' },
              ].map(l => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-slate-500 hover:text-brand-600 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Правовая информация</h3>
            <ul className="flex flex-col gap-3">
              {[
                { href: '#', label: 'Политика конфиденциальности' },
                { href: '#', label: 'Пользовательское соглашение' },
                { href: '#', label: 'Обработка данных' },
              ].map(l => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-slate-500 hover:text-brand-600 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} Timetrack.kz. Все права защищены.
          </p>
          <p className="text-xs text-slate-400">
            Разработано в Казахстане 🇰🇿
          </p>
        </div>
      </div>
    </footer>
  );
}
