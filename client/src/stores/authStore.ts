import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserRole {
  id:    string;
  name:  string;
  slug:  string;
  color: string;
  level: number;
}

export interface UserDivision {
  id:    string;
  name:  string;
  slug:  string;
  color: string;
}

export interface User {
  id:          string;
  email:       string;
  username:    string;
  fullName:    string;
  phone:       string | null;
  avatar:      string | null;
  isActive:    boolean;
  lastLoginAt: string | null;
  createdAt:   string;
  updatedAt:   string;
  role:        UserRole;
  division:    UserDivision;
}

interface AuthState {
  user:            User | null;
  token:           string | null;
  isAuthenticated: boolean;
  login:           (user: User, token: string) => void;
  logout:          () => void;
  setToken:        (token: string) => void;
  updateUser:      (partial: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:            null,
      token:           null,
      isAuthenticated: false,

      login: (user, token) => {
        localStorage.setItem('access_token', token);
        set({ user, token, isAuthenticated: true });
      },

      logout: () => {
        localStorage.removeItem('access_token');
        set({ user: null, token: null, isAuthenticated: false });
      },

      setToken: (token) => {
        localStorage.setItem('access_token', token);
        set({ token });
      },

      updateUser: (partial) =>
        set((s) => ({ user: s.user ? { ...s.user, ...partial } : s.user })),
    }),
    {
      name: 'auth-storage',
      partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }),
    },
  ),
);
