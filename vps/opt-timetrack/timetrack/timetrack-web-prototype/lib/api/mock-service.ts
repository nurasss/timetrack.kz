/**
 * Timetrack.kz — Mock API Service
 * Drop-in replacement layer: swap `mockApi` calls for real Axios/fetch calls
 * when backend is ready. All functions match the OpenAPI contract signatures.
 */

import { sleep, paginate } from '../utils';
import {
  MOCK_AUTH_USERS, MOCK_COMPANY, MOCK_EMPLOYEES, MOCK_DEPARTMENTS,
  MOCK_LOCATIONS, MOCK_SCHEDULES, MOCK_ATTENDANCE, MOCK_LEAVE_REQUESTS,
  MOCK_DASHBOARD_STATS, MOCK_ATTENDANCE_CHART, MOCK_DEPT_LATE_STATS,
  MOCK_INTEGRATIONS,
} from '../mock/data';
import type {
  AuthResponse, Company, Employee, CreateEmployeeDto, UpdateEmployeeDto,
  Location, CreateLocationDto, UpdateLocationDto, WorkSchedule,
  CreateScheduleDto, UpdateScheduleDto, AttendanceRecord, AttendanceFilters,
  LeaveRequest, CreateLeaveRequestDto, LeaveRequestFilters, EmployeeFilters,
  DashboardStats, AttendanceChartPoint, DepartmentLateStats, PaginatedResponse,
  Integration, IntegrationStatus,
} from '../types';

const DELAY = 400; // Simulate network latency

// ──────────────────────────────────────
// Auth
// ──────────────────────────────────────

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  await sleep(DELAY);
  const entry = MOCK_AUTH_USERS[email.toLowerCase()];
  if (!entry || entry.password !== password) {
    throw new Error('Неверный email или пароль');
  }
  return {
    user: entry.user,
    tokens: {
      accessToken: `mock_token_${Date.now()}`,
      refreshToken: `mock_refresh_${Date.now()}`,
      expiresIn: 3600,
    },
  };
}

export async function apiGetMe() {
  await sleep(200);
  return null; // Caller should read from Zustand store
}

// ──────────────────────────────────────
// Company
// ──────────────────────────────────────

export async function apiGetCompany(): Promise<Company> {
  await sleep(DELAY);
  return MOCK_COMPANY;
}

// ──────────────────────────────────────
// Employees
// ──────────────────────────────────────

let employees = [...MOCK_EMPLOYEES];

export async function apiGetEmployees(filters?: EmployeeFilters): Promise<PaginatedResponse<Employee>> {
  await sleep(DELAY);
  let result = [...employees];

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(e =>
      e.fullName.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.employeeCode.toLowerCase().includes(q) ||
      e.position.toLowerCase().includes(q)
    );
  }
  if (filters?.departmentId) {
    result = result.filter(e => e.departmentId === filters.departmentId);
  }
  if (filters?.status) {
    result = result.filter(e => e.status === filters.status);
  }

  return paginate(result, filters?.page ?? 1, filters?.pageSize ?? 20);
}

export async function apiGetEmployee(id: string): Promise<Employee> {
  await sleep(DELAY);
  const emp = employees.find(e => e.id === id);
  if (!emp) throw new Error('Сотрудник не найден');
  return emp;
}

