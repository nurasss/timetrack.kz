import { subDays, format, addHours, addMinutes, setHours, setMinutes } from 'date-fns';
import type {
  Company, Employee, Location, WorkSchedule, Department,
  AttendanceRecord, LeaveRequest, DashboardStats,
  AttendanceChartPoint, DepartmentLateStats, AuthUser, Integration,
} from '../types';

// ──────────────────────────────────────
// Company
// ──────────────────────────────────────

export const MOCK_COMPANY: Company = {
  id: 'comp_001',
  name: 'ТОО «Алтын Логистик»',
  bin: '221140012345',
  industry: 'Логистика и дистрибуция',
  employeeCount: 25,
  plan: 'TEAM_25',
  planExpiresAt: '2027-01-01T00:00:00+05:00',
  timezone: 'Asia/Almaty',
  language: 'ru',
  createdAt: '2026-01-15T09:00:00+05:00',
};

// ──────────────────────────────────────
// Departments
// ──────────────────────────────────────

export const MOCK_DEPARTMENTS: Department[] = [
  { id: 'dept_001', companyId: 'comp_001', name: 'Склад и логистика', managerId: 'emp_003' },
  { id: 'dept_002', companyId: 'comp_001', name: 'Отдел продаж', managerId: 'emp_007' },
  { id: 'dept_003', companyId: 'comp_001', name: 'Бухгалтерия и финансы', managerId: 'emp_012' },
  { id: 'dept_004', companyId: 'comp_001', name: 'IT и поддержка', managerId: 'emp_016' },
];

// ──────────────────────────────────────
// Locations
// ──────────────────────────────────────

export const MOCK_LOCATIONS: Location[] = [
  {
    id: 'loc_001',
    companyId: 'comp_001',
    name: 'Главный офис — Алматы',
    address: 'ул. Абая 150, БЦ Алматы Тауэр, оф. 510',
    lat: 43.2220,
    lng: 76.8512,
    radiusMeters: 120,
    isActive: true,
    timezone: 'Asia/Almaty',
  },
  {
    id: 'loc_002',
    companyId: 'comp_001',
    name: 'Складской комплекс — Алматы',
    address: 'пр. Рыскулова 103, район Жетысу',
    lat: 43.2858,
    lng: 76.9741,
    radiusMeters: 250,
    isActive: true,
    timezone: 'Asia/Almaty',
  },
  {
    id: 'loc_003',
    companyId: 'comp_001',
    name: 'Филиал — Астана',
    address: 'пр. Мәңгілік Ел 55/20, БЦ Astana Hub',
    lat: 51.0907,
    lng: 71.4178,
    radiusMeters: 100,
    isActive: true,
    timezone: 'Asia/Almaty',
  },
];

// ──────────────────────────────────────
// Schedules
// ──────────────────────────────────────

export const MOCK_SCHEDULES: WorkSchedule[] = [
  {
    id: 'sch_001',
    companyId: 'comp_001',
    name: 'Стандартный офисный (Пн–Пт)',
    startTime: '09:00',
    endTime: '18:00',
    daysOfWeek: [1, 2, 3, 4, 5],
    lateToleranceMinutes: 10,
    overtimeThresholdMinutes: 30,
    breakDurationMinutes: 60,
  },
  {
    id: 'sch_002',
    companyId: 'comp_001',
    name: 'Склад — Утренняя смена',
    startTime: '07:00',
    endTime: '15:00',
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    lateToleranceMinutes: 5,
    overtimeThresholdMinutes: 20,
    breakDurationMinutes: 45,
  },
  {
    id: 'sch_003',
    companyId: 'comp_001',
    name: 'Склад — Вечерняя смена',
    startTime: '15:00',
    endTime: '23:00',
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    lateToleranceMinutes: 5,
    overtimeThresholdMinutes: 20,
    breakDurationMinutes: 45,
  },
];

// ──────────────────────────────────────
// Auth users
// ──────────────────────────────────────

