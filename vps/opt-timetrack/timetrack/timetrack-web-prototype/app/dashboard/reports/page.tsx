'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet, Download, Clock, AlertTriangle,
  TrendingUp, UserX, Calendar, ChevronLeft, ChevronRight,
  BarChart2, FileText
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, parseISO, subMonths, addMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { apiGetAttendance, apiGetEmployees, apiGetDepartments } from '@/lib/api/mock-service';
import { AttendanceRecord, Employee } from '@/lib/types';
import { PageLoader } from '@/components/shared';
import { toast } from 'sonner';

type ReportTab = 'timesheet' | 'late' | 'overtime' | 'absences';

const TABS: { key: ReportTab; label: string; icon: any }[] = [
  { key: 'timesheet', label: 'Табель', icon: Calendar },
  { key: 'late', label: 'Опоздания', icon: Clock },
  { key: 'overtime', label: 'Переработки', icon: TrendingUp },
  { key: 'absences', label: 'Отсутствия', icon: UserX },
];

interface TimesheetRow {
  employee: Employee;
  days: Record<string, { checkIn?: string; checkOut?: string; status?: string }>;
  totalDays: number;
  lateDays: number;
  totalHours: number;
}

function buildTimesheetData(employees: Employee[], records: AttendanceRecord[], monthDate: Date): TimesheetRow[] {
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);
  const days = eachDayOfInterval({ start, end });

  return employees.map(emp => {
    const empRecords = records.filter(r => r.employeeId === emp.id);
    const dayMap: Record<string, { checkIn?: string; checkOut?: string; status?: string }> = {};

    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayIn = empRecords.find(r => r.type === 'CHECK_IN' && r.markedAt.startsWith(dateStr));
      const dayOut = empRecords.find(r => r.type === 'CHECK_OUT' && r.markedAt.startsWith(dateStr));
      if (dayIn || dayOut) {
        dayMap[dateStr] = {
          checkIn: dayIn ? format(parseISO(dayIn.markedAt), 'HH:mm') : undefined,
          checkOut: dayOut ? format(parseISO(dayOut.markedAt), 'HH:mm') : undefined,
          status: dayIn?.status,
        };
      }
    });

    const totalDays = Object.keys(dayMap).length;
    const lateDays = Object.values(dayMap).filter(d => d.status === 'LATE').length;

    let totalMins = 0;
    Object.values(dayMap).forEach(d => {
      if (d.checkIn && d.checkOut) {
        const [ih, im] = d.checkIn.split(':').map(Number);
        const [oh, om] = d.checkOut.split(':').map(Number);
        totalMins += (oh * 60 + om) - (ih * 60 + im);
      }
    });

    return { employee: emp, days: dayMap, totalDays, lateDays, totalHours: Math.round(totalMins / 60) };
  });
}

