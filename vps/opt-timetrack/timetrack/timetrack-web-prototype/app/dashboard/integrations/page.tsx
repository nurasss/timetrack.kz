'use client';

import { useEffect, useState } from 'react';
import { Search, Plug, CheckCircle2, Clock3 } from 'lucide-react';
import { toast } from 'sonner';
import { apiGetIntegrations } from '@/lib/api/mock-service';
import type { Integration, IntegrationCategory } from '@/lib/types';
import { PageLoader, EmptyState, StatCard, IntegrationStatusBadge } from '@/components/shared';
import { formatDate } from '@/lib/utils';

const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  accounting: 'Бухгалтерия',
  crm: 'CRM',
  access_control: 'Контроль доступа',
  messaging: 'Уведомления',
  developer: 'Разработка',
  payments: 'Оплата',
};

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const res = await apiGetIntegrations();
    setIntegrations(res);
    setLoading(false);
  }

  function handleConfigure(integration: Integration) {
    toast.success(`Настройка интеграции «${integration.label}» — раздел в разработке`);
  }

  const filtered = integrations.filter(i =>
    i.label.toLowerCase().includes(search.toLowerCase()) ||
    i.description.toLowerCase().includes(search.toLowerCase())
  );

  const connectedCount = integrations.filter(i => i.status === 'connected').length;
  const inProgressCount = integrations.filter(i => i.status === 'in_progress').length;

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Интеграции</h1>
          <p className="text-sm text-slate-500 mt-1">
            Подключите Timetrack.kz к учётным системам, СКУД и платёжным сервисам
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Всего интеграций"
          value={integrations.length}
          icon={<Plug className="h-4 w-4" />}
        />
        <StatCard
          title="Подключено"
          value={connectedCount}
          icon={<CheckCircle2 className="h-4 w-4" />}
          iconColor="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          title="В разработке"
          value={inProgressCount}
          icon={<Clock3 className="h-4 w-4" />}
          iconColor="bg-amber-100 text-amber-700"
        />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск интеграций..."
          className="form-input pl-9"
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Plug className="h-6 w-6" />}
          title="Ничего не найдено"
          description="Попробуйте изменить поисковый запрос"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(integration => (
            <div key={integration.id} className="card p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-sm font-bold text-brand-700">
                    {integration.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{integration.label}</p>
                    <p className="text-xs text-slate-400">{CATEGORY_LABELS[integration.category]}</p>
                  </div>
                </div>
                <IntegrationStatusBadge status={integration.status} />
              </div>

              <p className="text-sm text-slate-500 flex-1">{integration.description}</p>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                {integration.status === 'connected' && integration.connectedAt ? (
                  <span className="text-xs text-slate-400">Подключено {formatDate(integration.connectedAt)}</span>
                ) : (
                  <span />
                )}
                <button
                  onClick={() => handleConfigure(integration)}
                  className="btn-secondary py-1.5 px-3 text-xs"
                >
                  Настроить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
