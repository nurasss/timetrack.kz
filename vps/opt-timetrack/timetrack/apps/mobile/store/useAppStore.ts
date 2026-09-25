import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { create } from 'zustand';

import type { ApiEmployee, ApiLeaveRequest, ApiLocation, ApiMark } from '../../../packages/shared/services/realApi';
import { ApiError, configureApi, realApi } from '../../../packages/shared/services/realApi';
import type { AttendanceType, CheckState, Language, User } from '../../../packages/shared/types';
import { SecureTokenStore } from '../lib/secureTokenStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const QUEUE_KEY = 'timetrack.mobile.attendance_queue.v1';
const CACHE_KEY = 'timetrack.mobile.cache.v1';

configureApi({ baseUrl: API_URL, tokenStore: new SecureTokenStore() });

export interface QueuedMark {
  eventId: string;
  type: 'CHECK_IN' | 'CHECK_OUT';
  locationId: string | null;
  lat: number;
  lng: number;
  accuracy: number | null;
  markedAt: string;
  attempts: number;
  lastError: string | null;
}

interface CachedState {
  attendance: ApiMark[];
  leaveRequests: ApiLeaveRequest[];
  offlineQueue: QueuedMark[];
}

interface AppState {
  language: Language;
  user: User | null;
  employee: ApiEmployee | null;
  locations: ApiLocation[];
  attendance: ApiMark[];
  leaveRequests: ApiLeaveRequest[];
  offlineQueue: QueuedMark[];
  pendingSyncCount: number;
  checkState: CheckState;
  positionError: string | null;
  syncing: boolean;
  lastCreatedMark: ApiMark | null;
  setLanguage: (language: Language) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadCachedState: () => Promise<void>;
  refreshAttendance: () => Promise<void>;
  createAttendance: (type: 'CHECK_IN' | 'CHECK_OUT') => Promise<ApiMark>;
  createRequest: (type: string, startDate: string, endDate: string, comment: string) => Promise<ApiLeaveRequest>;
  syncOffline: () => Promise<void>;
}

