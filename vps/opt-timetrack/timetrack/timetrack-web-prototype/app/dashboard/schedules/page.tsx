'use client';

import { useState, useEffect } from 'react';
import { Clock, Plus, Edit, Trash2, Search, Users, Calendar, AlarmClock } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { WorkSchedule } from '@/lib/types';
import { apiGetSchedules, apiCreateSchedule, apiUpdateSchedule, apiDeleteSchedule, apiGetEmployees } from '@/lib/api/mock-service';
import { PageLoader } from '@/components/shared';
import { toast } from 'sonner';

const DAYS = [
  { key: 1, label: 'Пн', full: 'Понедельник' },
  { key: 2, label: 'Вт', full: 'Вторник' },
  { key: 3, label: 'Ср', full: 'Среда' },
  { key: 4, label: 'Чт', full: 'Четверг' },
  { key: 5, label: 'Пт', full: 'Пятница' },
  { key: 6, label: 'Сб', full: 'Суббота' },
  { key: 0, label: 'Вс', full: 'Воскресенье' },
];

const scheduleSchema = z.object({
  name: z.string().min(2, 'Минимум 2 символа'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Формат ЧЧ:ММ'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Формат ЧЧ:ММ'),
  daysOfWeek: z.array(z.number()).min(1, 'Выберите хотя бы один день'),
  lateToleranceMinutes: z.number().min(0).max(60),
  overtimeThresholdMinutes: z.number().min(0).max(120),
});

type ScheduleFormData = z.infer<typeof scheduleSchema>;

