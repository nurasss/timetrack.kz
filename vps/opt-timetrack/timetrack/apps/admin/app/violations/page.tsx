import { AlertTriangle, Clock3, MapPinned, ShieldAlert } from 'lucide-react';
import { DataTable, Column } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { violations } from '../../lib/panel-data';

type Violation = (typeof violations)[number];

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (status === 'Закрыто') return 'success';
  if (status === 'Нужно решение') return 'danger';
  if (status === 'На проверке') return 'warning';
  return 'info';
}

export default function ViolationsPage() {
  const columns: Column<Violation>[] = [
    { header: 'Сотрудник', accessor: (row) => <span className="font-black text-slate-900">{row.employee}</span> },
    { header: 'Тип', accessor: (row) => row.type },
    { header: 'Когда', accessor: (row) => row.when },
    { header: 'Должно быть', accessor: (row) => row.expected },
    { header: 'Факт', accessor: (row) => row.actual },
    { header: 'Сигнал', accessor: (row) => row.signal },
    { header: 'Источник', accessor: (row) => row.source },
    { header: 'Статус', accessor: (row) => <StatusBadge tone={statusTone(row.status)}>{row.status}</StatusBadge> }
  ];

  return (
    <div>
      <PageHeader title="Нарушения" subtitle="Опоздания, отсутствия, GPS, liveness, неизвестные устройства и ручные корректировки.">
        <div className="flex flex-wrap gap-2">
          <button className="control">Назначить проверку</button>
          <button className="primary-control">Закрыть выбранные</button>
        </div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Открыто" value="0" trend="Нарушений нет" tone="danger" icon={<ShieldAlert size={22} />} />
        <StatCard label="Опоздания" value="0" trend="Сегодня" tone="warning" icon={<Clock3 size={22} />} />
        <StatCard label="GPS / зона" value="0" trend="Нет событий" tone="warning" icon={<MapPinned size={22} />} />
        <StatCard label="Liveness / face" value="0" trend="Нет проверок" tone="danger" icon={<AlertTriangle size={22} />} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="input-shell">Тип · все</span>
        <span className="input-shell">Статус · открытые</span>
        <span className="input-shell">Локация · все</span>
        <span className="input-shell">Источник · Android/Kiosk</span>
      </div>

      <DataTable columns={columns} data={violations} />
    </div>
  );
}
