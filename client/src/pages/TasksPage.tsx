import {
  useEffect, useState, useRef, useCallback, FormEvent, KeyboardEvent, useMemo,
} from 'react';
import {
  Sun, Star, ClipboardList, CalendarDays, LayoutList, Users, Table2,
  FolderOpen, Building2,
  Plus, Search, X, ChevronDown, ChevronRight,
  Circle, CheckCircle2, Clock,
  AlertCircle, Calendar, User, Loader2, Trash2, FileText,
  ChevronsRight, GripVertical, ChevronLeft, Columns3,
  Filter, SortDesc, Lock, Link2, ExternalLink, MessageSquare,
  Check, XCircle, Eye, EyeOff, Download, Lightbulb, Globe,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { usePermStore } from '@/stores/permStore';
import { toast } from '@/stores/toastStore';
import { isInMyDay, localToday } from '@/stores/taskStore';
import { cn } from '@/lib/cn';
import { PageSizeSelect } from '@/components/shared/PageSizeSelect';

// ── Types ──────────────────────────────────────────────────
type AssignmentStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';
type TaskStatus       = 'TODO' | 'IN_PROGRESS' | 'DONE';
type TaskPriority     = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type TaskVisibility   = 'PRIVATE' | 'DIVISION' | 'DIVISION_SELECT' | 'PUBLIC';
type ViewMode         = 'list' | 'board' | 'calendar' | 'table';
type SidebarView      = 'my_day' | 'important' | 'planned' | 'assigned' | 'my_tasks' | 'completed' | 'browse' | 'team' | `list:${string}`;
type BrowseMode       = 'staff' | 'division';
type GroupBy          = 'status' | 'priority' | 'assignee';
type SortBy           = 'created' | 'due_date' | 'priority' | 'alpha';

const PRIORITY_RANK: Record<TaskPriority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

interface TaskUser { id: string; fullName: string; avatar: string | null }
interface TaskLink { id: string; url: string; title: string | null; createdAt: string }
interface Comment   { id: string; content: string; createdAt: string; user: TaskUser }

interface ListMembership {
  userId: string;
  listId: string;
  taskList: { id: string; name: string; color: string };
}

// Human duration for the task detail panel ("2d 4h", "35m").
function fmtElapsed(ms: number): string {
  const mins = Math.max(1, Math.round(ms / 60000));
  const days = Math.floor(mins / 1440);
  const hrs  = Math.floor((mins % 1440) / 60);
  if (days > 0) return hrs > 0 ? `${days}d ${hrs}h` : `${days}d`;
  if (hrs > 0)  return `${hrs}h`;
  return `${mins}m`;
}

interface Task {
  id: string; title: string; description: string | null;
  status: TaskStatus; priority: TaskPriority;
  isImportant: boolean; myDayDate: string | null;
  dueDate: string | null; startedAt: string | null; completedAt: string | null;
  isPrivate?: boolean; visibility: TaskVisibility;
  assignmentStatus: AssignmentStatus | null; assignmentNote: string | null;
  position: number; createdAt: string; updatedAt: string;
  creator: TaskUser; assignee: TaskUser | null;
  taskList: { id: string; name: string; color: string } | null;
  listMemberships?: ListMembership[];
  links: TaskLink[];
  _count: { subTasks: number; attachments: number; comments: number };
  divisionAccess?: DivisionAccess[];
  subTasks?: Task[];
}

interface TaskList {
  id: string; name: string; color: string; icon: string | null;
  _count?: { tasks: number; memberships: number };
}

interface TeamList {
  id: string; name: string; color: string; icon: string | null;
  user: { id: string; fullName: string; avatar: string | null };
  _count?: { tasks: number };
}

interface UserOption { id: string; fullName: string; avatar: string | null }

interface DivisionAccess { divisionId: string; division: { id: string; name: string; color: string } }

interface Division {
  id: string; name: string; color: string; description?: string | null;
  _count?: { members: number };
}

// ── Active filter state ────────────────────────────────────
interface FilterState {
  statuses:   TaskStatus[];
  priorities: TaskPriority[];
  assigneeId: string;
  hasDueDate: boolean;
  overdueOnly: boolean;
}

const EMPTY_FILTER: FilterState = {
  statuses: [], priorities: [], assigneeId: '', hasDueDate: false, overdueOnly: false,
};

// ── Constants ──────────────────────────────────────────────
const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  TODO:        { label: 'To Do',       icon: Circle,       color: 'text-gray-400',  bg: 'bg-gray-100'  },
  IN_PROGRESS: { label: 'In Progress', icon: Clock,        color: 'text-blue-500',  bg: 'bg-blue-50'   },
  DONE:        { label: 'Done',        icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50'  },
};

function displayStatus(task: { status: TaskStatus; assignmentStatus: AssignmentStatus | null }) {
  if (task.assignmentStatus === 'PENDING')
    return { label: 'Waiting for Confirmation', color: 'text-amber-600', bg: 'bg-amber-50' };
  return STATUS_CONFIG[task.status];
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; dot: string; border: string }> = {
  URGENT: { label: 'Urgent', color: 'text-red-500',    dot: 'bg-red-500',    border: 'border-l-red-400'    },
  HIGH:   { label: 'High',   color: 'text-orange-500', dot: 'bg-orange-500', border: 'border-l-orange-400' },
  MEDIUM: { label: 'Medium', color: 'text-blue-500',   dot: 'bg-blue-400',   border: 'border-l-blue-400'   },
  LOW:    { label: 'Low',    color: 'text-gray-400',   dot: 'bg-gray-300',   border: 'border-l-gray-200'   },
};

const VIEW_LABELS: Record<string, string> = {
  my_day: 'My Day', important: 'Important', planned: 'Planned',
  assigned: 'Assigned to Me', my_tasks: 'My Tasks', completed: 'Completed',
  browse: 'All Tasks', team: 'Team Tasks',
};

const VISIBILITY_CONFIG: Record<TaskVisibility, { label: string; icon: React.ElementType }> = {
  PRIVATE:          { label: 'Only Me',         icon: Lock      },
  DIVISION:         { label: 'My Division',     icon: Users     },
  DIVISION_SELECT:  { label: 'Select Divisions',icon: Building2 },
  PUBLIC:           { label: 'All Staff',       icon: Globe     },
};

// ── Markdown renderer ──────────────────────────────────────
function renderMarkdown(text: string): string {
  if (!text) return '';
  const html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // headings
    .replace(/^### (.+)$/gm, '<h3 style="font-size:1em;font-weight:700;margin:6px 0 2px">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 style="font-size:1.1em;font-weight:700;margin:8px 0 2px">$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1 style="font-size:1.2em;font-weight:700;margin:10px 0 2px">$1</h1>')
    // bold / italic / code
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g,   '<em>$1</em>')
    .replace(/`(.+?)`/g,     '<code style="background:#f1f5f9;padding:1px 4px;border-radius:3px;font-size:.85em">$1</code>')
    // links — only http(s) URLs, block javascript:/data: schemes
    .replace(/\[(.+?)\]\((.+?)\)/g, (_, label: string, url: string) =>
      /^https?:\/\//i.test(url)
        ? `<a href="${encodeURI(url)}" target="_blank" rel="noopener noreferrer" style="color:#3b82f6;text-decoration:underline">${label}</a>`
        : label)
    // list items
    .replace(/^[-*] (.+)$/gm, '<li style="margin-left:16px;list-style:disc">$1</li>')
    // line breaks
    .replace(/\n/g, '<br>');
  return html;
}

// ── Helpers ────────────────────────────────────────────────
function fmtDue(iso: string | null): { text: string; overdue: boolean } {
  if (!iso) return { text: '', overdue: false };
  const d = new Date(iso), now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
  if (diff < 0)   return { text: `${Math.abs(diff)}d ago`, overdue: true };
  if (diff === 0) return { text: 'Today', overdue: false };
  if (diff === 1) return { text: 'Tomorrow', overdue: false };
  return { text: d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }), overdue: false };
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function toLocalISO(d: string) { return `${d}T00:00:00+07:00`; }

function extractErr(err: unknown): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'An error occurred';
}

/** Click cycle: To Do → In Progress → Done → To Do */
function cycleStatus(s: TaskStatus): TaskStatus {
  return s === 'TODO' ? 'IN_PROGRESS' : s === 'IN_PROGRESS' ? 'DONE' : 'TODO';
}

// ── Atom components ────────────────────────────────────────
function Avatar({ name, avatar, size = 24 }: { name: string; avatar?: string | null; size?: number }) {
  if (avatar) return <img src={avatar} alt={name} className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />;
  return (
    <div className="rounded-full bg-navy flex items-center justify-center text-white font-semibold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials(name)}
    </div>
  );
}

function PriorityDot({ priority }: { priority: TaskPriority }) {
  return <span className={cn('inline-block w-2 h-2 rounded-full flex-shrink-0', PRIORITY_CONFIG[priority].dot)} />;
}

function AssignBadge({ status }: { status: AssignmentStatus }) {
  if (status === 'PENDING') return null;
  return (
    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0', {
      'bg-green-100 text-green-700': status === 'ACCEPTED',
      'bg-red-100   text-red-600':   status === 'REJECTED',
    })}>
      {status === 'ACCEPTED' ? 'Accepted' : 'Rejected'}
    </span>
  );
}

// ── Tasks Sidebar ──────────────────────────────────────────
function TasksSidebar({
  active, onSelect, taskLists, pendingCount, canSeeTeam, onNewList, loadingLists,
}: {
  active: SidebarView; onSelect: (v: SidebarView) => void;
  taskLists: TaskList[]; pendingCount: number; canSeeTeam: boolean;
  onNewList: () => void; loadingLists: boolean;
}) {
  type Item = { id: SidebarView; icon: React.ElementType; label: string; badge?: number };
  const personalItems: Item[] = [
    { id: 'my_day',    icon: Sun,           label: 'My Day'                              },
    { id: 'important', icon: Star,          label: 'Important'                           },
    { id: 'planned',   icon: CalendarDays,  label: 'Planned'                             },
    { id: 'assigned',  icon: ClipboardList, label: 'Assigned to Me', badge: pendingCount },
    { id: 'my_tasks',  icon: LayoutList,    label: 'My Tasks'                            },
    { id: 'completed', icon: CheckCircle2,  label: 'Completed'                           },
  ];
  const workspaceItems: Item[] = [
    { id: 'browse', icon: Globe, label: 'All Tasks' },
    ...(canSeeTeam ? [{ id: 'team' as SidebarView, icon: Users, label: 'Team Tasks' }] : []),
  ];

  const renderItem = ({ id, icon: Icon, label, badge }: Item) => (
    <button
      key={id}
      onClick={() => onSelect(id)}
      className={cn(
        'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors',
        active === id
          ? 'bg-navy/10 text-navy font-semibold'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
      )}
    >
      <Icon size={15} className="flex-shrink-0" />
      <span className="flex-1 text-left truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="w-52 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col h-full overflow-y-auto">
      <div className="px-4 pt-4 pb-1">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Personal</p>
      </div>
      <div className="px-3 pb-2 space-y-0.5">
        {personalItems.map(renderItem)}
      </div>

      <div className="px-4 pt-2 pb-1 border-t border-gray-100">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Workspace</p>
      </div>
      <div className="px-3 pb-2 space-y-0.5">
        {workspaceItems.map(renderItem)}
      </div>

      <div className="px-4 pt-2 pb-1 border-t border-gray-100">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Lists</p>
      </div>

      <div className="px-3 pb-2 flex-1 space-y-0.5 min-h-0">
        {loadingLists ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={14} className="animate-spin text-gray-300" />
          </div>
        ) : taskLists.map((list) => {
          const vid: SidebarView = `list:${list.id}`;
          return (
            <button
              key={list.id}
              onClick={() => onSelect(vid)}
              className={cn(
                'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors',
                active === vid
                  ? 'bg-navy/10 text-navy font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              )}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: list.color }} />
              <span className="flex-1 text-left truncate">{list.icon && `${list.icon} `}{list.name}</span>
              {((list._count?.tasks ?? 0) + (list._count?.memberships ?? 0)) > 0 && (
                <span className="text-[10px] text-gray-400">{(list._count?.tasks ?? 0) + (list._count?.memberships ?? 0)}</span>
              )}
            </button>
          );
        })}

        <button
          onClick={onNewList}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-navy hover:bg-gray-50 transition-colors"
        >
          <Plus size={13} /> New List
        </button>
      </div>
    </div>
  );
}

// ── Filter Panel ───────────────────────────────────────────
function FilterPanel({
  filters, onChange, users,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  users: UserOption[];
}) {
  function toggleStatus(s: TaskStatus) {
    onChange({
      ...filters,
      statuses: filters.statuses.includes(s)
        ? filters.statuses.filter((x) => x !== s)
        : [...filters.statuses, s],
    });
  }

  function togglePriority(p: TaskPriority) {
    onChange({
      ...filters,
      priorities: filters.priorities.includes(p)
        ? filters.priorities.filter((x) => x !== p)
        : [...filters.priorities, p],
    });
  }

  return (
    <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 flex flex-wrap items-start gap-4">
      {/* Status */}
      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Status</p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(STATUS_CONFIG) as [TaskStatus, (typeof STATUS_CONFIG)[TaskStatus]][]).map(([k, v]) => (
            <button
              key={k}
              onClick={() => toggleStatus(k)}
              className={cn(
                'flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors',
                filters.statuses.includes(k)
                  ? 'bg-navy text-white border-navy'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-navy',
              )}
            >
              <v.icon size={10} className={filters.statuses.includes(k) ? 'text-white' : v.color} />
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Priority */}
      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Priority</p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(PRIORITY_CONFIG) as [TaskPriority, (typeof PRIORITY_CONFIG)[TaskPriority]][]).map(([k, v]) => (
            <button
              key={k}
              onClick={() => togglePriority(k)}
              className={cn(
                'flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors',
                filters.priorities.includes(k)
                  ? 'bg-navy text-white border-navy'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-navy',
              )}
            >
              <span className={cn('w-1.5 h-1.5 rounded-full', filters.priorities.includes(k) ? 'bg-white' : v.dot)} />
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Assignee */}
      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Assignee</p>
        <select
          value={filters.assigneeId}
          onChange={(e) => onChange({ ...filters, assigneeId: e.target.value })}
          className="text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:border-navy bg-white"
        >
          <option value="">All</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </select>
      </div>

      {/* Toggles */}
      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Other</p>
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={filters.hasDueDate}
              onChange={(e) => onChange({ ...filters, hasDueDate: e.target.checked })}
              className="accent-navy" />
            Has due date
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={filters.overdueOnly}
              onChange={(e) => onChange({ ...filters, overdueOnly: e.target.checked })}
              className="accent-navy" />
            Overdue only
          </label>
        </div>
      </div>

      <button
        onClick={() => onChange(EMPTY_FILTER)}
        className="self-end ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
      >
        <X size={11} /> Clear all
      </button>
    </div>
  );
}

// ── Group helpers ──────────────────────────────────────────
function groupTasks(tasks: Task[], groupBy: GroupBy): { label: string; tasks: Task[]; key: string }[] {
  if (groupBy === 'priority') {
    return (['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as TaskPriority[]).map((p) => ({
      key: p,
      label: PRIORITY_CONFIG[p].label,
      tasks: tasks.filter((t) => t.priority === p),
    })).filter((g) => g.tasks.length > 0);
  }
  if (groupBy === 'assignee') {
    const byAssignee = new Map<string, { name: string; tasks: Task[] }>();
    byAssignee.set('__none', { name: 'Unassigned', tasks: [] });
    for (const t of tasks) {
      const key = t.assignee?.id ?? '__none';
      if (!byAssignee.has(key)) byAssignee.set(key, { name: t.assignee!.fullName, tasks: [] });
      byAssignee.get(key)!.tasks.push(t);
    }
    return Array.from(byAssignee.entries())
      .filter(([, v]) => v.tasks.length > 0)
      .map(([key, v]) => ({ key, label: v.name, tasks: v.tasks }));
  }
  // default: status
  return (['TODO', 'IN_PROGRESS', 'DONE'] as TaskStatus[]).map((s) => ({
    key: s,
    label: STATUS_CONFIG[s].label,
    tasks: tasks.filter((t) => t.status === s),
  }));
}

