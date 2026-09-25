import { departments, employees, locations, requests, schedules } from '../../../packages/shared/mock-data';

export const workspace = {
  company: 'Компания',
  bin: '-',
  city: '-',
  owner: 'Администратор',
  plan: 'Starter',
  timezone: 'Asia/Almaty',
  activeEmployees: 0,
  employeeLimit: 10,
  nextPayment: '-',
  monthlyPrice: '-'
};

export const todayRows: {
  employee: string;
  department: string;
  planned: string;
  checkIn: string;
  checkOut: string;
  location: string;
  source: string;
  status: string;
  tone: string;
  face: string;
  gps: string;
}[] = [];

export const attentionItems: { title: string; detail: string; tone: string }[] = [];
export const activityFeed: { time: string; title: string; meta: string }[] = [];
export const departmentHealth: { name: string; present: number; late: number; absent: number }[] = [];
export const devices: { id: string; name: string; type: string; location: string; lastSeen: string; version: string; status: string; battery: string; sync: string }[] = [];
export const biometrics: { employee: string; department: string; status: string; quality: string; consent: string; lastCheck: string; failures: number }[] = [];
export const violations: { id: string; employee: string; type: string; when: string; expected: string; actual: string; signal: string; status: string; source: string }[] = [];
export const supportTickets: { id: string; title: string; status: string; priority: string; updated: string }[] = [];
export const auditEvents: { actor: string; action: string; time: string; area: string }[] = [];

export const onboardingSteps = [
  { title: 'Данные компании', done: false },
  { title: 'Первый филиал', done: false },
  { title: 'Локация на карте', done: false },
  { title: 'График работы', done: false },
  { title: 'Добавление сотрудников', done: false },
  { title: 'Настройка отметок', done: false },
  { title: 'Приглашение команды', done: false },
  { title: 'Подключение планшета', done: false },
  { title: 'Проверка первой отметки', done: false },
  { title: 'Готово', done: false }
];

export const rolePermissions = [
  { role: 'Owner', employees: true, reports: true, billing: true, integrations: true, biometrics: true },
  { role: 'HR', employees: true, reports: true, billing: false, integrations: false, biometrics: true },
  { role: 'Manager', employees: true, reports: true, billing: false, integrations: false, biometrics: false },
  { role: 'Accountant', employees: false, reports: true, billing: false, integrations: false, biometrics: false },
  { role: 'Integrator', employees: false, reports: false, billing: false, integrations: true, biometrics: false }
];

export const organizationTree: { name: string; children: number; employees: number }[] = [];

export const timesheetRows = employees.map((employee) => ({
  employee: employee.full_name,
  department: employee.department ?? 'Без отдела',
  regular: 0,
  overtime: 0,
  late: 0,
  absence: 0,
  status: 'Нет данных'
}));

export const billingHistory: { date: string; amount: string; status: string; document: string }[] = [];

export const quickStats = {
  departments,
  locations,
  schedules,
  requests
};
