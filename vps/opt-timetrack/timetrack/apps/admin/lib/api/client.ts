import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const configuredUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const BASE_URL = configuredUrl
  ? (configuredUrl.endsWith('/api/v1') ? configuredUrl : `${configuredUrl}/api/v1`)
  : '/api/v1';
const ACCESS_KEY = 'tt_access';
const REFRESH_KEY = 'tt_refresh';

// Cookie read by Next.js middleware (middleware.ts) to gate protected routes.
// Auth state itself lives in localStorage; this cookie only signals "session present".
const SESSION_COOKIE = 'timetrack_session';

function setSessionCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
}

function clearSessionCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export const tokenStorage = {
  getAccess: () => (typeof window !== 'undefined' ? localStorage.getItem(ACCESS_KEY) : null),
  getRefresh: () => (typeof window !== 'undefined' ? localStorage.getItem(REFRESH_KEY) : null),
  set: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    setSessionCookie();
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    clearSessionCookie();
  },
};

function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function convertKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(convertKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [toCamel(k), convertKeys(v)])
    );
  }
  return obj;
}

let refreshPromise: Promise<string> | null = null;

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (typeof Blob === 'undefined' || !(response.data instanceof Blob)) {
      response.data = convertKeys(response.data);
    }
    return response;
  },
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry) {
      const refreshToken = tokenStorage.getRefresh();
      if (!refreshToken) {
        tokenStorage.clear();
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(error);
      }

      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken })
            .then(({ data }) => {
              tokenStorage.set(data.access_token, data.refresh_token);
              return data.access_token as string;
            })
            .finally(() => { refreshPromise = null; });
        }
        const accessToken = await refreshPromise;
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        tokenStorage.clear();
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);
