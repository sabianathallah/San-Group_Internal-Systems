import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { usePermStore } from '@/stores/permStore';
import { ROUTES } from '@/lib/constants';
import Sidebar from '@/components/shared/Sidebar';
import Header from '@/components/shared/Header';
import CommandPalette from '@/components/shared/CommandPalette';
import Toasts from '@/components/shared/Toasts';
import api from '@/lib/api';

function isJwtExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() >= payload.exp * 1000 - 10_000; // 10s buffer
  } catch {
    return true;
  }
}

export default function DashboardLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout          = useAuthStore((s) => s.logout);
  const [hasHydrated, setHasHydrated] = useState(useAuthStore.persist.hasHydrated());
  const [tokenReady, setTokenReady]   = useState(false);
  const fetchPerms = usePermStore((s) => s.fetch);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    setHasHydrated(useAuthStore.persist.hasHydrated());
    return useAuthStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });
  }, []);

  // After hydration, proactively refresh if access token is expired
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) {
      if (hasHydrated) setTokenReady(true);
      return;
    }
    const token = localStorage.getItem('access_token');
    if (!token || isJwtExpired(token)) {
      api.post('/auth/refresh')
        .then(({ data }) => {
          localStorage.setItem('access_token', data.data.accessToken);
          setTokenReady(true);
        })
        .catch(() => {
          logout();
          setTokenReady(true);
        });
    } else {
      setTokenReady(true);
    }
  }, [hasHydrated, isAuthenticated, logout]);

  useEffect(() => {
    if (isAuthenticated && tokenReady) {
      fetchPerms();
    }
  }, [isAuthenticated, tokenReady, fetchPerms]);

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  if (!hasHydrated || !tokenReady) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header onSearchClick={() => setPaletteOpen(true)} />

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Toasts />
    </div>
  );
}
