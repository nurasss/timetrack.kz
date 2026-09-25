import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info';

interface ToastState {
  message: string | null;
  tone: ToastTone;
  show: (message: string, tone?: ToastTone) => void;
  hide: () => void;
}

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  tone: 'info',
  show: (message, tone = 'info') => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ message, tone });
    hideTimer = setTimeout(() => set({ message: null }), 2600);
  },
  hide: () => set({ message: null }),
}));
