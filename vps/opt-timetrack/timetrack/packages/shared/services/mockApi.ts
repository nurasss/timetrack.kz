import { attendances, employees, locations, notifications, requests } from '../mock-data';
import type { Attendance, AttendanceType, LeaveRequest, RequestType } from '../types';

export const mockApi = {
  async getCurrentEmployee() {
    return employees[0];
  },
  async getTodayAttendance(employeeId: string) {
    return attendances.filter((attendance) => attendance.employeeId === employeeId && attendance.time.startsWith('2026-06-16'));
  },
  async getAttendanceHistory(employeeId: string) {
    return attendances.filter((attendance) => attendance.employeeId === employeeId);
  },
  async createAttendance(employeeId: string, type: AttendanceType, locationId = 'l1'): Promise<Attendance> {
    const now = new Date().toISOString();
    return {
      id: `local-${Date.now()}`,
      employeeId,
      type,
      time: now,
      serverTime: now,
      locationId,
      accuracy: 12,
      source: 'mobile',
      livenessPassed: true,
      faceScore: 0.91,
      photoMock: 'selfie-placeholder'
    };
  },
  async getRequests(employeeId: string) {
    return requests.filter((request) => request.employeeId === employeeId);
  },
  async createRequest(employeeId: string, type: RequestType, startDate: string, endDate: string, comment: string): Promise<LeaveRequest> {
    return {
      id: `request-${Date.now()}`,
      employeeId,
      type,
      startDate,
      endDate,
      comment,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
  },
  async getNotifications(employeeId: string) {
    return notifications.filter((notification) => notification.employeeId === employeeId);
  },
  async getLocations() {
    return locations;
  }
};
