/**
 * Timetrack.kz — Real API Service
 * Replaces mock-service.ts. All functions call https://timetrack.kz/api/v1
 */
import { api, tokenStorage } from './client';
import { subDays, format, parseISO, eachDayOfInterval } from 'date-fns';
import type {
  AuthResponse, AuthUser, Company, Employee, CreateEmployeeDto, UpdateEmployeeDto,
  Location, CreateLocationDto, UpdateLocationDto, WorkSchedule, CreateScheduleDto, UpdateScheduleDto,
  AttendanceRecord, AttendanceFilters, LeaveRequest, CreateLeaveRequestDto,
  LeaveRequestFilters, EmployeeFilters, DashboardStats, AttendanceChartPoint,
  DepartmentLateStats, PaginatedResponse, Department,
} from '../types';

// ─── helpers ───────────────────────────────────────────────

function mapEmployee(e: any): Employee {
  return {
    id: e.id,
    companyId: e.companyId,
    fullName: e.fullName,
    email: e.email ?? '',
    phone: e.phone ?? '',
    employeeCode: e.employeeCode ?? '',
    departmentId: e.departmentId ?? '',
    departmentName: e.department?.name ?? e.department ?? '',
    position: e.position?.name ?? e.position ?? '',
    workScheduleId: '',
    status: e.status === 'ACTIVE' ? 'active' : e.status === 'FIRED' ? 'inactive' : 'on_leave',
    hiredAt: '',
    avatarUrl: e.avatarUrl ?? undefined,
    hasFaceTemplate: false,
    locationIds: e.locationIds ?? [],
  };
}

function mapLocation(l: any): Location {
  return {
    id: l.id,
    companyId: l.companyId,
    name: l.name,
    address: l.address,
    lat: l.lat,
    lng: l.lng,
    radiusMeters: l.radiusMeters,
    isActive: l.isActive,
  };
}

function mapMark(m: any): AttendanceRecord {
  const isLate = m.isLate ?? false;
  const isInside = m.isInsideGeofence ?? true;
  const status = !isInside ? 'OUT_OF_GEOFENCE'
    : isLate ? 'LATE'
    : (m.status === 'SUSPICIOUS' || m.status === 'MANUAL') ? 'MANUAL_REVIEW'
    : 'OK';

  return {
    id: m.id,
    companyId: m.companyId,
    employeeId: m.employeeId,
    employeeName: typeof m.employee === 'string' ? m.employee : m.employee?.fullName ?? '',
    employeeCode: m.employee?.employeeCode ?? '',
    departmentName: m.employee?.department?.name ?? '',
    type: m.type,
    markedAt: m.markedAt,
    serverAt: m.serverAt ?? m.markedAt,
    locationId: m.locationId ?? m.location?.id ?? '',
    locationName: typeof m.location === 'string' ? m.location : m.location?.name ?? '',
    lat: m.lat ?? 0,
    lng: m.lng ?? 0,
    accuracyMeters: m.accuracyMeters ?? 0,
    photoUrl: m.photoUrl ?? undefined,
    status: status as any,
    source: m.source ?? 'API',
    isOfflineSynced: false,
    isLate,
    lateMinutes: m.lateMinutes ?? 0,
    geofence: {
      passed: isInside,
      distanceMeters: m.distanceToLocationMeters ?? 0,
      radiusMeters: 0,
    },
  };
}

function mapLeave(l: any): LeaveRequest {
  return {
    id: l.id,
    companyId: l.companyId,
    employeeId: l.employeeId,
    employeeName: typeof l.employee === 'string' ? l.employee : l.employee?.fullName ?? '',
    departmentName: l.employee?.department?.name ?? '',
    type: l.type,
    status: l.status,
    startDate: l.startDate,
    endDate: l.endDate,
    daysCount: 0,
    reason: l.comment ?? '',
    createdAt: l.createdAt ?? '',
  };
}

