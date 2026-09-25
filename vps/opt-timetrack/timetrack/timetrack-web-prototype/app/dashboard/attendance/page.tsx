'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  LogIn, LogOut, Search, Filter, Calendar, MapPin,
  Camera, Wifi, WifiOff, ChevronDown, X, Eye,
  Clock, Smartphone, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { AttendanceRecord, Employee, Location } from '@/lib/types';
import { apiGetAttendance, apiGetEmployees, apiGetLocations } from '@/lib/api/mock-service';
import { AttendanceStatusBadge, PageLoader } from '@/components/shared';
import { formatDateTime, formatTime } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'OK', label: 'OK' },
  { value: 'LATE', label: 'Опоздание' },
  { value: 'OUT_OF_GEOFENCE', label: 'Вне зоны' },
  { value: 'MANUAL_REVIEW', label: 'На проверке' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'Все типы' },
  { value: 'CHECK_IN', label: 'Приход' },
  { value: 'CHECK_OUT', label: 'Уход' },
];

function DetailModal({ record, onClose }: { record: AttendanceRecord | null; onClose: () => void }) {
  if (!record) return null;

  const statusColors: Record<string, string> = {
    OK: 'text-emerald-600 bg-emerald-50',
    LATE: 'text-amber-600 bg-amber-50',
    OUT_OF_GEOFENCE: 'text-red-600 bg-red-50',
    MANUAL_REVIEW: 'text-blue-600 bg-blue-50',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              record.type === 'CHECK_IN' ? 'bg-emerald-100' : 'bg-rose-100'
            }`}>
              {record.type === 'CHECK_IN'
                ? <LogIn className="w-5 h-5 text-emerald-600" />
                : <LogOut className="w-5 h-5 text-rose-600" />
              }
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">
                {record.type === 'CHECK_IN' ? 'Приход' : 'Уход'}
              </h3>
              <p className="text-xs text-slate-500">{record.employeeName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${statusColors[record.status]}`}>
            {record.status === 'OK' && <CheckCircle2 className="w-4 h-4" />}
            {record.status === 'LATE' && <Clock className="w-4 h-4" />}
            {record.status === 'OUT_OF_GEOFENCE' && <AlertTriangle className="w-4 h-4" />}
            {record.status === 'MANUAL_REVIEW' && <Eye className="w-4 h-4" />}
            <AttendanceStatusBadge status={record.status} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-500 mb-1">Время отметки</p>
              <p className="font-semibold text-slate-900">{formatDateTime(record.markedAt)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-500 mb-1">Время сервера</p>
              <p className="font-semibold text-slate-900">{formatDateTime(record.serverAt)}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-700">{record.locationName}</p>
                <p className="text-xs text-slate-500">{record.lat.toFixed(5)}, {record.lng.toFixed(5)}</p>
                <p className="text-xs text-slate-400">Точность: ±{record.accuracyMeters} м</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {record.isOfflineSynced
                ? <WifiOff className="w-4 h-4 text-amber-500 flex-shrink-0" />
                : <Wifi className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              }
              <p className="text-sm text-slate-600">
                {record.isOfflineSynced ? 'Синхронизировано офлайн' : 'Онлайн-отметка'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Smartphone className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <div>
                <p className="text-sm text-slate-600">Источник: {record.source}</p>
                {record.deviceInfo && (
                  <p className="text-xs text-slate-400">
                    {record.deviceInfo.platform} • {record.deviceInfo.model}
                  </p>
                )}
              </div>
            </div>

            {record.photoUrl && (
              <div className="flex items-start gap-3">
                <Camera className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <p className="text-sm text-slate-600 mb-2">Фото-подтверждение</p>
                  <div className="w-24 h-24 bg-gradient-to-br from-brand-100 to-cyan-100 rounded-xl flex items-center justify-center">
                    <Camera className="w-8 h-8 text-brand-400" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-5">
          <button onClick={onClose} className="w-full btn-secondary">Закрыть</button>
        </div>
      </div>
    </div>
  );
}

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<AttendanceRecord | null>(null);

  const [filters, setFilters] = useState({
    search: '',
    employeeId: '',
    locationId: '',
    status: '',
    type: '',
    dateFrom: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    dateTo: format(new Date(), 'yyyy-MM-dd'),
  });

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [att, emps, locs] = await Promise.all([
      apiGetAttendance({}),
      apiGetEmployees({}),
      apiGetLocations(),
    ]);
    setRecords(att.data);
    setEmployees(emps.data);
    setLocations(locs);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return records.filter(r => {
      const matchSearch = !filters.search ||
        r.employeeName.toLowerCase().includes(filters.search.toLowerCase()) ||
        r.locationName.toLowerCase().includes(filters.search.toLowerCase());
      const matchEmp = !filters.employeeId || r.employeeId === filters.employeeId;
      const matchLoc = !filters.locationId || r.locationId === filters.locationId;
      const matchStatus = !filters.status || r.status === filters.status;
      const matchType = !filters.type || r.type === filters.type;
      const date = r.markedAt.split('T')[0];
      const matchFrom = !filters.dateFrom || date >= filters.dateFrom;
      const matchTo = !filters.dateTo || date <= filters.dateTo;
      return matchSearch && matchEmp && matchLoc && matchStatus && matchType && matchFrom && matchTo;
    });
  }, [records, filters]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  function updateFilter(key: string, value: string) {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  }

  const hasActiveFilters = filters.employeeId || filters.locationId || filters.status || filters.type;

  if (loading) return <PageLoader />;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Журнал отметок</h1>
        <p className="text-slate-500 mt-1">История всех приходов и уходов сотрудников</p>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={filters.search}
              onChange={e => updateFilter('search', e.target.value)}
              placeholder="Поиск по сотруднику или локации..."
              className="form-input pl-9 text-sm"
            />
          </div>

          <input
            type="date"
            value={filters.dateFrom}
            onChange={e => updateFilter('dateFrom', e.target.value)}
            className="form-input text-sm w-40"
          />
          <span className="text-slate-400 text-sm">—</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={e => updateFilter('dateTo', e.target.value)}
            className="form-input text-sm w-40"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <select
              value={filters.employeeId}
              onChange={e => updateFilter('employeeId', e.target.value)}
              className="form-input text-sm pr-8 appearance-none"
            >
              <option value="">Все сотрудники</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.fullName}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={filters.locationId}
              onChange={e => updateFilter('locationId', e.target.value)}
              className="form-input text-sm pr-8 appearance-none"
            >
              <option value="">Все локации</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={filters.status}
              onChange={e => updateFilter('status', e.target.value)}
              className="form-input text-sm pr-8 appearance-none"
            >
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={filters.type}
              onChange={e => updateFilter('type', e.target.value)}
              className="form-input text-sm pr-8 appearance-none"
            >
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          {hasActiveFilters && (
            <button
              onClick={() => setFilters(prev => ({ ...prev, employeeId: '', locationId: '', status: '', type: '' }))}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Сбросить
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Найдено <span className="font-semibold text-slate-900">{filtered.length}</span> записей
        </p>
        {totalPages > 1 && (
          <p className="text-sm text-slate-500">
            Страница {page} из {totalPages}
          </p>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {paginated.length === 0 ? (
          <div className="p-12 text-center">
            <Filter className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">Записи не найдены</p>
            <p className="text-slate-400 text-sm mt-1">Измените параметры фильтрации</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Тип</th>
                  <th>Время</th>
                  <th>Локация</th>
                  <th>Статус</th>
                  <th>Источник</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setDetail(r)}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-brand-400 to-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {r.employeeName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </div>
                        <span className="font-medium text-slate-900 text-sm">{r.employeeName}</span>
                      </div>
                    </td>
                    <td>
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        r.type === 'CHECK_IN'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}>
                        {r.type === 'CHECK_IN'
                          ? <LogIn className="w-3 h-3" />
                          : <LogOut className="w-3 h-3" />
                        }
                        {r.type === 'CHECK_IN' ? 'Приход' : 'Уход'}
                      </div>
                    </td>
                    <td>
                      <p className="text-sm font-medium text-slate-900">{formatTime(r.markedAt)}</p>
                      <p className="text-xs text-slate-400">{format(parseISO(r.markedAt), 'dd MMM', { locale: ru })}</p>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="text-sm text-slate-600">{r.locationName}</span>
                      </div>
                    </td>
                    <td><AttendanceStatusBadge status={r.status} /></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{r.source}</span>
                        {r.photoUrl && <Camera className="w-3.5 h-3.5 text-slate-400" title="Есть фото" />}
                        {r.isOfflineSynced && <WifiOff className="w-3.5 h-3.5 text-amber-400" title="Офлайн-синк" />}
                      </div>
                    </td>
                    <td>
                      <button
                        onClick={e => { e.stopPropagation(); setDetail(r); }}
                        className="p-1 text-slate-400 hover:text-brand-600 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40"
          >
            ← Назад
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                page === p
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40"
          >
            Вперёд →
          </button>
        </div>
      )}

      <DetailModal record={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
