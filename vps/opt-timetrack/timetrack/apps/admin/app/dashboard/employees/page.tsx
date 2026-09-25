'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Plus, Search, UserX, Pencil, X, Camera, Upload,
  CheckCircle2, AlertCircle, User, Phone, Mail,
  Briefcase, CalendarDays, MapPin, Clock,
} from 'lucide-react';
import { EmptyState, EmployeeStatusBadge, PageLoader } from '@/components/shared';
import {
  apiGetEmployees, apiCreateEmployee, apiUpdateEmployee,
  apiDeleteEmployee, apiGetDepartments, apiUploadAvatar,
} from '@/lib/api/service';
import { MOCK_SCHEDULES } from '@/lib/mock/data';
import type { Employee, Department, EmployeeFilters } from '@/lib/types';
import { EMPLOYEE_STATUS_LABELS } from '@/lib/utils';

const employeeSchema = z.object({
  fullName: z.string().min(2, 'Минимум 2 символа'),
  email: z.string().email('Некорректный email'),
  phone: z.string().min(10, 'Некорректный телефон'),
  employeeCode: z.string().min(1, 'Обязательное поле'),
  departmentId: z.string().optional(),
  position: z.string().min(2, 'Укажите должность'),
  workScheduleId: z.string().optional(),
  hiredAt: z.string().min(1, 'Укажите дату'),
});
type EmployeeFormValues = z.infer<typeof employeeSchema>;