export async function apiCreateEmployee(dto: CreateEmployeeDto): Promise<Employee> {
  await sleep(DELAY);
  const dept = MOCK_DEPARTMENTS.find(d => d.id === dto.departmentId);
  const newEmp: Employee = {
    id: `emp_${String(employees.length + 1).padStart(3, '0')}`,
    companyId: 'comp_001',
    departmentName: dept?.name ?? '',
    status: 'active',
    hasFaceTemplate: false,
    avatarUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${dto.fullName.slice(0, 2)}&backgroundColor=6366f1&fontColor=ffffff`,
    ...dto,
  };
  employees = [newEmp, ...employees];
  return newEmp;
}

export async function apiUpdateEmployee(id: string, dto: UpdateEmployeeDto): Promise<Employee> {
  await sleep(DELAY);
  const idx = employees.findIndex(e => e.id === id);
  if (idx === -1) throw new Error('Сотрудник не найден');
  const updated = { ...employees[idx], ...dto };
  if (dto.departmentId) {
    const dept = MOCK_DEPARTMENTS.find(d => d.id === dto.departmentId);
    updated.departmentName = dept?.name ?? updated.departmentName;
  }
  employees = employees.map(e => e.id === id ? updated : e);
  return updated;
}

export async function apiDeleteEmployee(id: string): Promise<void> {
  await sleep(DELAY);
  employees = employees.map(e => e.id === id ? { ...e, status: 'inactive' } : e);
}

// ──────────────────────────────────────
// Locations
// ──────────────────────────────────────

let locations = [...MOCK_LOCATIONS];

export async function apiGetLocations(): Promise<Location[]> {
  await sleep(DELAY);
  return locations;
}

export async function apiCreateLocation(dto: CreateLocationDto): Promise<Location> {
  await sleep(DELAY);
  const newLoc: Location = {
    id: `loc_${String(locations.length + 1).padStart(3, '0')}`,
    companyId: 'comp_001',
    timezone: 'Asia/Almaty',
    ...dto,
  };
  locations = [newLoc, ...locations];
  return newLoc;
}

export async function apiUpdateLocation(id: string, dto: UpdateLocationDto): Promise<Location> {
  await sleep(DELAY);
  const idx = locations.findIndex(l => l.id === id);
  if (idx === -1) throw new Error('Локация не найдена');
  const updated = { ...locations[idx], ...dto };
  locations = locations.map(l => l.id === id ? updated : l);
  return updated;
}

export async function apiDeleteLocation(id: string): Promise<void> {
  await sleep(DELAY);
  locations = locations.filter(l => l.id !== id);
}

// ──────────────────────────────────────
// Schedules
// ──────────────────────────────────────

let schedules = [...MOCK_SCHEDULES];

export async function apiGetSchedules(): Promise<WorkSchedule[]> {
  await sleep(DELAY);
  return schedules;
}

export async function apiCreateSchedule(dto: CreateScheduleDto): Promise<WorkSchedule> {
  await sleep(DELAY);
  const newSch: WorkSchedule = {
    id: `sch_${String(schedules.length + 1).padStart(3, '0')}`,
    companyId: 'comp_001',
    ...dto,
  };
  schedules = [newSch, ...schedules];
  return newSch;
}

export async function apiUpdateSchedule(id: string, dto: UpdateScheduleDto): Promise<WorkSchedule> {
  await sleep(DELAY);
  const idx = schedules.findIndex(s => s.id === id);
  if (idx === -1) throw new Error('График не найден');
  const updated = { ...schedules[idx], ...dto };
  schedules = schedules.map(s => s.id === id ? updated : s);
  return updated;
}

export async function apiDeleteSchedule(id: string): Promise<void> {
  await sleep(DELAY);
  schedules = schedules.filter(s => s.id !== id);
}

// ──────────────────────────────────────
// Attendance
// ──────────────────────────────────────

let attendance = [...MOCK_ATTENDANCE];

export async function apiGetAttendance(filters?: AttendanceFilters): Promise<PaginatedResponse<AttendanceRecord>> {
  await sleep(DELAY);
  let result = [...attendance];

  if (filters?.dateFrom) {
    result = result.filter(a => a.markedAt >= filters.dateFrom!);
  }
  if (filters?.dateTo) {
    result = result.filter(a => a.markedAt <= filters.dateTo! + 'T23:59:59');
  }
  if (filters?.employeeId) {
    result = result.filter(a => a.employeeId === filters.employeeId);
  }
  if (filters?.locationId) {
    result = result.filter(a => a.locationId === filters.locationId);
  }
  if (filters?.status) {
    result = result.filter(a => a.status === filters.status);
  }
  if (filters?.type) {
    result = result.filter(a => a.type === filters.type);
  }

  return paginate(result, filters?.page ?? 1, filters?.pageSize ?? 50);
}

export async function apiGetTodayAttendance(): Promise<AttendanceRecord[]> {
  await sleep(DELAY);
  const today = new Date().toISOString().slice(0, 10);
  return attendance.filter(a => a.markedAt.startsWith(today));
}

// ──────────────────────────────────────
// Leave Requests
// ──────────────────────────────────────

let leaveRequests = [...MOCK_LEAVE_REQUESTS];

export async function apiGetLeaveRequests(filters?: LeaveRequestFilters): Promise<PaginatedResponse<LeaveRequest>> {
  await sleep(DELAY);
  let result = [...leaveRequests];
  if (filters?.status) result = result.filter(l => l.status === filters.status);
  if (filters?.type) result = result.filter(l => l.type === filters.type);
  if (filters?.employeeId) result = result.filter(l => l.employeeId === filters.employeeId);
  return paginate(result, filters?.page ?? 1, filters?.pageSize ?? 20);
}

export async function apiCreateLeaveRequest(dto: CreateLeaveRequestDto): Promise<LeaveRequest> {
  await sleep(DELAY);
  const emp = employees.find(e => e.id === dto.employeeId);
  const start = new Date(dto.startDate);
  const end = new Date(dto.endDate);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const newReq: LeaveRequest = {
    id: `leave_${String(leaveRequests.length + 1).padStart(3, '0')}`,
    companyId: 'comp_001',
    employeeName: emp?.fullName ?? 'Unknown',
    departmentName: emp?.departmentName ?? '',
    status: 'PENDING',
    daysCount: days,
    createdAt: new Date().toISOString(),
    ...dto,
  };
  leaveRequests = [newReq, ...leaveRequests];
  return newReq;
}

export async function apiApproveLeaveRequest(id: string): Promise<LeaveRequest> {
  await sleep(DELAY);
  const idx = leaveRequests.findIndex(l => l.id === id);
  if (idx === -1) throw new Error('Заявка не найдена');
  const updated = {
    ...leaveRequests[idx],
    status: 'APPROVED' as const,
    approvedAt: new Date().toISOString(),
  };
  leaveRequests = leaveRequests.map(l => l.id === id ? updated : l);
  return updated;
}

export async function apiRejectLeaveRequest(id: string, reason: string): Promise<LeaveRequest> {
  await sleep(DELAY);
  const idx = leaveRequests.findIndex(l => l.id === id);
  if (idx === -1) throw new Error('Заявка не найдена');
  const updated = {
    ...leaveRequests[idx],
    status: 'REJECTED' as const,
    rejectionReason: reason,
    approvedAt: new Date().toISOString(),
  };
  leaveRequests = leaveRequests.map(l => l.id === id ? updated : l);
  return updated;
}

// ──────────────────────────────────────
// Dashboard
// ──────────────────────────────────────

export async function apiGetDashboardStats(): Promise<DashboardStats> {
  await sleep(DELAY);
  return MOCK_DASHBOARD_STATS;
}

export async function apiGetAttendanceChart(): Promise<AttendanceChartPoint[]> {
  await sleep(DELAY);
  return MOCK_ATTENDANCE_CHART;
}

export async function apiGetDeptLateStats(): Promise<DepartmentLateStats[]> {
  await sleep(DELAY);
  return MOCK_DEPT_LATE_STATS;
}

// ──────────────────────────────────────
// Integrations
// ──────────────────────────────────────

let integrations = [...MOCK_INTEGRATIONS];

export async function apiGetIntegrations(): Promise<Integration[]> {
  await sleep(DELAY);
  return integrations;
}

export async function apiSetIntegrationStatus(id: string, status: IntegrationStatus): Promise<Integration> {
  await sleep(DELAY);
  const idx = integrations.findIndex(i => i.id === id);
  if (idx === -1) throw new Error('Интеграция не найдена');
  const updated: Integration = {
    ...integrations[idx],
    status,
    connectedAt: status === 'connected' ? new Date().toISOString().slice(0, 10) : integrations[idx].connectedAt,
  };
  integrations = integrations.map(i => i.id === id ? updated : i);
  return updated;
}

// ──────────────────────────────────────
// Misc
// ──────────────────────────────────────

export function apiGetDepartments() {
  return Promise.resolve(MOCK_DEPARTMENTS);
}
