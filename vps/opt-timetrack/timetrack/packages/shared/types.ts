export type Language = 'ru' | 'kz';

// Match API: CHECK_IN, CHECK_OUT
export type AttendanceType = 'CHECK_IN' | 'CHECK_OUT' | 'arrival' | 'departure';

// Match API: MOBILE, TABLET, TERMINAL, API
export type AttendanceSource = 'MOBILE' | 'TABLET' | 'TERMINAL' | 'API';

export type RequestType = 'vacation' | 'sick' | 'businessTrip' | 'dayOff';
export type RequestStatus = 'pending' | 'approved' | 'rejected';

// Match API Employee status
export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING';
export type TodayStatus = 'NOT_MARKED' | 'WORKING' | 'LATE' | 'EARLY_LEAVE' | 'ABSENT';

export type CheckState = 'loading' | 'ready' | 'success' | 'geoError' | 'faceError' | 'livenessError';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  company_id: string;
  company_name: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface Company {
  id: string;
  name: string;
  bin: string;
  plan: string;
  employeesLimit: number;
}

export interface Department {
  id: string;
  company_id: string;
  parent_id?: string;
  name: string;
}

export interface Position {
  id: string;
  department_id?: string;
  name: string;
}

export interface Location {
  id: string;
  company_id: string;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  radius: number;
  is_active: boolean;
  isActive?: boolean;
}

export interface Schedule {
  id: string;
  company_id: string;
  name: string;
  start_time: string;
  start?: string;
  end_time: string;
  end?: string;
  break_start: string;
  breakStart?: string;
  break_end: string;
  breakEnd?: string;
  allowed_late_minutes: number;
  allowedLateMinutes?: number;
  days: string[];
}

export interface Employee {
  id: string;
  company_id: string;
  full_name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  department_id: string | null;
  departmentId?: string | null;
  position_id: string | null;
  positionId?: string | null;
  department: string | null;
  position: string | null;
  status: EmployeeStatus;
  today_status: TodayStatus;
  employee_code: string;
  employeeCode?: string;
  avatar_url: string | null;
  hired_at?: string;
  hiredAt?: string;
  locationId?: string;
  scheduleId?: string;
  biometricPhotos?: number;
  faceProfileStatus?: 'ready' | 'needsUpdate' | 'missing';
}

export interface Attendance {
  id: string;
  company_id: string;
  employee_id: string;
  employeeId?: string;
  employee?: string;
  location_id: string | null;
  locationId?: string | null;
  location?: string;
  type: AttendanceType;
  source: AttendanceSource;
  marked_at: string;
  time?: string;
  server_at: string;
  accuracy_meters: number | null;
  accuracy?: number | null;
  faceScore?: number;
  spoofed?: boolean;
  lat?: number | null;
  lng?: number | null;
  is_inside_geofence?: boolean;
  distance_to_location_meters?: number;
  is_late?: boolean;
  late_minutes?: number;
  is_early_leave?: boolean;
  early_leave_minutes?: number;
  status: 'VALID' | 'INVALID' | 'SUSPICIOUS';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  employeeId?: string;
  type: RequestType;
  start_date: string;
  startDate?: string;
  end_date: string;
  endDate?: string;
  comment?: string;
  status: RequestStatus;
  created_at: string;
  approved_by?: string;
}

export interface NotificationItem {
  id: string;
  employee_id: string;
  employeeId?: string;
  title: string;
  message: string;
  type: 'late' | 'request' | 'reminder' | 'sync' | 'update';
  read?: boolean;
  created_at: string;
  createdAt?: string;
}

export interface IntegrationItem {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'disconnected' | 'developing';
  category: 'accounting' | 'hardware' | 'communications' | 'api' | 'payments';
}
