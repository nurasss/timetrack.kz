import type { ReactNode } from 'react';
import { Bell, Database, LockKeyhole, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { auditEvents, workspace } from '../../lib/panel-data';

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Настройки" subtitle="Компания, рабочее время, отметки, безопасность, уведомления, хранение данных и audit log.">
        <button className="primary-control">Сохранить изменения</button>
      </PageHeader>

      <div className="mb-6 flex flex-wrap gap-2">
        {['Компания', 'Рабочее время', 'Отметки', 'Безопасность', 'Уведомления', 'Хранение данных', 'Audit log'].map((tab, index) => (
          <button key={tab} className={index === 0 ? 'primary-control' : 'control'}>{tab}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="card p-6">
          <SectionTitle icon={<ShieldCheck size={20} />} title="Компания" />
          <div className="mt-5 space-y-3">
            <Field label="Название" value={workspace.company} />
            <Field label="БИН" value={workspace.bin} />
            <Field label="Часовой пояс" value={workspace.timezone} />
            <Field label="Язык" value="RU / KZ / EN" />
          </div>
        </section>
        <section className="card p-6">
          <SectionTitle icon={<LockKeyhole size={20} />} title="Безопасность" />
          <div className="mt-5 space-y-3">
            <Field label="MFA для администраторов" value="Включено" tone="success" />
            <Field label="JWT access token" value="15 минут" />
            <Field label="Refresh token" value="30 дней" />
            <Field label="IP whitelist" value="Enterprise only" tone="info" />
          </div>
        </section>
        <section className="card p-6">
          <SectionTitle icon={<Bell size={20} />} title="Уведомления" />
          <div className="mt-5 space-y-3">
            <Field label="Mobile push" value="Включено" tone="success" />
            <Field label="Telegram Bot" value="Подключено" tone="success" />
            <Field label="Email" value="Отключено" tone="neutral" />
            <Field label="Webhook device.offline" value="Активен" tone="success" />
          </div>
        </section>
        <section className="card p-6">
          <SectionTitle icon={<Database size={20} />} title="Хранение данных" />
          <div className="mt-5 space-y-3">
            <Field label="Селфи отметок" value="180 дней" />
            <Field label="Журнал входов" value="12 месяцев" />
            <Field label="Архив табелей" value="5 лет" />
            <Field label="Data residency" value="Kazakhstan" tone="success" />
          </div>
        </section>
      </div>

      <section className="mt-6 card p-6">
        <h2 className="text-lg font-black text-slate-900">Audit log</h2>
        <div className="mt-4 divide-y divide-line">
          {auditEvents.map((event) => (
            <div key={`${event.actor}-${event.action}`} className="grid gap-2 py-3 md:grid-cols-[180px_1fr_120px_90px] md:items-center">
              <span className="font-bold text-slate-900">{event.actor}</span>
              <span className="text-sm text-slate-600">{event.action}</span>
              <StatusBadge tone="info">{event.area}</StatusBadge>
              <span className="text-sm font-bold text-slate-400">{event.time}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="rounded-lg bg-emerald-50 p-2 text-primary">{icon}</span>
      <h2 className="text-xl font-black">{title}</h2>
    </div>
  );
}

function Field({ label, value, tone = 'info' }: { label: string; value: string; tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 p-4">
      <span className="text-sm font-bold text-slate-500">{label}</span>
      <StatusBadge tone={tone}>{value}</StatusBadge>
    </div>
  );
}