// ─── Auth ──────────────────────────────────────────────────

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  const res = await api.post('/auth/login', { email, password });
  const d = res.data;
  tokenStorage.set(d.accessToken, d.refreshToken);
  const user: AuthUser = {
    id: d.user.id,
    email: d.user.email,
    fullName: d.user.fullName,
    role: d.user.role,
    companyId: d.user.companyId,
    avatarUrl: d.user.avatarUrl ?? undefined,
  };
  return {
    user,
    tokens: {
      accessToken: d.accessToken,
      refreshToken: d.refreshToken,
      expiresIn: 3600,
    },
  };
}

export async function apiRegisterCompany(data: {
  company_name: string;
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  bin?: string;
}): Promise<{ email: string; message: string; expiresInMinutes: number; emailSent: boolean }> {
  const res = await api.post('/auth/register-company', data);
  return res.data;
}

export async function apiVerifyEmail(email: string, code: string): Promise<AuthResponse> {
  const res = await api.post('/auth/verify-email', { email, code });
  const d = res.data;
  tokenStorage.set(d.accessToken, d.refreshToken);
  return {
    user: { id: d.user.id, email: d.user.email, fullName: d.user.fullName, role: d.user.role, companyId: d.user.companyId },
    tokens: { accessToken: d.accessToken, refreshToken: d.refreshToken, expiresIn: 900 },
  };
}

export async function apiResendVerification(email: string): Promise<void> {
  await api.post('/auth/resend-verification', { email });
}

export async function apiForgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email });
}

export async function apiResetPassword(email: string, code: string, newPassword: string): Promise<void> {
  await api.post('/auth/reset-password', { email, code, password: newPassword });
}

export async function apiGetMe(): Promise<AuthUser> {
  const res = await api.get('/auth/me');
  const d = res.data;
  return {
    id: d.id,
    email: d.email,
    fullName: d.fullName,
    role: d.role,
    companyId: d.companyId,
    avatarUrl: d.avatarUrl ?? undefined,
  };
}

export async function apiLogout(): Promise<void> {
  try { await api.post('/auth/logout'); } catch {}
  tokenStorage.clear();
}

// ─── Company ───────────────────────────────────────────────

export async function apiGetCompany(): Promise<Company> {
  const res = await api.get('/company/me');
  const d = res.data;
  return {
    id: d.id,
    name: d.name,
    bin: d.bin ?? '',
    industry: '',
    employeeCount: 0,
    plan: 'STARTER_10',
    planExpiresAt: d.subscriptionExpiresAt ?? '',
    logoUrl: d.logoUrl ?? undefined,
    timezone: d.timezone ?? 'Asia/Almaty',
    language: 'ru',
    createdAt: '',
  };
}

export async function apiUpdateCompany(data: Partial<{
  name: string; bin: string; timezone: string;
}>): Promise<Company> {
  const res = await api.patch('/company/me', data);
  return apiGetCompany();
}

// ─── Employees ─────────────────────────────────────────────

export async function apiGetEmployees(filters?: EmployeeFilters): Promise<PaginatedResponse<Employee>> {
  const params: Record<string, any> = {
    page: filters?.page ?? 1,
    limit: filters?.pageSize ?? 20,
  };
  if (filters?.search) params.search = filters.search;
  if (filters?.status) params.status = filters.status === 'inactive' ? 'FIRED' : filters.status === 'on_leave' ? 'VACATION' : 'ACTIVE';

  const res = await api.get('/employees', { params });
  const d = res.data;
  const items: Employee[] = (d.items ?? d.data ?? []).map(mapEmployee);
  return {
    data: items,
    total: d.total ?? items.length,
    page: d.page ?? 1,
    pageSize: d.limit ?? 20,
    totalPages: d.pages ?? Math.ceil((d.total ?? items.length) / 20),
  };
}

export async function apiGetEmployee(id: string): Promise<Employee> {
  const res = await api.get(`/employees/${id}`);
  return mapEmployee(res.data);
}

export async function apiCreateEmployee(dto: CreateEmployeeDto): Promise<Employee> {
  if (dto.locationIds?.length) throw new Error('Привязка сотрудника к локациям ещё не поддерживается сервером');
  const res = await api.post('/employees', {
    full_name: dto.fullName,
    email: dto.email,
    phone: dto.phone,
    employee_code: dto.employeeCode,
    department_id: dto.departmentId || undefined,
    position_name: dto.position || undefined,
    manager_id: dto.managerId || undefined,
    hired_at: dto.hiredAt,
  });
  if (dto.workScheduleId) {
    await api.post(`/schedules/${dto.workScheduleId}/assign`, { employee_id: res.data.id, valid_from: dto.hiredAt || format(new Date(), 'yyyy-MM-dd') });
  }
  return mapEmployee(res.data);
}

