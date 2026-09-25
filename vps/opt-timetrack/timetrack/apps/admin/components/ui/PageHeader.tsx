import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <p className="text-sm font-black uppercase text-primary">Timetrack.kz</p>
        <h1 className="mt-1 text-3xl font-black text-slate-950">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-2xl text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}
