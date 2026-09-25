'use client';

import { useState, useEffect } from 'react';
import {
  Plane, Stethoscope, Briefcase, Coffee, Plus, Check, X,
  Clock, Search, ChevronDown, Calendar, AlertCircle, User
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { LeaveRequest } from '@/lib/types';
import {
  apiGetLeaveRequests, apiCreateLeaveRequest,
  apiApproveLeaveRequest, apiRejectLeaveRequest, apiGetEmployees
} from '@/lib/api/mock-service';
import { LeaveStatusBadge, PageLoader } from '@/components/shared';
import { toast } from 'sonner';

const TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  VACATION: { label: 'Отпуск', icon: Plane, color: 'bg-blue-100 text-blue-700' },
  SICK: { label: 'Больничный', icon: Stethoscope, color: 'bg-red-100 text-red-700' },
  BUSINESS_TRIP: { label: 'Командировка', icon: Briefcase, color: 'bg-purple-100 text-purple-700' },
  DAY_OFF: { label: 'Отгул', icon: Coffee, color: 'bg-amber-100 text-amber-700' },
};

const leaveSchema = z.object({
  employeeId: z.string().min(1, 'Выберите сотрудника'),
  type: z.enum(['VACATION', 'SICK', 'BUSINESS_TRIP', 'DAY_OFF']),
  startDate: z.string().min(1, 'Укажите дату начала'),
  endDate: z.string().min(1, 'Укажите дату окончания'),
  comment: z.string().optional(),
});

type LeaveFormData = z.infer<typeof leaveSchema>;

