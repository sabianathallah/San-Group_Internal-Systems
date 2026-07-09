import { useRef, useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Menu, Bell, ChevronDown, LogOut, KeyRound, ChevronRight,
  Loader2, Clock, Megaphone, ShieldAlert, Info, CheckCircle2, User, Search, ArrowRight,
  AlertTriangle, ClipboardList, Timer,
} from 'lucide-react';
import { useUiStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useClickOutside } from '@/hooks/useClickOutside';
import ChangePasswordModal from '@/components/shared/ChangePasswordModal';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/cn';
import api from '@/lib/api';
import { toast } from '@/stores/toastStore';

const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard':          'Dashboard',
  '/tasks':              'Tasks',
  '/bulletin':           'Bulletin',
  '/notes':              'Notes',
  '/database':           'DB Links',
  '/profile':            'My Profile',
  '/analytics':          'Analytics',
  '/notifications':      'Notifications',
  '/work-orders':        'Work Orders',
  '/hris':                  'HRIS',
  '/hris/attendance':       'Attendance',
  '/hris/leave':            'Leave',
  '/hris/requests':         'Requests',
  '/hris/admin/holidays':   'Holidays',
  '/hris/reports':          'Attendance Report',
  '/hris/admin/shifts':     'Manage Shifts',
  '/hris/admin/locations':  'Office Locations',
  '/admin/users':        'Manage Users',
  '/admin/permissions':  'Roles & Permissions',
  '/admin/audit-log':    'Audit Log',
};

function useBreadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; to: string }[] = [];
  let path = '';
  for (const seg of segments) {
    path += `/${seg}`;
    const label = BREADCRUMB_MAP[path];
    if (label) crumbs.push({ label, to: path });
  }
  return crumbs;
}

export function NotifIcon({ type }: { type: string }) {
  const cls = 'flex-shrink-0 mt-0.5';
  switch (type) {
    case 'TASK_ASSIGNED':   return <CheckCircle2   size={14} className={cn(cls, 'text-info')} />;
    case 'TASK_COMPLETED':  return <CheckCircle2   size={14} className={cn(cls, 'text-success')} />;
    case 'TASK_CREATED':    return <ClipboardList  size={14} className={cn(cls, 'text-navy')} />;
    case 'TASK_DUE_SOON':   return <Timer          size={14} className={cn(cls, 'text-warning')} />;
    case 'TASK_OVERDUE':    return <AlertTriangle  size={14} className={cn(cls, 'text-danger')} />;
    case 'BULLETIN_NEW':    return <Megaphone      size={14} className={cn(cls, 'text-warning')} />;
    case 'BULLETIN_URGENT': return <ShieldAlert    size={14} className={cn(cls, 'text-danger')} />;
    case 'SYSTEM':          return <Clock          size={14} className={cn(cls, 'text-navy')} />;
    default:                return <Info           size={14} className={cn(cls, 'text-gray-400')} />;
  }
}

function notifAge(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1)  return 'Just now';
  if (diff < 60) return `${diff} minutes ago`;
  const h = Math.floor(diff / 60);
  if (h < 24)   return `${h} hours ago`;
  return `${Math.floor(h / 24)} days ago`;
}

