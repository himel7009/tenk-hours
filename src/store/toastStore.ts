import { create } from 'zustand';

export interface ToastAction {
  label: string;
  run: () => void;
}

interface ToastState {
  message: string | null;
  /** A button on the toast. A toast with one stays until used or dismissed. */
  action: ToastAction | null;
  /** Changes with every toast so repeated messages still re-announce. */
  key: number;
  show: (message: string, action?: ToastAction) => void;
  dismiss: () => void;
}

export const useToastStore = create<ToastState>()((set) => ({
  message: null,
  action: null,
  key: 0,
  show: (message, action) =>
    set((state) => ({ message, action: action ?? null, key: state.key + 1 })),
  dismiss: () => set({ message: null, action: null }),
}));