function ScheduleModal({
  open, onClose, onSave, initial, loading
}: {
  open: boolean; onClose: () => void; onSave: (d: ScheduleFormData) => void;
  initial?: WorkSchedule | null; loading: boolean;
}) {
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      daysOfWeek: [1, 2, 3, 4, 5],
      lateToleranceMinutes: 10,
      overtimeThresholdMinutes: 30,
      startTime: '09:00',
      endTime: '18:00',
    },
  });

  useEffect(() => {
    if (initial) {
      reset({
        name: initial.name,
        startTime: initial.startTime,
        endTime: initial.endTime,
        daysOfWeek: initial.daysOfWeek,
        lateToleranceMinutes: initial.lateToleranceMinutes,
        overtimeThresholdMinutes: initial.overtimeThresholdMinutes,
      });
    } else {
      reset({
        daysOfWeek: [1, 2, 3, 4, 5],
        lateToleranceMinutes: 10,
        overtimeThresholdMinutes: 30,
        startTime: '09:00',
        endTime: '18:00',
      });
    }
  }, [initial, reset]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">
            {initial ? 'Редактировать график' : 'Новый график работы'}
          </h2>
        </div>
        <form onSubmit={handleSubmit(onSave)} className="p-6 space-y-4">
          <div>
            <label className="form-label">Название графика</label>
            <input {...register('name')} className="form-input" placeholder="5/2 стандарт, Посменный..." />
            {errors.name && <p className="form-error">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Начало рабочего дня</label>
              <input {...register('startTime')} type="time" className="form-input" />
              {errors.startTime && <p className="form-error">{errors.startTime.message}</p>}
            </div>
            <div>
              <label className="form-label">Конец рабочего дня</label>
              <input {...register('endTime')} type="time" className="form-input" />
              {errors.endTime && <p className="form-error">{errors.endTime.message}</p>}
            </div>
          </div>

          <div>
            <label className="form-label">Рабочие дни</label>
            <Controller
              name="daysOfWeek"
              control={control}
              render={({ field }) => (
                <div className="flex gap-2 flex-wrap">
                  {DAYS.map(day => {
                    const selected = field.value.includes(day.key);
                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => {
                          if (selected) {
                            field.onChange(field.value.filter((d: number) => d !== day.key));
                          } else {
                            field.onChange([...field.value, day.key].sort());
                          }
                        }}
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                          selected
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              )}
            />
            {errors.daysOfWeek && <p className="form-error">{errors.daysOfWeek.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Допуск опоздания (мин)</label>
              <input
                {...register('lateToleranceMinutes', { valueAsNumber: true })}
                type="number"
                min={0}
                max={60}
                className="form-input"
              />
              {errors.lateToleranceMinutes && <p className="form-error">{errors.lateToleranceMinutes.message}</p>}
            </div>
            <div>
              <label className="form-label">Порог переработки (мин)</label>
              <input
                {...register('overtimeThresholdMinutes', { valueAsNumber: true })}
                type="number"
                min={0}
                max={120}
                className="form-input"
              />
              {errors.overtimeThresholdMinutes && <p className="form-error">{errors.overtimeThresholdMinutes.message}</p>}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Отмена</button>
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getDayLabels(days: number[]) {
  const sorted = [...days].sort();
  return sorted.map(d => DAYS.find(x => x.key === d)?.label ?? '').join(', ');
}

function calcHours(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return mins > 0 ? `${Math.floor(mins / 60)}ч ${mins % 60}м` : '—';
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<WorkSchedule | null>(null);
  const [saving, setSaving] = useState(false);
  const [employeeCounts, setEmployeeCounts] = useState<Record<string, number>>({});

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [sch, emps] = await Promise.all([apiGetSchedules(), apiGetEmployees({})]);
    setSchedules(sch);
    const counts: Record<string, number> = {};
    emps.data.forEach(e => {
      if (e.workScheduleId) {
        counts[e.workScheduleId] = (counts[e.workScheduleId] ?? 0) + 1;
      }
    });
    setEmployeeCounts(counts);
    setLoading(false);
  }

  const filtered = schedules.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSave(data: ScheduleFormData) {
    setSaving(true);
    try {
      if (editTarget) {
        const updated = await apiUpdateSchedule(editTarget.id, data);
        setSchedules(prev => prev.map(s => s.id === editTarget.id ? updated : s));
        toast.success('График обновлён');
      } else {
        const created = await apiCreateSchedule(data);
        setSchedules(prev => [...prev, created]);
        toast.success('График создан');
      }
      setModalOpen(false);
      setEditTarget(null);
    } catch {
      toast.error('Ошибка сохранения');
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    try {
      await apiDeleteSchedule(id);
      setSchedules(prev => prev.filter(s => s.id !== id));
      toast.success('График удалён');
    } catch {
      toast.error('Ошибка удаления');
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Графики работы</h1>
          <p className="text-slate-500 mt-1">Настройте расписания для разных групп сотрудников</p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setModalOpen(true); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Создать график
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{schedules.length}</p>
            <p className="text-xs text-slate-500">Всего графиков</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">
              {Object.values(employeeCounts).reduce((a, b) => a + b, 0)}
            </p>
            <p className="text-xs text-slate-500">Сотрудников назначено</p>
          </div>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по названию..."
          className="form-input pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Графики не найдены</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(sch => (
            <div key={sch.id} className="card p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">{sch.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {employeeCounts[sch.id] ?? 0} сотрудников
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditTarget(sch); setModalOpen(true); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(sch.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Time display */}
              <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between">
                <div className="text-center">
                  <p className="text-xs text-slate-500 mb-0.5">Начало</p>
                  <p className="text-xl font-bold text-brand-600">{sch.startTime}</p>
                </div>
                <div className="flex-1 flex items-center justify-center px-4">
                  <div className="h-px flex-1 bg-slate-200" />
                  <AlarmClock className="w-4 h-4 text-slate-400 mx-2" />
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500 mb-0.5">Конец</p>
                  <p className="text-xl font-bold text-slate-900">{sch.endTime}</p>
                </div>
              </div>

              {/* Work duration */}
              <p className="text-xs text-center text-slate-500">
                Рабочее время: <span className="font-medium text-slate-700">{calcHours(sch.startTime, sch.endTime)}</span>
              </p>

              {/* Days */}
              <div className="flex gap-1">
                {DAYS.map(day => {
                  const active = sch.daysOfWeek.includes(day.key);
                  return (
                    <div
                      key={day.key}
                      className={`flex-1 py-1.5 rounded text-center text-xs font-medium ${
                        active
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {day.label}
                    </div>
                  );
                })}
              </div>

              {/* Tolerances */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-amber-50 rounded-lg p-2 text-center">
                  <p className="text-amber-600 font-medium">{sch.lateToleranceMinutes} мин</p>
                  <p className="text-amber-500 mt-0.5">Допуск опоздания</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-2 text-center">
                  <p className="text-emerald-600 font-medium">{sch.overtimeThresholdMinutes} мин</p>
                  <p className="text-emerald-500 mt-0.5">Порог переработки</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ScheduleModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        onSave={handleSave}
        initial={editTarget}
        loading={saving}
      />
    </div>
  );
}
