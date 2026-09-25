// ============================================================
// Timetrack.kz Mobile — Core Types
// ============================================================

export type Locale = 'ru' | 'kz';

export interface Employee {
  id: string;
  fullName: string;
  position: string;
  company: string;
  department: string;
  avatarInitials: string;
  scheduleId: string;
  primaryLocationId: string;
}

export interface Location {
  id: string;
  name: string;
  address: string;
  radiusMeters: number;
}

export interface WorkSchedule {
  id: string;
  name: string;
  startTime: string; // "HH:mm"
  endTime: string;
  lunchStart: string;
  lunchEnd: string;
}

export type AttendanceType = 'CHECK_IN' | 'CHECK_OUT';
export type AttendanceStatus = 'OK' | 'LATE' | 'OUT_OF_GEOFENCE' | 'MANUAL_REVIEW';

export interface AttendanceRecord {
  id: string;
  type: AttendanceType;
  date: string; // "yyyy-MM-dd"
  time: string; // "HH:mm"
  locationName: string;
  accuracyMeters: number;
  status: AttendanceStatus;
}

export interface DaySummary {
  date: string;
  workedMinutes: number;
  lateMinutes: number;
  records: AttendanceRecord[];
}

export type LeaveType = 'VACATION' | 'SICK' | 'BUSINESS_TRIP' | 'DAY_OFF';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface LeaveRequest {
  id: string;
  type: LeaveType;
  status: LeaveStatus;
  startDate: string;
  endDate: string;
  daysCount: number;
  comment?: string;
  createdAt: string;
}

export type CalendarDayStatus = 'work' | 'weekend' | 'late' | 'absent' | 'leave';

export interface CalendarDay {
  date: string;
  status: CalendarDayStatus;
  note?: string;
}

export type NotificationKind = 'late' | 'approved' | 'reminder' | 'sync' | 'update';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

// ──────────────────────────────────────
// Check-in flow state machine
// ──────────────────────────────────────

export type CheckStep = 'geolocation' | 'face' | 'liveness' | 'done';

export type CheckFlowState =
  | 'loading'
  | 'geofence_ok'
  | 'geofence_error'
  | 'face_scanning'
  | 'face_error'
  | 'liveness'
  | 'liveness_error'
  | 'success';

export type LivenessInstruction = 'look' | 'blink' | 'turn_left' | 'passed';

// ──────────────────────────────────────
// Kiosk
// ──────────────────────────────────────

export type KioskState = 'idle' | 'face_detected' | 'liveness' | 'success' | 'failed';
