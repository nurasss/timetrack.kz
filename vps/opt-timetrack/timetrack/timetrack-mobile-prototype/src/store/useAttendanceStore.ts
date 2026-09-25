import { create } from 'zustand';

import type { DaySummary } from '@/types';
import { MOCK_HISTORY } from '@/constants/mock-data';

interface AttendanceState {
  todayCheckIn: string | null;
  todayCheckOut: string | null;
  history: DaySummary[];
  pendingSyncCount: number;
  isSyncing: boolean;

  markCheckIn: (time: string) => void;
  markCheckOut: (time: string) => void;
  syncNow: () => Promise<void>;
}

export const useAttendanceStore = create<AttendanceState>()((set, get) => ({
  todayCheckIn: '08:56',
  todayCheckOut: null,
  history: MOCK_HISTORY,
  pendingSyncCount: 3,
  isSyncing: false,

  markCheckIn: (time) => set({ todayCheckIn: time }),
  markCheckOut: (time) => set({ todayCheckOut: time }),

  syncNow: async () => {
    if (get().isSyncing) return;
    set({ isSyncing: true });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    set({ isSyncing: false, pendingSyncCount: 0 });
  },
}));
