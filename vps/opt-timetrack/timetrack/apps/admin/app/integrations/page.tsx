import { Settings } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { integrations } from '../../../../packages/shared/mock-data';

const webhookEvents = ['employee.created', 'attendance.checked_in', 'attendance.checked_out', 'violation.created', 'leave.approved', 'timesheet.closed', 'device.offline'];

export default function IntegrationsPage() {
  return (
    <div>
      <PageHeader title="Интеграции" subtitle="1С, Bitrix24, видео-терминалы, Telegram, Open API и платежи." />
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {integrations.map((integration) => <div key={integration.id} className="card p-5"><div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-lg font-black text-slate-900">{integration.name}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{integration.description}</p></div><StatusBadge tone={statusTone(integration.status)}>{statusLabel(integration.status)}</StatusBadge></div><button className="control mt-4"><Settings className="mr-2 inline" size={16} />Настроить</button></div>)}
      </div>
      <section className="card p-5">
        <h2 className="text-lg font-black text-slate-900">Webhook events</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {webhookEvents.map((event) => <span key={event} className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-sm font-bold text-slate-700">{event}</span>)}
        </div>
      </section>
    </div>
  );
}

function statusLabel(status: string) { return status === 'connected' ? 'Подключено' : status === 'developing' ? 'В разработке' : 'Не подключено'; }
function statusTone(status: string): 'success' | 'warning' | 'neutral' { return status === 'connected' ? 'success' : status === 'developing' ? 'warning' : 'neutral'; }
