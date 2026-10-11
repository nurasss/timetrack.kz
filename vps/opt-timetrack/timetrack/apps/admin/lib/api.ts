export const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

type RequestOptions = RequestInit & { auth?: boolean };

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (options.auth && typeof window !== 'undefined') {
    const token = localStorage.getItem('timetrack_access_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(body.detail ?? 'Request failed');
  }
  return response.json() as Promise<T>;
}