function CreateModal({
  open, onClose, onCreated
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (r: LeaveRequest) => void;
}) {
  const [employees, setEmployees] = useState<{ id: string; fullName: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGetEmployees({ status: 'active' }).then(res => setEmployees(res.data));
  }, []);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<LeaveFormData>({
    resolver: zodResolver(leaveSchema),
    defaultValues: { type: 'VACATION' },
  });

  async function onSubmit(data: LeaveFormData) {
    setSaving(true);
    try {
      const created = await apiCreateLeaveRequest(data);
      onCreated(created);
      toast.success('Заявка создана');
      reset();
      onClose();
    } catch {
      toast.error('Ошибка создания заявки');
    }
    setSaving(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Новая заявка</h2>
          <p className="text-sm text-slate-500 mt-1">Заявка на отпуск, больничный или командировку</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="form-label">Сотрудник</label>
            <div className="relative">
              <select {...register('employeeId')} className="form-input appearance-none pr-8">
                <option value="">Выберите сотрудника</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.fullName}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            {errors.employeeId && <p className="form-error">{errors.employeeId.message}</p>}
          </div>

          <div>
            <label className="form-label">Тип</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(TYPE_META).map(([key, meta]) => (
                <label key={key} className="cursor-pointer">
                  <input {...register('type')} type="radio" value={key} className="sr-only peer" />
                  <div className="flex items-center gap-2 border-2 border-transparent rounded-xl p-3 peer-checked:border-brand-500 peer-checked:bg-brand-50 hover:bg-slate-50 transition-all">
                    <meta.icon className="w-4 h-4 text-slate-500 peer-checked:text-brand-600" />
                    <span className="text-sm font-medium text-slate-700">{meta.label}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Дата начала</label>
              <input {...register('startDate')} type="date" className="form-input" />
              {errors.startDate && <p className="form-error">{errors.startDate.message}</p>}
            </div>
            <div>
              <label className="form-label">Дата окончания</label>
              <input {...register('endDate')} type="date" className="form-input" />
              {errors.endDate && <p className="form-error">{errors.endDate.message}</p>}
            </div>
          </div>

          <div>
            <label className="form-label">Комментарий</label>
            <textarea
              {...register('comment')}
              rows={3}
              className="form-input resize-none"
              placeholder="Причина или дополнительная информация..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Отмена</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? 'Создание...' : 'Создать заявку'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RejectModal({
  open, onConfirm, onClose, loading
}: {
  open: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Отклонить заявку</h3>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          className="form-input resize-none w-full mb-4"
          placeholder="Причина отклонения (необязательно)..."
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Отмена</button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={loading}
            className="btn-danger flex-1"
          >
            {loading ? 'Отклоняем...' : 'Отклонить'}
          </button>
        </div>
      </div>
    </div>
  );
}

function calcDays(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
}

export default function LeaveRequestsPage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await apiGetLeaveRequests();
    setRequests(res);
    setLoading(false);
  }

  const filtered = requests.filter(r => {
    const matchSearch = !search || r.employeeName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || r.status === statusFilter;
    const matchType = !typeFilter || r.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  async function handleApprove(id: string) {
    setActionLoading(id);
    try {
      const updated = await apiApproveLeaveRequest(id);
      setRequests(prev => prev.map(r => r.id === id ? updated : r));
      toast.success('Заявка одобрена');
    } catch {
      toast.error('Ошибка');
    }
    setActionLoading(null);
  }

  async function handleReject(id: string, reason: string) {
    setActionLoading(id);
    try {
      const updated = await apiRejectLeaveRequest(id, reason);
      setRequests(prev => prev.map(r => r.id === id ? updated : r));
      toast.success('Заявка отклонена');
    } catch {
      toast.error('Ошибка');
    }
    setActionLoading(null);
    setRejectTarget(null);
  }

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;

  if (loading) return <PageLoader />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Заявки на отсутствие</h1>
          <p className="text-slate-500 mt-1">Отпуска, больничные, командировки и отгулы</p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl px-3 py-2 text-sm font-medium">
              <AlertCircle className="w-4 h-4" />
              {pendingCount} ожидают решения
            </div>
          )}
          <button
            onClick={() => setCreateOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Создать заявку
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Всего заявок', value: requests.length, bg: 'bg-brand-50', color: 'text-brand-600' },
          { label: 'Ожидают', value: requests.filter(r => r.status === 'PENDING').length, bg: 'bg-amber-50', color: 'text-amber-600' },
          { label: 'Одобрено', value: requests.filter(r => r.status === 'APPROVED').length, bg: 'bg-emerald-50', color: 'text-emerald-600' },
          { label: 'Отклонено', value: requests.filter(r => r.status === 'REJECTED').length, bg: 'bg-red-50', color: 'text-red-600' },
        ].map(item => (
          <div key={item.label} className="card p-4 text-center">
            <p className={`text-3xl font-bold ${item.color}`}>{item.value}</p>
            <p className="text-xs text-slate-500 mt-1">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по сотруднику..."
            className="form-input pl-9 text-sm"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="form-input text-sm appearance-none pr-8"
          >
            <option value="">Все статусы</option>
            <option value="PENDING">Ожидает</option>
            <option value="APPROVED">Одобрена</option>
            <option value="REJECTED">Отклонена</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="form-input text-sm appearance-none pr-8"
          >
            <option value="">Все типы</option>
            {Object.entries(TYPE_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="font-medium text-slate-500">Заявки не найдены</p>
          <p className="text-sm text-slate-400 mt-1">Попробуйте изменить фильтры или создайте первую заявку</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const meta = TYPE_META[req.type];
            const days = calcDays(req.startDate, req.endDate);
            const isPending = req.status === 'PENDING';

            return (
              <div
                key={req.id}
                className={`card p-4 transition-all ${isPending ? 'border-l-4 border-l-amber-400' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Avatar */}
                    <div className="w-10 h-10 bg-gradient-to-br from-brand-400 to-cyan-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {req.employeeName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900">{req.employeeName}</p>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${meta.color}`}>
                          <meta.icon className="w-3 h-3" />
                          {meta.label}
                        </span>
                        <LeaveStatusBadge status={req.status} />
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {format(parseISO(req.startDate), 'd MMM', { locale: ru })}
                          {' — '}
                          {format(parseISO(req.endDate), 'd MMM yyyy', { locale: ru })}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {days} {days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}
                        </div>
                      </div>

                      {req.comment && (
                        <p className="text-sm text-slate-500 mt-2 bg-slate-50 rounded-lg px-3 py-2">
                          {req.comment}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isPending && (
                      <>
                        <button
                          onClick={() => handleApprove(req.id)}
                          disabled={actionLoading === req.id}
                          className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
                        >
                          <Check className="w-4 h-4" />
                          Одобрить
                        </button>
                        <button
                          onClick={() => setRejectTarget(req.id)}
                          disabled={actionLoading === req.id}
                          className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                          Отклонить
                        </button>
                      </>
                    )}
                    {req.status === 'APPROVED' && (
                      <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium bg-emerald-50 px-3 py-2 rounded-lg">
                        <Check className="w-4 h-4" />
                        Одобрено
                      </div>
                    )}
                    {req.status === 'REJECTED' && (
                      <div className="flex items-center gap-1.5 text-red-500 text-sm font-medium bg-red-50 px-3 py-2 rounded-lg">
                        <X className="w-4 h-4" />
                        Отклонено
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={r => setRequests(prev => [r, ...prev])}
      />

      <RejectModal
        open={!!rejectTarget}
        onConfirm={reason => rejectTarget && handleReject(rejectTarget, reason)}
        onClose={() => setRejectTarget(null)}
        loading={!!actionLoading}
      />
    </div>
  );
}