function exportExcel(data: TimesheetRow[], monthDate: Date) {
  const monthLabel = format(monthDate, 'MMMM yyyy', { locale: ru });
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);
  const days = eachDayOfInterval({ start, end });

  const headers = ['Сотрудник', 'Должность', ...days.map(d => format(d, 'd')), 'Дней', 'Опозданий', 'Часов'];
  const rows = data.map(row => [
    row.employee.fullName,
    row.employee.position,
    ...days.map(d => {
      const ds = format(d, 'yyyy-MM-dd');
      const entry = row.days[ds];
      if (!entry) return '-';
      if (entry.checkIn && entry.checkOut) return `${entry.checkIn}-${entry.checkOut}`;
      if (entry.checkIn) return entry.checkIn;
      return '?';
    }),
    row.totalDays,
    row.lateDays,
    row.totalHours,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Табель ${monthLabel}`);
  XLSX.writeFile(wb, `timetrack_${format(monthDate, 'yyyy_MM')}.xlsx`);
  toast.success('Excel файл скачан');
}

function exportLateReport(data: TimesheetRow[], monthDate: Date) {
  const lateData = data
    .filter(r => r.lateDays > 0)
    .map(r => [r.employee.fullName, r.employee.position, r.lateDays, `${r.totalHours}ч`])
    .sort((a, b) => (b[2] as number) - (a[2] as number));

  const ws = XLSX.utils.aoa_to_sheet([
    ['Сотрудник', 'Должность', 'Кол-во опозданий', 'Всего часов'],
    ...lateData,
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Опоздания');
  XLSX.writeFile(wb, `late_report_${format(monthDate, 'yyyy_MM')}.xlsx`);
  toast.success('Отчёт об опозданиях скачан');
}

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('timesheet');
  const [month, setMonth] = useState(new Date());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [deptFilter, setDeptFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [emps, att, depts] = await Promise.all([
      apiGetEmployees({ status: 'active' }),
      apiGetAttendance({}),
      apiGetDepartments(),
    ]);
    setEmployees(emps.data);
    setRecords(att.data);
    setDepartments(depts);
    setLoading(false);
  }

  const filteredEmployees = useMemo(() => {
    if (!deptFilter) return employees;
    return employees.filter(e => e.departmentId === deptFilter);
  }, [employees, deptFilter]);

  const timesheetData = useMemo(
    () => buildTimesheetData(filteredEmployees, records, month),
    [filteredEmployees, records, month]
  );

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const monthLabel = format(month, 'MMMM yyyy', { locale: ru });

  const lateStats = useMemo(() => timesheetData
    .filter(r => r.lateDays > 0)
    .sort((a, b) => b.lateDays - a.lateDays),
    [timesheetData]);

  const absenceStats = useMemo(() => timesheetData
    .map(r => ({ ...r, absentDays: Math.max(0, 22 - r.totalDays) }))
    .filter(r => r.absentDays > 0)
    .sort((a, b) => b.absentDays - a.absentDays),
    [timesheetData]);

  const overtimeStats = useMemo(() => timesheetData
    .filter(r => r.totalHours > 160)
    .sort((a, b) => b.totalHours - a.totalHours),
    [timesheetData]);

  if (loading) return <PageLoader />;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Отчёты</h1>
          <p className="text-slate-500 mt-1">Табели, опоздания, переработки и отсутствия</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-3 py-2">
            <button onClick={() => setMonth(m => subMonths(m, 1))} className="p-1 hover:text-brand-600 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-sm font-semibold text-slate-900 capitalize min-w-36 text-center">
              {monthLabel}
            </span>
            <button onClick={() => setMonth(m => addMonths(m, 1))} className="p-1 hover:text-brand-600 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="form-input text-sm"
          >
            <option value="">Все отделы</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Сотрудников', value: filteredEmployees.length, color: 'brand', icon: BarChart2 },
          { label: 'Ср. рабочих дней', value: Math.round(timesheetData.reduce((a, b) => a + b.totalDays, 0) / Math.max(timesheetData.length, 1)), color: 'emerald', icon: Calendar },
          { label: 'Случаев опоздания', value: timesheetData.reduce((a, b) => a + b.lateDays, 0), color: 'amber', icon: Clock },
          { label: 'Ср. часов', value: Math.round(timesheetData.reduce((a, b) => a + b.totalHours, 0) / Math.max(timesheetData.length, 1)), color: 'purple', icon: TrendingUp },
        ].map(item => (
          <div key={item.label} className="card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 bg-${item.color}-50 rounded-xl flex items-center justify-center`}>
              <item.icon className={`w-5 h-5 text-${item.color === 'brand' ? 'brand-600' : item.color + '-600'}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{item.value}</p>
              <p className="text-xs text-slate-500">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-white text-brand-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Timesheet Tab */}
      {tab === 'timesheet' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-3">
            <button
              onClick={() => exportExcel(timesheetData, month)}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel
            </button>
            <button
              onClick={() => toast.info('PDF экспорт — в разработке')}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
          </div>
          <div className="card overflow-auto">
            <table className="w-full text-xs min-w-max">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-600 sticky left-0 bg-slate-50 z-10 min-w-40">Сотрудник</th>
                  {days.map(d => (
                    <th
                      key={d.toISOString()}
                      className={`px-1.5 py-2 font-medium text-center w-10 ${
                        getDay(d) === 0 || getDay(d) === 6
                          ? 'text-slate-400'
                          : 'text-slate-600'
                      }`}
                    >
                      <div>{format(d, 'd')}</div>
                      <div className="font-normal text-slate-400">{format(d, 'EEEEE', { locale: ru })}</div>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center font-medium text-slate-600 min-w-12">Дн.</th>
                  <th className="px-2 py-2 text-center font-medium text-slate-600 min-w-12">Оп.</th>
                  <th className="px-2 py-2 text-center font-medium text-slate-600 min-w-12">Ч.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {timesheetData.map(row => (
                  <tr key={row.employee.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 sticky left-0 bg-white z-10 border-r border-slate-100">
                      <p className="font-medium text-slate-800 whitespace-nowrap">{row.employee.fullName}</p>
                      <p className="text-slate-400 text-xs">{row.employee.position}</p>
                    </td>
                    {days.map(d => {
                      const ds = format(d, 'yyyy-MM-dd');
                      const entry = row.days[ds];
                      const isWeekend = getDay(d) === 0 || getDay(d) === 6;
                      return (
                        <td key={ds} className={`px-1 py-2 text-center ${isWeekend ? 'bg-slate-50' : ''}`}>
                          {entry ? (
                            <div className={`text-center leading-tight ${
                              entry.status === 'LATE' ? 'text-amber-600' : 'text-emerald-600'
                            }`}>
                              {entry.checkIn && <div>{entry.checkIn}</div>}
                              {entry.checkOut && <div className="text-slate-400">{entry.checkOut}</div>}
                            </div>
                          ) : (
                            <span className={isWeekend ? 'text-slate-300' : 'text-slate-300'}>
                              {isWeekend ? 'В' : '—'}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-center font-semibold text-slate-700">{row.totalDays}</td>
                    <td className={`px-2 py-2 text-center font-semibold ${row.lateDays > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {row.lateDays || '—'}
                    </td>
                    <td className="px-2 py-2 text-center font-semibold text-slate-700">{row.totalHours}ч</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Late Tab */}
      {tab === 'late' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => exportLateReport(timesheetData, month)}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              Скачать Excel
            </button>
          </div>
          {lateStats.length === 0 ? (
            <div className="card p-12 text-center">
              <Clock className="w-12 h-12 text-emerald-300 mx-auto mb-4" />
              <p className="font-medium text-slate-500">Опозданий за {monthLabel} не зафиксировано</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Сотрудник</th>
                    <th>Отдел</th>
                    <th>Опозданий</th>
                    <th>Рабочих дней</th>
                    <th>% опозданий</th>
                  </tr>
                </thead>
                <tbody>
                  {lateStats.map(row => (
                    <tr key={row.employee.id}>
                      <td>
                        <p className="font-medium text-slate-900">{row.employee.fullName}</p>
                        <p className="text-xs text-slate-500">{row.employee.position}</p>
                      </td>
                      <td className="text-sm text-slate-600">{row.employee.departmentId}</td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 text-sm font-semibold px-2.5 py-1 rounded-full">
                          <Clock className="w-3.5 h-3.5" />
                          {row.lateDays}
                        </span>
                      </td>
                      <td className="text-sm text-slate-600">{row.totalDays}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-1.5 max-w-20">
                            <div
                              className="bg-amber-400 h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, Math.round(row.lateDays / row.totalDays * 100))}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-600">
                            {Math.round(row.lateDays / Math.max(row.totalDays, 1) * 100)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Overtime Tab */}
      {tab === 'overtime' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Сотрудники с переработками</h3>
            <span className="text-sm text-slate-500">Норма: 160 ч/мес</span>
          </div>
          {overtimeStats.length === 0 ? (
            <div className="p-12 text-center">
              <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Переработок за период не зафиксировано</p>
            </div>
          ) : (
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Всего часов</th>
                  <th>Переработка</th>
                  <th>Рабочих дней</th>
                </tr>
              </thead>
              <tbody>
                {overtimeStats.map(row => (
                  <tr key={row.employee.id}>
                    <td>
                      <p className="font-medium text-slate-900">{row.employee.fullName}</p>
                      <p className="text-xs text-slate-500">{row.employee.position}</p>
                    </td>
                    <td>
                      <span className="font-semibold text-slate-900">{row.totalHours}ч</span>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-sm font-semibold px-2.5 py-1 rounded-full">
                        <TrendingUp className="w-3.5 h-3.5" />
                        +{row.totalHours - 160}ч
                      </span>
                    </td>
                    <td className="text-sm text-slate-600">{row.totalDays} дн</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Absences Tab */}
      {tab === 'absences' && (
        <div className="card overflow-hidden">
          {absenceStats.length === 0 ? (
            <div className="p-12 text-center">
              <UserX className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Данные об отсутствиях не найдены</p>
            </div>
          ) : (
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Отработал дней</th>
                  <th>Отсутствовал (расч.)</th>
                  <th>Часов отработано</th>
                </tr>
              </thead>
              <tbody>
                {absenceStats.map(row => (
                  <tr key={row.employee.id}>
                    <td>
                      <p className="font-medium text-slate-900">{row.employee.fullName}</p>
                      <p className="text-xs text-slate-500">{row.employee.position}</p>
                    </td>
                    <td className="text-sm font-semibold text-slate-900">{row.totalDays} дн</td>
                    <td>
                      <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-sm font-semibold px-2.5 py-1 rounded-full">
                        <UserX className="w-3.5 h-3.5" />
                        ~{row.absentDays} дн
                      </span>
                    </td>
                    <td className="text-sm text-slate-600">{row.totalHours}ч</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
