// ============================================================
// Timetrack.kz — Core TypeScript Types
// ============================================================

// ──────────────────────────────────────
// Auth & Users
// ──────────────────────────────────────

export type UserRole = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'HR' | 'MANAGER' | 'EMPLOYEE';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  companyId: string;
  avatarUrl?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

// ──────────────────────────────────────
// Company
// ──────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  bin: string; // БИН / ИИН Kazakhstan
  industry: string;
  employeeCount: number;
  plan: PlanType;
  planExpiresAt: string;
  logoUrl?: string;
  timezone: string;
  language: 'ru' | 'kz';
  createdAt: string;
}

export type PlanType = 'STARTER_10' | 'TEAM_25' | 'BUSINESS_50' | 'SCALE_100' | 'ENTERPRISE';

// ──────────────────────────────────────
// Department
// ──────────────────────────────────────

export interface Department {
  id: string;
  companyId: string;
  name: string;
  managerId?: string;
}

// ──────────────────────────────────────
// Employee
// ──────────────────────────────────────

export type EmployeeStatus = 'active' | 'inactive' | 'on_leave';

export interface Employee {
  id: string;
  companyId: string;
  fullName: string;
  email: string;
  phone: string;
  employeeCode: string;
  departmentId: string;
  departmentName: string;
  position: string;
  managerId?: string;
  workScheduleId: string;
  status: EmployeeStatus;
  hiredAt: string;
  avatarUrl?: string;
  hasFaceTemplate: boolean;
  locationIds: string[];
}

export interface CreateEmployeeDto {
  fullName: string;
  email: string;
  phone: string;
  employeeCode: string;
  departmentId: string;
  position: string;
  managerId?: string;
  workScheduleId: string;
  hiredAt: string;
  locationIds: string[];
}

export type UpdateEmployeeDto = Partial<CreateEmployeeDto> & {
  status?: EmployeeStatus;
};

// ──────────────────────────────────────
// Location (Office / Branch)
// ──────────────────────────────────────

export interface Location {
  id: string;
  companyId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  isActive: boolean;
  timezone?: string;
}

export interface CreateLocationDto {
  name: string;
  address: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  isActive: boolean;
}

export type UpdateLocationDto = Partial<CreateLocationDto>;

// ──────────────────────────────────────
// Work Schedule
// ──────────────────────────────────────

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Monday

export interface WorkSchedule {
  id: string;
  companyId: string;
  name: string;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  daysOfWeek: DayOfWeek[];
  lateToleranceMinutes: number;
  overtimeThresholdMinutes: number;
  breakDurationMinutes: number;
}

export interface CreateScheduleDto {
  name: string;
  startTime: string;
  endTime: string;
  daysOfWeek: DayOfWeek[];
  lateToleranceMinutes: number;
  overtimeThresholdMinutes: number;
  breakDurationMinutes: number;
}

export type UpdateScheduleDto = Partial<CreateScheduleDto>;

// ──────────────────────────────────────
// Attendance
// ──────────────────────────────────────

export type AttendanceType = 'CHECK_IN' | 'CHECK_OUT';
export type AttendanceStatus = 'OK' | 'LATE' | 'OUT_OF_GEOFENCE' | 'MANUAL_REVIEW';
export type AttendanceSource = 'MOBILE' | 'TABLET' | 'TERMINAL' | 'API';

export interface DeviceInfo {
  platform: 'android' | 'ios' | 'web';
  model: string;
  appVersion: string;
  isMockLocation: boolean;
}

export interface GeofenceResult {
  passed: boolean;
  distanceMeters: number;
  radiusMeters: number;
}

export interface AttendanceRecord {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string;
  type: AttendanceType;
  markedAt: string;  // ISO8601 client time
  serverAt: string;  // ISO8601 server time
  locationId: string;
  locationName: string;
  lat: number;
  lng: number;
  accuracyMeters: number;
  photoUrl?: string;
  status: AttendanceStatus;
  source: AttendanceSource;
  deviceInfo?: DeviceInfo;
  isOfflineSynced: boolean;
  isLate: boolean;
  lateMinutes: number;
  geofence: GeofenceResult;
  notes?: string;
}

export interface CheckInPayload {
  employeeId: string;
  locationId: string;
  type: AttendanceType;
  markedAt: string;
  deviceTime: string;
  lat: number;
  lng: number;
  accuracyMeters: number;
  selfieFileId?: string;
  deviceInfo: DeviceInfo;
  offlineClientId?: string;
}

export interface CheckInResponse {
  id: string;
  status: AttendanceStatus;
  serverAt: string;
  isLate: boolean;
  lateMinutes: number;
  geofence: GeofenceResult;
  message: string;
}

// ──────────────────────────────────────
// Leave Requests
// ──────────────────────────────────────

export type LeaveType = 'VACATION' | 'SICK' | 'BUSINESS_TRIP' | 'DAY_OFF';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface LeaveRequest {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  departmentName: string;
  type: LeaveType;
  status: LeaveStatus;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  documentUrl?: string;
}

export interface CreateLeaveRequestDto {
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

// ──────────────────────────────────────
// Reports
// ──────────────────────────────────────

export interface TimesheetRow {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string;
  position: string;
  period: string; // "2026-06"
  scheduledDays: number;
  workedDays: number;
  absentDays: number;
  lateCount: number;
  totalLateMinutes: number;
  overtimeMinutes: number;
  leaveDays: number;
}

export interface LateReport {
  employeeId: string;
  employeeName: string;
  departmentName: string;
  date: string;
  scheduledStart: string;
  actualStart: string;
  lateMinutes: number;
  status: AttendanceStatus;
}

export interface OvertimeReport {
  employeeId: string;
  employeeName: string;
  departmentName: string;
  date: string;
  scheduledEnd: string;
  actualEnd: string;
  overtimeMinutes: number;
}

// ──────────────────────────────────────
// Files
// ──────────────────────────────────────

export interface UploadedFile {
  id: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

// ──────────────────────────────────────
// API Responses
// ──────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

// ──────────────────────────────────────
// Dashboard Stats
// ──────────────────────────────────────

export interface DashboardStats {
  totalEmployees: number;
  checkedInToday: number;
  currentlyWorking: number;
  lateTodayCount: number;
  pendingApprovals: number;
  activeLocations: number;
  attendanceRate7d: number;
}

export interface AttendanceChartPoint {
  date: string;
  checkedIn: number;
  checkedOut: number;
  late: number;
  absent: number;
}

export interface DepartmentLateStats {
  department: string;
  lateCount: number;
  totalEmployees: number;
}

// ──────────────────────────────────────
// UI / Filters
// ──────────────────────────────────────

export interface AttendanceFilters {
  dateFrom?: string;
  dateTo?: string;
  employeeId?: string;
  locationId?: string;
  status?: AttendanceStatus;
  type?: AttendanceType;
  page?: number;
  pageSize?: number;
}

export interface EmployeeFilters {
  search?: string;
  departmentId?: string;
  status?: EmployeeStatus;
  page?: number;
  pageSize?: number;
}

export interface LeaveRequestFilters {
  status?: LeaveStatus;
  type?: LeaveType;
  employeeId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}
