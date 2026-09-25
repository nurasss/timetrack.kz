import type {
  Attendance,
  Company,
  Department,
  Employee,
  IntegrationItem,
  LeaveRequest,
  Location,
  NotificationItem,
  Position,
  Schedule
} from './types';

export const companies: Company[] = [];
export const departments: Department[] = [];
export const positions: Position[] = [];
export const locations: Location[] = [];
export const schedules: Schedule[] = [];
export const employees: Employee[] = [];
export const attendances: Attendance[] = [];
export const requests: LeaveRequest[] = [];
export const notifications: NotificationItem[] = [];

export const integrations: IntegrationItem[] = [
  { id: 'i1', name: '1С', description: 'Экспорт табеля и заявок в 1С:ЗУП/Бухгалтерию', status: 'disconnected', category: 'accounting' },
  { id: 'i2', name: 'Bitrix24', description: 'Синхронизация сотрудников и webhooks по событиям', status: 'disconnected', category: 'api' },
  { id: 'i3', name: 'Hikvision', description: 'Получение событий с терминалов и турникетов', status: 'disconnected', category: 'hardware' },
  { id: 'i4', name: 'ZKTeco', description: 'Импорт журналов прохода и статусов устройств', status: 'disconnected', category: 'hardware' },
  { id: 'i5', name: 'Telegram Bot', description: 'Уведомления руководителям по опозданиям и заявкам', status: 'disconnected', category: 'communications' },
  { id: 'i6', name: 'Webhooks / Open API', description: 'Внешние системы и кастомные интеграции', status: 'disconnected', category: 'api' },
  { id: 'i7', name: 'Freedom Pay / Kaspi Pay', description: 'Оплата подписки и годовые счета', status: 'disconnected', category: 'payments' }
];

export const dashboardStats = {
  totalEmployees: 0,
  presentToday: 0,
  lateToday: 0,
  absentToday: 0,
  overtimeThisWeek: 0,
  pendingRequests: 0
};

export const weeklyAttendance = [
  { day: 'Пн', present: 0, late: 0 },
  { day: 'Вт', present: 0, late: 0 },
  { day: 'Ср', present: 0, late: 0 },
  { day: 'Чт', present: 0, late: 0 },
  { day: 'Пт', present: 0, late: 0 },
  { day: 'Сб', present: 0, late: 0 },
  { day: 'Вс', present: 0, late: 0 }
];

export const locationStatus: { name: string; value: number }[] = [];

export function getFullName(employee: Employee): string {
  return employee.full_name;
}

export function getEmployeeById(id: string) {
  return employees.find((employee) => employee.id === id);
}

export function getDepartmentName(id: string | null | undefined): string {
  return departments.find((department) => department.id === id)?.name ?? '—';
}

export function getPositionName(id: string | null | undefined): string {
  return positions.find((position) => position.id === id)?.name ?? '—';
}

export function getLocationName(id: string | null | undefined): string {
  return locations.find((location) => location.id === id)?.name ?? '—';
}

export function getScheduleName(id: string | null | undefined): string {
  return schedules.find((schedule) => schedule.id === id)?.name ?? '—';
}

export function requestTypeName(type: LeaveRequest['type']): string {
  const map: Record<LeaveRequest['type'], string> = {
    vacation: 'Отпуск',
    sick: 'Больничный',
    businessTrip: 'Командировка',
    dayOff: 'Отгул'
  };
  return map[type];
}

export function requestStatusName(status: LeaveRequest['status']): string {
  const map: Record<LeaveRequest['status'], string> = {
    pending: 'На рассмотрении',
    approved: 'Одобрено',
    rejected: 'Отклонено'
  };
  return map[status];
}
