export interface TokenStore {
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  setTokens(accessToken: string | null, refreshToken: string | null): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryTokenStore implements TokenStore {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  async getAccessToken() {
    return this.accessToken;
  }

  async getRefreshToken() {
    return this.refreshToken;
  }

  async setTokens(accessToken: string | null, refreshToken: string | null) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  async clear() {
    this.accessToken = null;
    this.refreshToken = null;
  }
}

export class WebTokenStore extends MemoryTokenStore {
  private static refreshKey = 'timetrack_refresh_token';

  async getRefreshToken() {
    const memory = await super.getRefreshToken();
    if (memory || typeof window === 'undefined') return memory;
    return window.localStorage.getItem(WebTokenStore.refreshKey);
  }

  async setTokens(accessToken: string | null, refreshToken: string | null) {
    await super.setTokens(accessToken, refreshToken);
    if (typeof window === 'undefined') return;
    if (refreshToken) window.localStorage.setItem(WebTokenStore.refreshKey, refreshToken);
    else window.localStorage.removeItem(WebTokenStore.refreshKey);
  }

  async clear() {
    await super.clear();
    if (typeof window !== 'undefined') window.localStorage.removeItem(WebTokenStore.refreshKey);
  }
}
