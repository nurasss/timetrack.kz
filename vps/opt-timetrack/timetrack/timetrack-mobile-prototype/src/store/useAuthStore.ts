import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Employee, Locale } from '@/types';
import { MOCK_EMPLOYEE } from '@/constants/mock-data';

interface AuthState {
  isAuthenticated: boolean;
  employee: Employee | null;
  locale: Locale;
  hasHydrated: boolean;
  login: (emailOrPhone: string, password: string) => Promise<void>;
  logout: () => void;
  setLocale: (locale: Locale) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      employee: null,
      locale: 'ru',
      hasHydrated: false,

      login: async () => {
        // Mock-логин: в прототипе принимаем любые непустые значения.
        await new Promise((resolve) => setTimeout(resolve, 600));
        set({ isAuthenticated: true, employee: MOCK_EMPLOYEE });
      },

      logout: () => set({ isAuthenticated: false, employee: null }),

      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'timetrack-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        employee: state.employee,
        locale: state.locale,
      }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ hasHydrated: true });
      },
    }
  )
);