export async function apiUpdateEmployee(id: string, dto: UpdateEmployeeDto): Promise<Employee> {
  if (dto.locationIds?.length) throw new Error('Привязка сотрудника к локациям ещё не поддерживается сервером');
  const body: Record<string, any> = {};
  if (dto.fullName) body.full_name = dto.fullName;
  if (dto.email) body.email = dto.email;
  if (dto.phone) body.phone = dto.phone;
  if (dto.employeeCode) body.employee_code = dto.employeeCode;
  if (dto.position !== undefined) body.position_name = dto.position;
  if (dto.managerId !== undefined) body.manager_id = dto.managerId || null;
  if (dto.status) body.employment_status = dto.status === 'inactive' ? 'FIRED' : dto.status === 'on_leave' ? 'VACATION' : 'ACTIVE';
  const res = await api.patch(`/employees/${id}`, body);
  if (dto.workScheduleId) {
    await api.post(`/schedules/${dto.workScheduleId}/assign`, { employee_id: id, valid_from: format(new Date(), 'yyyy-MM-dd') });
  }
  return mapEmployee(res.data);
}

export async function apiDeleteEmployee(id: string): Promise<void> {
  await api.delete(`/employees/${id}`);
}

export async function apiUploadAvatar(employeeId: string, file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post(`/employees/${employeeId}/avatar`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data?.avatarUrl ?? res.data?.url ?? '';
}

// ─── Locations ─────────────────────────────────────────────

export async function apiGetLocations(): Promise<Location[]> {
  const res = await api.get('/locations');
  return (res.data ?? []).map(mapLocation);
}

export async function apiCreateLocation(dto: CreateLocationDto): Promise<Location> {
  const res = await api.post('/locations', {
    name: dto.name,
    address: dto.address,
    lat: dto.lat,
    lng: dto.lng,
    radius_meters: dto.radiusMeters,
    is_active: dto.isActive,
  });
  return mapLocation(res.data);
}

export async function apiUpdateLocation(id: string, dto: UpdateLocationDto): Promise<Location> {
  const body: Record<string, any> = {};
  if (dto.name !== undefined) body.name = dto.name;
  if (dto.address !== undefined) body.address = dto.address;
  if (dto.lat !== undefined) body.lat = dto.lat;
  if (dto.lng !== undefined) body.lng = dto.lng;
  if (dto.radiusMeters !== undefined) body.radius_meters = dto.radiusMeters;
  if (dto.isActive !== undefined) body.is_active = dto.isActive;
  const res = await api.patch(`/locations/${id}`, body);
  return mapLocation(res.data);
}

export async function apiDeleteLocation(id: string): Promise<void> {
  await apiUpdateLocation(id, { isActive: false });
}

// ─── Marks / Attendance ────────────────────────────────────

export async function apiGetAttendance(filters?: AttendanceFilters): Promise<PaginatedResponse<AttendanceRecord>> {
  const params: Record<string, any> = {
    page: filters?.page ?? 1,
    limit: filters?.pageSize ?? 50,
  };
  if (filters?.dateFrom) params.date_from = filters.dateFrom;
  if (filters?.dateTo) params.date_to = filters.dateTo;
  if (filters?.employeeId) params.employee_id = filters.employeeId;
  if (filters?.locationId) params.location_id = filters.locationId;
  if (filters?.type) params.type = filters.type;

  const res = await api.get('/marks', { params });
  const d = res.data;
  const items = (Array.isArray(d) ? d : d.items ?? d.data ?? []).map(mapMark);
  return {
    data: items,
    total: d.total ?? items.length,
    page: d.page ?? params.page,
    pageSize: d.limit ?? params.limit,
    totalPages: d.pages ?? (items.length === params.limit ? params.page + 1 : params.page),
  };
}

export async function apiGetTodayAttendance(): Promise<AttendanceRecord[]> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const res = await apiGetAttendance({ dateFrom: today, dateTo: today, pageSize: 100 });
  return res.data;
}

