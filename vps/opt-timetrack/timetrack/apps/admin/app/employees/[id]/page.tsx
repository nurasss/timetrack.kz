import Link from 'next/link';
import { ChevronLeft, ImagePlus, Pencil } from 'lucide-react';
import { DataTable, Column } from '../../../components/ui/DataTable';
import {
  attendances,
  employees,
  getDepartmentName,
  getEmployeeById,
  getFullName,
  getLocationName,
  getPositionName,
  requests,
  requestStatusName,
  requestTypeName
} from '../../../../../packages/shared/mock-data';
import type { Attendance, LeaveRequest } from '../../../../../packages/shared/types';

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = getEmployeeById(id);
  if (!employee) {
    return (
      <div>
        <Link href="/employees" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary">
          <ChevronLeft size={16} />Вернуться к сотрудникам
        </Link>
        <div className="card p-8">
          <h1 className="text-2xl font-black text-slate-900">Сотрудник не найден</h1>
          <p className="mt-2 text-sm text-slate-500">Добавьте сотрудников вручную или импортируйте список, чтобы здесь появились карточки.</p>
        </div>
      </div>
    );
  }
  const marks = attendances.filter((mark) => mark.employee_id === employee.id).slice(0, 8);
  const employeeRequests = requests.filter((request) => request.employee_id === employee.id);
  const initials = getFullName(employee)
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2);

  const markColumns: Column<Attendance>[] = [
    { header: 'Тип', accessor: (row) => row.type === 'CHECK_IN' ? 'Приход' : 'Уход' },
    { header: 'Время', accessor: (row) => new Date(row.marked_at).toLocaleString('ru-RU') },
    { header: 'Локация', accessor: (row) => getLocationName(row.location_id ?? '') },
    { header: 'GPS', accessor: (row) => `${row.accuracy_meters ?? 0} m` }
  ];
  const requestColumns: Column<LeaveRequest>[] = [
    { header: 'Тип', accessor: (row) => requestTypeName(row.type) },
    { header: 'Даты', accessor: (row) => `${row.start_date} - ${row.end_date}` },
    { header: 'Статус', accessor: (row) => requestStatusName(row.status) }
  ];

  return (
    <div>
      <Link href="/employees" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary">
        <ChevronLeft size={16} />Вернуться к сотрудникам
      </Link>
      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card p-6 xl:col-span-2">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-slate-100 text-2xl font-black text-slate-700">{initials}</div>
              <div>
                <h1 className="text-3xl font-black">{getFullName(employee)}</h1>
                <p className="mt-1 text-slate-500">{getPositionName(employee.position_id ?? '')} / {getDepartmentName(employee.department_id ?? '')}</p>
                <p className="mt-1 text-sm text-slate-400">{employee.email} / {employee.phone}</p>
              </div>
            </div>
            <button className="primary-control"><Pencil className="mr-2 inline" size={16} />Изменить</button>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Info label="Офис" value="-" />
            <Info label="График" value="-" />
            <Info label="Код" value={employee.employee_code} />
            <Info label="Принят" value={employee.hired_at ?? '-'} />
          </div>
        </div>
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-black">Фото и биометрия</h2>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }, (_, index) => <div key={index} className="aspect-square rounded-lg border border-dashed border-slate-300 bg-slate-50" />)}
          </div>
          <p className="mt-4 text-sm text-slate-500">Профиль лица: не настроен</p>
          <button className="control mt-4 w-full"><ImagePlus className="mr-2 inline" size={16} />Добавить фото</button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section><h2 className="mb-4 text-lg font-black">Последние отметки</h2><DataTable columns={markColumns} data={marks} /></section>
        <section><h2 className="mb-4 text-lg font-black">Заявки</h2><DataTable columns={requestColumns} data={employeeRequests} /></section>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-400">{label}</p><p className="mt-1 font-black text-slate-800">{value}</p></div>;
}
