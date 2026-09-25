import type { AuthResponse } from '../types';
import { MemoryTokenStore, TokenStore, WebTokenStore } from './tokenStore';

export interface ApiLocation {
  id: string;
  company_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radius_meters: number;
  is_active: boolean;
}

export interface ApiEmployee {
  id: string;
  company_id: string;
  user_id: string | null;
  full_name: string;
  department_id: string | null;
  position_id: string | null;
  status: string;
  employee_code: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface ApiMark {
  id: string;
  company_id: string;
  employee_id: string;
  location_id: string | null;
  location?: string | null;
  type: 'CHECK_IN' | 'CHECK_OUT';
  source: string;
  marked_at: string;
  server_at: string;
  accuracy_meters?: number | null;
  status: string;
}

export interface ApiLeaveRequest {
  id: string;
  company_id: string;
  employee_id: string;
  type: string;
  start_date: string;
  end_date: string;
  comment: string | null;
  status: string;
}

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

let configuredBaseUrl: string | null = null;
let tokenStore: TokenStore = typeof window === 'undefined' ? new MemoryTokenStore() : new WebTokenStore();
let refreshPromise: Promise<string> | null = null;

export function configureApi(options: { baseUrl?: string; tokenStore?: TokenStore } = {}) {
  if (options.baseUrl) configuredBaseUrl = options.baseUrl.replace(/\/$/, '');
  if (options.tokenStore) tokenStore = options.tokenStore;
}

function resolveBaseUrl() {
  const configured =
    configuredBaseUrl ||
    process.env.EXPO_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.API_BASE_URL;
  if (!configured) {
    if (typeof window !== 'undefined') return '/api/v1';
    throw new ApiError(0, 'API base URL is not configured');
  }
  const normalized = configured.replace(/\/$/, '');
  return normalized.endsWith('/api/v1') ? normalized : `${normalized}/api/v1`;
}

async function parseError(response: Response) {
  const data = await response.json().catch(() => ({}));
  const detail = data?.detail ?? data?.message ?? `API request failed with status ${response.status}`;
  if (Array.isArray(detail)) return detail.map((item) => item?.msg ?? 'Invalid request').join('; ');
  return typeof detail === 'string' ? detail : JSON.stringify(detail);
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = await tokenStore.getRefreshToken();
      if (!refreshToken) throw new ApiError(401, 'Session expired');
      const response = await fetch(`${resolveBaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!response.ok) {
        await tokenStore.clear();
        throw new ApiError(response.status, await parseError(response));
      }
      const data = (await response.json()) as AuthResponse;
      await tokenStore.setTokens(data.access_token, data.refresh_token);
      return data.access_token;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function request<T>(endpoint: string, options: RequestInit = {}, retried = false): Promise<T> {
  const accessToken = await tokenStore.getAccessToken();
  const headers = new Headers(options.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${resolveBaseUrl()}${endpoint}`, { ...options, headers });
  if (response.status === 401 && !retried) {
    try {
      const nextToken = await refreshAccessToken();
      headers.set('Authorization', `Bearer ${nextToken}`);
      const retry = await fetch(`${resolveBaseUrl()}${endpoint}`, { ...options, headers });
      if (!retry.ok) {
        if (retry.status === 401) await tokenStore.clear();
        throw new ApiError(retry.status, await parseError(retry));
      }
      return (await retry.json()) as T;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) await tokenStore.clear();
      throw error;
    }
  }
  if (!response.ok) throw new ApiError(response.status, await parseError(response));
  return (await response.json()) as T;
}

export const realApi = {
  async login(email: string, password: string) {
    const data = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await tokenStore.setTokens(data.access_token, data.refresh_token);
    return data;
  },

  async logout() {
    const refreshToken = await tokenStore.getRefreshToken();
    try {
      await request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } finally {
      await tokenStore.clear();
    }
  },

  getCurrentUser() {
    return request('/auth/me');
  },

  getEmployeeMe() {
    return request<ApiEmployee>('/employees/me');
  },

  listLocations() {
    return request<ApiLocation[]>('/locations');
  },

  listMarks(params: { employee_id?: string; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (params.employee_id) query.set('employee_id', params.employee_id);
    if (params.limit) query.set('limit', String(params.limit));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<ApiMark[]>(`/marks${suffix}`);
  },

  createMark(
    type: 'CHECK_IN' | 'CHECK_OUT',
    data: {
      employee_id?: string;
      location_id?: string | null;
      marked_at?: string | null;
      lat?: number | null;
      lng?: number | null;
      accuracy_meters?: number | null;
      offline?: boolean;
      idempotency_key?: string;
      client_event_id?: string;
    },
  ) {
    return request<ApiMark>(`/marks/${type === 'CHECK_IN' ? 'check-in' : 'check-out'}`, {
      method: 'POST',
      body: JSON.stringify({ source: 'MOBILE', ...data }),
    });
  },

  createLeaveRequest(data: { employee_id?: string; type: string; start_date: string; end_date: string; comment?: string }) {
    return request<ApiLeaveRequest>('/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  listLeaveRequests() {
    return request<ApiLeaveRequest[]>('/requests');
  },
};
