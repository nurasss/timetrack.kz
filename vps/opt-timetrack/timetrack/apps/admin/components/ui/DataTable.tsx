import type { ReactNode } from 'react';

export interface Column<T> {
  header: string;
  accessor: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  empty?: string;
}

export function DataTable<T>({ columns, data, empty = 'Нет данных' }: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th key={column.header} className={`whitespace-nowrap px-5 py-4 text-left text-xs font-black uppercase text-slate-500 ${column.className ?? ''}`}>{column.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-5 py-8 text-center text-slate-500">{empty}</td></tr>
            ) : data.map((row, index) => (
              <tr key={index} className="transition hover:bg-slate-50/80">
                {columns.map((column) => <td key={column.header} className={`px-5 py-4 align-middle text-slate-700 ${column.className ?? ''}`}>{column.accessor(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
