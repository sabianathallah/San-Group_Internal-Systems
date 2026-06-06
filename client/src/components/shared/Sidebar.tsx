import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare2,
  Bell,
  StickyNote,
  Database,
  Users,
  Shield,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useUiStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/cn';

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
}

const mainNav: NavItem[] = [
  { label: 'Dashboard',   to: ROUTES.DASHBOARD, icon: LayoutDashboard },
  { label: 'Tasks',       to: ROUTES.TASKS,     icon: CheckSquare2    },
  { label: 'Bulletin',    to: ROUTES.BULLETIN,  icon: Bell            },
  { label: 'Notes',       to: ROUTES.NOTES,     icon: StickyNote      },
  { label: 'DB Links',    to: ROUTES.DATABASE,  icon: Database        },
];

const adminNav: NavItem[] = [
  { label: 'Manage Users',    to: ROUTES.ADMIN_USERS,      icon: Users  },
  { label: 'Divisions',       to: ROUTES.ADMIN_DIVISIONS,  icon: Layers },
  { label: 'Roles',           to: ROUTES.ADMIN_ROLES,      icon: Shield },
];

export default function Sidebar() {
  const open   = useUiStore((s) => s.sidebarOpen);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const user   = useAuthStore((s) => s.user);

  const isAdmin = (user?.role?.level ?? 99) <= 2;

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
          <img
            src="/logo-san.png"
            alt="SAN Group"
            className="h-12 w-auto object-contain mix-blend-screen invert"
          />
        ) : (
          <img
            src="/logo-san.png"
            alt="SAN Group"
            className="w-10 h-10 object-contain mix-blend-screen invert"
          />
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-0.5 px-2">
        {open && (
          <p className="px-2 mb-1 text-xs font-semibold text-white/40 uppercase tracking-wider">
            Menu
          </p>
        )}

        {mainNav.map((item) => (
          <SidebarLink key={item.to} item={item} open={open} />
        ))}

        {isAdmin && (
          <>
            <div className="mt-3 mb-1 border-t border-white/10" />
            {open && (
              <p className="px-2 mb-1 text-xs font-semibold text-white/40 uppercase tracking-wider">
                Admin
              </p>
            )}
            {adminNav.map((item) => (
              <SidebarLink key={item.to} item={item} open={open} />
            ))}
          </>
        )}
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
                <p className="text-white text-sm font-medium truncate leading-tight">
                  {user.fullName}
                </p>
                <p className="text-white/50 text-xs truncate leading-tight mt-0.5">
                  {user.role?.name ?? ''}
                </p>
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
        {open ? (
          <ChevronLeft size={14} className="text-white" />
        ) : (
          <ChevronRight size={14} className="text-white" />
        )}
      </button>
    </aside>
  );
}

function SidebarLink({ item, open }: { item: NavItem; open: boolean }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
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
      <Icon size={20} className="flex-shrink-0" />
      {open && <span className="truncate">{item.label}</span>}
    </NavLink>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
