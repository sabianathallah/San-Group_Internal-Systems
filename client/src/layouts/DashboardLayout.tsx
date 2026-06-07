import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { usePermStore } from '@/stores/permStore';
import { ROUTES } from '@/lib/constants';
import Sidebar from '@/components/shared/Sidebar';
import Header from '@/components/shared/Header';

export default function DashboardLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [hasHydrated, setHasHydrated] = useState(useAuthStore.persist.hasHydrated());
  const fetchPerms = usePermStore((s) => s.fetch);

  useEffect(() => {
    setHasHydrated(useAuthStore.persist.hasHydrated());
    return useAuthStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPerms();
    }
  }, [isAuthenticated, fetchPerms]);

  if (!hasHydrated) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