export const MOCK_AUTH_USERS: Record<string, { user: AuthUser; password: string }> = {
  'admin@timetrack.kz': {
    password: 'password',
    user: {
      id: 'user_001',
      email: 'admin@timetrack.kz',
      fullName: 'Данияр Сейткали',
      role: 'COMPANY_ADMIN',
      companyId: 'comp_001',
      avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=DS&backgroundColor=4f46e5&fontColor=ffffff',
    },
  },
  'hr@timetrack.kz': {
    password: 'password',
    user: {
      id: 'user_002',
      email: 'hr@timetrack.kz',
      fullName: 'Асель Нурланова',
      role: 'HR',
      companyId: 'comp_001',
      avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=AN&backgroundColor=0891b2&fontColor=ffffff',
    },
  },
  'manager@timetrack.kz': {
    password: 'password',
    user: {
      id: 'user_003',
      email: 'manager@timetrack.kz',
      fullName: 'Ержан Бекенов',
      role: 'MANAGER',
      companyId: 'comp_001',
      avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=EB&backgroundColor=0d9488&fontColor=ffffff',
    },
  },
};

// ──────────────────────────────────────
// Employees (25 employees)
// ──────────────────────────────────────

export const MOCK_EMPLOYEES: Employee[] = [
  { id: 'emp_001', companyId: 'comp_001', fullName: 'Данияр Сейткали', email: 'admin@timetrack.kz', phone: '+7 701 234 5678', employeeCode: 'EMP-001', departmentId: 'dept_004', departmentName: 'IT и поддержка', position: 'Генеральный директор', workScheduleId: 'sch_001', status: 'active', hiredAt: '2022-03-01', hasFaceTemplate: true, locationIds: ['loc_001', 'loc_003'], avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=DS&backgroundColor=4f46e5&fontColor=ffffff' },
  { id: 'emp_002', companyId: 'comp_001', fullName: 'Асель Нурланова', email: 'hr@timetrack.kz', phone: '+7 702 345 6789', employeeCode: 'EMP-002', departmentId: 'dept_003', departmentName: 'Бухгалтерия и финансы', position: 'HR-менеджер', workScheduleId: 'sch_001', status: 'active', hiredAt: '2022-06-15', hasFaceTemplate: true, locationIds: ['loc_001'], avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=AN&backgroundColor=0891b2&fontColor=ffffff' },
  { id: 'emp_003', companyId: 'comp_001', fullName: 'Ержан Бекенов', email: 'manager@timetrack.kz', phone: '+7 705 456 7890', employeeCode: 'EMP-003', departmentId: 'dept_001', departmentName: 'Склад и логистика', position: 'Начальник склада', managerId: 'emp_001', workScheduleId: 'sch_002', status: 'active', hiredAt: '2021-09-10', hasFaceTemplate: true, locationIds: ['loc_002'], avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=EB&backgroundColor=0d9488&fontColor=ffffff' },
  { id: 'emp_004', companyId: 'comp_001', fullName: 'Айдос Мусаев', email: 'a.musaev@altyn.kz', phone: '+7 700 567 8901', employeeCode: 'EMP-004', departmentId: 'dept_001', departmentName: 'Склад и логистика', position: 'Кладовщик', managerId: 'emp_003', workScheduleId: 'sch_002', status: 'active', hiredAt: '2023-02-14', hasFaceTemplate: false, locationIds: ['loc_002'], avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=AM&backgroundColor=6366f1&fontColor=ffffff' },
  { id: 'emp_005', companyId: 'comp_001', fullName: 'Мадина Касенова', email: 'm.kasenova@altyn.kz', phone: '+7 707 678 9012', employeeCode: 'EMP-005', departmentId: 'dept_002', departmentName: 'Отдел продаж', position: 'Менеджер по продажам', managerId: 'emp_007', workScheduleId: 'sch_001', status: 'active', hiredAt: '2023-05-20', hasFaceTemplate: true, locationIds: ['loc_001'], avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=MK&backgroundColor=ec4899&fontColor=ffffff' },
  { id: 'emp_006', companyId: 'comp_001', fullName: 'Нурасыл Ахметов', email: 'n.akhmetov@altyn.kz', phone: '+7 701 789 0123', employeeCode: 'EMP-006', departmentId: 'dept_004', departmentName: 'IT и поддержка', position: 'Разработчик', managerId: 'emp_016', workScheduleId: 'sch_001', status: 'active', hiredAt: '2024-01-08', hasFaceTemplate: true, locationIds: ['loc_001', 'loc_003'], avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=NA&backgroundColor=8b5cf6&fontColor=ffffff' },
  { id: 'emp_007', companyId: 'comp_001', fullName: 'Алия Джаксыбекова', email: 'a.dzhaksybekova@altyn.kz', phone: '+7 702 890 1234', employeeCode: 'EMP-007', departmentId: 'dept_002', departmentName: 'Отдел продаж', position: 'Руководитель отдела продаж', managerId: 'emp_001', workScheduleId: 'sch_001', status: 'active', hiredAt: '2022-11-01', hasFaceTemplate: true, locationIds: ['loc_001', 'loc_003'], avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=AD&backgroundColor=f59e0b&fontColor=ffffff' },
  { id: 'emp_008', companyId: 'comp_001', fullName: 'Бауыржан Темиров', email: 'b.temirov@altyn.kz', phone: '+7 705 901 2345', employeeCode: 'EMP-008', departmentId: 'dept_001', departmentName: 'Склад и логистика', position: 'Водитель-экспедитор', managerId: 'emp_003', workScheduleId: 'sch_002', status: 'active', hiredAt: '2023-07-17', hasFaceTemplate: false, locationIds: ['loc_002'], avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=BT&backgroundColor=14b8a6&fontColor=ffffff' },
  { id: 'emp_009', companyId: 'comp_001', fullName: 'Гульнара Оразова', email: 'g.orazova@altyn.kz', phone: '+7 700 012 3456', employeeCode: 'EMP-009', departmentId: 'dept_003', departmentName: 'Бухгалтерия и финансы', position: 'Бухгалтер', managerId: 'emp_012', workScheduleId: 'sch_001', status: 'active', hiredAt: '2022-08-22', hasFaceTemplate: true, locationIds: ['loc_001'], avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=GO&backgroundColor=f97316&fontColor=ffffff' },
  { id: 'emp_010', companyId: 'comp_001', fullName: 'Дамир Сарсенов', email: 'd.sarsenov@altyn.kz', phone: '+7 707 123 4567', employeeCode: 'EMP-010', departmentId: 'dept_002', departmentName: 'Отдел продаж', position: 'Менеджер по продажам', managerId: 'emp_007', workScheduleId: 'sch_001', status: 'active', hiredAt: '2024-03-11', hasFaceTemplate: true, locationIds: ['loc_001'], avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=DS2&backgroundColor=3b82f6&fontColor=ffffff' },
  { id: 'emp_011', companyId: 'comp_001', fullName: 'Жанар Абдуллаева', email: 'zh.abdullaeva@altyn.kz', phone: '+7 701 234 5670', employeeCode: 'EMP-011', departmentId: 'dept_001', departmentName: 'Склад и логистика', position: 'Оператор склада', managerId: 'emp_003', workScheduleId: 'sch_003', status: 'active', hiredAt: '2023-10-05', hasFaceTemplate: false, locationIds: ['loc_002'], avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=ZHA&backgroundColor=a855f7&fontColor=ffffff' },
  { id: 'emp_012', companyId: 'comp_001', fullName: 'Зарина Байжанова', email: 'z.bayzhanova@altyn.kz', phone: '+7 702 345 6780', employeeCode: 'EMP-012', departmentId: 'dept_003', departmentName: 'Бухгалтерия и финансы', position: 'Главный бухгалтер', managerId: 'emp_001', workScheduleId: 'sch_001', status: 'active', hiredAt: '2022-01-10', hasFaceTemplate: true, locationIds: ['loc_001'], avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=ZB&backgroundColor=ec4899&fontColor=ffffff' },
  { id: 'emp_013', companyId: 'comp_001', fullName: 'Ибрагим Хасанов', email: 'i.khasanov@altyn.kz', phone: '+7 705 456 7891', employeeCode: 'EMP-013', departmentId: 'dept_002', departmentName: 'Отдел продаж', position: 'Торговый представитель', managerId: 'emp_007', workScheduleId: 'sch_001', status: 'active', hiredAt: '2024-06-01', hasFaceTemplate: false, locationIds: ['loc_001', 'loc_003'], avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=IH&backgroundColor=0ea5e9&fontColor=ffffff' },
  { id: 'emp_014', companyId: 'comp_001', fullName: 'Камила Юсупова', email: 'k.yusupova@altyn.kz', phone: '+7 700 567 8902', employeeCode: 'EMP-014', departmentId: 'dept_001', departmentName: 'Склад и логистика', position: 'Комплектовщик', managerId: 'emp_003', workScheduleId: 'sch_002', status: 'active', hiredAt: '2023-12-18', hasFaceTemplate: false, locationIds: ['loc_002'], avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=KY&backgroundColor=10b981&fontColor=ffffff' },
  { id: 'emp_015', companyId: 'comp_001', fullName: 'Лаура Ибраева', email: 'l.ibraeva@altyn.kz', phone: '+7 707 678 9013', employeeCode: 'EMP-015', departmentId: 'dept_003', departmentName: 'Бухгалтерия и финансы', position: 'Финансовый аналитик', managerId: 'emp_012', workScheduleId: 'sch_001', status: 'active', hiredAt: '2023-04-03', hasFaceTemplate: true, locationIds: ['loc_001'], avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=LI&backgroundColor=f43f5e&fontColor=ffffff' },
  { id: 'emp_016', companyId: 'comp_001', fullName: 'Максат Кожахметов', email: 'm.kozhakhmetov@altyn.kz', phone: '+7 701 789 0124', employeeCode: 'EMP-016', departmentId: 'dept_004', departmentName: 'IT и поддержка', position: 'IT-руководитель', managerId: 'emp_001', workScheduleId: 'sch_001', status: 'active', hiredAt: '2022-04-25', hasFaceTemplate: true, locationIds: ['loc_001', 'loc_003'], avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=MKo&backgroundColor=6366f1&fontColor=ffffff' },
  { id: 'emp_017', companyId: 'comp_001', fullName: 'Нурия Абенова', email: 'n.abenova@altyn.kz', phone: '+7 702 890 1235', employeeCode: 'EMP-017', departmentId: 'dept_002', departmentName: 'Отдел продаж', position: 'Менеджер по работе с клиентами', managerId: 'emp_007', workScheduleId: 'sch_001', status: 'on_leave', hiredAt: '2023-08-14', hasFaceTemplate: true, locationIds: ['loc_001'], avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=NAb&backgroundColor=4f46e5&fontColor=ffffff' },
  { id: 'emp_018', companyId: 'comp_001', fullName: 'Олжас Сейтказиев', email: 'o.seitkaziev@altyn.kz', phone: '+7 705 901 2346', employeeCode: 'EMP-018', departmentId: 'dept_001', departmentName: 'Склад и логистика', position: 'Грузчик', managerId: 'emp_003', workScheduleId: 'sch_002', status: 'active', hiredAt: '2024-02-29', hasFaceTemplate: false, locationIds: ['loc_002'], avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=OS&backgroundColor=0891b2&fontColor=ffffff' },
  { id: 'emp_019', companyId: 'comp_001', fullName: 'Перизат Досанова', email: 'p.dosanova@altyn.kz', phone: '+7 700 012 3457', employeeCode: 'EMP-019', departmentId: 'dept_004', departmentName: 'IT и поддержка', position: 'Системный администратор', managerId: 'emp_016', workScheduleId: 'sch_001', status: 'active', hiredAt: '2023-11-07', hasFaceTemplate: true, locationIds: ['loc_001', 'loc_003'], avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=PD&backgroundColor=8b5cf6&fontColor=ffffff' },
  { id: 'emp_020', companyId: 'comp_001', fullName: 'Рустам Турсунов', email: 'r.tursunov@altyn.kz', phone: '+7 707 123 4568', employeeCode: 'EMP-020', departmentId: 'dept_003', departmentName: 'Бухгалтерия и финансы', position: 'Экономист', managerId: 'emp_012', workScheduleId: 'sch_001', status: 'active', hiredAt: '2022-07-19', hasFaceTemplate: true, locationIds: ['loc_001'], avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=RT&backgroundColor=14b8a6&fontColor=ffffff' },
  { id: 'emp_021', companyId: 'comp_001', fullName: 'Сандугаш Жумабаева', email: 's.zhumabaeva@altyn.kz', phone: '+7 701 234 5671', employeeCode: 'EMP-021', departmentId: 'dept_001', departmentName: 'Склад и логистика', position: 'Оператор склада', managerId: 'emp_003', workScheduleId: 'sch_003', status: 'active', hiredAt: '2024-04-01', hasFaceTemplate: false, locationIds: ['loc_002'], avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=SZh&backgroundColor=f59e0b&fontColor=ffffff' },
  { id: 'emp_022', companyId: 'comp_001', fullName: 'Тимур Жаксылыков', email: 't.zhaksylykov@altyn.kz', phone: '+7 702 345 6781', employeeCode: 'EMP-022', departmentId: 'dept_002', departmentName: 'Отдел продаж', position: 'Региональный менеджер', managerId: 'emp_007', workScheduleId: 'sch_001', status: 'active', hiredAt: '2023-01-23', hasFaceTemplate: true, locationIds: ['loc_003'], avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=TZh&backgroundColor=3b82f6&fontColor=ffffff' },
  { id: 'emp_023', companyId: 'comp_001', fullName: 'Ұлбосын Ермекова', email: 'u.ermeкova@altyn.kz', phone: '+7 705 456 7892', employeeCode: 'EMP-023', departmentId: 'dept_003', departmentName: 'Бухгалтерия и финансы', position: 'Кассир', managerId: 'emp_012', workScheduleId: 'sch_001', status: 'inactive', hiredAt: '2022-10-11', hasFaceTemplate: false, locationIds: ['loc_001'], avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=UE&backgroundColor=a855f7&fontColor=ffffff' },
  { id: 'emp_024', companyId: 'comp_001', fullName: 'Фарида Атабекова', email: 'f.atabekova@altyn.kz', phone: '+7 700 567 8903', employeeCode: 'EMP-024', departmentId: 'dept_004', departmentName: 'IT и поддержка', position: 'Технический специалист', managerId: 'emp_016', workScheduleId: 'sch_001', status: 'active', hiredAt: '2024-05-13', hasFaceTemplate: true, locationIds: ['loc_001', 'loc_003'], avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=FA&backgroundColor=ec4899&fontColor=ffffff' },
  { id: 'emp_025', companyId: 'comp_001', fullName: 'Хасен Нурмагамбетов', email: 'kh.nurmagambetov@altyn.kz', phone: '+7 707 678 9014', employeeCode: 'EMP-025', departmentId: 'dept_001', departmentName: 'Склад и логистика', position: 'Водитель', managerId: 'emp_003', workScheduleId: 'sch_002', status: 'active', hiredAt: '2023-09-25', hasFaceTemplate: false, locationIds: ['loc_002'], avatarUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=KhN&backgroundColor=0d9488&fontColor=ffffff' },
];

// ──────────────────────────────────────
// Attendance Records (generator helper)
// ──────────────────────────────────────

function makeTime(base: Date, h: number, m: number): string {
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

let attId = 1;

function genAttRecord(
  employeeId: string,
  daysAgo: number,
  checkInH: number,
  checkInM: number,
  checkOutH: number,
  checkOutM: number,
  locationId: string,
  isLate: boolean,
): AttendanceRecord[] {
  const emp = MOCK_EMPLOYEES.find(e => e.id === employeeId)!;
  const day = subDays(TODAY, daysAgo);
  const inId = `att_${String(attId++).padStart(4, '0')}`;
  const outId = `att_${String(attId++).padStart(4, '0')}`;
  const loc = MOCK_LOCATIONS.find(l => l.id === locationId)!;
  const dist = Math.floor(Math.random() * 80) + 5;
  const lateMin = isLate ? checkInM - (checkInH === 9 ? 10 : 7) : 0;

  const checkIn: AttendanceRecord = {
    id: inId, companyId: 'comp_001',
    employeeId, employeeName: emp.fullName, employeeCode: emp.employeeCode,
    departmentName: emp.departmentName,
    type: 'CHECK_IN',
    markedAt: makeTime(day, checkInH, checkInM),
    serverAt: makeTime(day, checkInH, checkInM + 1),
    locationId, locationName: loc.name,
    lat: loc.lat + (Math.random() - 0.5) * 0.001,
    lng: loc.lng + (Math.random() - 0.5) * 0.001,
    accuracyMeters: Math.floor(Math.random() * 15) + 3,
    status: isLate ? 'LATE' : 'OK',
    source: 'MOBILE',
    deviceInfo: { platform: Math.random() > 0.5 ? 'android' : 'ios', model: 'Samsung Galaxy A52', appVersion: '0.1.0', isMockLocation: false },
    isOfflineSynced: false,
    isLate,
    lateMinutes: lateMin > 0 ? lateMin : 0,
    geofence: { passed: true, distanceMeters: dist, radiusMeters: loc.radiusMeters },
  };

  const checkOut: AttendanceRecord = {
    id: outId, companyId: 'comp_001',
    employeeId, employeeName: emp.fullName, employeeCode: emp.employeeCode,
    departmentName: emp.departmentName,
    type: 'CHECK_OUT',
    markedAt: makeTime(day, checkOutH, checkOutM),
    serverAt: makeTime(day, checkOutH, checkOutM + 1),
    locationId, locationName: loc.name,
    lat: loc.lat + (Math.random() - 0.5) * 0.001,
    lng: loc.lng + (Math.random() - 0.5) * 0.001,
    accuracyMeters: Math.floor(Math.random() * 15) + 3,
    status: 'OK',
    source: 'MOBILE',
    deviceInfo: { platform: Math.random() > 0.5 ? 'android' : 'ios', model: 'Samsung Galaxy A52', appVersion: '0.1.0', isMockLocation: false },
    isOfflineSynced: false,
    isLate: false,
    lateMinutes: 0,
    geofence: { passed: true, distanceMeters: Math.floor(Math.random() * 80) + 5, radiusMeters: loc.radiusMeters },
  };

  return [checkIn, checkOut];
}

export const MOCK_ATTENDANCE: AttendanceRecord[] = [];

// Generate 14 days of attendance for active employees
const activeEmps = MOCK_EMPLOYEES.filter(e => e.status === 'active');

for (let day = 1; day <= 14; day++) {
  const dayOfWeek = subDays(TODAY, day).getDay(); // 0=Sun, 6=Sat
  if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

  for (const emp of activeEmps) {
    const sch = MOCK_SCHEDULES.find(s => s.id === emp.workScheduleId)!;
    const locId = emp.locationIds[0];
    const [startH, startM] = sch.startTime.split(':').map(Number);
    const [endH, endM] = sch.endTime.split(':').map(Number);
    const isLate = Math.random() < 0.18; // 18% chance late
    const skip = Math.random() < 0.05;   // 5% chance absent
    if (skip) continue;

    const delayM = isLate ? Math.floor(Math.random() * 25) + 12 : Math.floor(Math.random() * 8);
    const earlyOut = Math.random() < 0.1;
    const outDelayM = earlyOut ? -(Math.floor(Math.random() * 30) + 5) : Math.floor(Math.random() * 45);

    const records = genAttRecord(
      emp.id, day,
      startH, startM + delayM,
      endH, endM + outDelayM,
      locId,
      isLate,
    );
    MOCK_ATTENDANCE.push(...records);
  }
}

// Also generate today's check-ins for some employees
const todayEmps = activeEmps.slice(0, 18);
for (const emp of todayEmps) {
  const sch = MOCK_SCHEDULES.find(s => s.id === emp.workScheduleId)!;
  const locId = emp.locationIds[0];
  const [startH, startM] = sch.startTime.split(':').map(Number);
  const isLate = Math.random() < 0.15;
  const delayM = isLate ? Math.floor(Math.random() * 20) + 12 : Math.floor(Math.random() * 5);

  const inId = `att_${String(attId++).padStart(4, '0')}`;
  const loc = MOCK_LOCATIONS.find(l => l.id === locId)!;
  const todayRecord: AttendanceRecord = {
    id: inId, companyId: 'comp_001',
    employeeId: emp.id, employeeName: emp.fullName,
    employeeCode: emp.employeeCode, departmentName: emp.departmentName,
    type: 'CHECK_IN',
    markedAt: makeTime(TODAY, startH, startM + delayM),
    serverAt: makeTime(TODAY, startH, startM + delayM + 1),
    locationId: locId, locationName: loc.name,
    lat: loc.lat + (Math.random() - 0.5) * 0.001,
    lng: loc.lng + (Math.random() - 0.5) * 0.001,
    accuracyMeters: 8,
    status: isLate ? 'LATE' : 'OK',
    source: 'MOBILE',
    deviceInfo: { platform: 'android', model: 'Samsung Galaxy A52', appVersion: '0.1.0', isMockLocation: false },
    isOfflineSynced: false,
    isLate,
    lateMinutes: isLate ? delayM - 10 : 0,
    geofence: { passed: true, distanceMeters: 35, radiusMeters: loc.radiusMeters },
  };
  MOCK_ATTENDANCE.push(todayRecord);
}

// Sort by most recent first
MOCK_ATTENDANCE.sort((a, b) => new Date(b.markedAt).getTime() - new Date(a.markedAt).getTime());

// ──────────────────────────────────────
// Leave Requests
// ──────────────────────────────────────

export const MOCK_LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: 'leave_001',
    companyId: 'comp_001',
    employeeId: 'emp_017',
    employeeName: 'Нурия Абенова',
    departmentName: 'Отдел продаж',
    type: 'VACATION',
    status: 'APPROVED',
    startDate: format(subDays(TODAY, 5), 'yyyy-MM-dd'),
    endDate: format(subDays(TODAY, -9), 'yyyy-MM-dd'),
    daysCount: 14,
    reason: 'Ежегодный оплачиваемый отпуск',
    approvedById: 'emp_002',
    approvedByName: 'Асель Нурланова',
    approvedAt: format(subDays(TODAY, 10), "yyyy-MM-dd'T'HH:mm:ssxxx"),
    createdAt: format(subDays(TODAY, 12), "yyyy-MM-dd'T'HH:mm:ssxxx"),
  },
  {
    id: 'leave_002',
    companyId: 'comp_001',
    employeeId: 'emp_008',
    employeeName: 'Бауыржан Темиров',
    departmentName: 'Склад и логистика',
    type: 'SICK',
    status: 'APPROVED',
    startDate: format(subDays(TODAY, 3), 'yyyy-MM-dd'),
    endDate: format(subDays(TODAY, -1), 'yyyy-MM-dd'),
    daysCount: 4,
    reason: 'Больничный лист №2026-4521',
    approvedById: 'emp_002',
    approvedByName: 'Асель Нурланова',
    approvedAt: format(subDays(TODAY, 3), "yyyy-MM-dd'T'HH:mm:ssxxx"),
    createdAt: format(subDays(TODAY, 3), "yyyy-MM-dd'T'HH:mm:ssxxx"),
  },
  {
    id: 'leave_003',
    companyId: 'comp_001',
    employeeId: 'emp_022',
    employeeName: 'Тимур Жаксылыков',
    departmentName: 'Отдел продаж',
    type: 'BUSINESS_TRIP',
    status: 'PENDING',
    startDate: format(subDays(TODAY, -2), 'yyyy-MM-dd'),
    endDate: format(subDays(TODAY, -5), 'yyyy-MM-dd'),
    daysCount: 3,
    reason: 'Командировка в Астану для встречи с партнёрами',
    createdAt: format(subDays(TODAY, 1), "yyyy-MM-dd'T'HH:mm:ssxxx"),
  },
  {
    id: 'leave_004',
    companyId: 'comp_001',
    employeeId: 'emp_010',
    employeeName: 'Дамир Сарсенов',
    departmentName: 'Отдел продаж',
    type: 'DAY_OFF',
    status: 'PENDING',
    startDate: format(subDays(TODAY, -3), 'yyyy-MM-dd'),
    endDate: format(subDays(TODAY, -3), 'yyyy-MM-dd'),
    daysCount: 1,
    reason: 'Личные обстоятельства',
    createdAt: format(subDays(TODAY, 0), "yyyy-MM-dd'T'HH:mm:ssxxx"),
  },
  {
    id: 'leave_005',
    companyId: 'comp_001',
    employeeId: 'emp_014',
    employeeName: 'Камила Юсупова',
    departmentName: 'Склад и логистика',
    type: 'SICK',
    status: 'REJECTED',
    startDate: format(subDays(TODAY, 14), 'yyyy-MM-dd'),
    endDate: format(subDays(TODAY, 12), 'yyyy-MM-dd'),
    daysCount: 2,
    reason: 'Плохое самочувствие',
    approvedById: 'emp_002',
    approvedByName: 'Асель Нурланова',
    approvedAt: format(subDays(TODAY, 14), "yyyy-MM-dd'T'HH:mm:ssxxx"),
    rejectionReason: 'Требуется больничный лист от врача',
    createdAt: format(subDays(TODAY, 14), "yyyy-MM-dd'T'HH:mm:ssxxx"),
  },
];

// ──────────────────────────────────────
// Dashboard Stats
// ──────────────────────────────────────

export const MOCK_DASHBOARD_STATS: DashboardStats = {
  totalEmployees: 25,
  checkedInToday: 18,
  currentlyWorking: 15,
  lateTodayCount: 3,
  pendingApprovals: 2,
  activeLocations: 3,
  attendanceRate7d: 91,
};

// ──────────────────────────────────────
// Chart data
// ──────────────────────────────────────

export const MOCK_ATTENDANCE_CHART: AttendanceChartPoint[] = Array.from({ length: 7 }, (_, i) => {
  const d = subDays(TODAY, 6 - i);
  const dow = d.getDay();
  const isWeekend = dow === 0 || dow === 6;
  return {
    date: format(d, 'dd.MM'),
    checkedIn: isWeekend ? 0 : Math.floor(Math.random() * 4) + 17,
    checkedOut: isWeekend ? 0 : Math.floor(Math.random() * 4) + 14,
    late: isWeekend ? 0 : Math.floor(Math.random() * 4) + 1,
    absent: isWeekend ? 22 : Math.floor(Math.random() * 3) + 2,
  };
});

export const MOCK_DEPT_LATE_STATS: DepartmentLateStats[] = [
  { department: 'Склад и логистика', lateCount: 8, totalEmployees: 9 },
  { department: 'Отдел продаж', lateCount: 4, totalEmployees: 6 },
  { department: 'Бухгалтерия', lateCount: 1, totalEmployees: 5 },
  { department: 'IT и поддержка', lateCount: 2, totalEmployees: 5 },
];

// ──────────────────────────────────────
// Integrations
// ──────────────────────────────────────

export const MOCK_INTEGRATIONS: Integration[] = [
  {
    id: 'int_001',
    key: '1c',
    label: '1С:Бухгалтерия',
    description: 'Выгрузка табеля в формате 1С для расчёта зарплаты.',
    category: 'accounting',
    icon: '1С',
    status: 'not_connected',
  },
  {
    id: 'int_002',
    key: 'bitrix24',
    label: 'Bitrix24',
    description: 'Синхронизация сотрудников и уведомления в Bitrix24.',
    category: 'crm',
    icon: 'B24',
    status: 'connected',
    connectedAt: format(subDays(TODAY, 40), 'yyyy-MM-dd'),
  },
  {
    id: 'int_003',
    key: 'hikvision',
    label: 'Hikvision',
    description: 'Турникеты и IP-камеры контроля доступа Hikvision.',
    category: 'access_control',
    icon: 'HIK',
    status: 'in_progress',
  },
  {
    id: 'int_004',
    key: 'zkteco',
    label: 'ZKTeco',
    description: 'Биометрические терминалы и контроллеры ZKTeco.',
    category: 'access_control',
    icon: 'ZK',
    status: 'not_connected',
  },
  {
    id: 'int_005',
    key: 'telegram_bot',
    label: 'Telegram Bot',
    description: 'Уведомления о приходах, опозданиях и заявках в Telegram.',
    category: 'messaging',
    icon: 'TG',
    status: 'connected',
    connectedAt: format(subDays(TODAY, 12), 'yyyy-MM-dd'),
  },
  {
    id: 'int_006',
    key: 'webhooks',
    label: 'Webhooks / Open API',
    description: 'Подписка на события в реальном времени через вебхуки и открытое API.',
    category: 'developer',
    icon: 'API',
    status: 'not_connected',
  },
  {
    id: 'int_007',
    key: 'freedompay_kaspi',
    label: 'Freedom Pay / Kaspi Pay',
    description: 'Оплата подписки Timetrack.kz через Freedom Pay или Kaspi Pay.',
    category: 'payments',
    icon: 'KZ',
    status: 'not_connected',
  },
];