export default function Header({ onSearchClick }: { onSearchClick?: () => void }) {
  const toggle  = useUiStore((s) => s.toggleSidebar);
  const user    = useAuthStore((s) => s.user);
  const logout  = useAuthStore((s) => s.logout);
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount   = useNotificationStore((s) => s.unreadCount);
  const notifLoading  = useNotificationStore((s) => s.loading);
  const fetchNotifs   = useNotificationStore((s) => s.fetch);
  const pollNotifs    = useNotificationStore((s) => s.poll);
  const markRead      = useNotificationStore((s) => s.markRead);
  const markAllRead   = useNotificationStore((s) => s.markAllRead);
  const navigate = useNavigate();
  const crumbs   = useBreadcrumbs();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen]       = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef    = useRef<HTMLDivElement>(null);

  useClickOutside(userMenuRef, () => setUserMenuOpen(false));
  useClickOutside(notifRef,    () => setNotifOpen(false));

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  // Poll every 60s; toast each new notification individually (max 3)
  const handlePoll = useCallback(async () => {
    const newNotifs = await pollNotifs();
    const shown = newNotifs.slice(0, 3);
    shown.forEach((n) => {
      toast.notif(n.title, n.message, n.type, n.link ?? null, () => {
        markRead(n.id);
        if (n.link) navigate(n.link);
      });
    });
    if (newNotifs.length > 3) {
      toast.info(`+${newNotifs.length - 3} notifikasi lainnya`);
    }
  }, [pollNotifs, markRead, navigate]);

  useEffect(() => {
    const id = setInterval(handlePoll, 60_000);
    return () => clearInterval(id);
  }, [handlePoll]);

  async function handleLogout() {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    logout();
    navigate(ROUTES.LOGIN, { replace: true });
  }

  return (
    <>
      <header className="flex-shrink-0 flex items-center justify-between h-header px-4 bg-white border-b border-gray-200 z-10">
        {/* Left */}
        <div className="flex items-center gap-3">
          <button onClick={toggle}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors text-gray-500"
            aria-label="Toggle sidebar">
            <Menu size={20} />
          </button>
          <nav className="flex items-center gap-1 text-sm text-gray-500" aria-label="Breadcrumb">
            <img src="/logo-san.png" alt="SAN Group" className="h-6 w-auto object-contain" />
            {crumbs.map((crumb, i) => (
              <span key={crumb.to} className="flex items-center gap-1">
                <ChevronRight size={14} className="text-gray-300" />
                {i === crumbs.length - 1
                  ? <span className="text-gray-700 font-medium">{crumb.label}</span>
                  : <Link to={crumb.to} className="hover:text-gray-700 transition-colors">{crumb.label}</Link>}
              </span>
            ))}
          </nav>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1">
          {/* Search trigger */}
          <button
            onClick={onSearchClick}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors mr-1"
          >
            <Search size={13} />
            <span>Search...</span>
            <kbd className="text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200 font-mono ml-2">⌘K</kbd>
          </button>
          <button
            onClick={onSearchClick}
            className="sm:hidden w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors text-gray-500"
          >
            <Search size={16} />
          </button>

          {/* Bell */}
          <div ref={notifRef} className="relative">
            <button onClick={() => { setNotifOpen((p) => !p); setUserMenuOpen(false); }}
              className="relative w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors text-gray-500"
              aria-label="Notifications">
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-danger text-white text-[10px] font-semibold flex items-center justify-center leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-lg shadow-md z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-800">
                    Notifications
                    {unreadCount > 0 && (
                      <span className="ml-1.5 text-xs bg-danger text-white px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                    )}
                  </span>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs text-info hover:underline">Mark all as read</button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 size={18} className="animate-spin text-gray-300" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="py-8 text-center">
                      <Bell size={24} className="text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">No notifications yet</p>
                    </div>
                  ) : notifications.map((n) => (
                    <button key={n.id}
                      onClick={() => {
                        if (!n.isRead) markRead(n.id);
                        if (n.link) navigate(n.link);
                        setNotifOpen(false);
                      }}
                      className={cn(
                        'w-full text-left flex items-start gap-2.5 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors',
                        !n.isRead && 'bg-info/5',
                      )}>
                      <NotifIcon type={n.type} />
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm leading-tight', !n.isRead ? 'font-semibold text-gray-800' : 'text-gray-700')}>
                          {n.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <Clock size={10} /> {notifAge(n.createdAt)}
                        </p>
                      </div>
                      {!n.isRead && <span className="w-2 h-2 rounded-full bg-info flex-shrink-0 mt-1" />}
                    </button>
                  ))}
                </div>
                <Link
                  to={ROUTES.NOTIFICATIONS}
                  onClick={() => setNotifOpen(false)}
                  className="flex items-center justify-center gap-1.5 w-full py-2.5 text-xs font-medium text-navy hover:bg-gray-50 border-t border-gray-100 transition-colors"
                >
                  See all notifications <ArrowRight size={12} />
                </Link>
              </div>
            )}
          </div>

          {/* User menu */}
          <div ref={userMenuRef} className="relative ml-1">
            <button onClick={() => { setUserMenuOpen((p) => !p); setNotifOpen(false); }}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 transition-colors">
              <div className="w-7 h-7 rounded-full bg-navy flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 overflow-hidden">
                {user?.avatar
                  ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                  : getInitials(user?.fullName ?? '?')}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-gray-800 leading-tight">{user?.fullName ?? '—'}</p>
                <p className="text-xs text-gray-400 leading-tight">{user?.role?.name ?? ''}</p>
              </div>
              <ChevronDown size={14} className="text-gray-400 ml-1" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-11 w-56 bg-white border border-gray-200 rounded-lg shadow-md z-50 py-1">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-800 leading-tight">{user?.fullName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{user?.email}</p>
                </div>

                <Link to={ROUTES.PROFILE}
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <User size={15} className="text-gray-400" />
                  My Profile
                </Link>

                <button onClick={() => { setUserMenuOpen(false); setChangePwOpen(true); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <KeyRound size={15} className="text-gray-400" />
                  Change Password
                </button>

                <div className="border-t border-gray-100 mt-1 pt-1">
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-danger hover:bg-danger/10 transition-colors">
                    <LogOut size={15} />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <ChangePasswordModal open={changePwOpen} onClose={() => setChangePwOpen(false)} />
    </>
  );
}

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}
