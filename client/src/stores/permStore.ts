import { create } from 'zustand';
import api from '@/lib/api';
import { PermissionConfig, DEFAULT_PERMS } from '@/types/permissions';

interface PermState {
  perms: PermissionConfig;
  loaded: boolean;
  fetch: () => Promise<void>;
  clear: () => void;
}

export const usePermStore = create<PermState>((set) => ({
  perms: DEFAULT_PERMS,
  loaded: false,
  fetch: async () => {
    try {
      const res = await api.get('/permissions/me');
      set({ perms: res.data.data ?? DEFAULT_PERMS, loaded: true });
    } catch {
      set({ perms: DEFAULT_PERMS, loaded: true });
    }
  },
  clear: () => set({ perms: DEFAULT_PERMS, loaded: false }),
}));
