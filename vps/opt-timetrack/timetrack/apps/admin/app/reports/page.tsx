import { BarChart3, Clock, FileSpreadsheet, Send, Settings2, TrendingUp } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';

const reports = [
  { title: 'Посещаемость и рабочее время', desc: 'Дни по сотрудникам, приходы и уходы', icon: Clock, tone: 'success' },
  { title: 'Дисциплина смен', desc: 'Графики, опоздания и отсутствия', icon: BarChart3, tone: 'warning' },
  { title: 'Проверки по GPS', desc: 'Подозрительные отметки и геозоны', icon: TrendingUp, tone: 'danger' },
  { title: 'Финальный табель', desc: 'XLS/PDF для бухгалтерии и HR', icon: FileSpreadsheet, tone: 'info' }
] as const;

export default function ReportsPage() {
  return (
    <div>
      <PageHeader title="Отчеты" subtitle="Операционные отчеты, табель, дисциплина, GPS-проверки и экспорт для бухгалтерии.">
        <button className="primary-control"><Send size={16} /> Сформировать</button>
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <div key={report.title} className="card p-5">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-primary"><Icon size={22} /></div>
              <StatusBadge tone={report.tone}>{report.title.includes('Табель') ? 'Бухгалтерия' : 'HR'}</StatusBadge>
              <h2 className="mt-3 text-lg font-black text-slate-900">{report.title}</h2>
              <p className="mt-2 text-sm text-slate-500">{report.desc}</p>
              <button className="control mt-5">Открыть</button>
            </div>
          );
        })}
      </div>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <Settings2 className="text-primary" size={22} />
            <h2 className="text-lg font-black text-slate-900">Report Builder</h2>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Период" value="Июнь 2026" />
            <Field label="Филиалы" value="Все активные" />
            <Field label="Поля" value="Часы, GPS, face, статусы" />
            <Field label="Экспорт" value="Excel, PDF, 1C" />
          </div>
          <button className="primary-control mt-5">Собрать отчет</button>
        </div>
        <div className="card p-5">
          <h2 className="text-lg font-black text-slate-900">Плановые выгрузки</h2>
          <div className="mt-4 space-y-3">
            {['Еженедельная дисциплина для Owner', 'Табель за месяц для бухгалтерии', 'Webhook timesheet.closed в 1С'].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                <span className="font-bold text-slate-700">{item}</span>
                <StatusBadge tone="success">Активно</StatusBadge>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-1 font-black text-slate-900">{value}</p>
    </div>
  );
}
