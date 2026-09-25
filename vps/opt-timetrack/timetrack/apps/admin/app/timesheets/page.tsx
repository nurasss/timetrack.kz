import { Download, FileText, LockKeyhole, RefreshCcw } from 'lucide-react';
import { DataTable, Column } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { timesheetRows } from '../../lib/panel-data';

type TimesheetRow = (typeof timesheetRows)[number];

const days = Array.from({ length: 31 }, (_, index) => index + 1);
const statuses = ['full', 'full', 'late', 'full', 'absent', 'business', 'weekend'] as const;

export default function TimesheetsPage() {
  const columns: Column<TimesheetRow>[] = [
    { header: 'Сотрудник', accessor: (row) => <span className="font-black text-slate-900">{row.employee}</span> },
    { header: 'Отдел', accessor: (row) => row.department },
    { header: 'Часы', accessor: (row) => `${row.regular} ч` },
    { header: 'Переработки', accessor: (row) => `${row.overtime} ч` },
    { header: 'Опоздания', accessor: (row) => row.late },
    { header: 'Отсутствия', accessor: (row) => row.absence },
    { header: 'Статус', accessor: (row) => <StatusBadge tone={row.status === 'Готов к закрытию' ? 'success' : 'warning'}>{row.status}</StatusBadge> }
  ];

  return (
    <div>
      <PageHeader title="Табель" subtitle="Месячная сетка для бухгалтерии: часы, переработки, отсутствия, отпуска и спорные отметки.">
        <div className="flex flex-wrap gap-2">
          <button className="control"><RefreshCcw size={16} /> Пересчитать</button>
          <button className="control"><Download size={16} /> XLS</button>
          <button className="control"><FileText size={16} /> PDF</button>
          <button className="primary-control"><LockKeyhole size={16} /> Закрыть месяц</button>
        </div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-4">
        {[
          ['Готовность', '86%', 'warning'],
          ['Норма часов', '160 ч', 'info'],
          ['Переработки', '42 ч', 'warning'],
          ['Спорные отметки', '4', 'danger']
        ].map(([label, value, tone]) => (
          <div key={label} className="card p-5">
            <StatusBadge tone={tone as 'warning' | 'info' | 'danger'}>{label}</StatusBadge>
            <p className="mt-3 text-3xl font-black text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <section className="mb-6">
        <h2 className="mb-3 text-lg font-black text-slate-900">Свод за июнь</h2>
        <DataTable columns={columns} data={timesheetRows} />
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line p-5">
          <h2 className="text-lg font-black text-slate-900">Календарная сетка</h2>
          <p className="mt-1 text-sm text-slate-500">Цвет показывает полный день, опоздание, отсутствие, отпуск или выходной.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left font-black text-slate-600">Сотрудник</th>
                {days.map((day) => <th key={day} className="px-2 py-3 text-center text-xs font-black text-slate-500">{day}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {timesheetRows.map((row, rowIndex) => (
                <tr key={row.employee}>
                  <td className="sticky left-0 z-10 bg-white px-4 py-3 font-bold text-slate-800">{row.employee}</td>
                  {days.map((day) => (
                    <td key={day} className="px-2 py-3 text-center">
                      <span className={`inline-block h-7 w-7 rounded-lg ${color(statuses[(day + rowIndex) % statuses.length])}`} title="status" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function color(status: string) {
  return status === 'full' ? 'bg-emerald-500' : status === 'late' ? 'bg-amber-400' : status === 'absent' ? 'bg-red-500' : status === 'business' ? 'bg-blue-500' : 'bg-slate-200';
}
