import type {
  Employee, Location, WorkSchedule, AttendanceRecord, DaySummary,
  LeaveRequest, CalendarDay, AppNotification,
} from '@/types';

export const MOCK_EMPLOYEE: Employee = {
  id: 'emp_001',
  fullName: 'Алексей Петров',
  position: 'Менеджер по продажам',
  company: 'ТОО «Алтын Логистик»',
  department: 'Отдел продаж',
  avatarInitials: 'АП',
  scheduleId: 'sch_001',
  primaryLocationId: 'loc_001',
};

export const MOCK_LOCATION: Location = {
  id: 'loc_001',
  name: 'Офис Алматы',
  address: 'ул. Абая, 109Б',
  radiusMeters: 80,
};

export const MOCK_SCHEDULE: WorkSchedule = {
  id: 'sch_001',
  name: '5/2, офис',
  startTime: '09:00',
  endTime: '18:00',
  lunchStart: '13:00',
  lunchEnd: '14:00',
};

export const MOCK_COLLEAGUES = [
  { fullName: 'Мария Сидорова', position: 'Бухгалтер', initials: 'МС' },
  { fullName: 'Дмитрий Ким', position: 'Дизайнер', initials: 'ДК' },
  { fullName: 'Анна Иванова', position: 'HR-менеджер', initials: 'АИ' },
  { fullName: 'Сергей Павлов', position: 'Кладовщик', initials: 'СП' },
];

export const MOCK_TODAY_RECORDS: AttendanceRecord[] = [
  {
    id: 'att_today_in',
    type: 'CHECK_IN',
    date: '2026-06-16',
    time: '08:56',
    locationName: 'Офис Алматы',
    accuracyMeters: 12,
    status: 'OK',
  },
];

export const MOCK_HISTORY: DaySummary[] = [
  {
    date: '2026-06-16',
    workedMinutes: 0,
    lateMinutes: 0,
    records: [
      { id: 'h1', type: 'CHECK_IN', date: '2026-06-16', time: '08:56', locationName: 'Офис Алматы', accuracyMeters: 12, status: 'OK' },
    ],
  },
  {
    date: '2026-06-15',
    workedMinutes: 537,
    lateMinutes: 0,
    records: [
      { id: 'h2', type: 'CHECK_IN', date: '2026-06-15', time: '08:56', locationName: 'Офис Алматы', accuracyMeters: 12, status: 'OK' },
      { id: 'h3', type: 'CHECK_OUT', date: '2026-06-15', time: '18:07', locationName: 'Офис Алматы', accuracyMeters: 15, status: 'OK' },
    ],
  },
  {
    date: '2026-06-14',
    workedMinutes: 522,
    lateMinutes: 12,
    records: [
      { id: 'h4', type: 'CHECK_IN', date: '2026-06-14', time: '09:12', locationName: 'Офис Алматы', accuracyMeters: 10, status: 'LATE' },
      { id: 'h5', type: 'CHECK_OUT', date: '2026-06-14', time: '18:01', locationName: 'Офис Алматы', accuracyMeters: 18, status: 'OK' },
    ],
  },
  {
    date: '2026-06-13',
    workedMinutes: 540,
    lateMinutes: 0,
    records: [
      { id: 'h6', type: 'CHECK_IN', date: '2026-06-13', time: '08:49', locationName: 'Офис Алматы', accuracyMeters: 9, status: 'OK' },
      { id: 'h7', type: 'CHECK_OUT', date: '2026-06-13', time: '18:00', locationName: 'Офис Алматы', accuracyMeters: 14, status: 'OK' },
    ],
  },
];

export const MOCK_LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: 'req_001',
    type: 'VACATION',
    status: 'PENDING',
    startDate: '2026-06-24',
    endDate: '2026-06-30',
    daysCount: 7,
    comment: 'Ежегодный отпуск',
    createdAt: '2026-06-10',
  },
  {
    id: 'req_002',
    type: 'SICK',
    status: 'APPROVED',
    startDate: '2026-05-13',
    endDate: '2026-05-15',
    daysCount: 3,
    createdAt: '2026-05-12',
  },
  {
    id: 'req_003',
    type: 'BUSINESS_TRIP',
    status: 'PENDING',
    startDate: '2026-05-20',
    endDate: '2026-05-22',
    daysCount: 3,
    comment: 'Командировка в Астану, встреча с клиентом',
    createdAt: '2026-05-14',
  },
];

export const MOCK_TODAY = new Date('2026-06-16');
function isoDay(offset: number) {
  const d = new Date(MOCK_TODAY);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export const MOCK_CALENDAR: CalendarDay[] = Array.from({ length: 31 }, (_, i) => {
  const offset = i - MOCK_TODAY.getDate() + 1;
  const date = isoDay(offset);
  const dow = new Date(date).getDay();
  if (dow === 0 || dow === 6) return { date, status: 'weekend' as const };
  if (i === 13) return { date, status: 'late' as const, note: 'Опоздание 12 мин' };
  if (i === 7) return { date, status: 'absent' as const, note: 'Отсутствие' };
  if (i >= 23 && i <= 29) return { date, status: 'leave' as const, note: 'Отпуск' };
  return { date, status: 'work' as const };
});

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    kind: 'late',
    title: 'Опоздание',
    message: 'Вы пришли с опозданием на 12 минут',
    createdAt: '2026-06-14 09:12',
    read: false,
  },
  {
    id: 'n2',
    kind: 'approved',
    title: 'Заявка одобрена',
    message: 'Ваш больничный (13–15 мая) одобрен',
    createdAt: '2026-05-12 10:30',
    read: false,
  },
  {
    id: 'n3',
    kind: 'reminder',
    title: 'Напоминание',
    message: 'Не забудьте отметить уход',
    createdAt: '2026-06-15 17:45',
    read: true,
  },
  {
    id: 'n4',
    kind: 'sync',
    title: 'Синхронизация',
    message: 'Данные синхронизированы',
    createdAt: '2026-05-12 18:10',
    read: true,
  },
  {
    id: 'n5',
    kind: 'update',
    title: 'Обновление',
    message: 'Доступна новая версия приложения',
    createdAt: '2026-05-12 12:00',
    read: true,
  },
];
