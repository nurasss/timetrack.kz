import { AlertTriangle, CheckCircle2, Clock3, MapPin, Smartphone } from 'lucide-react';
import { DataTable, Column } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { attentionItems, todayRows } from '../../lib/panel-data';

type TodayRow = (typeof todayRows)[number];

function badgeTone(tone: string): 'success' | 'warning' | 'danger' | 'info' {
  if (tone === 'success' || tone === 'warning' || tone === 'danger' || tone === 'info') return tone;
  return 'info';
}

export default function TodayPage() {
  const columns: Column<TodayRow>[] = [
    { header: 'Сотрудник', accessor: (row) => <span className="font-black text-slate-900">{row.employee}</span> },
    { header: 'Отдел', accessor: (row) => row.department },
    { header: 'График', accessor: (row) => row.planned },
    { header: 'Приход', accessor: (row) => row.checkIn },
    { header: 'Уход', accessor: (row) => row.checkOut },
    { header: 'Локация', accessor: (row) => row.location },
    { header: 'Источник', accessor: (row) => row.source },
    { header: 'Face / GPS', accessor: (row) => `${row.face} · ${row.gps}` },
    { header: 'Статус', accessor: (row) => <StatusBadge tone={badgeTone(row.tone)}>{row.status}</StatusBadge> }
  ];

  return (
    <div>
      <PageHeader title="Сегодня" subtitle="Оперативный контроль рабочего дня: отметки, отсутствия, GPS, liveness и источники событий.">
        <div className="flex flex-wrap gap-2">
          <button className="control">Все филиалы</button>
          <button className="control">Все отделы</button>
          <button className="primary-control">Ручная корректировка</button>
        </div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Пришли" value="0" trend="Сотрудников пока нет" tone="success" icon={<CheckCircle2 size={22} />} />
        <StatCard label="Опоздали" value="0" trend="Нет отметок" tone="warning" icon={<Clock3 size={22} />} />
        <StatCard label="Нет отметки" value="0" trend="Нет сотрудников" tone="danger" icon={<AlertTriangle size={22} />} />
        <StatCard label="Android отметки" value="0" trend="Нет событий" tone="info" icon={<Smartphone size={22} />} />
        <StatCard label="Вне геозоны" value="0" trend="Нет событий" tone="warning" icon={<MapPin size={22} />} />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-4">
        {attentionItems.map((item) => (
          <div key={item.title} className="card p-4">
            <StatusBadge tone={badgeTone(item.tone)}>{item.tone === 'danger' ? 'Критично' : 'Внимание'}</StatusBadge>
            <p className="mt-3 font-black text-slate-900">{item.title}</p>
            <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="input-shell">Дата · 17.06.2026</span>
        <span className="input-shell">Статус · все</span>
        <span className="input-shell">Источник · Android/Kiosk/Terminal</span>
        <span className="input-shell">Face score · все</span>
      </div>

      <DataTable columns={columns} data={todayRows} />
    </div>
  );
}
