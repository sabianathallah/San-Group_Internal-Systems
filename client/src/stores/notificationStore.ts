import { create } from 'zustand';
import api from '@/lib/api';

export interface Notification {
  id:        string;
  type:      string;
  title:     string;
  message:   string;
  link:      string | null;
  isRead:    boolean;
  createdAt: string;
  actor:     { id: string; fullName: string; avatar: string | null } | null;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount:   number;
  loading:       boolean;
  fetch:         (limit?: number) => Promise<void>;
  poll:          () => Promise<number>; // returns delta of new unread
  markRead:      (id: string) => Promise<void>;
  markAllRead:   () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount:   0,
  loading:       false,

  fetch: async (limit = 30) => {
    set({ loading: true });
    try {
      const res = await api.get('/notifications', { params: { limit } });
      const list: Notification[] = res.data.data ?? [];
      set({ notifications: list, unreadCount: list.filter((n) => !n.isRead).length });
    } catch {
      // silently ignore — bell stays empty on error
    } finally {
      set({ loading: false });
    }
  },

  poll: async () => {
    const prevUnread = get().unreadCount;
    try {
      const res = await api.get('/notifications', { params: { limit: 30 } });
      const list: Notification[] = res.data.data ?? [];
      const newUnread = list.filter((n) => !n.isRead).length;
      set({ notifications: list, unreadCount: newUnread });
      return Math.max(0, newUnread - prevUnread);
    } catch { return 0; }
  },

  markRead: async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      set((s) => ({
        notifications: s.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        unreadCount:   Math.max(0, s.unreadCount - 1),
      }));
    } catch { /* ignore */ }
  },

  markAllRead: async () => {
    const prev = get().notifications;
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount:   0,
    }));
    try {
      await api.patch('/notifications/read-all');
    } catch {
      set({ notifications: prev, unreadCount: prev.filter((n) => !n.isRead).length });
    }
  },
}));
