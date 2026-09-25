import { BadgeDollarSign, CalendarDays, CreditCard, Users } from 'lucide-react';
import { DataTable, Column } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { billingHistory, workspace } from '../../lib/panel-data';

type BillingRow = (typeof billingHistory)[number];

export default function BillingPage() {
  const columns: Column<BillingRow>[] = [
    { header: 'Дата', accessor: (row) => row.date },
    { header: 'Сумма', accessor: (row) => <span className="font-black text-slate-900">{row.amount}</span> },
    { header: 'Статус', accessor: (row) => <StatusBadge tone="success">{row.status}</StatusBadge> },
    { header: 'Документ', accessor: (row) => row.document }
  ];

  return (
    <div>
      <PageHeader title="Биллинг" subtitle="Текущий тариф, лимиты, счета, документы и условия оплаты компании.">
        <div className="flex flex-wrap gap-2">
          <button className="control">Реквизиты</button>
          <button className="primary-control">Обновить тариф</button>
        </div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Тариф" value={workspace.plan} trend="Starter" tone="success" icon={<BadgeDollarSign size={22} />} />
        <StatCard label="Активные сотрудники" value={`${workspace.activeEmployees}/${workspace.employeeLimit}`} trend="0% лимита" tone="info" icon={<Users size={22} />} />
        <StatCard label="Следующее списание" value="—" trend={workspace.monthlyPrice} tone="warning" icon={<CalendarDays size={22} />} />
        <StatCard label="Способ оплаты" value="—" trend="Не настроен" tone="success" icon={<CreditCard size={22} />} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="card p-5">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <StatusBadge tone="neutral">Не настроено</StatusBadge>
              <h2 className="mt-3 text-2xl font-black text-slate-900">Starter</h2>
              <p className="mt-2 text-sm text-slate-500">Данные биллинга и лимиты можно настроить после запуска компании.</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4 text-right">
              <p className="text-sm font-bold text-slate-500">Стоимость</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{workspace.monthlyPrice}</p>
              <p className="mt-1 text-xs font-bold text-slate-400">в месяц</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            {['Grace period 7 дней', 'Read-only после просрочки', 'Экспорт не блокируется мгновенно'].map((item) => (
              <div key={item} className="rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{item}</div>
            ))}
          </div>
        </section>
        <section className="card p-5">
          <h2 className="text-lg font-black text-slate-900">Лимиты</h2>
          <div className="mt-4 space-y-4">
            <Limit label="Сотрудники" value={0} />
            <Limit label="Устройства" value={0} />
            <Limit label="Хранилище фото" value={0} />
            <Limit label="API requests" value={0} />
          </div>
        </section>
      </div>

      <h2 className="mb-3 text-lg font-black text-slate-900">История счетов</h2>
      <DataTable columns={columns} data={billingHistory} />
    </div>
  );
}

function Limit({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-bold text-slate-600">{label}</span>
        <span className="font-black text-slate-900">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
