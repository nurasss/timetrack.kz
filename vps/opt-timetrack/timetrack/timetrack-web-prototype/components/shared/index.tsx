import { cn } from '@/lib/utils';
import type { AttendanceStatus, LeaveStatus, EmployeeStatus, IntegrationStatus } from '@/lib/types';
import {
  ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_COLORS,
  LEAVE_STATUS_LABELS, LEAVE_STATUS_COLORS,
  EMPLOYEE_STATUS_LABELS, EMPLOYEE_STATUS_COLORS,
  INTEGRATION_STATUS_LABELS, INTEGRATION_STATUS_COLORS,
} from '@/lib/utils';

// ──────────────────────────────────────
// Loading Spinner
// ──────────────────────────────────────

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className="h-6 w-6 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin" />
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex h-48 items-center justify-center">
      <LoadingSpinner />
    </div>
  );
}

// ──────────────────────────────────────
// Empty State
// ──────────────────────────────────────

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-slate-500 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ──────────────────────────────────────
// Status Badges
// ──────────────────────────────────────

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <span className={cn('badge', ATTENDANCE_STATUS_COLORS[status])}>
      {ATTENDANCE_STATUS_LABELS[status]}
    </span>
  );
}

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return (
    <span className={cn('badge', LEAVE_STATUS_COLORS[status])}>
      {LEAVE_STATUS_LABELS[status]}
    </span>
  );
}

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  return (
    <span className={cn('badge', EMPLOYEE_STATUS_COLORS[status])}>
      {EMPLOYEE_STATUS_LABELS[status]}
    </span>
  );
}

export function IntegrationStatusBadge({ status }: { status: IntegrationStatus }) {
  return (
    <span className={cn('badge', INTEGRATION_STATUS_COLORS[status])}>
      {INTEGRATION_STATUS_LABELS[status]}
    </span>
  );
}

// ──────────────────────────────────────
// Stat Card
// ──────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconColor?: string;
  change?: string;
  changeLabel?: string;
}

export function StatCard({ title, value, icon, iconColor = 'bg-brand-100 text-brand-700', change, changeLabel }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', iconColor)}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        {change && (
          <p className="text-xs text-slate-500 mt-1">{change} {changeLabel}</p>
        )}
      </div>
    </div>
  );
}
