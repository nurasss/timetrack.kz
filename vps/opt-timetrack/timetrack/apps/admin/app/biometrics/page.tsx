import { AlertTriangle, FileCheck2, Fingerprint, ShieldCheck } from 'lucide-react';
import { DataTable, Column } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { biometrics } from '../../lib/panel-data';

type BiometricProfile = (typeof biometrics)[number];

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (status === 'Шаблон создан' || status === 'Фото загружено') return 'success';
  if (status === 'Низкое качество') return 'warning';
  if (status === 'Ожидает согласия') return 'info';
  return 'neutral';
}

export default function BiometricsPage() {
  const columns: Column<BiometricProfile>[] = [
    { header: 'Сотрудник', accessor: (row) => <span className="font-black text-slate-900">{row.employee}</span> },
    { header: 'Отдел', accessor: (row) => row.department },
    { header: 'Статус', accessor: (row) => <StatusBadge tone={statusTone(row.status)}>{row.status}</StatusBadge> },
    { header: 'Качество', accessor: (row) => row.quality },
    { header: 'Согласие', accessor: (row) => row.consent },
    { header: 'Последняя проверка', accessor: (row) => row.lastCheck },
    { header: 'Отказы', accessor: (row) => row.failures }
  ];

  return (
    <div>
      <PageHeader title="Биометрия" subtitle="Профили лиц, согласия сотрудников, качество фото и liveness-проверки.">
        <div className="flex flex-wrap gap-2">
          <button className="control">Экспорт журнала</button>
          <button className="primary-control">Запросить согласие</button>
        </div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Шаблоны лиц" value="0" trend="Сотрудников пока нет" tone="success" icon={<Fingerprint size={22} />} />
        <StatCard label="Ожидают согласие" value="0" trend="Нет сотрудников" tone="info" icon={<FileCheck2 size={22} />} />
        <StatCard label="Низкое качество" value="0" trend="Нет фото" tone="warning" icon={<AlertTriangle size={22} />} />
        <StatCard label="Liveness pass" value="—" trend="Нет проверок" tone="success" icon={<ShieldCheck size={22} />} />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {['Лицо закрыто', 'Плохое освещение', 'Несколько лиц в кадре'].map((issue, index) => (
          <div key={issue} className="card p-5">
            <StatusBadge tone={index === 0 ? 'danger' : 'warning'}>{index + 2} случая</StatusBadge>
            <h2 className="mt-3 text-lg font-black text-slate-900">{issue}</h2>
            <p className="mt-2 text-sm text-slate-500">События попали в журнал биометрии и требуют проверки HR или Security Officer.</p>
          </div>
        ))}
      </div>

      <DataTable columns={columns} data={biometrics} />
    </div>
  );
}
