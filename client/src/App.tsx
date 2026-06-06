import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ROUTES } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import AuthLayout from '@/layouts/AuthLayout';
import DashboardLayout from '@/layouts/DashboardLayout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import TasksPage from '@/pages/TasksPage';
import BulletinPage from '@/pages/BulletinPage';
import NotesPage from '@/pages/NotesPage';
import DatabasePage from '@/pages/DatabasePage';
import ProfilePage from '@/pages/ProfilePage';
import UsersPage from '@/pages/admin/UsersPage';
import DivisionsPage from '@/pages/admin/DivisionsPage';
import RolesPage from '@/pages/admin/RolesPage';

function AdminRoute() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = (user?.role?.level ?? 99) <= 2;
  if (!isAdmin) return <Navigate to={ROUTES.DASHBOARD} replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route element={<AuthLayout />}>
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        </Route>

        {/* Protected routes */}
        <Route element={<DashboardLayout />}>
          <Route path={ROUTES.DASHBOARD}   element={<DashboardPage />} />
          <Route path={ROUTES.TASKS}       element={<TasksPage />}     />
          <Route path={ROUTES.BULLETIN}    element={<BulletinPage />}  />
          <Route path={ROUTES.NOTES}       element={<NotesPage />}     />
          <Route path={ROUTES.DATABASE}    element={<DatabasePage />}  />
          <Route path={ROUTES.PROFILE}     element={<ProfilePage />}   />

          {/* Admin-only routes */}
          <Route element={<AdminRoute />}>
            <Route path={ROUTES.ADMIN_USERS}      element={<UsersPage />}      />
            <Route path={ROUTES.ADMIN_DIVISIONS}  element={<DivisionsPage />}  />
            <Route path={ROUTES.ADMIN_ROLES}      element={<RolesPage />}      />
          </Route>
        </Route>

        {/* Default redirect */}
        <Route path="/"  element={<Navigate to={ROUTES.DASHBOARD} replace />} />
        <Route path="*"  element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
