'use client';

import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Search, Filter, Upload, UserX, Pencil, X } from 'lucide-react';
import { EmptyState, EmployeeStatusBadge, PageLoader } from '@/components/shared';
import {
  apiGetEmployees, apiCreateEmployee, apiUpdateEmployee,
  apiDeleteEmployee, apiGetDepartments,
} from '@/lib/api/mock-service';
import { MOCK_SCHEDULES } from '@/lib/mock/data';
import type { Employee, Department, EmployeeFilters } from '@/lib/types';
import { EMPLOYEE_STATUS_LABELS } from '@/lib/utils';

const employeeSchema = z.object({
  fullName: z.string().min(2, 'Минимум 2 символа'),
  email: z.string().email('Некорректный email'),
  phone: z.string().min(10, 'Некорректный телефон'),
  employeeCode: z.string().min(1, 'Обязательное поле'),
  departmentId: z.string().min(1, 'Выберите отдел'),
  position: z.string().min(2, 'Укажите должность'),
  workScheduleId: z.string().min(1, 'Выберите график'),
  hiredAt: z.string().min(1, 'Укажите дату'),
  locationIds: z.array(z.string()).min(1, 'Выберите хотя бы одну локацию'),
});

type EmployeeFormValues = z.infer<typeof employeeSchema>;

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<EmployeeFilters>({ page: 1, pageSize: 20 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [search, setSearch] = useState('');

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [res, depts] = await Promise.all([apiGetEmployees(filters), apiGetDepartments()]);
    setEmployees(res.data);
    setTotal(res.total);
    setDepartments(depts);
    setLoading(false);
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters(f => ({ ...f, search, page: 1 }));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  function openCreate() {
    setEditTarget(null);
    reset({
      fullName: '', email: '', phone: '', employeeCode: '',
      departmentId: '', position: '', workScheduleId: '',
      hiredAt: new Date().toISOString().slice(0, 10),
      locationIds: [],
    });
    setModalOpen(true);
  }

  function openEdit(emp: Employee) {
    setEditTarget(emp);
    reset({
      fullName: emp.fullName,
      email: emp.email,
      phone: emp.phone,
      employeeCode: emp.employeeCode,
      departmentId: emp.departmentId,
      position: emp.position,
      workScheduleId: emp.workScheduleId,
      hiredAt: emp.hiredAt,
      locationIds: emp.locationIds,
    });
    setModalOpen(true);
  }

  async function onSubmit(data: EmployeeFormValues) {
    try {
      if (editTarget) {
        await apiUpdateEmployee(editTarget.id, data);
        toast.success('Данные сотрудника обновлены');
      } else {
        await apiCreateEmployee(data);
        toast.success('Сотрудник добавлен');
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function deactivate(emp: Employee) {
    if (!confirm(`Деактивировать ${emp.fullName}?`)) return;
    await apiDeleteEmployee(emp.id);
    toast.success('Сотрудник деактивирован');
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Сотрудники</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} сотрудников в базе</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary text-sm py-2" onClick={() => toast.info('Импорт: функция в разработке')}>
            <Upload className="h-4 w-4" />
            Импорт XLS
          </button>
          <button className="btn-primary text-sm py-2" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Добавить
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-1 min-w-48 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск по имени, email, коду..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 text-sm outline-none placeholder-slate-400 text-slate-700"
          />
        </div>
        <select
          className="form-input w-auto min-w-40"
          value={filters.departmentId ?? ''}
          onChange={e => setFilters(f => ({ ...f, departmentId: e.target.value || undefined, page: 1 }))}
        >
          <option value="">Все отделы</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select
          className="form-input w-auto min-w-36"
          value={filters.status ?? ''}
          onChange={e => setFilters(f => ({ ...f, status: (e.target.value as any) || undefined, page: 1 }))}
        >
          <option value="">Все статусы</option>
          {Object.entries(EMPLOYEE_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <PageLoader />
        ) : employees.length === 0 ? (
          <EmptyState title="Сотрудники не найдены" description="Попробуйте изменить фильтры или добавьте нового сотрудника." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full data-table">
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Код</th>
                  <th>Отдел / Должность</th>
                  <th>Контакты</th>
                  <th>Статус</th>
                  <th>Биометрия</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        {emp.avatarUrl ? (
                          <img src={emp.avatarUrl} alt="" className="h-8 w-8 rounded-full" />
                        ) : (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                            {emp.fullName.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-slate-800">{emp.fullName}</p>
                          <p className="text-xs text-slate-400">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-xs text-slate-500">{emp.employeeCode}</td>
                    <td>
                      <p className="text-sm text-slate-700">{emp.departmentName}</p>
                      <p className="text-xs text-slate-400">{emp.position}</p>
                    </td>
                    <td className="text-sm text-slate-500">{emp.phone}</td>
                    <td><EmployeeStatusBadge status={emp.status} /></td>
                    <td>
                      <span className={`badge ${emp.hasFaceTemplate ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {emp.hasFaceTemplate ? 'Есть' : 'Нет'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          className="btn-ghost py-1.5 px-2 text-xs"
                          onClick={() => openEdit(emp)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {emp.status === 'active' && (
                          <button
                            className="btn-ghost py-1.5 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => deactivate(emp)}
                          >
                            <UserX className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-bold text-slate-900">
                {editTarget ? 'Редактировать сотрудника' : 'Добавить сотрудника'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1 hover:bg-slate-100">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="form-label">ФИО *</label>
                  <input {...register('fullName')} className="form-input" placeholder="Айдос Мусаев" />
                  {errors.fullName && <p className="form-error">{errors.fullName.message}</p>}
                </div>

                <div>
                  <label className="form-label">Email *</label>
                  <input {...register('email')} type="email" className="form-input" placeholder="a.musaev@company.kz" />
                  {errors.email && <p className="form-error">{errors.email.message}</p>}
                </div>

                <div>
                  <label className="form-label">Телефон *</label>
                  <input {...register('phone')} className="form-input" placeholder="+7 700 000 00 00" />
                  {errors.phone && <p className="form-error">{errors.phone.message}</p>}
                </div>

                <div>
                  <label className="form-label">Код сотрудника *</label>
                  <input {...register('employeeCode')} className="form-input" placeholder="EMP-001" />
                  {errors.employeeCode && <p className="form-error">{errors.employeeCode.message}</p>}
                </div>

                <div>
                  <label className="form-label">Дата приёма *</label>
                  <input {...register('hiredAt')} type="date" className="form-input" />
                  {errors.hiredAt && <p className="form-error">{errors.hiredAt.message}</p>}
                </div>

                <div className="col-span-2">
                  <label className="form-label">Отдел *</label>
                  <select {...register('departmentId')} className="form-input">
                    <option value="">Выберите отдел</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {errors.departmentId && <p className="form-error">{errors.departmentId.message}</p>}
                </div>

                <div className="col-span-2">
                  <label className="form-label">Должность *</label>
                  <input {...register('position')} className="form-input" placeholder="Менеджер по продажам" />
                  {errors.position && <p className="form-error">{errors.position.message}</p>}
                </div>

                <div className="col-span-2">
                  <label className="form-label">График работы *</label>
                  <select {...register('workScheduleId')} className="form-input">
                    <option value="">Выберите график</option>
                    {MOCK_SCHEDULES.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
                    ))}
                  </select>
                  {errors.workScheduleId && <p className="form-error">{errors.workScheduleId.message}</p>}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
                  Отмена
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary">
                  {isSubmitting ? 'Сохранение...' : editTarget ? 'Сохранить' : 'Добавить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