// ─── Dashboard Stats ───────────────────────────────────────

export async function apiGetDashboardStats(): Promise<DashboardStats> {
  const [statsRes, todayMarks] = await Promise.all([
    api.get('/company/stats'),
    apiGetTodayAttendance(),
  ]);
  const s = statsRes.data;
  const checkedIn = new Set(todayMarks.filter(m => m.type === 'CHECK_IN').map(m => m.employeeId)).size;
  const checkedOut = new Set(todayMarks.filter(m => m.type === 'CHECK_OUT').map(m => m.employeeId)).size;
  const lateCount = todayMarks.filter(m => m.type === 'CHECK_IN' && m.isLate).length;

  return {
    totalEmployees: s.employees ?? 0,
    checkedInToday: checkedIn,
    currentlyWorking: checkedIn - checkedOut,
    lateTodayCount: lateCount,
    pendingApprovals: s.pendingRequests ?? 0,
    activeLocations: s.locations ?? 0,
    attendanceRate7d: checkedIn > 0 ? Math.round((checkedIn / Math.max(s.employees, 1)) * 100) : 0,
  };
}

export async function apiGetAttendanceChart(): Promise<AttendanceChartPoint[]> {
  const end = new Date();
  const start = subDays(end, 6);
  const dateFrom = format(start, 'yyyy-MM-dd');
  const dateTo = format(end, 'yyyy-MM-dd');
  const res = await apiGetAttendance({ dateFrom, dateTo, pageSize: 500 });

  const days = eachDayOfInterval({ start, end });
  return days.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayMarks = res.data.filter(m => m.markedAt.startsWith(dayStr));
    return {
      date: format(day, 'dd.MM'),
      checkedIn: dayMarks.filter(m => m.type === 'CHECK_IN').length,
      checkedOut: dayMarks.filter(m => m.type === 'CHECK_OUT').length,
      late: dayMarks.filter(m => m.type === 'CHECK_IN' && m.isLate).length,
      absent: 0,
    };
  });
}

export async function apiGetDeptLateStats(): Promise<DepartmentLateStats[]> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const res = await apiGetAttendance({ dateFrom: today, dateTo: today, pageSize: 200 });
  const byDept: Record<string, { late: number; total: Set<string> }> = {};
  res.data.forEach(m => {
    const dept = m.departmentName || 'Без отдела';
    if (!byDept[dept]) byDept[dept] = { late: 0, total: new Set() };
    byDept[dept].total.add(m.employeeId);
    if (m.type === 'CHECK_IN' && m.isLate) byDept[dept].late++;
  });
  return Object.entries(byDept).map(([department, v]) => ({
    department,
    lateCount: v.late,
    totalEmployees: v.total.size,
  }));
}

// ─── Leave Requests ────────────────────────────────────────

export async function apiGetLeaveRequests(filters?: LeaveRequestFilters): Promise<PaginatedResponse<LeaveRequest>> {
  const params: Record<string, any> = {
    page: filters?.page ?? 1,
    limit: filters?.pageSize ?? 20,
  };
  if (filters?.status) params.status = filters.status;
  if (filters?.type) params.type = filters.type;
  if (filters?.employeeId) params.employee_id = filters.employeeId;

  const res = await api.get('/leave-requests', { params });
  const d = res.data;
  const items = (Array.isArray(d) ? d : d.items ?? d.data ?? []).map(mapLeave);
  return {
    data: items,
    total: d.total ?? items.length,
    page: d.page ?? params.page,
    pageSize: d.limit ?? params.limit,
    totalPages: d.pages ?? (items.length === params.limit ? params.page + 1 : params.page),
  };
}

export async function apiCreateLeaveRequest(dto: CreateLeaveRequestDto): Promise<LeaveRequest> {
  const res = await api.post('/leave-requests', {
    employee_id: dto.employeeId,
    type: dto.type,
    start_date: dto.startDate,
    end_date: dto.endDate,
    comment: dto.reason,
  });
  return mapLeave(res.data);
}