// ─── Avatar Upload Component ────────────────────────────────
function AvatarUpload({
  employee,
  onUploaded,
}: {
  employee: Employee;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(employee.avatarUrl ?? null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Выберите файл изображения');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Файл слишком большой. Максимум 5 МБ');
      return;
    }
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const url = await apiUploadAvatar(employee.id, file);
      onUploaded(url);
      toast.success('Фото загружено');
    } catch {
      toast.error('Ошибка загрузки фото');
      setPreview(employee.avatarUrl ?? null);
    }
    setUploading(false);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative group cursor-pointer"
        onClick={() => !uploading && inputRef.current?.click()}
      >
        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg bg-brand-100 flex items-center justify-center">
          {preview ? (
            <img src={preview} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl font-bold text-brand-600">
              {employee.fullName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {uploading
            ? <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <Camera className="w-6 h-6 text-white" />
          }
        </div>
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
      >
        <Upload className="w-3 h-3" />
        {uploading ? 'Загрузка...' : 'Загрузить фото'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ─── Employee Detail Modal ──────────────────────────────────
function EmployeeModal({
  open, onClose, editTarget, departments, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editTarget: Employee | null;
  departments: Department[];
  onSaved: () => void;
}) {
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
  });

  useEffect(() => {
    if (editTarget) {
      reset({
        fullName: editTarget.fullName,
        email: editTarget.email,
        phone: editTarget.phone,
        employeeCode: editTarget.employeeCode,
        departmentId: editTarget.departmentId,
        position: editTarget.position,
        workScheduleId: editTarget.workScheduleId,
        hiredAt: editTarget.hiredAt,
      });
      setAvatarUrl(editTarget.avatarUrl);
    } else {
      reset({
        fullName: '', email: '', phone: '', employeeCode: '',
        departmentId: '', position: '', workScheduleId: '',
        hiredAt: new Date().toISOString().slice(0, 10),
      });
      setAvatarUrl(undefined);
    }
  }, [editTarget, reset]);

  async function onSubmit(data: EmployeeFormValues) {
    try {
      if (editTarget) {
        await apiUpdateEmployee(editTarget.id, {
          ...data,
          departmentId: data.departmentId || undefined,
          workScheduleId: data.workScheduleId || undefined,
        });
        toast.success('Данные обновлены');
      } else {
        await apiCreateEmployee({
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          employeeCode: data.employeeCode,
          departmentId: data.departmentId ?? '',
          position: data.position,
          workScheduleId: data.workScheduleId ?? '',
          hiredAt: data.hiredAt,
          locationIds: [],
        });
        toast.success('Сотрудник добавлен');
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Ошибка сохранения');
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-bold text-slate-900">
            {editTarget ? 'Редактировать сотрудника' : 'Новый сотрудник'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-6 flex flex-col gap-5">
            {/* Avatar — только при редактировании */}
            {editTarget && (
              <div className="flex justify-center pb-2">
                <AvatarUpload
                  employee={{ ...editTarget, avatarUrl }}
                  onUploaded={url => setAvatarUrl(url)}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="form-label">
                  <User className="inline h-3.5 w-3.5 mr-1 text-slate-400" />ФИО *
                </label>
                <input {...register('fullName')} className="form-input" placeholder="Айдос Мусаев" />
                {errors.fullName && <p className="form-error">{errors.fullName.message}</p>}
              </div>

              <div>
                <label className="form-label">
                  <Mail className="inline h-3.5 w-3.5 mr-1 text-slate-400" />Email *
                </label>
                <input {...register('email')} type="email" className="form-input" placeholder="a.musaev@company.kz" />
                {errors.email && <p className="form-error">{errors.email.message}</p>}
              </div>

              <div>
                <label className="form-label">
                  <Phone className="inline h-3.5 w-3.5 mr-1 text-slate-400" />Телефон *
                </label>
                <input {...register('phone')} className="form-input" placeholder="+7 700 000 00 00" />
                {errors.phone && <p className="form-error">{errors.phone.message}</p>}
              </div>

              <div>
                <label className="form-label">Код сотрудника *</label>
                <input {...register('employeeCode')} className="form-input" placeholder="EMP-001" />
                {errors.employeeCode && <p className="form-error">{errors.employeeCode.message}</p>}
              </div>

              <div>
                <label className="form-label">
                  <CalendarDays className="inline h-3.5 w-3.5 mr-1 text-slate-400" />Дата приёма *
                </label>
                <input {...register('hiredAt')} type="date" className="form-input" />
                {errors.hiredAt && <p className="form-error">{errors.hiredAt.message}</p>}
              </div>

              <div>
                <label className="form-label">Отдел</label>
                <select {...register('departmentId')} className="form-input">
                  <option value="">Без отдела</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div>
                <label className="form-label">
                  <Briefcase className="inline h-3.5 w-3.5 mr-1 text-slate-400" />Должность *
                </label>
                <input {...register('position')} className="form-input" placeholder="Менеджер по продажам" />
                {errors.position && <p className="form-error">{errors.position.message}</p>}
              </div>

              <div className="col-span-2">
                <label className="form-label">
                  <Clock className="inline h-3.5 w-3.5 mr-1 text-slate-400" />График работы
                </label>
                <select {...register('workScheduleId')} className="form-input">
                  <option value="">Не назначен</option>
                  {MOCK_SCHEDULES.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tip for new employee */}
            {!editTarget && (
              <div className="flex items-start gap-2.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm text-brand-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-brand-600" />
                После создания сотрудника — откройте его карточку и загрузите фото для распознавания.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 px-6 pb-6 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="btn-secondary">Отмена</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Сохранение...' : editTarget ? 'Сохранить' : 'Добавить сотрудника'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────
export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<EmployeeFilters>({ page: 1, pageSize: 20 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [search, setSearch] = useState('');

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
    setModalOpen(true);
  }

  function openEdit(emp: Employee) {
    setEditTarget(emp);
    setModalOpen(true);
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
        <button className="btn-primary text-sm py-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Добавить
        </button>
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
                  <th>Фото</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        {emp.avatarUrl ? (
                          <img src={emp.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover border border-slate-200" />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
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
                      <p className="text-sm text-slate-700">{emp.departmentName || '—'}</p>
                      <p className="text-xs text-slate-400">{emp.position}</p>
                    </td>
                    <td className="text-sm text-slate-500">{emp.phone}</td>
                    <td><EmployeeStatusBadge status={emp.status} /></td>
                    <td>
                      {emp.avatarUrl ? (
                        <span className="badge bg-emerald-100 text-emerald-700 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="h-3 w-3" />Загружено
                        </span>
                      ) : (
                        <button
                          onClick={() => openEdit(emp)}
                          className="badge bg-amber-100 text-amber-700 flex items-center gap-1 w-fit cursor-pointer hover:bg-amber-200"
                        >
                          <Camera className="h-3 w-3" />Добавить фото
                        </button>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          className="btn-ghost py-1.5 px-2 text-xs"
                          onClick={() => openEdit(emp)}
                          title="Редактировать"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {emp.status === 'active' && (
                          <button
                            className="btn-ghost py-1.5 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => deactivate(emp)}
                            title="Деактивировать"
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

      <EmployeeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editTarget={editTarget}
        departments={departments}
        onSaved={load}
      />
    </div>
  );
}
