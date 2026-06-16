import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'notif';

export interface Toast {
  id:        number;
  type:      ToastType;
  message:   string;
  // notif-specific fields
  title?:     string;
  notifType?: string;
  link?:      string | null;
  onClick?:   () => void;
  onUndo?:   () => void;
  duration:  number;
}

interface ToastState {
  toasts: Toast[];
  push: (type: ToastType, message: string, duration?: number) => void;
  pushNotif: (title: string, message: string, notifType: string, link: string | null, onClick: () => void) => void;
  pushUndoable: (message: string, opts: { onUndo: () => void; onCommit: () => void; duration?: number }) => void;
  dismiss: (id: number, undone?: boolean) => void;
}

let nextId = 1;
const timers  = new Map<number, ReturnType<typeof setTimeout>>();
const commits = new Map<number, () => void>();

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  push: (type, message, duration = 3500) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, type, message, duration }] }));
    timers.set(id, setTimeout(() => get().dismiss(id), duration));
  },

  pushNotif: (title, message, notifType, link, onClick, duration = 5000) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, type: 'notif', title, message, notifType, link, onClick, duration }] }));
    timers.set(id, setTimeout(() => get().dismiss(id), duration));
  },

  pushUndoable: (message, { onUndo, onCommit, duration = 5000 }) => {
    const id = nextId++;
    commits.set(id, onCommit);
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, type: 'info', message, onUndo, duration }] }));
    timers.set(id, setTimeout(() => get().dismiss(id), duration));
  },

  dismiss: (id, undone = false) => {
    const timer = timers.get(id);
    if (timer) clearTimeout(timer);
    timers.delete(id);
    const commit = commits.get(id);
    commits.delete(id);
    const t = get().toasts.find((x) => x.id === id);
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    if (undone) t?.onUndo?.();
    else commit?.();
  },
}));

// Imperative helpers — usable outside React components too
export const toast = {
  success:  (m: string) => useToastStore.getState().push('success', m),
  error:    (m: string) => useToastStore.getState().push('error', m),
  info:     (m: string) => useToastStore.getState().push('info', m),
  undoable: (m: string, opts: { onUndo: () => void; onCommit: () => void; duration?: number }) =>
    useToastStore.getState().pushUndoable(m, opts),
  notif: (title: string, message: string, notifType: string, link: string | null, onClick: () => void) =>
    useToastStore.getState().pushNotif(title, message, notifType, link, onClick),
};
