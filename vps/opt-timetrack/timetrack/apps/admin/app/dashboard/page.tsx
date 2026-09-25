'use client';

import { useEffect, useState } from 'react';
import { Users, UserCheck, Briefcase, AlertTriangle, Clock, MapPin, TrendingUp } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { StatCard, AttendanceStatusBadge, PageLoader } from '@/components/shared';
import {
  apiGetDashboardStats, apiGetAttendanceChart,
  apiGetDeptLateStats, apiGetTodayAttendance,
} from '@/lib/api/service';
import type { DashboardStats, AttendanceChartPoint, DepartmentLateStats, AttendanceRecord } from '@/lib/types';
import { formatTime } from '@/lib/utils';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chart, setChart] = useState<AttendanceChartPoint[]>([]);
  const [deptStats, setDeptStats] = useState<DepartmentLateStats[]>([]);
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiGetDashboardStats(),
      apiGetAttendanceChart(),
      apiGetDeptLateStats(),
      apiGetTodayAttendance(),
    ]).then(([s, c, d, t]) => {
      setStats(s);
      setChart(c);
      setDeptStats(d);
      setTodayRecords(t.slice(0, 10));
      setLoading(false);
    });
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-6">
      {/* Page title */}
      <div>
        <h1 className="page-title">Обзор</h1>
        <p className="text-sm text-slate-500 mt-1">
          {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Всего сотрудников"
          value={stats!.totalEmployees}
          icon={<Users className="h-4 w-4" />}
          iconColor="bg-brand-100 text-brand-700"
        />
        <StatCard
          title="Отметились сегодня"
          value={stats!.checkedInToday}
          icon={<UserCheck className="h-4 w-4" />}
          iconColor="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          title="Сейчас на работе"
          value={stats!.currentlyWorking}
          icon={<Briefcase className="h-4 w-4" />}
          iconColor="bg-cyan-100 text-cyan-700"
        />
        <StatCard
          title="Опоздания сегодня"
          value={stats!.lateTodayCount}
          icon={<AlertTriangle className="h-4 w-4" />}
          iconColor="bg-amber-100 text-amber-700"
        />
        <StatCard
          title="Ожидают согласования"
          value={stats!.pendingApprovals}
          icon={<Clock className="h-4 w-4" />}
          iconColor="bg-violet-100 text-violet-700"
        />
        <StatCard
          title="Активных локаций"
          value={stats!.activeLocations}
          icon={<MapPin className="h-4 w-4" />}
          iconColor="bg-teal-100 text-teal-700"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Attendance chart */}
        <div className="card p-5 lg:col-span-3">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Посещаемость за 7 дней</h2>
            <p className="text-xs text-slate-500 mt-0.5">Приходы, уходы и опоздания</p>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCheckedIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="checkedIn"
                  name="Пришли"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  fill="url(#gradCheckedIn)"
                />
                <Area
                  type="monotone"
                  dataKey="late"
                  name="Опоздали"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Late by department */}
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Опоздания по отделам</h2>
            <p className="text-xs text-slate-500 mt-0.5">За последние 14 дней</p>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptStats} layout="vertical" margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis dataKey="department" type="category" tick={{ fontSize: 10, fill: '#64748b' }} width={80} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
                />
                <Bar dataKey="lateCount" name="Опоздания" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Today's attendance */}
      <div className="card">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Последние отметки сегодня</h2>
            <p className="text-xs text-slate-500 mt-0.5">{todayRecords.length} записей</p>
          </div>
          <a href="/dashboard/attendance" className="text-xs font-medium text-brand-600 hover:text-brand-700">
            Все отметки →
          </a>
        </div>

        {todayRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Clock className="h-8 w-8 mb-2" />
            <p className="text-sm">Сегодня ещё нет отметок</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full data-table">
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Тип</th>
                  <th>Время</th>
                  <th>Локация</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {todayRecords.map(rec => (
                  <tr key={rec.id} className="cursor-pointer hover:bg-slate-50/60 transition-colors">
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                          {rec.employeeName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{rec.employeeName}</p>
                          <p className="text-xs text-slate-400">{rec.employeeCode}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${rec.type === 'CHECK_IN' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'}`}>
                        {rec.type === 'CHECK_IN' ? '↓ Приход' : '↑ Уход'}
                      </span>
                    </td>
                    <td className="font-mono text-sm">{formatTime(rec.markedAt)}</td>
                    <td className="text-sm text-slate-500">{rec.locationName}</td>
                    <td><AttendanceStatusBadge status={rec.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
