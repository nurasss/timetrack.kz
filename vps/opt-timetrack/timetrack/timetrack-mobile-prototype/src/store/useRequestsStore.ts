import { create } from 'zustand';

import type { LeaveRequest, LeaveType } from '@/types';
import { MOCK_LEAVE_REQUESTS } from '@/constants/mock-data';

interface NewRequestInput {
  type: LeaveType;
  startDate: string;
  endDate: string;
  comment?: string;
}

interface RequestsState {
  requests: LeaveRequest[];
  addRequest: (input: NewRequestInput) => void;
}

function daysBetween(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

export const useRequestsStore = create<RequestsState>((set, get) => ({
  requests: MOCK_LEAVE_REQUESTS,
  addRequest: (input) => {
    const newRequest: LeaveRequest = {
      id: `req_${Date.now()}`,
      type: input.type,
      status: 'PENDING',
      startDate: input.startDate,
      endDate: input.endDate,
      daysCount: daysBetween(input.startDate, input.endDate),
      comment: input.comment,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    set({ requests: [newRequest, ...get().requests] });
  },
}));
