import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { AttendanceStatus, LeaveStatus, LeaveType, EmployeeStatus, IntegrationStatus } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(iso: string): string {
  try {
    return format(parseISO(iso), 'dd.MM.yyyy HH:mm', { locale: ru });
  } catch {
    return iso;
  }
}

export function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), 'dd.MM.yyyy', { locale: ru });
  } catch {
    return iso;
  }
}

export function formatTime(iso: string): string {
  try {
    return format(parseISO(iso), 'HH:mm');
  } catch {
    return iso;
  }
}

export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0 мин';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} мин`;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
}

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  OK: 'Вовремя',
  LATE: 'Опоздание',
  OUT_OF_GEOFENCE: 'Вне геозоны',
  MANUAL_REVIEW: 'На проверке',
};

export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  OK: 'bg-emerald-100 text-emerald-800',
  LATE: 'bg-amber-100 text-amber-800',
  OUT_OF_GEOFENCE: 'bg-red-100 text-red-800',
  MANUAL_REVIEW: 'bg-slate-100 text-slate-700',
};

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  PENDING: 'Ожидает',
  APPROVED: 'Одобрено',
  REJECTED: 'Отклонено',
};

export const LEAVE_STATUS_COLORS: Record<LeaveStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
};

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  VACATION: 'Отпуск',
  SICK: 'Больничный',
  BUSINESS_TRIP: 'Командировка',
  DAY_OFF: 'Отгул',
};

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: 'Активен',
  inactive: 'Неактивен',
  on_leave: 'В отпуске',
};

export const EMPLOYEE_STATUS_COLORS: Record<EmployeeStatus, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  inactive: 'bg-slate-100 text-slate-600',
  on_leave: 'bg-blue-100 text-blue-800',
};

export const INTEGRATION_STATUS_LABELS: Record<IntegrationStatus, string> = {
  connected: 'Подключено',
  not_connected: 'Не подключено',
  in_progress: 'В разработке',
};

export const INTEGRATION_STATUS_COLORS: Record<IntegrationStatus, string> = {
  connected: 'bg-emerald-100 text-emerald-800',
  not_connected: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-amber-100 text-amber-800',
};

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return {
    data: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
    totalPages: Math.ceil(items.length / pageSize),
  };
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
