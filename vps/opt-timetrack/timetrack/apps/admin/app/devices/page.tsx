import { BatteryCharging, Cpu, QrCode, Smartphone } from 'lucide-react';
import { DataTable, Column } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { devices } from '../../lib/panel-data';

type Device = (typeof devices)[number];

function deviceTone(status: string): 'success' | 'danger' | 'warning' {
  if (status === 'online') return 'success';
  if (status === 'offline') return 'danger';
  return 'warning';
}

export default function DevicesPage() {
  const columns: Column<Device>[] = [
    { header: 'Устройство', accessor: (row) => <span className="font-black text-slate-900">{row.name}</span> },
    { header: 'Тип', accessor: (row) => row.type },
    { header: 'Локация', accessor: (row) => row.location },
    { header: 'Последний сигнал', accessor: (row) => row.lastSeen },
    { header: 'Версия', accessor: (row) => row.version },
    { header: 'Питание', accessor: (row) => row.battery },
    { header: 'Синхронизация', accessor: (row) => row.sync },
    { header: 'Статус', accessor: (row) => <StatusBadge tone={deviceTone(row.status)}>{row.status === 'online' ? 'Online' : row.status === 'offline' ? 'Offline' : 'Внимание'}</StatusBadge> }
  ];

  return (
    <div>
      <PageHeader title="Устройства" subtitle="Android-телефоны сотрудников, kiosk-планшеты, терминалы и источники API.">
        <div className="flex flex-wrap gap-2">
          <button className="control"><QrCode size={16} /> QR привязки</button>
          <button className="primary-control">Добавить устройство</button>
        </div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Всего устройств" value={devices.length} trend="3 типа источников" tone="info" icon={<Cpu size={22} />} />
        <StatCard label="Android активны" value="0" trend="За последние 24 часа" tone="success" icon={<Smartphone size={22} />} />
        <StatCard label="Offline" value="0" trend="Нет подключенных устройств" tone="danger" icon={<BatteryCharging size={22} />} />
        <StatCard label="Kiosk sync" value="—" trend="Подключите kiosk" tone="info" icon={<QrCode size={22} />} />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card p-5">
          <h2 className="text-lg font-black text-slate-900">Подключение Kiosk</h2>
          <div className="mt-4 grid h-40 place-items-center rounded-lg border border-dashed border-line bg-slate-50">
            <QrCode size={72} className="text-slate-700" />
          </div>
          <p className="mt-3 text-sm text-slate-500">QR-код действует 10 минут и привязывает планшет к выбранной локации.</p>
        </div>
        <div className="card p-5 xl:col-span-2">
          <h2 className="text-lg font-black text-slate-900">Правила отметки</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {['GPS обязателен', 'Liveness включен', 'Offline sync разрешен 2 часа', 'Root/Jailbreak блокируется'].map((rule) => (
              <div key={rule} className="rounded-lg bg-slate-50 p-4">
                <StatusBadge tone="success">Включено</StatusBadge>
                <p className="mt-2 font-bold text-slate-900">{rule}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <DataTable columns={columns} data={devices} />
    </div>
  );
}
