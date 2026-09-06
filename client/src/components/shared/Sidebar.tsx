import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  CheckSquare2,
  Bell,
  StickyNote,
  Database,
  Users,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  ClipboardList,
  Inbox,
  Shield,
  Wrench,
  HardHat,
  UserCog,
  Clock,
  CalendarRange,
  MapPin,
  CalendarClock,
  CalendarOff,
  ClipboardEdit,
  Archive,
} from 'lucide-react';
import { useUiStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { usePermStore } from '@/stores/permStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/cn';

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
  badge?: number;
  disabled?: boolean;
}

// A titled group of nav items. Everyday items live in an untitled section;
// admin/config items get their own labelled section so the two don't blend
// into one long flat list (matters for HR admins who see both).
interface NavSection {
  label: string | null;
  items: NavItem[];
}

type ModuleId = 'internal' | 'work-orders' | 'hris' | 'admin';

interface Module {
  id: ModuleId;
  icon: React.ElementType;
  color: string;
  adminOnly?: boolean;
  disabled?: boolean;
  disabledLabel?: string;
}

const MODULES: Module[] = [
  { id: 'internal',     icon: LayoutDashboard, color: 'text-blue-300'  },
  { id: 'work-orders',  icon: Wrench,          color: 'text-orange-300' },
  { id: 'hris',         icon: HardHat,         color: 'text-green-300' },
  { id: 'admin',        icon: UserCog,         color: 'text-purple-300', adminOnly: true },
];

/** Derive active module from current pathname */
function useActiveModule(): ModuleId {
  const { pathname } = useLocation();
  if (pathname.startsWith('/work-orders')) return 'work-orders';
  if (pathname.startsWith('/hris'))        return 'hris';
  if (pathname.startsWith('/admin'))       return 'admin';
  return 'internal';
}

