import { BookOpen, Headphones, MessageSquareText, Search } from 'lucide-react';
import { DataTable, Column } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { supportTickets } from '../../lib/panel-data';

type SupportTicket = (typeof supportTickets)[number];

function priorityTone(priority: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (priority === 'Высокий') return 'danger';
  if (priority === 'Средний') return 'warning';
  return 'neutral';
}

export default function SupportPage() {
  const columns: Column<SupportTicket>[] = [
    { header: 'Номер', accessor: (row) => <span className="font-black text-slate-900">{row.id}</span> },
    { header: 'Тема', accessor: (row) => row.title },
    { header: 'Статус', accessor: (row) => <StatusBadge tone="info">{row.status}</StatusBadge> },
    { header: 'Приоритет', accessor: (row) => <StatusBadge tone={priorityTone(row.priority)}>{row.priority}</StatusBadge> },
    { header: 'Обновлено', accessor: (row) => row.updated }
  ];

  return (
    <div>
      <PageHeader title="Поддержка" subtitle="Тикеты, база знаний, инструкции по Android/Kiosk и связь с командой Timetrack.kz.">
        <button className="primary-control">Создать тикет</button>
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Открытые тикеты" value="3" trend="1 высокий приоритет" tone="warning" icon={<Headphones size={22} />} />
        <StatCard label="Среднее SLA" value="18 мин" trend="Business support" tone="success" icon={<MessageSquareText size={22} />} />
        <StatCard label="Статьи базы" value="42" trend="Android, Kiosk, 1C, billing" tone="info" icon={<BookOpen size={22} />} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="card p-5">
          <h2 className="text-lg font-black text-slate-900">База знаний</h2>
          <div className="input-shell mt-4">
            <Search size={16} className="text-slate-400" />
            <input className="w-full bg-transparent outline-none" placeholder="Поиск по инструкциям" />
          </div>
          <div className="mt-4 space-y-2">
            {['Подключение Android-приложения', 'Настройка Kiosk-планшета', 'Экспорт табеля в Excel', 'Интеграция с 1С'].map((article) => (
              <a key={article} className="block rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-700" href="#">
                {article}
              </a>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-black text-slate-900">Тикеты</h2>
          <DataTable columns={columns} data={supportTickets} />
        </section>
      </div>
    </div>
  );
}
