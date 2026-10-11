import { apiFetch } from './api';

export type AuthUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  company_id: string | null;
  company_name: string | null;
};

export type LoginResponse = {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  user: AuthUser;
};

export type RegisterCompanyPayload = {
  company_name: string;
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  bin?: string;
};

export type EmailVerificationResponse = {
  ok: boolean;
  email: string;
  message: string;
  expires_in_minutes: number;
  email_sent: boolean;
};

const ACCESS_TOKEN_KEY = 'timetrack_access_token';
const REFRESH_TOKEN_KEY = 'timetrack_refresh_token';
const USER_KEY = 'timetrack_user';
const SESSION_COOKIE = 'timetrack_session';

function setSessionCookie(token: string) {
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

function clearSessionCookie() {
  document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function accessToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function refreshToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function persistSession(response: LoginResponse) {
  localStorage.setItem(ACCESS_TOKEN_KEY, response.access_token);
  localStorage.setItem(REFRESH_TOKEN_KEY, response.refresh_token);
  localStorage.setItem(USER_KEY, JSON.stringify(response.user));
  setSessionCookie(response.access_token);
}

export async function login(email: string, password: string) {
  const response = await apiFetch<LoginResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  persistSession(response);
  return response;
}

export async function registerCompany(payload: RegisterCompanyPayload) {
  return apiFetch<EmailVerificationResponse>('/api/v1/auth/register-company', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function verifyEmail(email: string, code: string) {
  const response = await apiFetch<LoginResponse>('/api/v1/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ email, code })
  });
  persistSession(response);
  return response;
}

export async function resendVerification(email: string) {
  return apiFetch<EmailVerificationResponse>('/api/v1/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

export function logout() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  clearSessionCookie();
}

export function currentUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export async function refreshSession() {
  const token = refreshToken();
  if (!token) return null;
  const response = await apiFetch<LoginResponse>('/api/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: token })
  });
  persistSession(response);
  return response;
}

export async function fetchCurrentUser() {
  return apiFetch<AuthUser>('/api/v1/auth/me', { auth: true });
}