export default function Sidebar() {
  const { t } = useTranslation();
  const open   = useUiStore((s) => s.sidebarOpen);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const user   = useAuthStore((s) => s.user);
  const perms  = usePermStore((s) => s.perms);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const roleLevel    = user?.role?.level ?? 99;
  const isAdmin      = roleLevel <= 2;
  const canAnalytics = perms.analytics?.view !== 'none';
  const canReports   = perms.hris?.viewReports !== 'none';
  const isHRAdmin    = perms.hris?.manageShifts || perms.hris?.manageLocations;
  const activeModule = useActiveModule();

  const MODULE_LABELS: Record<ModuleId, string> = {
    'internal':    t('shared.sidebar.modules.internal'),
    'work-orders': t('shared.sidebar.modules.workOrders'),
    'hris':        t('shared.sidebar.modules.hris'),
    'admin':       t('shared.sidebar.modules.admin'),
  };

  const internalNav: NavSection[] = [
    {
      label: null,
      items: [
        { label: t('shared.sidebar.nav.dashboard'),     to: ROUTES.DASHBOARD,     icon: LayoutDashboard },
        { label: t('shared.sidebar.nav.tasks'),         to: ROUTES.TASKS,         icon: CheckSquare2    },
        { label: t('shared.sidebar.nav.bulletin'),      to: ROUTES.BULLETIN,      icon: Bell            },
        { label: t('shared.sidebar.nav.notifications'), to: ROUTES.NOTIFICATIONS, icon: Inbox           },
        { label: t('shared.sidebar.nav.notes'),         to: ROUTES.NOTES,         icon: StickyNote      },
        { label: t('shared.sidebar.nav.dbLinks'),       to: ROUTES.DATABASE,      icon: Database        },
      ],
    },
    ...(canAnalytics ? [{
      label: t('shared.sidebar.sections.administration'),
      items: [{ label: t('shared.sidebar.nav.analytics'), to: ROUTES.ANALYTICS, icon: BarChart3 }],
    }] : []),
  ];

  // Same everyday/Administration split as HRIS: one visual rule app-wide —
  // what you see is what you may access, and admin tooling sits under a label.
  const canWorkOrderReports = perms.work_order?.view !== 'own';
  const workOrderNav: NavSection[] = [
    {
      label: null,
      items: [
        { label: t('shared.sidebar.nav.workOrders'), to: ROUTES.WORK_ORDERS,         icon: Wrench  },
        { label: t('shared.sidebar.nav.history'),    to: ROUTES.WORK_ORDERS_HISTORY, icon: Archive },
      ],
    },
    ...(canWorkOrderReports ? [{
      label: t('shared.sidebar.sections.administration'),
      items: [{ label: t('shared.sidebar.nav.reports'), to: ROUTES.WORK_ORDERS_REPORTS, icon: BarChart3 }],
    }] : []),
  ];

  // Everyday HRIS items for everyone; management tooling in its own
  // labelled section so daily use and configuration don't blend together.
  const hrisAdminItems: NavItem[] = [
    ...(canReports ? [{ label: t('shared.sidebar.nav.reports'), to: ROUTES.HRIS_REPORTS, icon: BarChart3 }] : []),
    ...(isHRAdmin ? [
      { label: t('shared.sidebar.nav.shifts'),     to: ROUTES.HRIS_ADMIN_SHIFTS,      icon: CalendarClock },
      { label: t('shared.sidebar.nav.locations'),  to: ROUTES.HRIS_ADMIN_LOCATIONS,   icon: MapPin        },
      { label: t('shared.sidebar.nav.holidays'),   to: ROUTES.HRIS_ADMIN_HOLIDAYS,    icon: CalendarOff   },
      { label: t('shared.sidebar.nav.leaveTypes'), to: ROUTES.HRIS_ADMIN_LEAVE_TYPES, icon: CalendarRange },
    ] : []),
  ];
  const hrisNav: NavSection[] = [
    {
      label: null,
      items: [
        { label: t('shared.sidebar.nav.overview'),   to: ROUTES.HRIS,            icon: HardHat       },
        { label: t('shared.sidebar.nav.attendance'), to: ROUTES.HRIS_ATTENDANCE, icon: Clock         },
        { label: t('shared.sidebar.nav.leave'),      to: ROUTES.HRIS_LEAVE,      icon: CalendarRange },
        { label: t('shared.sidebar.nav.requests'),   to: ROUTES.HRIS_REQUESTS,   icon: ClipboardEdit },
      ],
    },
    ...(hrisAdminItems.length > 0 ? [{ label: t('shared.sidebar.sections.administration'), items: hrisAdminItems }] : []),
  ];

  // Management (things you change) vs Monitoring (things you inspect).
  const adminNav: NavSection[] = [
    {
      label: null,
      items: [
        { label: t('shared.sidebar.nav.manageUsers'),       to: ROUTES.ADMIN_USERS,       icon: Users  },
        { label: t('shared.sidebar.nav.rolesPermissions'),  to: ROUTES.ADMIN_PERMISSIONS, icon: Shield },
      ],
    },
    {
      label: t('shared.sidebar.sections.monitoring'),
      items: [{ label: t('shared.sidebar.nav.auditLog'), to: ROUTES.ADMIN_AUDIT_LOG, icon: ClipboardList }],
    },
  ];

  const navSections: NavSection[] =
    activeModule === 'work-orders' ? workOrderNav :
    activeModule === 'hris'        ? hrisNav :
    activeModule === 'admin'       ? adminNav :
    internalNav;

  const visibleModules = MODULES.filter((m) => !m.adminOnly || isAdmin);

  return (
    <aside
      className={cn(
        'relative flex flex-col flex-shrink-0 h-screen bg-navy transition-[width] duration-200 ease-in-out z-20',
        open ? 'w-sidebar' : 'w-sidebar-collapsed',
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-header px-3 border-b border-white/10 flex-shrink-0">
        {open ? (
          <img src="/logo-san.png" alt="SAN Group" className="h-12 w-auto object-contain mix-blend-screen invert" />
        ) : (
          <img src="/logo-san.png" alt="SAN Group" className="w-10 h-10 object-contain mix-blend-screen invert" />
        )}
      </div>

      {/* Module switcher — a horizontal tab bar (open) so it reads as a
          distinct "level" from the vertical nav list below it, instead of
          just another stack of rows in the same direction. */}
      <div className={cn(
        'flex-shrink-0 border-b border-white/10 bg-black/15',
        open ? 'px-2 py-2' : 'px-1 py-2',
      )}>
        <div className={cn('flex gap-1', open ? 'items-stretch' : 'flex-col items-center')}>
          {visibleModules.map((mod) => {
            const Icon = mod.icon;
            const isActive = activeModule === mod.id;

            if (mod.disabled) {
              return (
                <div
                  key={mod.id}
                  title={`${MODULE_LABELS[mod.id]} (${mod.disabledLabel})`}
                  className={cn(
                    'flex items-center justify-center cursor-not-allowed opacity-40',
                    open ? 'flex-1 flex-col gap-1 py-2 rounded-lg' : 'px-0 w-10 py-1.5 rounded',
                  )}
                >
                  <Icon size={16} className="text-white/40 flex-shrink-0" />
                  {open && <span className="text-[9px] text-white/40 truncate">{MODULE_LABELS[mod.id]}</span>}
                </div>
              );
            }

            return (
              <NavLink
                key={mod.id}
                to={
                  mod.id === 'internal'    ? ROUTES.DASHBOARD   :
                  mod.id === 'work-orders' ? ROUTES.WORK_ORDERS :
                  mod.id === 'hris'        ? ROUTES.HRIS :
                  mod.id === 'admin'       ? ROUTES.ADMIN_USERS :
                  ROUTES.DASHBOARD
                }
                title={MODULE_LABELS[mod.id]}
                className={cn(
                  'flex items-center justify-center transition-colors duration-150',
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:text-white hover:bg-white/5',
                  open ? 'flex-1 flex-col gap-1 py-2 rounded-lg' : 'px-0 w-10 py-1.5 rounded',
                )}
              >
                <Icon size={16} className={cn('flex-shrink-0', isActive ? mod.color : '')} />
                {open && <span className="text-[9px] font-medium truncate">{MODULE_LABELS[mod.id]}</span>}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Module nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-0.5 px-2">
        {open && (
          <p className="px-2 mb-1 text-[10px] font-semibold text-white/30 uppercase tracking-wider">
            {activeModule === 'work-orders' ? MODULE_LABELS['work-orders'] :
             activeModule === 'hris'        ? MODULE_LABELS['hris'] :
             activeModule === 'admin'       ? MODULE_LABELS['admin'] : t('shared.sidebar.sections.menu')}
          </p>
        )}

        {navSections.map((section, idx) => (
          <div key={section.label ?? idx}>
            {idx > 0 && (
              open && section.label ? (
                <p className="px-2 mt-4 mb-1 text-[10px] font-semibold text-white/30 uppercase tracking-wider">
                  {section.label}
                </p>
              ) : (
                <div className="my-3 mx-2 border-t border-white/10" />
              )
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarLink
                  key={item.to}
                  item={item}
                  open={open}
                  badge={item.to === ROUTES.NOTIFICATIONS && unreadCount > 0 ? unreadCount : undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User info */}
      {user && (
        <div className="flex-shrink-0 border-t border-white/10 p-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-navy-light flex items-center justify-center text-white text-xs font-semibold">
              {getInitials(user.fullName)}
            </div>
            {open && (
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate leading-tight">{user.fullName}</p>
                <p className="text-white/50 text-xs truncate leading-tight mt-0.5">{user.role?.name ?? ''}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={toggle}
        className="absolute -right-3.5 top-[68px] w-7 h-7 rounded-full bg-navy-light border-2 border-navy flex items-center justify-center shadow-md hover:bg-navy-lighter transition-colors z-10"
        aria-label={open ? t('shared.sidebar.collapseSidebar') : t('shared.sidebar.expandSidebar')}
      >
        {open ? <ChevronLeft size={14} className="text-white" /> : <ChevronRight size={14} className="text-white" />}
      </button>
    </aside>
  );
}

function SidebarLink({ item, open, badge }: { item: NavItem; open: boolean; badge?: number }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      // NavLink matches by path prefix by default, so without `end` a parent
      // route (e.g. /work-orders, /hris) stays highlighted on every sibling
      // sub-route (/work-orders/history, /hris/attendance, ...). Each nav item
      // here is a distinct page, not a nested layout, so exact matching is correct.
      end
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-2 py-2 rounded text-sm transition-colors duration-150',
          isActive
            ? 'nav-item-active text-white'
            : 'text-white/70 hover:text-white hover:bg-white/5',
          !open && 'justify-center px-0',
        )
      }
      title={!open ? item.label : undefined}
    >
      <div className="relative flex-shrink-0">
        <Icon size={20} />
        {badge !== undefined && !open && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      {open && <span className="truncate flex-1">{item.label}</span>}
      {open && badge !== undefined && (
        <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  );
}

function getInitials(name?: string): string {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}
