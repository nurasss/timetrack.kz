'use client';

import { useState } from 'react';
import { DataTable, Column } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { employees, getFullName, requests as initialRequests, requestStatusName, requestTypeName } from '../../../../packages/shared/mock-data';
import type { LeaveRequest, RequestStatus } from '../../../../packages/shared/types';

export default function RequestsPage() {
  const [items, setItems] = useState(initialRequests);
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const updateStatus = (id: string, status: RequestStatus) => setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item));
  const columns: Column<LeaveRequest>[] = [
    { header: 'Сотрудник', accessor: (row) => getFullName(employees.find((employee) => employee.id === row.employee_id) ?? employees[0]) },
    { header: 'Тип', accessor: (row) => requestTypeName(row.type) },
    { header: 'Даты', accessor: (row) => `${row.start_date} — ${row.end_date}` },
    { header: 'Комментарий', accessor: (row) => row.comment ?? '—' },
    { header: 'Статус', accessor: (row) => <StatusBadge tone={row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'danger' : 'warning'}>{requestStatusName(row.status)}</StatusBadge> },
    { header: 'Действие', accessor: (row) => <button onClick={() => setSelected(row)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Открыть</button> }
  ];
  return (
    <div>
      <PageHeader title="Заявки" subtitle="Отпуска, больничные, командировки и отгулы на согласовании." />
      <DataTable columns={columns} data={items} />
      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-5" onClick={() => setSelected(null)}>
          <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-2xl font-black">Заявка: {requestTypeName(selected.type)}</h2>
            <p className="mt-2 text-slate-500">{getFullName(employees.find((employee) => employee.id === selected.employee_id) ?? employees[0])}</p>
            <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600"><p><b>Период:</b> {selected.start_date} — {selected.end_date}</p><p className="mt-2"><b>Комментарий:</b> {selected.comment ?? '—'}</p><p className="mt-2"><b>Статус:</b> {requestStatusName(selected.status)}</p></div>
            <div className="mt-5 flex gap-2"><button onClick={() => { updateStatus(selected.id, 'approved'); setSelected(null); }} className="primary-control">Одобрить</button><button onClick={() => { updateStatus(selected.id, 'rejected'); setSelected(null); }} className="inline-flex h-10 items-center justify-center rounded-lg bg-red-500 px-3 text-sm font-black text-white">Отклонить</button><button onClick={() => setSelected(null)} className="control">Закрыть</button></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
