import * as SecureStore from 'expo-secure-store';
import type { TokenStore } from '../../../packages/shared/services/tokenStore';

const REFRESH_KEY = 'timetrack.mobile.refresh_token.v1';

export class SecureTokenStore implements TokenStore {
  private accessToken: string | null = null;

  async getAccessToken() {
    return this.accessToken;
  }

  getRefreshToken() {
    return SecureStore.getItemAsync(REFRESH_KEY);
  }

  async setTokens(accessToken: string | null, refreshToken: string | null) {
    this.accessToken = accessToken;
    if (refreshToken) await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
    else await SecureStore.deleteItemAsync(REFRESH_KEY);
  }

  async clear() {
    this.accessToken = null;
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  }
}