export async function apiApproveLeaveRequest(id: string): Promise<LeaveRequest> {
  const res = await api.patch(`/leave-requests/${id}/approve`);
  return mapLeave(res.data);
}

export async function apiRejectLeaveRequest(id: string, reason: string): Promise<LeaveRequest> {
  const res = await api.patch(`/leave-requests/${id}/reject`, { reason });
  return mapLeave(res.data);
}

// ─── Departments (derived from employees) ──────────────────

export async function apiGetDepartments(): Promise<Department[]> {
  const res = await apiGetEmployees({ pageSize: 200 });
  const seen = new Map<string, Department>();
  res.data.forEach(e => {
    if (e.departmentId && !seen.has(e.departmentId)) {
      seen.set(e.departmentId, { id: e.departmentId, companyId: e.companyId, name: e.departmentName });
    }
  });
  return Array.from(seen.values());
}

function mapSchedule(value: any): WorkSchedule {
  const lunchStart = value.lunchStart?.slice(0, 5);
  const lunchEnd = value.lunchEnd?.slice(0, 5);
  const breakDurationMinutes = lunchStart && lunchEnd
    ? Math.max(0, Number(lunchEnd.slice(0, 2)) * 60 + Number(lunchEnd.slice(3, 5)) - Number(lunchStart.slice(0, 2)) * 60 - Number(lunchStart.slice(3, 5)))
    : 0;
  return {
    id: value.id, companyId: value.companyId, name: value.name,
    startTime: value.startTime?.slice(0, 5) ?? '', endTime: value.endTime?.slice(0, 5) ?? '',
    daysOfWeek: value.daysOfWeek ?? [], lateToleranceMinutes: value.lateToleranceMinutes ?? 0,
    overtimeThresholdMinutes: value.overtimeThresholdMinutes ?? 0, breakDurationMinutes,
  };
}

function scheduleBody(dto: UpdateScheduleDto): Record<string, unknown> {
  return Object.fromEntries(Object.entries({
    name: dto.name, start_time: dto.startTime, end_time: dto.endTime,
    days_of_week: dto.daysOfWeek, late_tolerance_minutes: dto.lateToleranceMinutes,
    overtime_threshold_minutes: dto.overtimeThresholdMinutes,
  }).filter(([, value]) => value !== undefined));
}

export async function apiGetSchedules(): Promise<WorkSchedule[]> {
  const res = await api.get('/schedules');
  return (res.data as any[]).map(mapSchedule);
}

export async function apiCreateSchedule(dto: CreateScheduleDto): Promise<WorkSchedule> {
  const res = await api.post('/schedules', scheduleBody(dto));
  return mapSchedule(res.data);
}

export async function apiUpdateSchedule(id: string, dto: UpdateScheduleDto): Promise<WorkSchedule> {
  const res = await api.patch(`/schedules/${id}`, scheduleBody(dto));
  return mapSchedule(res.data);
}

export async function apiDeleteSchedule(id: string): Promise<void> {
  await api.delete(`/schedules/${id}`);
}

// ─── Settings ──────────────────────────────────────────────

export async function apiGetSettings() {
  const res = await api.get('/settings');
  return res.data;
}

export async function apiUpdateSettings(data: any) {
  const res = await api.patch('/settings', data);
  return res.data;
}

export interface TimesheetApiDay {
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number;
  lateMinutes: number;
  overtimeMinutes: number;
}

export interface TimesheetApiEmployee {
  employeeId: string;
  fullName: string;
  departmentId: string | null;
  departmentName: string | null;
  position: string | null;
  days: TimesheetApiDay[];
  totalWorkedMinutes: number;
  totalLateMinutes: number;
  totalOvertimeMinutes: number;
  absences: number;
}

export async function apiGetTimesheet(month: string): Promise<{ month: string; timezone: string; employees: TimesheetApiEmployee[] }> {
  const res = await api.get('/timesheet', { params: { month } });
  return res.data;
}

export async function apiDownloadTimesheet(month: string): Promise<void> {
  const res = await api.get('/timesheet/export/xlsx', { params: { month }, responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `timesheet-${month}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
