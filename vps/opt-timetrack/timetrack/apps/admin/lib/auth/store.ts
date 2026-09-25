'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { tokenStorage } from '@/lib/api/client';
import type { AuthUser } from '../types';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken, refreshToken) => {
        tokenStorage.set(accessToken, refreshToken);
        set({ user, accessToken, isAuthenticated: true });
      },
      clearAuth: () => {
        tokenStorage.clear();
        set({ user: null, accessToken: null, isAuthenticated: false });
      },
    }),
    { name: 'timetrack-auth' }
  )
);
