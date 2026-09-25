import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: number | string;
  trend?: string;
  tone?: 'success' | 'danger' | 'warning' | 'info';
  icon?: ReactNode;
}

const toneClass = {
  success: 'bg-emerald-50 text-emerald-700',
  danger: 'bg-red-50 text-red-700',
  warning: 'bg-amber-50 text-amber-700',
  info: 'bg-blue-50 text-blue-700'
};

export function StatCard({ label, value, trend, tone = 'info', icon }: StatCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
        </div>
        {icon ? <div className={`rounded-lg p-3 ${toneClass[tone]}`}>{icon}</div> : null}
      </div>
      {trend ? <p className="mt-4 text-xs font-bold text-slate-400">{trend}</p> : null}
    </div>
  );
}
