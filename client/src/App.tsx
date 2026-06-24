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
import AnalyticsPage from '@/pages/AnalyticsPage';
import UsersPage from '@/pages/admin/UsersPage';
import PermissionPage from '@/pages/admin/PermissionPage';
import AuditLogPage from '@/pages/admin/AuditLogPage';
import NotificationsPage from '@/pages/NotificationsPage';
import WorkOrderPage from '@/pages/WorkOrderPage';

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
          <Route path={ROUTES.ANALYTICS}      element={<AnalyticsPage />}      />
          <Route path={ROUTES.NOTIFICATIONS} element={<NotificationsPage />} />
          <Route path={ROUTES.WORK_ORDERS}   element={<WorkOrderPage />}     />

          {/* Admin-only routes */}
          <Route element={<AdminRoute />}>
            <Route path={ROUTES.ADMIN_USERS}        element={<UsersPage />}      />
            <Route path={ROUTES.ADMIN_PERMISSIONS}  element={<PermissionPage />} />
            <Route path={ROUTES.ADMIN_AUDIT_LOG}    element={<AuditLogPage />}   />
            <Route path={ROUTES.ADMIN_DIVISIONS}    element={<Navigate to={ROUTES.ADMIN_USERS} replace />} />
            <Route path={ROUTES.ADMIN_ROLES}        element={<Navigate to={ROUTES.ADMIN_PERMISSIONS} replace />} />
          </Route>
        </Route>

        {/* Default redirect */}
        <Route path="/"  element={<Navigate to={ROUTES.DASHBOARD} replace />} />
        <Route path="*"  element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
