'use client';

import { useState, useEffect } from 'react';
import {
  MapPin, Plus, Edit, Trash2, ToggleLeft, ToggleRight,
  Search, Building2, Navigation, AlertCircle, CheckCircle2
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Location } from '@/lib/types';
import {
  apiGetLocations, apiCreateLocation, apiUpdateLocation, apiDeleteLocation
} from '@/lib/api/mock-service';
import { PageLoader } from '@/components/shared';
import { toast } from 'sonner';

const locationSchema = z.object({
  name: z.string().min(2, 'Минимум 2 символа'),
  address: z.string().min(5, 'Введите полный адрес'),
  lat: z.number({ invalid_type_error: 'Введите числовое значение' }).min(-90).max(90),
  lng: z.number({ invalid_type_error: 'Введите числовое значение' }).min(-180).max(180),
  radiusMeters: z.number({ invalid_type_error: 'Введите числовое значение' }).min(10).max(5000),
  isActive: z.boolean(),
});

type LocationFormData = z.infer<typeof locationSchema>;

interface ModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: LocationFormData) => void;
  initial?: Location | null;
  loading: boolean;
}

function LocationModal({ open, onClose, onSave, initial, loading }: ModalProps) {
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: { isActive: true, radiusMeters: 100 },
  });

  useEffect(() => {
    if (initial) {
      reset({
        name: initial.name,
        address: initial.address,
        lat: initial.lat,
        lng: initial.lng,
        radiusMeters: initial.radiusMeters,
        isActive: initial.isActive,
      });
    } else {
      reset({ isActive: true, radiusMeters: 100 });
    }
  }, [initial, reset]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">
            {initial ? 'Редактировать локацию' : 'Новая локация'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">Настройте параметры рабочей зоны</p>
        </div>
        <form onSubmit={handleSubmit(onSave)} className="p-6 space-y-4">
          <div>
            <label className="form-label">Название локации</label>
            <input {...register('name')} className="form-input" placeholder="Офис Алматы, Склад №1..." />
            {errors.name && <p className="form-error">{errors.name.message}</p>}
          </div>
          <div>
            <label className="form-label">Адрес</label>
            <input {...register('address')} className="form-input" placeholder="г. Алматы, ул. Панфилова 150" />
            {errors.address && <p className="form-error">{errors.address.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Широта (lat)</label>
              <input
                {...register('lat', { valueAsNumber: true })}
                type="number"
                step="any"
                className="form-input"
                placeholder="43.2220"
              />
              {errors.lat && <p className="form-error">{errors.lat.message}</p>}
            </div>
            <div>
              <label className="form-label">Долгота (lng)</label>
              <input
                {...register('lng', { valueAsNumber: true })}
                type="number"
                step="any"
                className="form-input"
                placeholder="76.8512"
              />
              {errors.lng && <p className="form-error">{errors.lng.message}</p>}
            </div>
          </div>
          <div>
            <label className="form-label">Радиус геозоны (метры)</label>
            <div className="flex items-center gap-3">
              <input
                {...register('radiusMeters', { valueAsNumber: true })}
                type="number"
                className="form-input"
                placeholder="100"
              />
              <span className="text-sm text-slate-500 whitespace-nowrap">м</span>
            </div>
            {errors.radiusMeters && <p className="form-error">{errors.radiusMeters.message}</p>}
            <p className="text-xs text-slate-400 mt-1">Рекомендуется 50–200 м для офисов, 200–500 м для объектов</p>
          </div>

          {/* Map Placeholder */}
          <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 h-48 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <Navigation className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium">Map preview</p>
              <p className="text-xs mt-1">Google Maps / Yandex Maps будет подключён</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Активная локация</p>
              <p className="text-xs text-slate-500">Сотрудники смогут отмечаться в этом офисе</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const currentVal = (document.querySelector('input[name="isActive"]') as HTMLInputElement)?.checked;
                setValue('isActive', !currentVal);
              }}
              className="relative"
            >
              <input type="checkbox" {...register('isActive')} className="sr-only" />
              <div className="w-10 h-6 bg-brand-600 rounded-full flex items-center px-1">
                <div className="w-4 h-4 bg-white rounded-full shadow" />
              </div>
            </button>
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

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Location | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await apiGetLocations();
    setLocations(res);
    setLoading(false);
  }

  const filtered = locations.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.address.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSave(data: LocationFormData) {
    setSaving(true);
    try {
      if (editTarget) {
        const updated = await apiUpdateLocation(editTarget.id, data);
        setLocations(prev => prev.map(l => l.id === editTarget.id ? updated : l));
        toast.success('Локация обновлена');
      } else {
        const created = await apiCreateLocation(data);
        setLocations(prev => [...prev, created]);
        toast.success('Локация создана');
      }
      setModalOpen(false);
      setEditTarget(null);
    } catch {
      toast.error('Ошибка сохранения');
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setDeleteId(id);
    try {
      await apiDeleteLocation(id);
      setLocations(prev => prev.filter(l => l.id !== id));
      toast.success('Локация удалена');
    } catch {
      toast.error('Ошибка удаления');
    }
    setDeleteId(null);
  }

  if (loading) return <PageLoader />;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Локации</h1>
          <p className="text-slate-500 mt-1">Рабочие офисы и точки отметки сотрудников</p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setModalOpen(true); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Добавить локацию
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{locations.length}</p>
              <p className="text-xs text-slate-500">Всего локаций</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{locations.filter(l => l.isActive).length}</p>
              <p className="text-xs text-slate-500">Активных</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{locations.filter(l => !l.isActive).length}</p>
              <p className="text-xs text-slate-500">Неактивных</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по названию или адресу..."
          className="form-input pl-9"
        />
      </div>

      {/* Location Cards Grid */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Локации не найдены</p>
          <p className="text-slate-400 text-sm mt-1">Добавьте первую рабочую локацию</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(loc => (
            <div key={loc.id} className="card overflow-hidden group">
              {/* Map placeholder */}
              <div className="h-36 bg-gradient-to-br from-brand-50 to-cyan-50 relative flex items-center justify-center border-b border-slate-100">
                <div className="text-center">
                  <div className="w-10 h-10 bg-brand-600 rounded-full flex items-center justify-center mx-auto mb-2 shadow-lg">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-xs text-slate-500">{loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</p>
                </div>
                {/* Radius circle decoration */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-24 h-24 border-2 border-brand-300 border-dashed rounded-full opacity-50" />
                  <div className="absolute w-12 h-12 border-2 border-brand-400 rounded-full opacity-30" />
                </div>
                {/* Status badge */}
                <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                  loc.isActive
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${loc.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  {loc.isActive ? 'Активна' : 'Неактивна'}
                </div>
              </div>

              <div className="p-4">
                <h3 className="font-semibold text-slate-900">{loc.name}</h3>
                <p className="text-sm text-slate-500 mt-1 flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                  {loc.address}
                </p>

                <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <Navigation className="w-3.5 h-3.5 text-brand-500" />
                    <span className="font-medium text-slate-700">Радиус:</span>
                    {loc.radiusMeters} м
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
                  <button
                    onClick={() => { setEditTarget(loc); setModalOpen(true); }}
                    className="flex-1 flex items-center justify-center gap-1.5 text-sm text-slate-600 hover:text-brand-600 hover:bg-brand-50 py-2 rounded-lg transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Изменить
                  </button>
                  <div className="w-px h-6 bg-slate-200" />
                  <button
                    onClick={() => handleDelete(loc.id)}
                    disabled={deleteId === loc.id}
                    className="flex-1 flex items-center justify-center gap-1.5 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 py-2 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deleteId === loc.id ? 'Удаление...' : 'Удалить'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <LocationModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        onSave={handleSave}
        initial={editTarget}
        loading={saving}
      />
    </div>
  );
}