function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earth = 6371000;
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(aLat)) * Math.cos(toRadians(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earth * Math.asin(Math.sqrt(a));
}

function nearestLocation(position: Location.LocationObject, locations: ApiLocation[]) {
  let best: { location: ApiLocation; distance: number } | null = null;
  for (const location of locations) {
    const distance = haversineMeters(position.coords.latitude, position.coords.longitude, location.lat, location.lng);
    if (!best || distance < best.distance) best = { location, distance };
  }
  return best;
}

async function readCache(): Promise<CachedState> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return { attendance: [], leaveRequests: [], offlineQueue: [] };
    const parsed = JSON.parse(raw) as Partial<CachedState>;
    return {
      attendance: Array.isArray(parsed.attendance) ? parsed.attendance : [],
      leaveRequests: Array.isArray(parsed.leaveRequests) ? parsed.leaveRequests : [],
      offlineQueue: Array.isArray(parsed.offlineQueue) ? parsed.offlineQueue : [],
    };
  } catch {
    return { attendance: [], leaveRequests: [], offlineQueue: [] };
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  language: 'ru',
  user: null,
  employee: null,
  locations: [],
  attendance: [],
  leaveRequests: [],
  offlineQueue: [],
  pendingSyncCount: 0,
  checkState: 'ready',
  positionError: null,
  syncing: false,
  lastCreatedMark: null,
  setLanguage: (language) => set({ language }),

  login: async (email, password) => {
    if (!API_URL) throw new Error('EXPO_PUBLIC_API_URL is not configured');
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) throw new Error('Введите email и пароль');
    const response = await realApi.login(trimmedEmail, password);
    const [user, employee, locations] = await Promise.all([
      realApi.getCurrentUser() as Promise<User>,
      realApi.getEmployeeMe(),
      realApi.listLocations(),
    ]);
    const cached = await readCache();
    set({
      user: response.user ?? user,
      employee,
      locations,
      attendance: cached.attendance,
      leaveRequests: cached.leaveRequests,
      offlineQueue: cached.offlineQueue,
      pendingSyncCount: cached.offlineQueue.length,
      checkState: 'ready',
      positionError: null,
    });
  },

  logout: async () => {
    try {
      await realApi.logout();
    } finally {
      set({
        user: null,
        employee: null,
        locations: [],
        attendance: [],
        leaveRequests: [],
        offlineQueue: [],
        pendingSyncCount: 0,
        checkState: 'ready',
        positionError: null,
      });
    }
  },

  loadCachedState: async () => {
    const cached = await readCache();
    set({
      attendance: cached.attendance,
      leaveRequests: cached.leaveRequests,
      offlineQueue: cached.offlineQueue,
      pendingSyncCount: cached.offlineQueue.length,
    });
  },

  refreshAttendance: async () => {
    const { employee } = get();
    if (!employee) return;
    const marks = await realApi.listMarks({ employee_id: employee.id, limit: 100 });
    const requests = await realApi.listLeaveRequests().catch(() => []);
    set({ attendance: marks, leaveRequests: requests });
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ attendance: marks, leaveRequests: requests, offlineQueue: get().offlineQueue }),
    );
  },

  createAttendance: async (type) => {
    const { employee, locations } = get();
    if (!employee) throw new Error('Employee profile is missing');
    set({ checkState: 'loading', positionError: null });

    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      const error = 'Разрешите доступ к геолокации для отметки';
      set({ checkState: 'geoError', positionError: error });
      throw new Error(error);
    }
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
    if (position.mocked) {
      const error = 'Mock-локация запрещена для отметки';
      set({ checkState: 'geoError', positionError: error });
      throw new Error(error);
    }
    const match = nearestLocation(position, locations);
    if (!match) {
      const error = 'Активные рабочие локации не найдены';
      set({ checkState: 'geoError', positionError: error });
      throw new Error(error);
    }
    const payload = {
      employee_id: employee.id,
      location_id: match.location.id,
      marked_at: new Date().toISOString(),
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy_meters: position.coords.accuracy,
      offline: false,
      idempotency_key: `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
      client_event_id: `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
    };

    try {
      const mark = await realApi.createMark(type, payload);
      set((state) => ({ attendance: [mark, ...state.attendance], checkState: 'success', lastCreatedMark: mark }));
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ attendance: get().attendance, leaveRequests: get().leaveRequests, offlineQueue: get().offlineQueue }),
      );
      return mark;
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) {
        set({ checkState: type === 'CHECK_IN' ? 'faceError' : 'ready', positionError: error.detail });
        throw error;
      }
      const queued: QueuedMark = {
        eventId: payload.client_event_id as string,
        type,
        locationId: match.location.id,
        lat: payload.lat as number,
        lng: payload.lng as number,
        accuracy: payload.accuracy_meters,
        markedAt: payload.marked_at as string,
        attempts: 0,
        lastError: error instanceof Error ? error.message : 'Network error',
      };
      const offlineQueue = [...get().offlineQueue.filter((item) => item.eventId !== queued.eventId), queued];
      set({ offlineQueue, pendingSyncCount: offlineQueue.length, checkState: 'ready' });
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ attendance: get().attendance, leaveRequests: get().leaveRequests, offlineQueue }),
      );
      throw new Error('Нет связи с сервером. Отметка сохранена в очередь и ожидает синхронизации.');
    }
  },

  createRequest: async (type, startDate, endDate, comment) => {
    const { employee } = get();
    if (!employee) throw new Error('Employee profile is missing');
    if (!startDate || !endDate || endDate < startDate) throw new Error('Некорректный период заявки');
    const created = await realApi.createLeaveRequest({
      employee_id: employee.id,
      type,
      start_date: startDate,
      end_date: endDate,
      comment,
    });
    const leaveRequests = [created, ...get().leaveRequests];
    set({ leaveRequests });
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ attendance: get().attendance, leaveRequests, offlineQueue: get().offlineQueue }),
    );
    return created;
  },

  syncOffline: async () => {
    const { employee, syncing } = get();
    if (!employee || syncing) return;
    set({ syncing: true });
    try {
      let queue = [...get().offlineQueue];
      for (const item of queue) {
        try {
          await realApi.createMark(item.type, {
            employee_id: employee.id,
            location_id: item.locationId,
            marked_at: item.markedAt,
            lat: item.lat,
            lng: item.lng,
            accuracy_meters: item.accuracy,
            offline: true,
            idempotency_key: item.eventId,
            client_event_id: item.eventId,
          });
          queue = queue.filter((entry) => entry.eventId !== item.eventId);
        } catch (error: unknown) {
          if (error instanceof ApiError && error.status === 409) {
            queue = queue.filter((entry) => entry.eventId !== item.eventId);
            continue;
          }
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
            const detail = error.detail;
            queue = queue.map((entry) =>
              entry.eventId === item.eventId
                ? { ...entry, attempts: entry.attempts + 1, lastError: detail }
                : entry,
            );
            continue;
          }
          break;
        }
      }
      set({ offlineQueue: queue, pendingSyncCount: queue.length });
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ attendance: get().attendance, leaveRequests: get().leaveRequests, offlineQueue: queue }),
      );
      await get().refreshAttendance().catch(() => undefined);
    } finally {
      set({ syncing: false });
    }
  },
}));
