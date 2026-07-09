import { NavLink, useLocation } from 'react-router-dom';
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
  label: string;
  icon: React.ElementType;
  color: string;
  adminOnly?: boolean;
  disabled?: boolean;
  disabledLabel?: string;
}

const MODULES: Module[] = [
  { id: 'internal',     label: 'Internal',     icon: LayoutDashboard, color: 'text-blue-300'  },
  { id: 'work-orders',  label: 'Work Orders',  icon: Wrench,          color: 'text-orange-300' },
  { id: 'hris',         label: 'HRIS',         icon: HardHat,         color: 'text-green-300' },
  { id: 'admin',        label: 'Admin',        icon: UserCog,         color: 'text-purple-300', adminOnly: true },
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

  const internalNav: NavItem[] = [
    { label: 'Dashboard',     to: ROUTES.DASHBOARD,     icon: LayoutDashboard },
    { label: 'Tasks',         to: ROUTES.TASKS,         icon: CheckSquare2    },
    { label: 'Bulletin',      to: ROUTES.BULLETIN,      icon: Bell            },
    { label: 'Notifications', to: ROUTES.NOTIFICATIONS, icon: Inbox           },
    { label: 'Notes',         to: ROUTES.NOTES,         icon: StickyNote      },
    { label: 'DB Links',      to: ROUTES.DATABASE,      icon: Database        },
    ...(canAnalytics ? [{ label: 'Analytics', to: ROUTES.ANALYTICS, icon: BarChart3 }] : []),
  ];

  // Same everyday/Administration split as HRIS: one visual rule app-wide —
  // what you see is what you may access, and admin tooling sits under a label.
  const canWorkOrderReports = perms.work_order?.view !== 'own';
  const workOrderNav: NavSection[] = [
    {
      label: null,
      items: [
        { label: 'Work Orders', to: ROUTES.WORK_ORDERS,         icon: Wrench  },
        { label: 'History',     to: ROUTES.WORK_ORDERS_HISTORY, icon: Archive },
      ],
    },
    ...(canWorkOrderReports ? [{
      label: 'Administration',
      items: [{ label: 'Reports', to: ROUTES.WORK_ORDERS_REPORTS, icon: BarChart3 }],
    }] : []),
  ];

  // Everyday HRIS items for everyone; management tooling in its own
  // labelled section so daily use and configuration don't blend together.
  const hrisAdminItems: NavItem[] = [
    ...(canReports ? [{ label: 'Reports', to: ROUTES.HRIS_REPORTS, icon: BarChart3 }] : []),
    ...(isHRAdmin ? [
      { label: 'Shifts',    to: ROUTES.HRIS_ADMIN_SHIFTS,    icon: CalendarClock },
      { label: 'Locations', to: ROUTES.HRIS_ADMIN_LOCATIONS, icon: MapPin        },
      { label: 'Holidays',  to: ROUTES.HRIS_ADMIN_HOLIDAYS,  icon: CalendarOff   },
    ] : []),
  ];
  const hrisNav: NavSection[] = [
    {
      label: null,
      items: [
        { label: 'Overview',   to: ROUTES.HRIS,            icon: HardHat       },
        { label: 'Attendance', to: ROUTES.HRIS_ATTENDANCE, icon: Clock         },
        { label: 'Leave',      to: ROUTES.HRIS_LEAVE,      icon: CalendarRange },
        { label: 'Requests',   to: ROUTES.HRIS_REQUESTS,   icon: ClipboardEdit },
      ],
    },
    ...(hrisAdminItems.length > 0 ? [{ label: 'Administration', items: hrisAdminItems }] : []),
  ];

  const adminNav: NavItem[] = [
    { label: 'Manage Users',        to: ROUTES.ADMIN_USERS,       icon: Users         },
    { label: 'Roles & Permissions', to: ROUTES.ADMIN_PERMISSIONS, icon: Shield        },
    { label: 'Audit Log',           to: ROUTES.ADMIN_AUDIT_LOG,   icon: ClipboardList },
  ];

  const navSections: NavSection[] =
    activeModule === 'work-orders' ? workOrderNav :
    activeModule === 'hris'        ? hrisNav :
    activeModule === 'admin'       ? [{ label: null, items: adminNav }] :
    [{ label: null, items: internalNav }];

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

      {/* Module switcher */}
      <div className={cn(
        'flex-shrink-0 border-b border-white/10',
        open ? 'px-2 py-2' : 'px-1 py-2',
      )}>
        {open && (
          <p className="px-2 mb-1.5 text-[10px] font-semibold text-white/30 uppercase tracking-wider">
            Module
          </p>
        )}
        <div className={cn('flex gap-1', open ? 'flex-col' : 'flex-col items-center')}>
          {visibleModules.map((mod) => {
            const Icon = mod.icon;
            const isActive = activeModule === mod.id;

            if (mod.disabled) {
              return (
                <div
                  key={mod.id}
                  title={open ? undefined : `${mod.label} (${mod.disabledLabel})`}
                  className={cn(
                    'flex items-center gap-2.5 px-2 py-1.5 rounded text-sm cursor-not-allowed opacity-40',
                    !open && 'justify-center px-0 w-10',
                  )}
                >
                  <Icon size={17} className="text-white/40 flex-shrink-0" />
                  {open && (
                    <span className="flex-1 text-white/40 truncate">{mod.label}</span>
                  )}
                  {open && mod.disabledLabel && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-white/10 text-white/40 font-medium">
                      {mod.disabledLabel}
                    </span>
                  )}
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
                title={!open ? mod.label : undefined}
                className={cn(
                  'flex items-center gap-2.5 px-2 py-1.5 rounded text-sm transition-colors duration-150',
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:text-white hover:bg-white/5',
                  !open && 'justify-center px-0 w-10',
                )}
              >
                <Icon size={17} className={cn('flex-shrink-0', isActive ? mod.color : '')} />
                {open && <span className="flex-1 truncate">{mod.label}</span>}
                {open && isActive && (
                  <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', mod.color.replace('text-', 'bg-'))} />
                )}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Module nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-0.5 px-2">
        {open && (
          <p className="px-2 mb-1 text-[10px] font-semibold text-white/30 uppercase tracking-wider">
            {activeModule === 'work-orders' ? 'Work Orders' :
             activeModule === 'hris'        ? 'HRIS' :
             activeModule === 'admin'       ? 'Admin' : 'Menu'}
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
        aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
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
