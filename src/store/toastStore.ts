import { create } from 'zustand';

interface ToastState {
  message: string | null;
  /** Changes with every toast so repeated messages still re-announce. */
  key: number;
  show: (message: string) => void;
  dismiss: () => void;
}

export const useToastStore = create<ToastState>()((set) => ({
  message: null,
  key: 0,
  show: (message) => set((state) => ({ message, key: state.key + 1 })),
  dismiss: () => set({ message: null }),
}));