// ── List View ──────────────────────────────────────────────
function ListView({
  tasks, selectedId, onSelect, onToggle, onDelete, onCreated, onToggleMyDay, onToggleImportant,
  listId, showUser, groupBy, showDone, extraPayload,
}: {
  tasks: Task[]; selectedId: string | null; onSelect: (id: string) => void;
  onToggle: (t: Task) => void; onDelete: (id: string) => void; onCreated: (t: Task) => void;
  onToggleMyDay: (t: Task) => void; onToggleImportant: (t: Task) => void;
  listId?: string | null; showUser?: boolean; groupBy: GroupBy; showDone?: boolean;
  extraPayload?: Record<string, unknown>;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ DONE: true });
  const [addingTo,  setAddingTo]  = useState<string | null>(null);
  const [newTitle,  setNewTitle]  = useState('');
  const [adding,    setAdding]    = useState(false);

  const allDoneCount = tasks.filter((t) => t.status === 'DONE').length;
  const doneCount    = allDoneCount;
  const visibleTasks = (showDone === false) ? tasks.filter((t) => t.status !== 'DONE') : tasks;
  const progress     = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  const groups = groupTasks(visibleTasks, groupBy);

  async function quickAdd(status: string) {
    if (!newTitle.trim()) { setAddingTo(null); return; }
    setAdding(true);
    try {
      const payload: Record<string, unknown> = {
        title: newTitle.trim(),
        status: status === 'DONE' ? 'DONE' : status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'TODO',
        priority: 'MEDIUM',
        ...extraPayload,
      };
      if (listId) payload.listId = listId;
      const res = await api.post('/tasks', payload);
      onCreated(res.data.data);
      setNewTitle(''); setAddingTo(null);
    } catch (err) { toast.error(extractErr(err)); } finally { setAdding(false); }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {listId && tasks.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-100 bg-white flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-navy rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-gray-500 flex-shrink-0">{doneCount}/{tasks.length} done</span>
        </div>
      )}

      <div className="grid grid-cols-[1fr_110px_100px_80px] gap-2 px-4 py-2 border-b border-gray-100 sticky top-0 bg-white z-10">
        {['Title','Status','Priority','Due'].map((h) => (
          <div key={h} className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{h}</div>
        ))}
      </div>

      {groups.map((group) => {
        const isCollapsed = collapsed[group.key];
        const statusKey   = group.key as TaskStatus;
        const cfg         = STATUS_CONFIG[statusKey];
        const Icon        = cfg?.icon ?? Circle;

        return (
          <div key={group.key}>
            <button
              onClick={() => setCollapsed((c) => ({ ...c, [group.key]: !c[group.key] }))}
              className="flex items-center gap-2 w-full px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 text-left"
            >
              {isCollapsed ? <ChevronRight size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
              <Icon size={13} className={cfg?.color ?? 'text-gray-400'} />
              <span className="text-xs font-semibold text-gray-700">{group.label}</span>
              <span className="text-[10px] text-gray-400 ml-1">{group.tasks.length}</span>
            </button>

            {!isCollapsed && (
              <>
                {group.tasks.map((task) => (
                  <div key={task.id} className="group grid grid-cols-[1fr_110px_100px_80px] gap-2 items-center">
                    <div className={cn(
                      'flex items-center gap-2 px-4 py-2.5 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors border-l-2',
                      selectedId === task.id ? 'bg-navy/5 border-l-navy' : PRIORITY_CONFIG[task.priority].border,
                    )} onClick={() => onSelect(task.id)}>
                      <button onClick={(e) => { e.stopPropagation(); onToggle(task); }}
                        title="Click: To Do → In Progress → Done"
                        className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                          task.status === 'DONE' ? 'border-green-500 bg-green-500' :
                          task.status === 'IN_PROGRESS' ? 'border-blue-400' : 'border-gray-300 hover:border-navy',
                        )}>
                        {task.status === 'DONE' && <CheckCircle2 size={9} className="text-white" strokeWidth={3} />}
                        {task.status === 'IN_PROGRESS' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                      </button>
                      <span className={cn('text-sm truncate flex-1', task.status === 'DONE' && 'line-through text-gray-400')}>
                        {task.title}
                      </span>
                      {task.assignmentStatus && <AssignBadge status={task.assignmentStatus} />}
                      {(task._count.subTasks > 0 || task._count.comments > 0) && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                          {task._count.subTasks > 0 && <><GripVertical size={10} />{task._count.subTasks}</>}
                          {task._count.comments > 0 && <><MessageSquare size={10} />{task._count.comments}</>}
                        </span>
                      )}
                      {showUser && <p className="text-[10px] text-gray-400 truncate">{task.creator.fullName}</p>}
                      <button onClick={(e) => { e.stopPropagation(); onToggleMyDay(task); }}
                        title={isInMyDay(task) ? 'Remove from My Day' : 'Add to My Day'}
                        className={cn('flex-shrink-0 transition-colors', isInMyDay(task) ? 'text-amber-400' : 'text-gray-200 hover:text-amber-400')}>
                        <Sun size={12} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onToggleImportant(task); }}
                        title={task.isImportant ? 'Remove from Important' : 'Mark as important'}
                        className={cn('flex-shrink-0 transition-colors', task.isImportant ? 'text-yellow-400' : 'text-gray-200 hover:text-yellow-400')}>
                        <Star size={12} />
                      </button>
                    </div>
                    <div className="py-2.5 border-b border-gray-50">
                      {(() => { const ds = displayStatus(task); return <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', ds.bg, ds.color)}>{ds.label}</span>; })()}
                    </div>
                    <div className="flex items-center gap-1.5 py-2.5 border-b border-gray-50">
                      <PriorityDot priority={task.priority} />
                      <span className={cn('text-[11px]', PRIORITY_CONFIG[task.priority].color)}>{PRIORITY_CONFIG[task.priority].label}</span>
                    </div>
                    <div className="py-2.5 border-b border-gray-50 flex items-center justify-between pr-3">
                      {(() => { const d = fmtDue(task.dueDate); return d.text ? <span className={cn('text-[11px]', d.overdue ? 'text-red-500' : 'text-gray-400')}>{d.text}</span> : null; })()}
                      <button onClick={() => onDelete(task.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 ml-auto transition-opacity">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}

                {addingTo === group.key ? (
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-50 bg-blue-50/20">
                    <div className="w-4" />
                    <Circle size={14} className="text-gray-300" />
                    <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') quickAdd(group.key); if (e.key === 'Escape') { setAddingTo(null); setNewTitle(''); } }}
                      onBlur={() => { if (!newTitle.trim()) setAddingTo(null); }}
                      placeholder="New task title..."
                      className="flex-1 text-sm outline-none bg-transparent" />
                    {adding ? <Loader2 size={13} className="animate-spin text-gray-400" /> :
                      <button onClick={() => quickAdd(group.key)} className="text-[11px] text-white bg-navy px-2 py-0.5 rounded">OK</button>}
                  </div>
                ) : (
                  <button onClick={() => { setAddingTo(group.key); setNewTitle(''); }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-xs text-gray-400 hover:text-navy hover:bg-gray-50 transition-colors border-b border-gray-50">
                    <Plus size={12} /> Add task
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Board View ─────────────────────────────────────────────
function BoardCard({ task, selected, draggable, onSelect, onToggle, onDelete, onToggleMyDay, onToggleImportant, overlay }: {
  task: Task; selected: boolean; draggable: boolean;
  onSelect: (id: string) => void; onToggle: (t: Task) => void; onDelete: (id: string) => void;
  onToggleMyDay: (t: Task) => void; onToggleImportant: (t: Task) => void;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: overlay ? `overlay-${task.id}` : task.id, disabled: !draggable || overlay,
  });
  const due = fmtDue(task.dueDate);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(task.id)}
      style={transform && !overlay ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={cn('group bg-white rounded-lg border p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow border-l-2',
        selected ? 'border-navy ring-1 ring-navy/20' : `border-gray-200 ${PRIORITY_CONFIG[task.priority].border}`,
        isDragging && !overlay && 'opacity-40',
        overlay && 'shadow-xl rotate-2 cursor-grabbing',
        draggable && !overlay && 'touch-none')}
    >
      <div className="flex items-start gap-2 mb-2">
        <button onClick={(e) => { e.stopPropagation(); onToggle(task); }}
          title="Click: To Do → In Progress → Done"
          className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
            task.status === 'DONE' ? 'border-green-500 bg-green-500' :
            task.status === 'IN_PROGRESS' ? 'border-blue-400' : 'border-gray-300 hover:border-navy')}>
          {task.status === 'DONE' && <CheckCircle2 size={9} className="text-white" strokeWidth={3} />}
          {task.status === 'IN_PROGRESS' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
        </button>
        <p className={cn('flex-1 text-sm font-medium leading-snug', task.status === 'DONE' && 'line-through text-gray-400')}>
          {task.title}
        </p>
        <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400">
          <X size={12} />
        </button>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={cn('text-[10px] font-medium flex items-center gap-1', PRIORITY_CONFIG[task.priority].color)}>
          <PriorityDot priority={task.priority} />{PRIORITY_CONFIG[task.priority].label}
        </span>
        {due.text && <span className={cn('text-[10px] flex items-center gap-0.5', due.overdue ? 'text-red-500' : 'text-gray-400')}><Calendar size={9} />{due.text}</span>}
        {task.assignmentStatus && <AssignBadge status={task.assignmentStatus} />}
        {task.assignee && <div className="ml-auto"><Avatar name={task.assignee.fullName} avatar={task.assignee.avatar} size={18} /></div>}
        <button onClick={(e) => { e.stopPropagation(); onToggleMyDay(task); }}
          className={cn('transition-colors', isInMyDay(task) ? 'text-amber-400' : 'text-gray-200 hover:text-amber-400')}>
          <Sun size={11} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onToggleImportant(task); }}
          className={cn('transition-colors', task.isImportant ? 'text-yellow-400' : 'text-gray-200 hover:text-yellow-400')}>
          <Star size={11} />
        </button>
      </div>
    </div>
  );
}

function BoardColumn({ group, groupBy, children }: {
  group: { key: string; label: string; tasks: Task[] }; groupBy: GroupBy; children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: group.key, disabled: groupBy === 'assignee' });
  const statusKey = group.key as TaskStatus;
  const cfg  = groupBy === 'status' ? STATUS_CONFIG[statusKey] : undefined;
  const Icon = cfg?.icon ?? Circle;

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      <div className={cn('flex items-center gap-2 px-3 py-2 rounded-t-lg mb-2', cfg?.bg ?? 'bg-gray-100')}>
        <Icon size={13} className={cfg?.color ?? 'text-gray-400'} />
        <span className={cn('text-xs font-semibold', cfg?.color ?? 'text-gray-600')}>{group.label}</span>
        <span className="text-[10px] text-gray-400 ml-auto">{group.tasks.length}</span>
      </div>
      <div ref={setNodeRef}
        className={cn('flex-1 overflow-y-auto space-y-2 pb-2 rounded-lg transition-colors',
          isOver && 'bg-navy/5 ring-2 ring-navy/20')}>
        {children}
      </div>
    </div>
  );
}

function BoardView({ tasks, selectedId, onSelect, onToggle, onDelete, onCreated, onToggleMyDay, onToggleImportant, groupBy, onMove, extraPayload }: {
  tasks: Task[]; selectedId: string | null; onSelect: (id: string) => void;
  onToggle: (t: Task) => void; onDelete: (id: string) => void; onCreated: (t: Task) => void;
  onToggleMyDay: (t: Task) => void; onToggleImportant: (t: Task) => void;
  groupBy: GroupBy; onMove: (task: Task, groupKey: string) => void;
  extraPayload?: Record<string, unknown>;
}) {
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [adding,   setAdding]   = useState(false);
  const [dragTask, setDragTask] = useState<Task | null>(null);

  // Require a small movement before drag starts so plain clicks still select
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const groups = groupTasks(tasks, groupBy);
  const canDrag = groupBy !== 'assignee';

  function handleDragStart(e: DragStartEvent) {
    setDragTask(tasks.find((t) => t.id === e.active.id) ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setDragTask(null);
    const { active, over } = e;
    if (!over) return;
    const task = tasks.find((t) => t.id === active.id);
    if (!task) return;
    const sameGroup = groupBy === 'status' ? task.status === over.id : task.priority === over.id;
    if (sameGroup) return;
    onMove(task, String(over.id));
  }

  async function quickAdd(groupKey: string) {
    if (!newTitle.trim()) { setAddingTo(null); return; }
    setAdding(true);
    try {
      const payload: Record<string, unknown> = { title: newTitle.trim(), priority: 'MEDIUM', status: 'TODO', ...extraPayload };
      if (groupBy === 'status') {
        payload.status = groupKey as TaskStatus;
      } else if (groupBy === 'priority') {
        payload.priority = groupKey;
      }
      const res = await api.post('/tasks', payload);
      onCreated(res.data.data);
      setNewTitle(''); setAddingTo(null);
    } catch (err) { toast.error(extractErr(err)); } finally { setAdding(false); }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 h-full px-4 py-4 min-w-max">
          {groups.map((group) => (
            <BoardColumn key={group.key} group={group} groupBy={groupBy}>
              {group.tasks.map((task) => (
                <BoardCard key={task.id} task={task} selected={selectedId === task.id} draggable={canDrag}
                  onSelect={onSelect} onToggle={onToggle} onDelete={onDelete}
                  onToggleMyDay={onToggleMyDay} onToggleImportant={onToggleImportant} />
              ))}

              {addingTo === group.key ? (
                <div className="bg-white rounded-lg border border-navy/30 p-3 shadow-sm">
                  <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') quickAdd(group.key); if (e.key === 'Escape') { setAddingTo(null); setNewTitle(''); } }}
                    placeholder="Task title..." className="w-full text-sm outline-none placeholder:text-gray-300 mb-2" />
                  <div className="flex gap-1">
                    {adding ? <Loader2 size={13} className="animate-spin text-gray-400" /> :
                      <><button onClick={() => quickAdd(group.key)} className="text-[11px] text-white bg-navy px-2 py-1 rounded">OK</button>
                        <button onClick={() => { setAddingTo(null); setNewTitle(''); }} className="text-[11px] text-gray-500 px-2 py-1 rounded hover:bg-gray-100">Cancel</button></>}
                  </div>
                </div>
              ) : (
                <button onClick={() => { setAddingTo(group.key); setNewTitle(''); }}
                  className="flex items-center gap-1.5 w-full px-3 py-2 text-xs text-gray-400 hover:text-navy rounded-lg hover:bg-white border border-dashed border-gray-200 hover:border-navy transition-colors">
                  <Plus size={12} /> Add task
                </button>
              )}
            </BoardColumn>
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragTask && (
          <div className="w-72">
            <BoardCard task={dragTask} selected={false} draggable={false} overlay
              onSelect={() => {}} onToggle={() => {}} onDelete={() => {}}
              onToggleMyDay={() => {}} onToggleImportant={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

// ── Table View ─────────────────────────────────────────────
type SortCol = 'title' | 'status' | 'priority' | 'assignee' | 'dueDate' | 'taskList';

function TableView({ tasks, selectedId, onSelect, onToggle, onDelete }: {
  tasks: Task[]; selectedId: string | null; onSelect: (id: string) => void;
  onToggle: (t: Task) => void; onDelete: (id: string) => void;
}) {
  const [sortCol, setSortCol]   = useState<SortCol>('dueDate');
  const [sortAsc, setSortAsc]   = useState(true);

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortAsc((a) => !a);
    else { setSortCol(col); setSortAsc(true); }
  }

  const sorted = useMemo(() => {
    const dir = sortAsc ? 1 : -1;
    return [...tasks].sort((a, b) => {
      switch (sortCol) {
        case 'title':    return dir * a.title.localeCompare(b.title);
        case 'status':   return dir * a.status.localeCompare(b.status);
        case 'priority': {
          const pOrd: Record<TaskPriority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
          return dir * (pOrd[a.priority] - pOrd[b.priority]);
        }
        case 'assignee': return dir * ((a.assignee?.fullName ?? '').localeCompare(b.assignee?.fullName ?? ''));
        case 'dueDate':  return dir * ((a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
        case 'taskList': return dir * ((a.taskList?.name ?? '').localeCompare(b.taskList?.name ?? ''));
        default: return 0;
      }
    });
  }, [tasks, sortCol, sortAsc]);

  function Th({ col, children }: { col: SortCol; children: React.ReactNode }) {
    return (
      <th
        onClick={() => handleSort(col)}
        className="text-left px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-navy transition-colors"
      >
        <div className="flex items-center gap-1">
          {children}
          {sortCol === col && <SortDesc size={11} className={cn('flex-shrink-0', !sortAsc && 'rotate-180 transition-transform')} />}
        </div>
      </th>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 bg-white z-10 border-b border-gray-200">
          <tr>
            <th className="px-3 py-2.5 w-8" />
            <Th col="title">Title</Th>
            <Th col="status">Status</Th>
            <Th col="priority">Priority</Th>
            <Th col="assignee">Assignee</Th>
            <Th col="dueDate">Due Date</Th>
            <Th col="taskList">List</Th>
            <th className="px-3 py-2.5 w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sorted.map((task) => {
            const due = fmtDue(task.dueDate);
            const ds  = displayStatus(task);
            return (
              <tr
                key={task.id}
                onClick={() => onSelect(task.id)}
                className={cn(
                  'hover:bg-gray-50/60 transition-colors cursor-pointer',
                  selectedId === task.id && 'bg-navy/5',
                )}
              >
                {/* Checkbox */}
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onToggle(task)}
                    className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center',
                      task.status === 'DONE' ? 'border-green-500 bg-green-500' : 'border-gray-300 hover:border-navy',
                    )}
                  >
                    {task.status === 'DONE' && <CheckCircle2 size={9} className="text-white" strokeWidth={3} />}
                  </button>
                </td>

                {/* Title */}
                <td className="px-3 py-2.5 max-w-xs">
                  <span className={cn('truncate block', task.status === 'DONE' && 'line-through text-gray-400')}>
                    {task.title}
                  </span>
                </td>

                {/* Status */}
                <td className="px-3 py-2.5">
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', ds.bg, ds.color)}>{ds.label}</span>
                </td>

                {/* Priority */}
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <PriorityDot priority={task.priority} />
                    <span className={cn('text-[11px]', PRIORITY_CONFIG[task.priority].color)}>
                      {PRIORITY_CONFIG[task.priority].label}
                    </span>
                  </div>
                </td>

                {/* Assignee */}
                <td className="px-3 py-2.5">
                  {task.assignee ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar name={task.assignee.fullName} avatar={task.assignee.avatar} size={20} />
                      <span className="text-xs text-gray-600 truncate max-w-[100px]">{task.assignee.fullName}</span>
                    </div>
                  ) : <span className="text-xs text-gray-300">—</span>}
                </td>

                {/* Due date */}
                <td className="px-3 py-2.5">
                  {due.text ? (
                    <span className={cn('text-xs', due.overdue ? 'text-red-500 font-medium' : 'text-gray-500')}>
                      {due.overdue && '⚠ '}{due.text}
                    </span>
                  ) : <span className="text-xs text-gray-300">—</span>}
                </td>

                {/* Task list */}
                <td className="px-3 py-2.5">
                  {task.taskList ? (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white"
                      style={{ backgroundColor: task.taskList.color }}>
                      {task.taskList.name}
                    </span>
                  ) : <span className="text-xs text-gray-300">—</span>}
                </td>

                {/* Delete */}
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => onDelete(task.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <div className="flex items-center justify-center py-16 text-gray-400 text-sm">No tasks found</div>
      )}
    </div>
  );
}

// ── Calendar View ──────────────────────────────────────────
function CalendarChip({ task, onSelect }: { task: Task; onSelect: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <button ref={setNodeRef} {...listeners} {...attributes}
      onClick={() => onSelect(task.id)}
      className={cn('block w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate touch-none',
        isDragging && 'opacity-40',
        task.status === 'DONE' ? 'line-through text-gray-400 bg-gray-50' :
        cn('text-white font-medium', { 'bg-red-400': task.priority === 'URGENT', 'bg-orange-400': task.priority === 'HIGH', 'bg-blue-400': task.priority === 'MEDIUM', 'bg-gray-400': task.priority === 'LOW' }))}>
      {task.title}
    </button>
  );
}

function CalendarDayCell({ ds, day, isToday, dayTasks, onSelect, addingDate, onStartAdd, onSubmitAdd, onCancelAdd }: {
  ds: string; day: number; isToday: boolean; dayTasks: Task[];
  onSelect: (id: string) => void;
  addingDate: string | null; onStartAdd: (ds: string) => void;
  onSubmitAdd: (ds: string, title: string) => Promise<void>; onCancelAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${ds}` });
  const [title, setTitle] = useState('');
  const adding = addingDate === ds;

  return (
    <div ref={setNodeRef}
      onClick={() => { if (!adding) onStartAdd(ds); }}
      className={cn('group/cell border-b border-r border-gray-100 p-1.5 min-h-[90px] cursor-pointer transition-colors',
        isOver && 'bg-navy/5 ring-2 ring-inset ring-navy/20')}>
      <div className={cn('w-6 h-6 flex items-center justify-center rounded-full text-xs mb-1 font-medium mx-auto', isToday ? 'bg-navy text-white' : 'text-gray-600')}>{day}</div>
      <div className="space-y-0.5" onClick={(e) => e.stopPropagation()}>
        {dayTasks.slice(0, 3).map((t) => <CalendarChip key={t.id} task={t} onSelect={onSelect} />)}
        {dayTasks.length > 3 && <p className="text-[10px] text-gray-400 pl-1">+{dayTasks.length - 3} more</p>}
        {adding ? (
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && title.trim()) { await onSubmitAdd(ds, title.trim()); setTitle(''); }
              if (e.key === 'Escape') { setTitle(''); onCancelAdd(); }
            }}
            onBlur={() => { if (!title.trim()) onCancelAdd(); }}
            placeholder="Task…"
            className="w-full text-[10px] px-1.5 py-1 rounded border border-navy/40 outline-none" />
        ) : (
          <div className="opacity-0 group-hover/cell:opacity-100 flex items-center gap-0.5 text-[10px] text-gray-300 pl-1 transition-opacity pointer-events-none">
            <Plus size={9} /> Add
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarView({ tasks, onSelect, onCreate, onReschedule }: {
  tasks: Task[]; onSelect: (id: string) => void;
  onCreate: (dateStr: string, title: string) => Promise<void>;
  onReschedule: (task: Task, dateStr: string) => void;
}) {
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const year = month.getFullYear(), mi = month.getMonth();
  const daysInMonth = new Date(year, mi + 1, 0).getDate();
  const startOffset = (new Date(year, mi, 1).getDay() + 6) % 7;
  const today = localToday();

  const byDate = tasks.reduce<Record<string, Task[]>>((acc, t) => {
    if (!t.dueDate) return acc;
    const k = t.dueDate.slice(0, 10);
    (acc[k] = acc[k] ?? []).push(t);
    return acc;
  }, {});

  const noDate = tasks.filter((t) => !t.dueDate);
  const cells  = Array.from({ length: startOffset + daysInMonth }, (_, i) => i < startOffset ? null : i - startOffset + 1);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || !String(over.id).startsWith('day:')) return;
    const ds = String(over.id).slice(4);
    const task = tasks.find((t) => t.id === active.id);
    if (!task || task.dueDate?.slice(0, 10) === ds) return;
    onReschedule(task, ds);
  }

  async function submitAdd(ds: string, title: string) {
    await onCreate(ds, title);
    setAddingDate(null);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <button onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="p-1.5 rounded hover:bg-gray-100"><ChevronLeft size={15} /></button>
            <span className="text-sm font-semibold text-gray-800">{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            <button onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="p-1.5 rounded hover:bg-gray-100"><ChevronRight size={15} /></button>
          </div>
          <div className="grid grid-cols-7 border-b border-gray-100">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => <div key={d} className="text-center text-[11px] font-semibold text-gray-400 py-2">{d}</div>)}
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-7">
              {cells.map((day, i) => {
                if (!day) return <div key={`e-${i}`} className="border-b border-r border-gray-50 bg-gray-50/30 min-h-[90px]" />;
                const ds = `${year}-${String(mi+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                return (
                  <CalendarDayCell key={ds} ds={ds} day={day} isToday={ds === today}
                    dayTasks={byDate[ds] ?? []} onSelect={onSelect}
                    addingDate={addingDate} onStartAdd={setAddingDate}
                    onSubmitAdd={submitAdd} onCancelAdd={() => setAddingDate(null)} />
                );
              })}
            </div>
          </div>
        </div>
        {noDate.length > 0 && (
          <div className="w-48 border-l border-gray-100 flex flex-col flex-shrink-0">
            <div className="px-3 py-2.5 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500">No due date</p>
              <p className="text-[10px] text-gray-400">{noDate.length} task · drag ke tanggal</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {noDate.map((t) => <CalendarChip key={t.id} task={t} onSelect={onSelect} />)}
            </div>
          </div>
        )}
      </div>
    </DndContext>
  );
}

// ── Planned View (grouped by date bucket) ─────────────────
function PlannedView({ tasks, selectedId, onSelect, onToggle, onDelete, onToggleMyDay, onToggleImportant, currentUserId }: {
  tasks: Task[]; selectedId: string | null; onSelect: (id: string) => void;
  onToggle: (t: Task) => void; onDelete: (id: string) => void;
  onToggleMyDay: (t: Task) => void; onToggleImportant: (t: Task) => void;
  currentUserId: string;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const weekEnd  = new Date(now); weekEnd.setDate(now.getDate() + 7);
  const monthEnd = new Date(now); monthEnd.setDate(now.getDate() + 30);

  function getBucket(dueDate: string): string {
    const d = new Date(dueDate); d.setHours(0, 0, 0, 0);
    if (d < now)           return '0_overdue';
    if (d.getTime() === now.getTime()) return '1_today';
    if (d.getTime() === tomorrow.getTime()) return '2_tomorrow';
    if (d <= weekEnd)      return '3_week';
    if (d <= monthEnd)     return '4_month';
    return '5_later';
  }

  const BUCKET_LABELS: Record<string, string> = {
    '0_overdue':  'Overdue',
    '1_today':    'Today',
    '2_tomorrow': 'Tomorrow',
    '3_week':     'This Week',
    '4_month':    'This Month',
    '5_later':    'Later',
  };

  const groups = useMemo(() => {
    const map = new Map<string, Task[]>();
    const sorted = [...tasks].sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
    for (const t of sorted) {
      const key = t.dueDate ? getBucket(t.dueDate) : '5_later';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  return (
    <div className="flex-1 overflow-y-auto">
      {groups.map(([key, groupTasks]) => {
        const isCollapsed = collapsed[key];
        const isOverdue   = key === '0_overdue';
        return (
          <div key={key}>
            <button
              onClick={() => setCollapsed((c) => ({ ...c, [key]: !c[key] }))}
              className="flex items-center gap-2 w-full px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 text-left"
            >
              {isCollapsed ? <ChevronRight size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
              <CalendarDays size={13} className={isOverdue ? 'text-red-400' : 'text-blue-400'} />
              <span className={cn('text-xs font-semibold', isOverdue ? 'text-red-500' : 'text-gray-700')}>{BUCKET_LABELS[key]}</span>
              <span className="text-[10px] text-gray-400 ml-1">{groupTasks.length}</span>
            </button>
            {!isCollapsed && groupTasks.map((task) => {
              const due = fmtDue(task.dueDate);
              const isMe = task.creator?.id === currentUserId;
              return (
                <div key={task.id} className={cn(
                  'flex items-center gap-2 px-4 py-2.5 border-b border-gray-50 cursor-pointer hover:bg-gray-50 border-l-2 transition-colors',
                  selectedId === task.id ? 'bg-navy/5 border-l-navy' : PRIORITY_CONFIG[task.priority].border,
                )} onClick={() => onSelect(task.id)}>
                  <button onClick={(e) => { e.stopPropagation(); onToggle(task); }}
                    className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                      task.status === 'DONE' ? 'border-green-500 bg-green-500' :
                      task.status === 'IN_PROGRESS' ? 'border-blue-400' : 'border-gray-300 hover:border-navy')}>
                    {task.status === 'DONE' && <CheckCircle2 size={9} className="text-white" strokeWidth={3} />}
                    {task.status === 'IN_PROGRESS' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                  </button>
                  <span className={cn('text-sm flex-1 truncate', task.status === 'DONE' && 'line-through text-gray-400')}>{task.title}</span>
                  {due.text && <span className={cn('text-[11px] flex-shrink-0', due.overdue ? 'text-red-500' : 'text-gray-400')}>{due.text}</span>}
                  {task.assignee && <Avatar name={task.assignee.fullName} avatar={task.assignee.avatar} size={18} />}
                  <button onClick={(e) => { e.stopPropagation(); onToggleMyDay(task); }}
                    title={isInMyDay(task) ? 'Remove from My Day' : 'Add to My Day'}
                    className={cn('flex-shrink-0 transition-colors', isInMyDay(task) ? 'text-amber-400' : 'text-gray-200 hover:text-amber-400')}>
                    <Sun size={13} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onToggleImportant(task); }}
                    title={task.isImportant ? 'Remove from Important' : 'Mark as important'}
                    className={cn('flex-shrink-0 transition-colors', task.isImportant ? 'text-yellow-400' : 'text-gray-200 hover:text-yellow-400')}>
                    <Star size={13} />
                  </button>
                  {isMe && <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} className="text-gray-200 hover:text-red-400 flex-shrink-0"><Trash2 size={12} /></button>}
                </div>
              );
            })}
          </div>
        );
      })}
      {groups.length === 0 && (
        <div className="flex items-center justify-center py-16 text-gray-400 text-sm">No scheduled tasks</div>
      )}
    </div>
  );
}

// ── Markdown Description Editor ────────────────────────────
function DescriptionEditor({
  value, onChange, onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setTab('write')}
          className={cn('px-3 py-1.5 text-xs font-medium transition-colors', tab === 'write' ? 'text-navy border-b-2 border-navy' : 'text-gray-400 hover:text-gray-600')}
        >
          Write
        </button>
        <button
          onClick={() => setTab('preview')}
          className={cn('px-3 py-1.5 text-xs font-medium transition-colors', tab === 'preview' ? 'text-navy border-b-2 border-navy' : 'text-gray-400 hover:text-gray-600')}
        >
          Preview
        </button>
      </div>

      {tab === 'write' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          rows={5}
          placeholder="Add description... (Markdown supported)"
          className="w-full p-3 text-sm text-gray-700 placeholder:text-gray-300 outline-none resize-none leading-relaxed"
        />
      ) : (
        <div
          className="p-3 min-h-[120px] text-sm text-gray-700 leading-relaxed prose-sm"
          dangerouslySetInnerHTML={{ __html: value ? renderMarkdown(value) : '<span style="color:#d1d5db">Preview will appear here</span>' }}
        />
      )}
    </div>
  );
}

// ── Task Detail Panel ──────────────────────────────────────
function TaskDetailPanel({
  taskId, initialTask, onClose, onUpdated, onRequestDelete, currentUserId, taskLists,
}: {
  taskId: string; initialTask?: Task | null; onClose: () => void;
  onUpdated: (t: Task) => void; onRequestDelete: (t: Task) => void; currentUserId: string;
  taskLists: TaskList[];
}) {
  // Render instantly from the list's copy; hydrate subtasks/links in the background
  const [task,    setTask]    = useState<Task | null>(initialTask ?? null);
  const [loading, setLoading] = useState(!initialTask);
  const [saving,  setSaving]  = useState(false);

  const [editTitle, setEditTitle] = useState(false);
  const [titleVal,  setTitleVal]  = useState(initialTask?.title ?? '');
  const titleRef = useRef<HTMLInputElement>(null);

  const [descVal,   setDescVal]   = useState(initialTask?.description ?? '');

  const [newSub,    setNewSub]    = useState('');
  const [addingSub, setAddingSub] = useState(false);
  const [subInput,  setSubInput]  = useState(false);

  const [comments,    setComments]    = useState<Comment[]>([]);
  const [commLoading, setCommLoading] = useState(false);
  const [newComment,  setNewComment]  = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  const [newLinkUrl,   setNewLinkUrl]   = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [addingLink,   setAddingLink]   = useState(false);
  const [linkInput,    setLinkInput]    = useState(false);

  const [showReject, setShowReject] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [rejecting,  setRejecting]  = useState(false);
  const [accepting,  setAccepting]  = useState(false);

  const [users,          setUsers]          = useState<UserOption[]>([]);
  const [panelDivisions, setPanelDivisions] = useState<Division[]>([]);
  const [tab,            setTab]            = useState<'subtasks' | 'links' | 'comments'>('subtasks');

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/tasks/${taskId}`);
      const t: Task = res.data.data;
      setTask(t); setTitleVal(t.title); setDescVal(t.description ?? '');
    } catch (err) { toast.error(extractErr(err)); } finally { setLoading(false); }
  }, [taskId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (editTitle) titleRef.current?.focus(); }, [editTitle]);

  useEffect(() => {
    api.get('/users', { params: { limit: 100 } })
      .then((r) => setUsers(r.data.data?.items ?? r.data.data ?? []))
      .catch(() => {});
    api.get('/divisions')
      .then((r) => setPanelDivisions(r.data.data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (tab !== 'comments' || !taskId) return;
    setCommLoading(true);
    api.get(`/tasks/${taskId}/comments`)
      .then((r) => setComments(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setCommLoading(false));
  }, [tab, taskId]);

  async function patch(data: Record<string, unknown>) {
    if (!task) return;
    setSaving(true);
    try {
      const res = await api.patch(`/tasks/${task.id}`, data);
      const updated: Task = { ...res.data.data, subTasks: task.subTasks };
      setTask(updated); onUpdated(res.data.data);
    } catch (err) { toast.error(extractErr(err)); } finally { setSaving(false); }
  }

  async function patchMyList(listId: string | null) {
    if (!task) return;
    setSaving(true);
    try {
      const res = await api.put(`/tasks/${task.id}/my-list`, { listId });
      const updated: Task = { ...res.data.data, subTasks: task.subTasks };
      setTask(updated); onUpdated(res.data.data);
    } catch (err) { toast.error(extractErr(err)); } finally { setSaving(false); }
  }

  async function saveTitle() {
    setEditTitle(false);
    if (!task || titleVal.trim() === task.title) return;
    if (!titleVal.trim()) { setTitleVal(task.title); return; }
    await patch({ title: titleVal.trim() });
  }

  async function addSubTask(e: FormEvent) {
    e.preventDefault();
    if (!task || !newSub.trim()) return;
    setAddingSub(true);
    try {
      const res = await api.post('/tasks', { title: newSub.trim(), status: 'TODO', priority: 'MEDIUM', parentTaskId: task.id });
      const sub: Task = res.data.data;
      setTask((p) => p ? { ...p, subTasks: [...(p.subTasks ?? []), sub], _count: { ...p._count, subTasks: p._count.subTasks + 1 } } : p);
      setNewSub(''); setSubInput(false);
    } catch (err) { toast.error(extractErr(err)); } finally { setAddingSub(false); }
  }

  async function toggleSubTask(sub: Task) {
    const next: TaskStatus = sub.status === 'DONE' ? 'TODO' : 'DONE';
    setTask((p) => p ? { ...p, subTasks: p.subTasks?.map((s) => s.id === sub.id ? { ...s, status: next } : s) } : p);
    try { await api.patch(`/tasks/${sub.id}`, { status: next }); } catch { load(); }
  }

  async function deleteSubTask(subId: string) {
    setTask((p) => p ? { ...p, subTasks: p.subTasks?.filter((s) => s.id !== subId), _count: { ...p._count, subTasks: Math.max(0, p._count.subTasks - 1) } } : p);
    try { await api.delete(`/tasks/${subId}`); } catch { load(); }
  }

  function handleDelete() {
    if (!task) return;
    onRequestDelete(task);
    onClose();
  }

  async function handleAccept() {
    if (!task) return;
    setAccepting(true);
    try {
      const res = await api.post(`/tasks/${task.id}/accept`);
      const updated = { ...res.data.data, subTasks: task.subTasks };
      setTask(updated); onUpdated(res.data.data);
    } catch (err) { toast.error(extractErr(err)); } finally { setAccepting(false); }
  }

  async function handleReject(e: FormEvent) {
    e.preventDefault();
    if (!task || !rejectNote.trim()) return;
    setRejecting(true);
    try {
      const res = await api.post(`/tasks/${task.id}/reject`, { note: rejectNote.trim() });
      const updated = { ...res.data.data, subTasks: task.subTasks };
      setTask(updated); onUpdated(res.data.data);
      setShowReject(false); setRejectNote('');
    } catch (err) { toast.error(extractErr(err)); } finally { setRejecting(false); }
  }

  async function submitComment(e: FormEvent) {
    e.preventDefault();
    if (!task || !newComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/tasks/${task.id}/comments`, { content: newComment.trim() });
      setComments((c) => [...c, res.data.data]);
      setTask((p) => p ? { ...p, _count: { ...p._count, comments: p._count.comments + 1 } } : p);
      setNewComment('');
    } catch (err) { toast.error(extractErr(err)); } finally { setSubmitting(false); }
  }

  async function deleteComment(id: string) {
    if (!task) return;
    try {
      await api.delete(`/tasks/${task.id}/comments/${id}`);
      setComments((c) => c.filter((x) => x.id !== id));
      setTask((p) => p ? { ...p, _count: { ...p._count, comments: Math.max(0, p._count.comments - 1) } } : p);
    } catch (err) { toast.error(extractErr(err)); }
  }

  async function addLink(e: FormEvent) {
    e.preventDefault();
    if (!task || !newLinkUrl.trim()) return;
    setAddingLink(true);
    try {
      const res = await api.post(`/tasks/${task.id}/links`, { url: newLinkUrl.trim(), title: newLinkTitle.trim() || undefined });
      setTask((p) => p ? { ...p, links: [...p.links, res.data.data] } : p);
      setNewLinkUrl(''); setNewLinkTitle(''); setLinkInput(false);
    } catch (err) { toast.error(extractErr(err)); } finally { setAddingLink(false); }
  }

  async function deleteLink(linkId: string) {
    if (!task) return;
    try {
      await api.delete(`/tasks/${task.id}/links/${linkId}`);
      setTask((p) => p ? { ...p, links: p.links.filter((l) => l.id !== linkId) } : p);
    } catch (err) { toast.error(extractErr(err)); }
  }

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 size={20} className="animate-spin text-gray-300" /></div>;
  if (!task)   return <div className="flex items-center justify-center h-full"><p className="text-sm text-gray-400">Task not found</p></div>;

  const doneSubCount = task.subTasks?.filter((s) => s.status === 'DONE').length ?? 0;
  const totalSub     = task.subTasks?.length ?? 0;
  const subProgress  = totalSub > 0 ? Math.round((doneSubCount / totalSub) * 100) : 0;
  const isOwner      = task.creator.id === currentUserId;
  const isAssignee   = task.assignee?.id === currentUserId;
  const isPending    = task.assignmentStatus === 'PENDING' && isAssignee;
  const myMembership = task.listMemberships?.find((m) => m.userId === currentUserId) ?? null;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
          <ChevronsRight size={16} />
        </button>
        {saving && <Loader2 size={13} className="animate-spin text-gray-400 ml-1" />}
        <div className="flex-1" />
        <button onClick={handleDelete} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50">
          <Trash2 size={13} /> Delete
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-5 pb-10 space-y-5">

          {/* Assignment banner */}
          {isPending && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">
                This task was assigned to you by {task.creator.fullName}
              </p>
              {!showReject ? (
                <div className="flex gap-2 mt-2">
                  <button onClick={handleAccept} disabled={accepting}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg disabled:opacity-50">
                    {accepting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Accept
                  </button>
                  <button onClick={() => setShowReject(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg">
                    <XCircle size={12} /> Reject
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReject} className="mt-2 space-y-2">
                  <textarea autoFocus value={rejectNote} onChange={(e) => setRejectNote(e.target.value)}
                    placeholder="Write rejection reason..." rows={2}
                    className="w-full text-xs border border-amber-200 rounded p-2 outline-none focus:border-amber-400 resize-none" />
                  <div className="flex gap-2">
                    <button type="submit" disabled={rejecting || !rejectNote.trim()}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded disabled:opacity-50">
                      {rejecting ? <Loader2 size={12} className="animate-spin inline mr-1" /> : null}Submit
                    </button>
                    <button type="button" onClick={() => { setShowReject(false); setRejectNote(''); }}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded">Cancel</button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Rejected note */}
          {task.assignmentStatus === 'REJECTED' && task.assignmentNote && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
              <p className="font-semibold mb-1">Task rejected</p>
              <p>{task.assignmentNote}</p>
            </div>
          )}

          {/* Title */}
          <div>
            {editTitle ? (
              <input ref={titleRef} value={titleVal}
                onChange={(e) => setTitleVal(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') saveTitle();
                  if (e.key === 'Escape') { setEditTitle(false); setTitleVal(task.title); }
                }}
                className="w-full text-xl font-semibold text-gray-900 outline-none border-b-2 border-navy pb-1 bg-transparent" />
            ) : (
              <h1 onClick={() => setEditTitle(true)}
                className="text-xl font-semibold text-gray-900 cursor-text hover:text-gray-700 leading-snug">
                {task.title}
              </h1>
            )}
          </div>

          {/* Properties */}
          <div className="-mx-1 space-y-0.5">
            <div className="flex items-center gap-3 px-1 py-2 rounded hover:bg-gray-50">
              <div className="flex items-center gap-2 w-24 flex-shrink-0">
                <Clock size={13} className="text-gray-400" />
                <span className="text-xs text-gray-400">Status</span>
              </div>
              <select value={task.status} onChange={(e) => patch({ status: e.target.value })}
                className="text-xs bg-transparent outline-none cursor-pointer text-gray-700 hover:text-navy">
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-3 px-1 py-2 rounded hover:bg-gray-50">
              <div className="flex items-center gap-2 w-24 flex-shrink-0">
                <PriorityDot priority={task.priority} />
                <span className="text-xs text-gray-400">Priority</span>
              </div>
              <select value={task.priority} onChange={(e) => patch({ priority: e.target.value })}
                className="text-xs bg-transparent outline-none cursor-pointer text-gray-700 hover:text-navy">
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-3 px-1 py-2 rounded hover:bg-gray-50">
              <div className="flex items-center gap-2 w-24 flex-shrink-0">
                <Calendar size={13} className="text-gray-400" />
                <span className="text-xs text-gray-400">Due date</span>
              </div>
              <input type="date" value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                onChange={(e) => patch({ dueDate: e.target.value ? toLocalISO(e.target.value) : null })}
                className="text-xs bg-transparent outline-none cursor-pointer text-gray-700 hover:text-navy" />
            </div>

            <div className="flex items-center gap-3 px-1 py-2 rounded hover:bg-gray-50">
              <div className="flex items-center gap-2 w-24 flex-shrink-0">
                <User size={13} className="text-gray-400" />
                <span className="text-xs text-gray-400">Assign to</span>
              </div>
              <select value={task.assignee?.id ?? ''}
                onChange={(e) => patch({ assignedToId: e.target.value || null })}
                className="text-xs bg-transparent outline-none cursor-pointer text-gray-700 hover:text-navy max-w-[160px]">
                <option value="">— Unassigned —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </select>
            </div>

            {isOwner && (
              <div className="flex items-center gap-3 px-1 py-2 rounded hover:bg-gray-50">
                <div className="flex items-center gap-2 w-24 flex-shrink-0">
                  <LayoutList size={13} className="text-gray-400" />
                  <span className="text-xs text-gray-400">List</span>
                </div>
                <select value={task.taskList?.id ?? ''} onChange={(e) => patch({ listId: e.target.value || null })}
                  className="text-xs bg-transparent outline-none cursor-pointer text-gray-700 hover:text-navy max-w-[200px]">
                  <option value="">— Tanpa list —</option>
                  {taskLists.map((l) => <option key={l.id} value={l.id}>{l.icon ? `${l.icon} ` : ''}{l.name}</option>)}
                </select>
              </div>
            )}

            {isAssignee && !isOwner && (
              <div className="flex items-center gap-3 px-1 py-2 rounded hover:bg-gray-50">
                <div className="flex items-center gap-2 w-24 flex-shrink-0">
                  <LayoutList size={13} className="text-gray-400" />
                  <span className="text-xs text-gray-400">My Lists</span>
                </div>
                <select value={myMembership?.listId ?? ''} onChange={(e) => patchMyList(e.target.value || null)}
                  className="text-xs bg-transparent outline-none cursor-pointer text-gray-700 hover:text-navy max-w-[200px]">
                  <option value="">— Tanpa list —</option>
                  {taskLists.map((l) => <option key={l.id} value={l.id}>{l.icon ? `${l.icon} ` : ''}{l.name}</option>)}
                </select>
              </div>
            )}

            <div className="flex items-center gap-3 px-1 py-2 rounded hover:bg-gray-50">
              <div className="flex items-center gap-2 w-24 flex-shrink-0">
                <Star size={13} className="text-gray-400" />
                <span className="text-xs text-gray-400">Flags</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => patch({ myDay: !isInMyDay(task) })}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors',
                    isInMyDay(task)
                      ? 'bg-amber-50 text-amber-600 border-amber-200'
                      : 'text-gray-400 border-gray-200 hover:text-amber-500 hover:border-amber-200',
                  )}
                >
                  <Sun size={11} /> My Day
                </button>
                <button
                  onClick={() => patch({ isImportant: !task.isImportant })}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors',
                    task.isImportant
                      ? 'bg-yellow-50 text-yellow-600 border-yellow-200'
                      : 'text-gray-400 border-gray-200 hover:text-yellow-500 hover:border-yellow-200',
                  )}
                >
                  <Star size={11} /> Important
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 px-1 py-2 rounded hover:bg-gray-50">
              <div className="flex items-center gap-2 w-24 flex-shrink-0">
                {(() => { const Icon = VISIBILITY_CONFIG[task.visibility].icon; return <Icon size={13} className="text-gray-400" />; })()}
                <span className="text-xs text-gray-400">Bagikan ke</span>
              </div>
              <div className="flex items-center gap-1.5">
                {(Object.entries(VISIBILITY_CONFIG) as [TaskVisibility, (typeof VISIBILITY_CONFIG)[TaskVisibility]][]).map(([v, cfg]) => (
                  <button
                    key={v}
                    onClick={() => patch({ visibility: v, ...(v !== 'DIVISION_SELECT' && { divisionIds: [] }) })}
                    disabled={false}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors disabled:opacity-40',
                      task.visibility === v
                        ? 'bg-navy/10 text-navy border-navy/30'
                        : 'text-gray-400 border-gray-200 hover:text-navy hover:border-navy/30',
                    )}
                  >
                    <cfg.icon size={11} /> {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 px-1 py-2 rounded hover:bg-gray-50">
              <div className="flex items-center gap-2 w-24 flex-shrink-0">
                {task.isPrivate ? <EyeOff size={13} className="text-gray-400" /> : <Eye size={13} className="text-gray-400" />}
                <span className="text-xs text-gray-400">Ke atasan</span>
              </div>
              <button
                onClick={() => patch({ isPrivate: !task.isPrivate })}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors',
                  task.isPrivate
                    ? 'bg-gray-100 text-gray-500 border-gray-300'
                    : 'bg-emerald-50 text-emerald-600 border-emerald-200',
                )}
              >
                {task.isPrivate ? <><EyeOff size={11} /> Disembunyikan dari atasan</> : <><Eye size={11} /> Terlihat oleh atasan</>}
              </button>
            </div>

            {task.visibility === 'DIVISION_SELECT' && (
              <div className="flex items-start gap-3 px-1 py-2">
                <div className="flex items-center gap-2 w-24 flex-shrink-0 pt-1">
                  <Building2 size={13} className="text-gray-400" />
                  <span className="text-xs text-gray-400">Division</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {panelDivisions.map((div) => {
                    const selected = task.divisionAccess?.some((a) => a.divisionId === div.id) ?? false;
                    const newIds = selected
                      ? (task.divisionAccess ?? []).filter((a) => a.divisionId !== div.id).map((a) => a.divisionId)
                      : [...(task.divisionAccess ?? []).map((a) => a.divisionId), div.id];
                    return (
                      <button
                        key={div.id}
                        onClick={() => patch({ visibility: 'DIVISION_SELECT', divisionIds: newIds })}
                        className={cn(
                          'flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-colors',
                          selected
                            ? 'bg-navy/10 text-navy border-navy/30 font-medium'
                            : 'text-gray-400 border-gray-200 hover:border-navy/30 hover:text-navy',
                        )}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: div.color }} />
                        {div.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 px-1 py-2 rounded hover:bg-gray-50">
              <div className="flex items-center gap-2 w-24 flex-shrink-0">
                <User size={13} className="text-gray-400" />
                <span className="text-xs text-gray-400">Created by</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Avatar name={task.creator.fullName} avatar={task.creator.avatar} size={16} />
                <span className="text-xs text-gray-500">{task.creator.fullName}</span>
              </div>
            </div>

            {/* Duration — same "how long is this taking" visibility as Work Orders */}
            <div className="flex items-center gap-3 px-1 py-2 rounded hover:bg-gray-50">
              <div className="flex items-center gap-2 w-24 flex-shrink-0">
                <Clock size={13} className="text-gray-400" />
                <span className="text-xs text-gray-400">Duration</span>
              </div>
              <span className="text-xs text-gray-500">
                {task.status === 'DONE' && task.completedAt
                  ? `Completed in ${fmtElapsed(new Date(task.completedAt).getTime() - new Date(task.startedAt ?? task.createdAt).getTime())}`
                  : task.status === 'IN_PROGRESS' && task.startedAt
                    ? `In progress for ${fmtElapsed(Date.now() - new Date(task.startedAt).getTime())}`
                    : `Open for ${fmtElapsed(Date.now() - new Date(task.createdAt).getTime())}`}
              </span>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Description — markdown editor */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <FileText size={13} className="text-gray-400" />
              <span className="text-xs font-medium text-gray-500">Description</span>
            </div>
            <DescriptionEditor
              value={descVal}
              onChange={setDescVal}
              onBlur={() => {
                if (!task) return;
                const val = descVal.trim() || null;
                if (val !== (task.description ?? null)) patch({ description: val });
              }}
            />
          </div>

          <div className="border-t border-gray-100" />

          {/* Tabs */}
          <div>
            <div className="flex gap-1 mb-4 border-b border-gray-100 -mx-5 px-5">
              {([
                { k: 'subtasks' as const, label: `Subtasks${totalSub > 0 ? ` (${totalSub})` : ''}` },
                { k: 'links'    as const, label: `Links${task.links.length > 0 ? ` (${task.links.length})` : ''}` },
                { k: 'comments' as const, label: `Notes${task._count.comments > 0 ? ` (${task._count.comments})` : ''}` },
              ]).map(({ k, label }) => (
                <button key={k} onClick={() => setTab(k)}
                  className={cn('px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors', tab === k ? 'border-navy text-navy' : 'border-transparent text-gray-500 hover:text-gray-700')}>
                  {label}
                </button>
              ))}
            </div>

            {tab === 'subtasks' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  {totalSub > 0 && (
                    <div className="flex items-center gap-2 flex-1">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${subProgress}%` }} />
                      </div>
                      <span className="text-[11px] text-gray-400 flex-shrink-0">{doneSubCount}/{totalSub}</span>
                    </div>
                  )}
                  {!subInput && (
                    <button onClick={() => setSubInput(true)} className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-navy ml-2">
                      <Plus size={12} /> Add
                    </button>
                  )}
                </div>
                <div className="space-y-0.5">
                  {(task.subTasks ?? []).map((sub) => (
                    <div key={sub.id} className="group flex items-center gap-2 px-1 py-1.5 rounded hover:bg-gray-50">
                      <button onClick={() => toggleSubTask(sub)}
                        className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                          sub.status === 'DONE' ? 'border-green-500 bg-green-500' : 'border-gray-300 hover:border-navy')}>
                        {sub.status === 'DONE' && <CheckCircle2 size={9} className="text-white" strokeWidth={3} />}
                      </button>
                      <span className={cn('flex-1 text-sm min-w-0 truncate', sub.status === 'DONE' && 'line-through text-gray-400')}>
                        {sub.title}
                      </span>
                      <button onClick={() => deleteSubTask(sub.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all">
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
                {subInput && (
                  <form onSubmit={addSubTask} className="flex items-center gap-2 mt-2 pl-1">
                    <Circle size={14} className="text-gray-300 flex-shrink-0" />
                    <input autoFocus value={newSub} onChange={(e) => setNewSub(e.target.value)}
                      onKeyDown={(e) => e.key === 'Escape' && setSubInput(false)}
                      placeholder="Subtask name..."
                      className="flex-1 text-sm text-gray-800 outline-none placeholder:text-gray-300" />
                    {addingSub ? <Loader2 size={13} className="animate-spin text-gray-400" /> :
                      <div className="flex gap-1">
                        <button type="submit" disabled={!newSub.trim()} className="text-[11px] px-2 py-1 bg-navy text-white rounded disabled:opacity-40">OK</button>
                        <button type="button" onClick={() => setSubInput(false)} className="text-[11px] px-2 py-1 text-gray-500 hover:bg-gray-100 rounded">Cancel</button>
                      </div>}
                  </form>
                )}
              </div>
            )}

            {tab === 'links' && (
              <div className="space-y-2">
                {task.links.map((link) => (
                  <div key={link.id} className="group flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <Link2 size={13} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      {link.title && <p className="text-xs font-medium text-gray-700 truncate">{link.title}</p>}
                      <a href={link.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                        className="text-[11px] text-blue-500 hover:underline truncate flex items-center gap-1">
                        <ExternalLink size={10} />{link.url}
                      </a>
                    </div>
                    <button onClick={() => deleteLink(link.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400">
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {!linkInput ? (
                  <button onClick={() => setLinkInput(true)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-navy transition-colors">
                    <Plus size={12} /> Add link
                  </button>
                ) : (
                  <form onSubmit={addLink} className="space-y-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <input value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} placeholder="https://…" autoFocus
                      className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-navy" />
                    <input value={newLinkTitle} onChange={(e) => setNewLinkTitle(e.target.value)} placeholder="Link name (optional)"
                      className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-navy" />
                    <div className="flex gap-1">
                      <button type="submit" disabled={!newLinkUrl.trim() || addingLink}
                        className="text-[11px] px-2 py-1 bg-navy text-white rounded disabled:opacity-40">
                        {addingLink ? <Loader2 size={10} className="animate-spin inline mr-1" /> : null}Add
                      </button>
                      <button type="button" onClick={() => { setLinkInput(false); setNewLinkUrl(''); setNewLinkTitle(''); }}
                        className="text-[11px] px-2 py-1 text-gray-500 hover:bg-gray-200 rounded">Cancel</button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {tab === 'comments' && (
              <div className="space-y-3">
                {commLoading ? (
                  <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-gray-300" /></div>
                ) : comments.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No notes yet</p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="group flex gap-2.5">
                      <Avatar name={c.user.fullName} avatar={c.user.avatar} size={26} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-700">{c.user.fullName}</span>
                          <span className="text-[10px] text-gray-400">{fmtTime(c.createdAt)}</span>
                          {c.user.id === currentUserId && (
                            <button onClick={() => deleteComment(c.id)} className="opacity-0 group-hover:opacity-100 ml-auto text-gray-300 hover:text-red-400">
                              <X size={11} />
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                      </div>
                    </div>
                  ))
                )}
                <form onSubmit={submitComment} className="flex gap-2 pt-1">
                  <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(e as unknown as FormEvent); } }}
                    placeholder="Write a note... (Enter to submit, Shift+Enter for new line)"
                    rows={2}
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-navy resize-none" />
                  <button type="submit" disabled={!newComment.trim() || submitting}
                    className="flex-shrink-0 px-3 py-1 text-xs font-medium text-white bg-navy rounded-lg hover:bg-navy-light disabled:opacity-40 self-end">
                    {submitting ? <Loader2 size={12} className="animate-spin" /> : 'Send'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Create Task Modal ──────────────────────────────────────
function CreateTaskModal({ onClose, onCreated, defaultListId, extraPayload, taskLists }: {
  onClose: () => void; onCreated: (t: Task) => void; defaultListId?: string | null;
  extraPayload?: Record<string, unknown>; taskLists: TaskList[];
}) {
  const [title,      setTitle]      = useState('');
  const [desc,       setDesc]       = useState('');
  const [status,     setStatus]     = useState<TaskStatus>('TODO');
  const [priority,   setPriority]   = useState<TaskPriority>('MEDIUM');
  const [dueDate,    setDueDate]    = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [listId,     setListId]     = useState(defaultListId ?? '');
  const [visibility,  setVisibility]  = useState<TaskVisibility>('PRIVATE');
  const [divisionIds, setDivisionIds] = useState<string[]>([]);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [users,       setUsers]       = useState<UserOption[]>([]);
  const [divisions,   setDivisions]   = useState<Division[]>([]);

  useEffect(() => {
    api.get('/users', { params: { limit: 100 } })
      .then((r) => setUsers(r.data.data?.items ?? r.data.data ?? []))
      .catch(() => {});
    api.get('/divisions')
      .then((r) => setDivisions(r.data.data ?? []))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true); setError('');
    try {
      const payload: Record<string, unknown> = { title: title.trim(), status, priority, visibility, ...extraPayload };
      if (desc.trim())   payload.description = desc.trim();
      if (dueDate)       payload.dueDate      = toLocalISO(dueDate);
      if (assignedTo)    payload.assignedToId = assignedTo;
      if (listId)        payload.listId       = listId;
      if (visibility === 'DIVISION_SELECT') payload.divisionIds = divisionIds;
      const res = await api.post('/tasks', payload);
      onCreated(res.data.data);
      onClose();
    } catch (err) { setError(extractErr(err)); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">New Task</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <input autoFocus type="text" placeholder="Task title..." value={title}
            onChange={(e) => { setTitle(e.target.value); setError(''); }}
            className="w-full text-base font-medium text-gray-900 outline-none placeholder:text-gray-300 border-b border-gray-200 pb-2 focus:border-navy transition-colors" />

          <textarea placeholder="Description (optional)..." value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
            className="w-full text-sm text-gray-700 placeholder:text-gray-300 outline-none resize-none border-b border-gray-100 pb-2" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 outline-none focus:border-navy">
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 outline-none focus:border-navy">
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Due date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="text-sm border border-gray-200 rounded px-2.5 py-1.5 outline-none focus:border-navy w-full" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Assign to</label>
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 outline-none focus:border-navy">
                <option value="">— None —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">List</label>
            <select value={listId} onChange={(e) => setListId(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 outline-none focus:border-navy">
              <option value="">— Tanpa List —</option>
              {taskLists.map((l) => (
                <option key={l.id} value={l.id}>{l.icon ? `${l.icon} ` : ''}{l.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Bagikan ke</label>
              <select value={visibility}
                onChange={(e) => {
                  const v = e.target.value as TaskVisibility;
                  setVisibility(v);
                  if (v !== 'DIVISION_SELECT') setDivisionIds([]);
                }}
                className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 outline-none focus:border-navy disabled:opacity-50 disabled:bg-gray-50">
                <option value="PRIVATE">Only Me (default)</option>
                <option value="DIVISION">My Division</option>
                <option value="DIVISION_SELECT">Select Divisions</option>
                <option value="PUBLIC">All Staff</option>
              </select>
            </div>

            {visibility === 'DIVISION_SELECT' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Select divisions that can view</label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {divisions.map((div) => (
                    <label key={div.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={divisionIds.includes(div.id)}
                        onChange={(e) => setDivisionIds((prev) =>
                          e.target.checked ? [...prev, div.id] : prev.filter((id) => id !== div.id)
                        )}
                        className="w-3.5 h-3.5 rounded border-gray-300 accent-navy"
                      />
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: div.color }} />
                      <span className="text-xs text-gray-700">{div.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving || !title.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-navy rounded hover:bg-navy-light disabled:opacity-50">
              {saving && <Loader2 size={13} className="animate-spin" />} Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── New List Modal ─────────────────────────────────────────
function NewListModal({ onClose, onCreated }: {
  onClose: () => void; onCreated: (list: TaskList) => void;
}) {
  const [name,  setName]    = useState('');
  const [color, setColor]   = useState('#6366f1');
  const [icon,  setIcon]    = useState('');
  const [saving, setSaving] = useState(false);
  const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await api.post('/task-lists', { name: name.trim(), color, icon: icon.trim() || undefined });
      onCreated(res.data.data);
      onClose();
    } catch (err) { toast.error(extractErr(err)); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">New List</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <input autoFocus type="text" placeholder="List name…" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded px-3 py-2 outline-none focus:border-navy" />
          <input type="text" placeholder="Emoji icon (optional)" value={icon} onChange={(e) => setIcon(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded px-3 py-2 outline-none focus:border-navy" />
          <div>
            <p className="text-xs text-gray-500 mb-2">Color</p>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={cn('w-6 h-6 rounded-full transition-all', color === c && 'ring-2 ring-offset-1 ring-gray-400')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving || !name.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-navy rounded hover:bg-navy-light disabled:opacity-50">
              {saving && <Loader2 size={13} className="animate-spin" />} Create List
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Division Folder Grid ───────────────────────────────────
function DivisionFolderGrid({
  divisions, onSelect, userDivisionId, loading,
}: {
  divisions: Division[]; onSelect: (div: Division) => void;
  userDivisionId?: string; loading: boolean;
}) {
  if (loading) return (
    <div className="flex flex-col items-center justify-center flex-1 gap-2">
      <Loader2 size={24} className="animate-spin text-gray-300" />
      <p className="text-sm text-gray-400">Loading divisions…</p>
    </div>
  );

  if (!divisions.length) return (
    <div className="flex flex-col items-center justify-center flex-1 gap-3 text-gray-400">
      <Building2 size={32} className="text-gray-200" />
      <p className="text-sm">No divisions available</p>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-800">Select Division</h2>
        <p className="text-xs text-gray-400 mt-0.5">Click a division to view its tasks</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {divisions.map((div) => (
          <button
            key={div.id}
            onClick={() => onSelect(div)}
            className="group bg-white rounded-xl border border-gray-100 hover:shadow-md hover:border-transparent transition-all text-left overflow-hidden"
          >
            <div className="h-1.5 w-full" style={{ backgroundColor: div.color ?? '#6366f1' }} />
            <div className="p-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm mb-3 flex-shrink-0"
                style={{ backgroundColor: div.color ?? '#6366f1' }}
              >
                {div.name.charAt(0).toUpperCase()}
              </div>
              <p className="font-semibold text-gray-800 text-sm leading-tight truncate">{div.name}</p>
              {div.description && (
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{div.description}</p>
              )}
              {userDivisionId === div.id && (
                <span
                  className="inline-block mt-2 text-[10px] font-semibold text-white px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: div.color ?? '#6366f1' }}
                >
                  My Division
                </span>
              )}
              <div className="mt-3 flex items-center gap-1 text-[10px] text-gray-300 group-hover:text-gray-400 transition-colors">
                <FolderOpen size={11} />
                <span>Open</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── CSV Export ─────────────────────────────────────────────
function exportToCSV(tasks: Task[], filename: string) {
  const headers = ['Title', 'Status', 'Priority', 'Due Date', 'Creator', 'Assignee', 'List', 'Created At'];
  const rows = tasks.map((t) => [
    `"${t.title.replace(/"/g, '""')}"`,
    t.status,
    t.priority,
    t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-US') : '',
    t.creator.fullName,
    t.assignee?.fullName ?? '',
    t.taskList?.name ?? '',
    new Date(t.createdAt).toLocaleDateString('en-US'),
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Completed View (Selesai) ───────────────────────────────
function CompletedView({
  tasks, selectedId, onSelect,
}: {
  tasks: Task[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
  // Group by month of completedAt
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; key: string; tasks: Task[] }>();
    // Generate all months from oldest task to now
    const now = new Date();
    const earliest = tasks.length > 0
      ? new Date(tasks[tasks.length - 1].completedAt ?? tasks[tasks.length - 1].createdAt)
      : now;
    const start = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth(), 1);
    const cur   = new Date(start);
    while (cur <= end) {
      const key   = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
      const label = cur.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      map.set(key, { label, key, tasks: [] });
      cur.setMonth(cur.getMonth() + 1);
    }
    for (const t of tasks) {
      const d   = new Date(t.completedAt ?? t.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.get(key)?.tasks.push(t);
    }
    // Sort descending (newest month first)
    return Array.from(map.values()).reverse();
  }, [tasks]);

  const currentKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    return init; // set after groups are built
  });

  // Auto-collapse past months on mount
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (!initialized && groups.length > 0) {
      const init: Record<string, boolean> = {};
      for (const g of groups) {
        if (g.key !== currentKey) init[g.key] = true;
      }
      setCollapsed(init);
      setInitialized(true);
    }
  }, [groups, initialized, currentKey]);

  const toggle = (key: string) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 text-gray-400">
        <CheckCircle2 size={32} className="text-gray-200" />
        <p className="text-sm">No completed tasks yet</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
      {groups.map(({ key, label, tasks: monthTasks }) => {
        const isCollapsed = collapsed[key] ?? false;
        const isCurrent   = key === currentKey;
        return (
          <div key={key}>
            <button
              onClick={() => toggle(key)}
              className={cn(
                'flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-left transition-colors',
                isCurrent ? 'text-navy font-semibold' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              <span className="text-sm">{label}</span>
              <span className={cn('text-xs ml-auto', isCurrent ? 'text-navy/60' : 'text-gray-400')}>
                {monthTasks.length} task
              </span>
            </button>

            {!isCollapsed && (
              <div className="mt-1 space-y-px border border-gray-100 rounded-lg overflow-hidden">
                {monthTasks.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-gray-400 text-center">No completed tasks this month</div>
                ) : monthTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => onSelect(task.id)}
                    className={cn(
                      'flex items-center gap-3 w-full px-4 py-3 text-left transition-colors text-sm',
                      selectedId === task.id
                        ? 'bg-navy/5 border-l-2 border-l-navy'
                        : 'bg-white hover:bg-gray-50 border-l-2 border-l-transparent',
                    )}
                  >
                    <CheckCircle2 size={15} className="text-green-500 flex-shrink-0" />
                    <span className="flex-1 truncate line-through text-gray-400">{task.title}</span>
                    {task.completedAt && (
                      <span className="text-[10px] text-gray-300 flex-shrink-0">
                        {new Date(task.completedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                    <PriorityDot priority={task.priority} />
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function TasksPage() {
  const { user } = useAuthStore();
  const { perms } = usePermStore();
  const canSeeTeam = (user?.role?.level ?? 99) <= 4;
  const location   = useLocation();

  // Personal-first: semua role mendarat di My Day
  const defaultView: SidebarView = 'my_day';
  const [sidebarView,  setSidebarView]  = useState<SidebarView>(defaultView);
  const [browseMode,   setBrowseMode]   = useState<BrowseMode>('staff');
  const [viewMode,     setViewMode]     = useState<ViewMode>('list');
  const [groupBy,      setGroupBy]      = useState<GroupBy>('status');
  const [sortBy,       setSortBy]       = useState<SortBy>('created');
  const [showDone,     setShowDone]     = useState(false);
  const [tasks,        setTasks]        = useState<Task[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [taskLists,    setTaskLists]    = useState<TaskList[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedId,   setSelectedId]  = useState<string | null>(null);
  const [showCreate,   setShowCreate]  = useState(false);
  const [showNewList,  setShowNewList] = useState(false);
  const [search,       setSearch]      = useState('');
  const [debSearch,    setDebSearch]   = useState('');
  const [showFilters,  setShowFilters] = useState(false);
  const [filters,      setFilters]     = useState<FilterState>(EMPTY_FILTER);
  const [filterUsers,  setFilterUsers] = useState<UserOption[]>([]);
  const [selectedDivision,  setSelectedDivision]  = useState<Division | null>(null);
  const [divisions,         setDivisions]          = useState<Division[]>([]);
  const [loadingDivisions,  setLoadingDivisions]   = useState(false);
  const [pageMeta,     setPageMeta]     = useState<{ page: number; totalPages: number } | null>(null);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [pageSize,     setPageSize]     = useState(100);
  const [suggestions,  setSuggestions]  = useState<Task[]>([]);
  const [suggestOpen,  setSuggestOpen]  = useState(true);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [loadingCompleted, setLoadingCompleted] = useState(false);
  const [teamLists,    setTeamLists]    = useState<TeamList[]>([]);
  const [teamListId,   setTeamListId]   = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Load task lists
  const loadLists = useCallback(async () => {
    setLoadingLists(true);
    try {
      const res = await api.get('/task-lists');
      setTaskLists(res.data.data ?? []);
    } catch { /* silent */ } finally { setLoadingLists(false); }
  }, []);

  // Load subordinates' lists for Team view (list-sharing: manager browses by list)
  const loadTeamLists = useCallback(async () => {
    if (!canSeeTeam || sidebarView !== 'team') return;
    try {
      const res = await api.get('/task-lists/team');
      setTeamLists(res.data.data ?? []);
    } catch { /* silent */ }
  }, [canSeeTeam, sidebarView]);

  useEffect(() => { loadTeamLists(); }, [loadTeamLists]);
  useEffect(() => { if (sidebarView !== 'team') setTeamListId(null); }, [sidebarView]);

  // Load pending count
  const loadPendingCount = useCallback(async () => {
    try {
      const res = await api.get('/tasks/pending-count');
      setPendingCount(res.data.data?.count ?? 0);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadLists();
    loadPendingCount();
    // Load users for filter panel
    api.get('/users', { params: { limit: 100 } })
      .then((r) => setFilterUsers(r.data.data?.items ?? r.data.data ?? []))
      .catch(() => {});
  }, [loadLists, loadPendingCount]);

  // Open task from navigation state (e.g. from command palette)
  useEffect(() => {
    const state = location.state as { selectedTaskId?: string } | null;
    if (state?.selectedTaskId) {
      setSelectedId(state.selectedTaskId);
      setSidebarView(defaultView);
      window.history.replaceState({}, '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load completed tasks for Selesai view
  const loadCompleted = useCallback(async () => {
    if (sidebarView !== 'completed') return;
    setLoadingCompleted(true);
    try {
      const res = await api.get('/tasks/completed');
      setCompletedTasks(res.data.data ?? []);
    } catch (err) { toast.error(extractErr(err)); }
    finally { setLoadingCompleted(false); }
  }, [sidebarView]);

  useEffect(() => { loadCompleted(); }, [loadCompleted]);

  // Load tasks when view/search changes (page > 1 appends — "Load more")
  const loadTasks = useCallback(async (page = 1) => {
    if (sidebarView === 'completed') return;
    if (page === 1) setLoading(true); else setLoadingMore(true);
    try {
      const params: Record<string, string> = { limit: String(pageSize), page: String(page) };
      if (debSearch) params.search = debSearch;
      let endpoint = '/tasks';
      if (sidebarView === 'team') {
        endpoint = '/tasks/team';
        if (teamListId) params.listId = teamListId;
      } else if (sidebarView.startsWith('list:')) {
        params.view   = 'list';
        params.listId = sidebarView.slice(5);
      } else if (sidebarView === 'my_tasks') {
        params.view = 'mine';
      } else if (sidebarView === 'browse') {
        params.view = 'browse';
        if (selectedDivision) params.divisionId = selectedDivision.id;
      } else {
        params.view = sidebarView;
      }
      const res = await api.get(endpoint, { params });
      const fetched: Task[] = res.data.data ?? [];
      const meta = res.data.meta as { page: number; totalPages: number } | undefined;
      setPageMeta(meta ?? null);
      setTasks((prev) => page === 1 ? fetched : [...prev, ...fetched]);
    } catch (err) { toast.error(extractErr(err)); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [sidebarView, debSearch, selectedDivision, pageSize, teamListId]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // My Day suggestions
  const loadSuggestions = useCallback(async () => {
    if (sidebarView !== 'my_day') return;
    try {
      const res = await api.get('/tasks/suggestions');
      setSuggestions(res.data.data ?? []);
    } catch { /* non-critical */ }
  }, [sidebarView]);

  useEffect(() => { loadSuggestions(); }, [loadSuggestions]);

  // Load divisions for the folder picker
  useEffect(() => {
    if (sidebarView !== 'browse') return;
    setLoadingDivisions(true);
    api.get('/divisions')
      .then((r) => setDivisions(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingDivisions(false));
  }, [sidebarView]);

  // Client-side filtering
  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (filters.statuses.length > 0)    result = result.filter((t) => filters.statuses.includes(t.status));
    if (filters.priorities.length > 0)  result = result.filter((t) => filters.priorities.includes(t.priority));
    if (filters.assigneeId)             result = result.filter((t) => t.assignee?.id === filters.assigneeId);
    if (filters.hasDueDate)             result = result.filter((t) => !!t.dueDate);
    if (filters.overdueOnly) {
      const now = new Date(); now.setHours(0, 0, 0, 0);
      result = result.filter((t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE');
    }

    const sorted = [...result];
    if (sortBy === 'due_date') {
      sorted.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    } else if (sortBy === 'priority') {
      sorted.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
    } else if (sortBy === 'alpha') {
      sorted.sort((a, b) => a.title.localeCompare(b.title, 'id'));
    }
    // 'created' = urutan dari server (default, tidak perlu sort ulang)

    return sorted;
  }, [tasks, filters, sortBy]);

  const activeFilterCount = [
    filters.statuses.length > 0,
    filters.priorities.length > 0,
    !!filters.assigneeId,
    filters.hasDueDate,
    filters.overdueOnly,
  ].filter(Boolean).length;

  // View labels
  const activeListId  = sidebarView.startsWith('list:') ? sidebarView.slice(5) : null;
  const activeList    = taskLists.find((l) => l.id === activeListId);
  const pageTitle     = activeList
    ? `${activeList.icon ?? ''}${activeList.icon ? ' ' : ''}${activeList.name}`
    : (VIEW_LABELS[sidebarView] ?? 'Tasks');

  const handleTaskUpdated = useCallback((task: Task) => {
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, ...task } : t));
    setCompletedTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, ...task } : t));
    loadPendingCount();
    loadLists();
  }, [loadPendingCount, loadLists]);

  const handleTaskCreated = useCallback((task: Task) => {
    setTasks((prev) => [task, ...prev]);
    setSelectedId(task.id);
    loadPendingCount();
    loadLists();
  }, [loadPendingCount, loadLists]);

  // Status circle click: TODO → IN_PROGRESS → DONE → TODO, with undo when landing on DONE
  const handleToggle = useCallback(async (task: Task) => {
    if (task.assignmentStatus === 'PENDING') return;
    const prev = task.status;
    const next = cycleStatus(prev);
    setTasks((p) => p.map((t) => t.id === task.id ? { ...t, status: next } : t));
    try {
      const res = await api.patch(`/tasks/${task.id}`, { status: next });
      setTasks((p) => p.map((t) => t.id === task.id ? { ...t, ...res.data.data } : t));
      if (next === 'DONE') {
        toast.undoable(`"${task.title}" marked done`, {
          onCommit: () => {},
          onUndo: async () => {
            setTasks((p) => p.map((t) => t.id === task.id ? { ...t, status: prev, completedAt: null } : t));
            try { await api.patch(`/tasks/${task.id}`, { status: prev }); }
            catch (err) { toast.error(extractErr(err)); }
          },
        });
      }
    } catch (err) {
      setTasks((p) => p.map((t) => t.id === task.id ? { ...t, status: prev } : t));
      toast.error(extractErr(err));
    }
  }, []);

  // Optimistic delete with 5s undo — the DELETE only fires when the toast expires
  const handleDeleteTask = useCallback((task: Task) => {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    setSelectedId((prev) => prev === task.id ? null : prev);
    toast.undoable(`"${task.title}" deleted`, {
      onUndo: () => setTasks((prev) => [task, ...prev]),
      onCommit: async () => {
        try { await api.delete(`/tasks/${task.id}`); loadLists(); }
        catch (err) {
          setTasks((prev) => [task, ...prev]);
          toast.error(extractErr(err));
        }
      },
    });
  }, [loadLists]);

  const handleDelete = useCallback((id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (task) handleDeleteTask(task);
  }, [tasks, handleDeleteTask]);

  const handleToggleMyDay = useCallback(async (task: Task) => {
    const adding = !isInMyDay(task);
    const nextDate = adding ? `${localToday()}T00:00:00.000Z` : null;
    setTasks((prev) =>
      sidebarView === 'my_day' && !adding
        ? prev.filter((t) => t.id !== task.id)
        : prev.map((t) => t.id === task.id ? { ...t, myDayDate: nextDate } : t));
    try { await api.patch(`/tasks/${task.id}`, { myDay: adding }); loadSuggestions(); }
    catch (err) {
      toast.error(extractErr(err));
      if (sidebarView === 'my_day' && !adding) setTasks((prev) => [task, ...prev]);
      else setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, myDayDate: task.myDayDate } : t));
    }
  }, [sidebarView, loadSuggestions]);

  const handleToggleImportant = useCallback(async (task: Task) => {
    const next = !task.isImportant;
    setTasks((prev) =>
      sidebarView === 'important' && !next
        ? prev.filter((t) => t.id !== task.id)
        : prev.map((t) => t.id === task.id ? { ...t, isImportant: next } : t));
    try { await api.patch(`/tasks/${task.id}`, { isImportant: next }); }
    catch (err) {
      toast.error(extractErr(err));
      if (sidebarView === 'important' && !next) setTasks((prev) => [task, ...prev]);
      else setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, isImportant: task.isImportant } : t));
    }
  }, [sidebarView]);

  // Board drag & drop → patch status/priority
  const handleBoardMove = useCallback(async (task: Task, groupKey: string) => {
    const patch: Partial<Task> = groupBy === 'priority'
      ? { priority: groupKey as TaskPriority }
      : { status: groupKey as TaskStatus };
    const revert: Partial<Task> = groupBy === 'priority'
      ? { priority: task.priority }
      : { status: task.status };
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, ...patch } : t));
    try {
      const res = await api.patch(`/tasks/${task.id}`, patch);
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, ...res.data.data } : t));
    } catch (err) {
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, ...revert } : t));
      toast.error(extractErr(err));
    }
  }, [groupBy]);

  // Calendar: drag a task to another day
  const handleReschedule = useCallback(async (task: Task, dateStr: string) => {
    const nextDue = toLocalISO(dateStr);
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, dueDate: nextDue } : t));
    try { await api.patch(`/tasks/${task.id}`, { dueDate: nextDue }); }
    catch (err) {
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, dueDate: task.dueDate } : t));
      toast.error(extractErr(err));
    }
  }, []);

  // Add a suggested task to today's My Day
  const addSuggestionToMyDay = useCallback(async (task: Task) => {
    setSuggestions((prev) => prev.filter((t) => t.id !== task.id));
    try {
      const res = await api.patch(`/tasks/${task.id}`, { myDay: true });
      setTasks((prev) => [res.data.data, ...prev]);
    } catch (err) {
      setSuggestions((prev) => [task, ...prev]);
      toast.error(extractErr(err));
    }
  }, []);

  // Tasks created from a view inherit that view's context so they don't vanish on refetch
  const quickAddPayload = useMemo<Record<string, unknown>>(() => {
    if (sidebarView === 'my_day')    return { myDay: true };
    if (sidebarView === 'important') return { isImportant: true };
    return {};
  }, [sidebarView]);

  // Calendar inline add
  const handleCalendarCreate = useCallback(async (dateStr: string, title: string) => {
    try {
      const res = await api.post('/tasks', { title, priority: 'MEDIUM', status: 'TODO', dueDate: toLocalISO(dateStr), ...quickAddPayload });
      handleTaskCreated(res.data.data);
    } catch (err) { toast.error(extractErr(err)); }
  }, [quickAddPayload, handleTaskCreated]);

  // Keyboard shortcuts: N = new task, Esc = close, ↑/↓ = navigate, Space = cycle status
  const filteredRef = useRef(filteredTasks);
  filteredRef.current = filteredTasks;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  useEffect(() => {
    function handler(e: globalThis.KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Escape') {
        setShowCreate(false); setShowNewList(false); setSelectedId(null);
        return;
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setShowCreate(true);
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const list = filteredRef.current;
        if (!list.length) return;
        e.preventDefault();
        const idx = list.findIndex((t) => t.id === selectedRef.current);
        const nextIdx = e.key === 'ArrowDown'
          ? Math.min(list.length - 1, idx + 1)
          : Math.max(0, idx === -1 ? 0 : idx - 1);
        setSelectedId(list[nextIdx].id);
        return;
      }
      if (e.key === ' ' && selectedRef.current) {
        e.preventDefault();
        const task = filteredRef.current.find((t) => t.id === selectedRef.current);
        if (task) handleToggle(task);
      }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleToggle]);

  const totalDone = filteredTasks.filter((t) => t.status === 'DONE').length;
  const doneCount = totalDone;

  // My Day greeting
  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 11 ? 'Good morning' : greetingHour < 15 ? 'Good afternoon' : greetingHour < 18 ? 'Good evening' : 'Good night';
  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="flex h-full -m-6 overflow-hidden">
      {/* Sidebar */}
      <TasksSidebar
        active={sidebarView}
        onSelect={(v) => { setSidebarView(v); setSelectedId(null); setSelectedDivision(null); }}
        taskLists={taskLists}
        pendingCount={pendingCount}
        canSeeTeam={canSeeTeam}
        onNewList={() => setShowNewList(true)}
        loadingLists={loadingLists}
      />

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-white">

        {/* My Day greeting header */}
        {sidebarView === 'my_day' && (
          <div className="px-6 pt-5 pb-4 border-b border-navy/20 bg-navy flex-shrink-0">
            <div className="flex items-center gap-2.5 mb-1">
              <Sun size={20} className="text-white/80" />
              <h1 className="text-xl font-bold text-white">My Day</h1>
            </div>
            <p className="text-xs text-white/60">{greeting}, {user?.fullName?.split(' ')[0]} · {todayStr}</p>
          </div>
        )}

        {/* Important header */}
        {sidebarView === 'important' && (
          <div className="px-6 pt-5 pb-4 border-b border-navy/20 bg-navy flex-shrink-0">
            <div className="flex items-center gap-2.5 mb-1">
              <Star size={20} className="text-white/80" />
              <h1 className="text-xl font-bold text-white">Important</h1>
            </div>
            <p className="text-xs text-white/60">Tasks you have marked as important</p>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 flex-shrink-0 flex-wrap bg-white">
          {sidebarView !== 'my_day' && sidebarView !== 'important' && (
            <div className="flex items-center gap-1.5 mr-1">
              {sidebarView === 'browse' && selectedDivision ? (
                <>
                  <button
                    onClick={() => { setSelectedDivision(null); setSelectedId(null); }}
                    className="text-sm text-gray-400 hover:text-navy transition-colors"
                  >
                    All Tasks
                  </button>
                  <ChevronRight size={13} className="text-gray-300" />
                  <span
                    className="text-sm font-semibold text-gray-800 flex items-center gap-1.5"
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: selectedDivision.color }} />
                    {selectedDivision.name}
                  </span>
                </>
              ) : (
                <h1 className="text-sm font-semibold text-gray-800">{pageTitle}</h1>
              )}
            </div>
          )}

          {/* Browse scope: Semua Staff | Per Divisi */}
          {sidebarView === 'browse' && (
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
              {([
                { m: 'staff'    as const, icon: Globe,     label: 'All Staff'   },
                { m: 'division' as const, icon: Building2, label: 'By Division' },
              ]).map(({ m, icon: Icon, label }) => (
                <button key={m}
                  onClick={() => { setBrowseMode(m); setSelectedDivision(null); setSelectedId(null); }}
                  className={cn('flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
                    browseMode === m ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                  <Icon size={12} />{label}
                </button>
              ))}
            </div>
          )}

          {sidebarView !== 'completed' && (
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {([
              { v: 'list'     as const, icon: LayoutList,   label: 'List'  },
              { v: 'board'    as const, icon: Columns3,     label: 'Board' },
              { v: 'calendar' as const, icon: CalendarDays, label: 'Cal'   },
              { v: 'table'    as const, icon: Table2,       label: 'Table' },
            ]).map(({ v, icon: Icon, label }) => (
              <button key={v} onClick={() => setViewMode(v)}
                className={cn('flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
                  viewMode === v ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                <Icon size={12} />{label}
              </button>
            ))}
          </div>)}

          {/* Group by (not for table/calendar) */}
          {sidebarView !== 'completed' && (viewMode === 'list' || viewMode === 'board') && (
            <div className="flex items-center gap-1.5">
              <SortDesc size={13} className="text-gray-400" />
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-navy text-gray-600">
                <option value="status">Group: Status</option>
                <option value="priority">Group: Priority</option>
                <option value="assignee">Group: Assignee</option>
              </select>
            </div>
          )}

          {/* Sort by (not for calendar or completed) */}
          {sidebarView !== 'completed' && viewMode !== 'calendar' && (
            <div className="flex items-center gap-1.5">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-navy text-gray-600">
                <option value="created">Sort: Latest</option>
                <option value="due_date">Sort: Due Date</option>
                <option value="priority">Sort: Priority</option>
                <option value="alpha">Sort: A–Z</option>
              </select>
            </div>
          )}

          {sidebarView !== 'completed' && <>
          {/* Search */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-7 pr-6 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-navy w-36" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X size={11} /></button>}
          </div>

          {/* Filter button */}
          <button
            onClick={() => setShowFilters((f) => !f)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors',
              showFilters || activeFilterCount > 0
                ? 'bg-navy text-white border-navy'
                : 'border-gray-200 text-gray-600 hover:border-navy',
            )}
          >
            <Filter size={12} /> Filter
            {activeFilterCount > 0 && (
              <span className="bg-white text-navy text-[10px] font-bold px-1 py-0.5 rounded-full min-w-[16px] text-center leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Export CSV button */}
          {filteredTasks.length > 0 && (
            <button
              onClick={() => exportToCSV(
                filteredTasks,
                `tasks-${sidebarView}-${new Date().toISOString().slice(0, 10)}.csv`,
              )}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors"
              title="Export ke CSV"
            >
              <Download size={12} /> CSV
            </button>
          )}

          <div className="flex-1" />
          {(sidebarView === 'my_tasks' || sidebarView === 'browse') && (viewMode === 'list' || viewMode === 'board') && (
            <button
              onClick={() => setShowDone((v) => !v)}
              className={cn('flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-lg border transition-colors',
                showDone ? 'border-navy text-navy bg-navy/5' : 'border-gray-200 text-gray-400 hover:border-gray-300')}
            >
              {showDone ? <Eye size={12} /> : <EyeOff size={12} />}
              {showDone ? 'Hide done' : `Show done (${totalDone})`}
            </button>
          )}
          {!loading && <span className="text-xs text-gray-400">{doneCount}/{filteredTasks.length} done</span>}

          {perms.task.create && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-navy hover:bg-navy-light rounded-lg">
              <Plus size={13} /> New Task
            </button>
          )}
          </>}
        </div>

        {/* Filter panel */}
        {showFilters && (
          <FilterPanel filters={filters} onChange={setFilters} users={filterUsers} />
        )}

        {/* My Day suggestions — a floating bottom pop-up instead of an inline
            banner, so it doesn't push the task list down / add to page clutter */}
        {sidebarView === 'my_day' && suggestions.length > 0 && (
          <div className="fixed bottom-5 right-6 z-30 w-80 max-w-[calc(100vw-2.5rem)]">
            <div className="rounded-xl border border-amber-200 bg-amber-50 shadow-lg overflow-hidden">
              <button
                onClick={() => setSuggestOpen((v) => !v)}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-left"
              >
                <Lightbulb size={14} className="text-amber-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-amber-700">
                  Suggestions ({suggestions.length})
                </span>
                {suggestOpen ? <ChevronDown size={13} className="text-amber-400 ml-auto flex-shrink-0" /> : <ChevronRight size={13} className="text-amber-400 ml-auto flex-shrink-0" />}
              </button>
              {suggestOpen && (
                <div className="px-3 pb-3 space-y-1.5 max-h-64 overflow-y-auto">
                  <p className="text-[10px] text-amber-600/70 px-1 mb-1">overdue · due today · not done yesterday</p>
                  {suggestions.map((s) => {
                    const due = fmtDue(s.dueDate);
                    return (
                      <div key={s.id} className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-700 truncate">{s.title}</p>
                          {due.text && (
                            <p className={cn('text-[10px]', due.overdue ? 'text-red-500' : 'text-gray-400')}>{due.text}</p>
                          )}
                        </div>
                        <button
                          onClick={() => addSuggestionToMyDay(s)}
                          title="Add to My Day"
                          className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 hover:text-white hover:bg-amber-500 border border-amber-300 rounded-full px-2 py-1 transition-colors flex-shrink-0"
                        >
                          <Plus size={10} /> My Day
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Team view: browse by subordinate's list */}
        {sidebarView === 'team' && teamLists.length > 0 && (
          <div className="border-b border-gray-100 bg-gray-50/50 flex-shrink-0 px-4 py-2 flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setTeamListId(null)}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors flex-shrink-0',
                !teamListId ? 'bg-navy text-white border-navy' : 'text-gray-500 border-gray-200 hover:border-navy/40',
              )}
            >
              All lists
            </button>
            {teamLists.map((l) => (
              <button
                key={l.id}
                onClick={() => setTeamListId(l.id)}
                title={l.user.fullName}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors flex-shrink-0',
                  teamListId === l.id ? 'bg-navy text-white border-navy' : 'text-gray-600 border-gray-200 hover:border-navy/40',
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} />
                {l.icon ? `${l.icon} ` : ''}{l.name}
                <span className={cn('opacity-70', teamListId === l.id ? 'text-white' : 'text-gray-400')}>· {l.user.fullName}</span>
                {typeof l._count?.tasks === 'number' && (
                  <span className={cn('opacity-70', teamListId === l.id ? 'text-white' : 'text-gray-400')}>({l._count.tasks})</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {sidebarView === 'completed' ? (
              loadingCompleted ? (
                <div className="flex flex-col items-center justify-center flex-1 gap-2">
                  <Loader2 size={24} className="animate-spin text-gray-300" />
                  <p className="text-sm text-gray-400">Loading…</p>
                </div>
              ) : (
                <CompletedView
                  tasks={completedTasks}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              )
            ) : sidebarView === 'browse' && browseMode === 'division' && !selectedDivision ? (
              <DivisionFolderGrid
                divisions={divisions}
                onSelect={(div) => { setSelectedDivision(div); setSelectedId(null); }}
                userDivisionId={user?.division?.id}
                loading={loadingDivisions}
              />
            ) : loading ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-2">
                <Loader2 size={24} className="animate-spin text-gray-300" />
                <p className="text-sm text-gray-400">Loading tasks…</p>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-3 text-gray-400">
                <LayoutList size={32} className="text-gray-200" />
                <p className="text-sm">No tasks here</p>
                <button onClick={() => setShowCreate(true)}
                  className="flex items-center gap-1.5 text-xs text-navy hover:underline">
                  <Plus size={12} /> Create first task
                </button>
              </div>
            ) : sidebarView === 'planned' ? (
              <PlannedView
                tasks={filteredTasks}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onToggleMyDay={handleToggleMyDay}
                onToggleImportant={handleToggleImportant}
                currentUserId={user?.id ?? ''}
              />
            ) : viewMode === 'list' ? (
              <ListView
                tasks={filteredTasks}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onCreated={handleTaskCreated}
                onToggleMyDay={handleToggleMyDay}
                onToggleImportant={handleToggleImportant}
                listId={activeListId}
                showUser={sidebarView === 'team'}
                groupBy={groupBy}
                showDone={(sidebarView === 'my_tasks' || sidebarView === 'browse') ? showDone : undefined}
                extraPayload={quickAddPayload}
              />
            ) : viewMode === 'board' ? (
              <BoardView
                tasks={filteredTasks}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onCreated={handleTaskCreated}
                onToggleMyDay={handleToggleMyDay}
                onToggleImportant={handleToggleImportant}
                groupBy={groupBy}
                onMove={handleBoardMove}
                extraPayload={quickAddPayload}
              />
            ) : viewMode === 'calendar' ? (
              <CalendarView
                tasks={filteredTasks}
                onSelect={setSelectedId}
                onCreate={handleCalendarCreate}
                onReschedule={handleReschedule}
              />
            ) : (
              <TableView
                tasks={filteredTasks}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            )}

            {/* Pagination */}
            {!loading && !(sidebarView === 'browse' && browseMode === 'division' && !selectedDivision) && pageMeta && (
              <div className="flex items-center justify-between gap-2 py-2 px-3 border-t border-gray-100 flex-shrink-0">
                <PageSizeSelect value={pageSize} onChange={setPageSize} options={[25, 50, 100]} />
                {pageMeta.page < pageMeta.totalPages && (
                  <button
                    onClick={() => loadTasks(pageMeta.page + 1)}
                    disabled={loadingMore}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-navy px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    {loadingMore ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={12} />}
                    Load more
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selectedId && (
            <div className="w-[400px] flex-shrink-0 border-l border-gray-200 flex flex-col min-h-0">
              <TaskDetailPanel
                key={selectedId}
                taskId={selectedId}
                initialTask={(sidebarView === 'completed' ? completedTasks : tasks).find((t) => t.id === selectedId) ?? null}
                onClose={() => setSelectedId(null)}
                onUpdated={handleTaskUpdated}
                onRequestDelete={handleDeleteTask}
                currentUserId={user?.id ?? ''}
                taskLists={taskLists}
              />
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateTaskModal
          onClose={() => setShowCreate(false)}
          onCreated={handleTaskCreated}
          defaultListId={activeListId}
          extraPayload={quickAddPayload}
          taskLists={taskLists}
        />
      )}
      {showNewList && (
        <NewListModal
          onClose={() => setShowNewList(false)}
          onCreated={(list) => { setTaskLists((prev) => [...prev, list]); setSidebarView(`list:${list.id}`); }}
        />
      )}
    </div>
  );
}
