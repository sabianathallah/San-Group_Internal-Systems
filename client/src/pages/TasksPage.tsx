import {
  useEffect, useState, useRef, useCallback, FormEvent, KeyboardEvent,
} from 'react';
import {
  Sun, Star, LayoutList, Users, Plus, Search, X,
  ChevronDown, ChevronRight, Circle, CheckCircle2, Clock,
  Calendar, User, Loader2, Trash2, FileText, ChevronsRight,
  Lock, Unlock, Link2, ExternalLink, MessageSquare, AlertCircle,
  Check, XCircle, Columns3, CalendarDays, GripVertical, ChevronLeft,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/cn';

// ── Types ──────────────────────────────────────────────────
type AssignmentStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';
type TaskStatus   = 'TODO' | 'IN_PROGRESS' | 'DONE';
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type ViewMode = 'list' | 'board' | 'calendar';
type SidebarView = 'my_day' | 'assigned' | 'all' | 'team' | `list:${string}`;

interface TaskUser { id: string; fullName: string; avatar: string | null }
interface TaskLink { id: string; url: string; title: string | null; createdAt: string }
interface Comment  { id: string; content: string; createdAt: string; user: TaskUser }

interface Task {
  id: string; title: string; description: string | null;
  status: TaskStatus; priority: TaskPriority; category: string;
  dueDate: string | null; completedAt: string | null;
  isPrivate: boolean; assignmentStatus: AssignmentStatus | null; assignmentNote: string | null;
  position: number; createdAt: string; updatedAt: string;
  creator: TaskUser; assignee: TaskUser | null;
  taskList: { id: string; name: string; color: string } | null;
  links: TaskLink[];
  _count: { subTasks: number; attachments: number; comments: number };
  subTasks?: Task[];
}

interface TaskList {
  id: string; name: string; color: string; icon: string | null;
  _count?: { tasks: number };
}

interface UserOption { id: string; fullName: string; role: string; avatar: string | null }

// ── Constants ──────────────────────────────────────────────
const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  TODO:        { label: 'Undone',       icon: Circle,       color: 'text-gray-400',  bg: 'bg-gray-100' },
  IN_PROGRESS: { label: 'On Progress',  icon: Clock,        color: 'text-blue-500',  bg: 'bg-blue-50'  },
  DONE:        { label: 'Done',         icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50' },
};

// Display status — overrides with "Waiting for Confirmation" when pending assignment
function displayStatus(task: { status: TaskStatus; assignmentStatus: AssignmentStatus | null }): {
  label: string; color: string; bg: string;
} {
  if (task.assignmentStatus === 'PENDING') {
    return { label: 'Waiting for Confirmation', color: 'text-amber-600', bg: 'bg-amber-50' };
  }
  return STATUS_CONFIG[task.status];
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; dot: string; border: string }> = {
  URGENT: { label: 'Mendesak', color: 'text-red-500',    dot: 'bg-red-500',    border: 'border-l-red-400'    },
  HIGH:   { label: 'Tinggi',   color: 'text-orange-500', dot: 'bg-orange-500', border: 'border-l-orange-400' },
  MEDIUM: { label: 'Sedang',   color: 'text-blue-500',   dot: 'bg-blue-400',   border: 'border-l-blue-400'   },
  LOW:    { label: 'Rendah',   color: 'text-gray-400',   dot: 'bg-gray-300',   border: 'border-l-gray-200'   },
};

const MANAGER_ROLES = [
  'OWNER','SUPER_ADMIN','ADMIN','DIRECTOR',
  'PROPERTY_MANAGER','LEASING_MANAGER','FINANCE_MANAGER',
  'HR_MANAGER','FNB_MANAGER','GA_MANAGER','LEGAL_HEAD',
];

// ── Helpers ────────────────────────────────────────────────
function fmtDue(iso: string | null): { text: string; overdue: boolean } {
  if (!iso) return { text: '', overdue: false };
  const d = new Date(iso), now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
  if (diff < 0)  return { text: `${Math.abs(diff)}h lalu`, overdue: true };
  if (diff === 0) return { text: 'Hari ini', overdue: false };
  if (diff === 1) return { text: 'Besok',    overdue: false };
  return { text: d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }), overdue: false };
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function toLocalISO(d: string) { return `${d}T00:00:00+07:00`; }

function extractErr(err: unknown): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Terjadi kesalahan';
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
  if (status === 'PENDING') return null; // handled by displayStatus
  return (
    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0', {
      'bg-green-100 text-green-700': status === 'ACCEPTED',
      'bg-red-100   text-red-600':   status === 'REJECTED',
    })}>
      {status === 'ACCEPTED' ? 'Accepted' : 'Rejected'}
    </span>
  );
}

// ── Sidebar ────────────────────────────────────────────────
function Sidebar({
  active, onSelect, taskLists, pendingCount, canSeeTeam, onNewList, loadingLists,
}: {
  active: SidebarView; onSelect: (v: SidebarView) => void;
  taskLists: TaskList[]; pendingCount: number; canSeeTeam: boolean;
  onNewList: () => void; loadingLists: boolean;
}) {
  const items: { id: SidebarView; icon: React.ElementType; label: string; badge?: number }[] = [
    { id: 'my_day',   icon: Sun,        label: 'My Day'         },
    { id: 'assigned', icon: Star,       label: 'Assigned to Me', badge: pendingCount },
    { id: 'all',      icon: LayoutList, label: 'All Tasks'      },
    ...(canSeeTeam ? [{ id: 'team' as SidebarView, icon: Users, label: 'Team Tasks' }] : []),
  ];

  return (
    <div className="w-52 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col h-full overflow-y-auto">
      <div className="px-3 pt-4 pb-2 space-y-0.5">
        {items.map(({ id, icon: Icon, label, badge }) => (
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
        ))}
      </div>

      <div className="px-4 pt-3 pb-1">
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
              {(list._count?.tasks ?? 0) > 0 && (
                <span className="text-[10px] text-gray-400">{list._count?.tasks}</span>
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

// ── List View ──────────────────────────────────────────────
function ListView({
  tasks, selectedId, onSelect, onToggle, onDelete, onCreated,
  listId, showUser,
}: {
  tasks: Task[]; selectedId: string | null; onSelect: (id: string) => void;
  onToggle: (t: Task) => void; onDelete: (id: string) => void; onCreated: (t: Task) => void;
  listId?: string | null; showUser?: boolean;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ DONE: true });
  const [addingTo,  setAddingTo]  = useState<TaskStatus | null>(null);
  const [newTitle,  setNewTitle]  = useState('');
  const [adding,    setAdding]    = useState(false);

  const doneCount  = tasks.filter((t) => t.status === 'DONE').length;
  const progress   = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  const grouped = (['TODO', 'IN_PROGRESS', 'DONE'] as TaskStatus[]).reduce<Record<TaskStatus, Task[]>>(
    (acc, s) => { acc[s] = tasks.filter((t) => t.status === s); return acc; },
    {} as Record<TaskStatus, Task[]>,
  );

  async function quickAdd(status: TaskStatus) {
    if (!newTitle.trim()) { setAddingTo(null); return; }
    setAdding(true);
    try {
      const payload: Record<string, unknown> = { title: newTitle.trim(), status, priority: 'MEDIUM' };
      if (listId) payload.listId = listId;
      const res = await api.post('/tasks', payload);
      onCreated(res.data.data);
      setNewTitle(''); setAddingTo(null);
    } catch { /* silent */ } finally { setAdding(false); }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Progress bar for lists */}
      {listId && tasks.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-100 bg-white flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-navy rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-gray-500 flex-shrink-0">{doneCount}/{tasks.length} selesai</span>
        </div>
      )}

      {/* Column header */}
      <div className="grid grid-cols-[1fr_100px_100px_80px] gap-2 px-4 py-2 border-b border-gray-100 sticky top-0 bg-white z-10">
        {['Judul','Status','Prioritas','Due'].map((h) => (
          <div key={h} className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{h}</div>
        ))}
      </div>

      {(['TODO','IN_PROGRESS','DONE'] as TaskStatus[]).map((status) => {
        const group = grouped[status];
        const cfg   = STATUS_CONFIG[status];
        const Icon  = cfg.icon;
        const isCollapsed = collapsed[status];

        return (
          <div key={status}>
            <button
              onClick={() => setCollapsed((c) => ({ ...c, [status]: !c[status] }))}
              className="flex items-center gap-2 w-full px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 text-left"
            >
              {isCollapsed ? <ChevronRight size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
              <Icon size={13} className={cfg.color} />
              <span className="text-xs font-semibold text-gray-700">{cfg.label}</span>
              <span className="text-[10px] text-gray-400 ml-1">{group.length}</span>
            </button>

            {!isCollapsed && (
              <>
                {group.map((task) => (
                  <div key={task.id} className="grid grid-cols-[1fr_100px_100px_80px] gap-2 items-center">
                    <div className={cn(
                      'flex items-center gap-2 px-4 py-2.5 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors border-l-2',
                      selectedId === task.id ? 'bg-navy/5 border-l-navy' : PRIORITY_CONFIG[task.priority].border,
                    )} onClick={() => onSelect(task.id)}>
                      <button onClick={(e) => { e.stopPropagation(); onToggle(task); }}
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
                      {task.isPrivate && <Lock size={11} className="text-gray-300" />}
                      {task.assignmentStatus && <AssignBadge status={task.assignmentStatus} />}
                      {(task._count.subTasks > 0 || task._count.comments > 0) && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-1 flex-shrink-0">
                          {task._count.subTasks > 0 && <><GripVertical size={10} />{task._count.subTasks}</>}
                          {task._count.comments > 0 && <><MessageSquare size={10} />{task._count.comments}</>}
                        </span>
                      )}
                      {showUser && <p className="text-[10px] text-gray-400 truncate">{task.creator.fullName}</p>}
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
                      <button onClick={() => onDelete(task.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}

                {addingTo === status ? (
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-50 bg-blue-50/20">
                    <div className="w-4" />
                    <Circle size={14} className="text-gray-300" />
                    <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') quickAdd(status); if (e.key === 'Escape') { setAddingTo(null); setNewTitle(''); } }}
                      onBlur={() => { if (!newTitle.trim()) setAddingTo(null); }}
                      placeholder="Judul task baru…"
                      className="flex-1 text-sm outline-none bg-transparent" />
                    {adding ? <Loader2 size={13} className="animate-spin text-gray-400" /> :
                      <button onClick={() => quickAdd(status)} className="text-[11px] text-white bg-navy px-2 py-0.5 rounded">OK</button>}
                  </div>
                ) : (
                  <button onClick={() => { setAddingTo(status); setNewTitle(''); }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-xs text-gray-400 hover:text-navy hover:bg-gray-50 transition-colors border-b border-gray-50">
                    <Plus size={12} /> Tambah task
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
function BoardView({ tasks, selectedId, onSelect, onToggle, onDelete, onCreated }: {
  tasks: Task[]; selectedId: string | null; onSelect: (id: string) => void;
  onToggle: (t: Task) => void; onDelete: (id: string) => void; onCreated: (t: Task) => void;
}) {
  const [addingTo, setAddingTo] = useState<TaskStatus | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [adding,   setAdding]   = useState(false);

  const grouped = (['TODO','IN_PROGRESS','DONE'] as TaskStatus[]).reduce<Record<TaskStatus, Task[]>>(
    (acc, s) => { acc[s] = tasks.filter((t) => t.status === s); return acc; },
    {} as Record<TaskStatus, Task[]>,
  );

  async function quickAdd(status: TaskStatus) {
    if (!newTitle.trim()) { setAddingTo(null); return; }
    setAdding(true);
    try {
      const res = await api.post('/tasks', { title: newTitle.trim(), status, priority: 'MEDIUM' });
      onCreated(res.data.data);
      setNewTitle(''); setAddingTo(null);
    } catch { /* silent */ } finally { setAdding(false); }
  }

  return (
    <div className="flex-1 overflow-x-auto">
      <div className="flex gap-4 h-full px-4 py-4 min-w-max">
        {(['TODO','IN_PROGRESS','DONE'] as TaskStatus[]).map((status) => {
          const cfg = STATUS_CONFIG[status]; const group = grouped[status];
          return (
            <div key={status} className="flex flex-col w-72 flex-shrink-0">
              <div className={cn('flex items-center gap-2 px-3 py-2 rounded-t-lg mb-2', cfg.bg)}>
                <cfg.icon size={13} className={cfg.color} />
                <span className={cn('text-xs font-semibold', cfg.color)}>{cfg.label}</span>
                <span className="text-[10px] text-gray-400 ml-auto">{group.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pb-2">
                {group.map((task) => {
                  const due = fmtDue(task.dueDate);
                  return (
                    <div key={task.id}
                      onClick={() => onSelect(task.id)}
                      className={cn('group bg-white rounded-lg border p-3 shadow-sm cursor-pointer hover:shadow-md transition-all border-l-2',
                        selectedId === task.id ? 'border-navy ring-1 ring-navy/20' : `border-gray-200 ${PRIORITY_CONFIG[task.priority].border}`)}>
                      <div className="flex items-start gap-2 mb-2">
                        <button onClick={(e) => { e.stopPropagation(); onToggle(task); }}
                          className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                            task.status === 'DONE' ? 'border-green-500 bg-green-500' : 'border-gray-300 hover:border-navy')}>
                          {task.status === 'DONE' && <CheckCircle2 size={9} className="text-white" strokeWidth={3} />}
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
                        {task.isPrivate && <Lock size={10} className="text-gray-300" />}
                        {task.assignmentStatus && <AssignBadge status={task.assignmentStatus} />}
                        {task.assignee && <div className="ml-auto"><Avatar name={task.assignee.fullName} avatar={task.assignee.avatar} size={18} /></div>}
                      </div>
                    </div>
                  );
                })}
                {addingTo === status ? (
                  <div className="bg-white rounded-lg border border-navy/30 p-3 shadow-sm">
                    <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') quickAdd(status); if (e.key === 'Escape') { setAddingTo(null); setNewTitle(''); } }}
                      placeholder="Judul task…" className="w-full text-sm outline-none placeholder:text-gray-300 mb-2" />
                    <div className="flex gap-1">
                      {adding ? <Loader2 size={13} className="animate-spin text-gray-400" /> :
                        <><button onClick={() => quickAdd(status)} className="text-[11px] text-white bg-navy px-2 py-1 rounded">OK</button>
                          <button onClick={() => { setAddingTo(null); setNewTitle(''); }} className="text-[11px] text-gray-500 px-2 py-1 rounded hover:bg-gray-100">Batal</button></>}
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setAddingTo(status); setNewTitle(''); }}
                    className="flex items-center gap-1.5 w-full px-3 py-2 text-xs text-gray-400 hover:text-navy rounded-lg hover:bg-white border border-dashed border-gray-200 hover:border-navy transition-colors">
                    <Plus size={12} /> Tambah task
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Calendar View ──────────────────────────────────────────
function CalendarView({ tasks, onSelect }: { tasks: Task[]; onSelect: (id: string) => void }) {
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const year = month.getFullYear(), mi = month.getMonth();
  const daysInMonth = new Date(year, mi + 1, 0).getDate();
  const startOffset = (new Date(year, mi, 1).getDay() + 6) % 7;
  const today = new Date().toISOString().slice(0, 10);

  const byDate = tasks.reduce<Record<string, Task[]>>((acc, t) => {
    if (!t.dueDate) return acc;
    const k = t.dueDate.slice(0, 10);
    (acc[k] = acc[k] ?? []).push(t);
    return acc;
  }, {});

  const noDate = tasks.filter((t) => !t.dueDate);
  const cells  = Array.from({ length: startOffset + daysInMonth }, (_, i) => i < startOffset ? null : i - startOffset + 1);

  return (
    <div className="flex-1 overflow-hidden flex">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <button onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="p-1.5 rounded hover:bg-gray-100"><ChevronLeft size={15} /></button>
          <span className="text-sm font-semibold text-gray-800">{month.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</span>
          <button onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="p-1.5 rounded hover:bg-gray-100"><ChevronRight size={15} /></button>
        </div>
        <div className="grid grid-cols-7 border-b border-gray-100">
          {['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map((d) => <div key={d} className="text-center text-[11px] font-semibold text-gray-400 py-2">{d}</div>)}
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} className="border-b border-r border-gray-50 bg-gray-50/30 min-h-[90px]" />;
              const ds = `${year}-${String(mi+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const dayTasks = byDate[ds] ?? [];
              return (
                <div key={ds} className="border-b border-r border-gray-100 p-1.5 min-h-[90px]">
                  <div className={cn('w-6 h-6 flex items-center justify-center rounded-full text-xs mb-1 font-medium mx-auto', ds === today ? 'bg-navy text-white' : 'text-gray-600')}>{day}</div>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map((t) => (
                      <button key={t.id} onClick={() => onSelect(t.id)}
                        className={cn('block w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate',
                          t.status === 'DONE' ? 'line-through text-gray-400 bg-gray-50' :
                          cn('text-white font-medium', { 'bg-red-400': t.priority === 'URGENT', 'bg-orange-400': t.priority === 'HIGH', 'bg-blue-400': t.priority === 'MEDIUM', 'bg-gray-400': t.priority === 'LOW' }))}>
                        {t.title}
                      </button>
                    ))}
                    {dayTasks.length > 3 && <p className="text-[10px] text-gray-400 pl-1">+{dayTasks.length - 3} lagi</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {noDate.length > 0 && (
        <div className="w-48 border-l border-gray-100 flex flex-col flex-shrink-0">
          <div className="px-3 py-2.5 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500">Tanpa jadwal</p>
            <p className="text-[10px] text-gray-400">{noDate.length} task</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {noDate.map((t) => (
              <button key={t.id} onClick={() => onSelect(t.id)}
                className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded hover:bg-gray-50">
                <span className={cn('text-xs flex-1 truncate', t.status === 'DONE' && 'line-through text-gray-400')}>{t.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Detail Panel ───────────────────────────────────────────
function TaskDetailPanel({
  taskId, onClose, onUpdated, onDeleted, currentUserId,
}: {
  taskId: string; onClose: () => void;
  onUpdated: (t: Task) => void; onDeleted: (id: string) => void; currentUserId: string;
}) {
  const [task,    setTask]    = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  // Title edit
  const [editTitle, setEditTitle] = useState(false);
  const [titleVal,  setTitleVal]  = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  // Description
  const [descVal,   setDescVal]   = useState('');
  const [descFocus, setDescFocus] = useState(false);

  // Sub-tasks
  const [newSub,    setNewSub]    = useState('');
  const [addingSub, setAddingSub] = useState(false);
  const [subInput,  setSubInput]  = useState(false);

  // Comments
  const [comments,    setComments]    = useState<Comment[]>([]);
  const [commLoading, setCommLoading] = useState(false);
  const [newComment,  setNewComment]  = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  // Links
  const [newLinkUrl,   setNewLinkUrl]   = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [addingLink,   setAddingLink]   = useState(false);
  const [linkInput,    setLinkInput]    = useState(false);

  // Reject modal
  const [showReject, setShowReject] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [rejecting,  setRejecting]  = useState(false);
  const [accepting,  setAccepting]  = useState(false);

  // Users for assign picker
  const [users, setUsers] = useState<UserOption[]>([]);

  // Active tab
  const [tab, setTab] = useState<'subtasks' | 'links' | 'comments'>('subtasks');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/tasks/${taskId}`);
      const t: Task = res.data.data;
      setTask(t); setTitleVal(t.title); setDescVal(t.description ?? '');
    } catch { /* silent */ } finally { setLoading(false); }
  }, [taskId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (editTitle) titleRef.current?.focus(); }, [editTitle]);

  // Load users for assign picker
  useEffect(() => {
    api.get('/users', { params: { limit: 100 } })
      .then((r) => setUsers(r.data.data?.items ?? r.data.data ?? []))
      .catch(() => {});
  }, []);

  // Load comments when tab switches
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
    } catch { /* silent */ } finally { setSaving(false); }
  }

  async function saveTitle() {
    setEditTitle(false);
    if (!task || titleVal.trim() === task.title) return;
    if (!titleVal.trim()) { setTitleVal(task.title); return; }
    await patch({ title: titleVal.trim() });
  }

  async function saveDesc() {
    setDescFocus(false);
    if (!task) return;
    const val = descVal.trim() || null;
    if (val === (task.description ?? null)) return;
    await patch({ description: val });
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
    } catch { /* silent */ } finally { setAddingSub(false); }
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

  async function handleDelete() {
    if (!task || !confirm('Hapus task ini?')) return;
    try { await api.delete(`/tasks/${task.id}`); onDeleted(task.id); onClose(); } catch { /* silent */ }
  }

  async function handleAccept() {
    if (!task) return;
    setAccepting(true);
    try {
      const res = await api.post(`/tasks/${task.id}/accept`);
      const updated = { ...res.data.data, subTasks: task.subTasks };
      setTask(updated); onUpdated(res.data.data);
    } catch { /* silent */ } finally { setAccepting(false); }
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
    } catch { /* silent */ } finally { setRejecting(false); }
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
    } catch { /* silent */ } finally { setSubmitting(false); }
  }

  async function deleteComment(id: string) {
    if (!task) return;
    try {
      await api.delete(`/tasks/${task.id}/comments/${id}`);
      setComments((c) => c.filter((x) => x.id !== id));
      setTask((p) => p ? { ...p, _count: { ...p._count, comments: Math.max(0, p._count.comments - 1) } } : p);
    } catch { /* silent */ }
  }

  async function addLink(e: FormEvent) {
    e.preventDefault();
    if (!task || !newLinkUrl.trim()) return;
    setAddingLink(true);
    try {
      const res = await api.post(`/tasks/${task.id}/links`, { url: newLinkUrl.trim(), title: newLinkTitle.trim() || undefined });
      setTask((p) => p ? { ...p, links: [...p.links, res.data.data] } : p);
      setNewLinkUrl(''); setNewLinkTitle(''); setLinkInput(false);
    } catch { /* silent */ } finally { setAddingLink(false); }
  }

  async function deleteLink(linkId: string) {
    if (!task) return;
    try {
      await api.delete(`/tasks/${task.id}/links/${linkId}`);
      setTask((p) => p ? { ...p, links: p.links.filter((l) => l.id !== linkId) } : p);
    } catch { /* silent */ }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 size={20} className="animate-spin text-gray-300" />
    </div>
  );
  if (!task) return <div className="flex items-center justify-center h-full"><p className="text-sm text-gray-400">Task tidak ditemukan</p></div>;

  const doneSubCount = task.subTasks?.filter((s) => s.status === 'DONE').length ?? 0;
  const totalSub     = task.subTasks?.length ?? 0;
  const subProgress  = totalSub > 0 ? Math.round((doneSubCount / totalSub) * 100) : 0;
  const isAssignee   = task.assignee?.id === currentUserId;
  const isPending    = task.assignmentStatus === 'PENDING' && isAssignee;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
          <ChevronsRight size={16} />
        </button>
        {saving && <Loader2 size={13} className="animate-spin text-gray-400 ml-1" />}
        <div className="flex-1" />
        <button onClick={handleDelete} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50">
          <Trash2 size={13} /> Hapus
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-5 pb-10 space-y-5">

          {/* Assignment banner */}
          {isPending && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">
                Task ini ditugaskan kepadamu oleh {task.creator.fullName}
              </p>
              {!showReject ? (
                <div className="flex gap-2 mt-2">
                  <button onClick={handleAccept} disabled={accepting}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg disabled:opacity-50">
                    {accepting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Terima
                  </button>
                  <button onClick={() => setShowReject(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg">
                    <XCircle size={12} /> Tolak
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReject} className="mt-2 space-y-2">
                  <textarea
                    autoFocus
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    placeholder="Tulis alasan penolakan…"
                    rows={2}
                    className="w-full text-xs border border-amber-200 rounded p-2 outline-none focus:border-amber-400 resize-none"
                  />
                  <div className="flex gap-2">
                    <button type="submit" disabled={rejecting || !rejectNote.trim()}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded disabled:opacity-50">
                      {rejecting ? <Loader2 size={12} className="animate-spin inline mr-1" /> : null}Kirim Penolakan
                    </button>
                    <button type="button" onClick={() => { setShowReject(false); setRejectNote(''); }}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded">Batal</button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Rejected note */}
          {task.assignmentStatus === 'REJECTED' && task.assignmentNote && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
              <p className="font-semibold mb-1">Task ditolak</p>
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
            {/* Status */}
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

            {/* Priority */}
            <div className="flex items-center gap-3 px-1 py-2 rounded hover:bg-gray-50">
              <div className="flex items-center gap-2 w-24 flex-shrink-0">
                <PriorityDot priority={task.priority} />
                <span className="text-xs text-gray-400">Prioritas</span>
              </div>
              <select value={task.priority} onChange={(e) => patch({ priority: e.target.value })}
                className="text-xs bg-transparent outline-none cursor-pointer text-gray-700 hover:text-navy">
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            {/* Due date */}
            <div className="flex items-center gap-3 px-1 py-2 rounded hover:bg-gray-50">
              <div className="flex items-center gap-2 w-24 flex-shrink-0">
                <Calendar size={13} className="text-gray-400" />
                <span className="text-xs text-gray-400">Due date</span>
              </div>
              <input type="date" value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                onChange={(e) => patch({ dueDate: e.target.value ? toLocalISO(e.target.value) : null })}
                className="text-xs bg-transparent outline-none cursor-pointer text-gray-700 hover:text-navy" />
            </div>

            {/* Assign to */}
            <div className="flex items-center gap-3 px-1 py-2 rounded hover:bg-gray-50">
              <div className="flex items-center gap-2 w-24 flex-shrink-0">
                <User size={13} className="text-gray-400" />
                <span className="text-xs text-gray-400">Assign ke</span>
              </div>
              <select value={task.assignee?.id ?? ''}
                onChange={(e) => patch({ assignedToId: e.target.value || null })}
                className="text-xs bg-transparent outline-none cursor-pointer text-gray-700 hover:text-navy max-w-[160px]">
                <option value="">— Tidak diassign —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </select>
            </div>

            {/* Private */}
            <div className="flex items-center gap-3 px-1 py-2 rounded hover:bg-gray-50">
              <div className="flex items-center gap-2 w-24 flex-shrink-0">
                {task.isPrivate ? <Lock size={13} className="text-gray-400" /> : <Unlock size={13} className="text-gray-400" />}
                <span className="text-xs text-gray-400">Private</span>
              </div>
              <button onClick={() => patch({ isPrivate: !task.isPrivate })}
                className={cn('w-8 h-4 rounded-full transition-colors relative flex-shrink-0', task.isPrivate ? 'bg-navy' : 'bg-gray-200')}>
                <span className={cn('absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all', task.isPrivate ? 'left-4' : 'left-0.5')} />
              </button>
            </div>

            {/* Creator */}
            <div className="flex items-center gap-3 px-1 py-2 rounded hover:bg-gray-50">
              <div className="flex items-center gap-2 w-24 flex-shrink-0">
                <User size={13} className="text-gray-400" />
                <span className="text-xs text-gray-400">Dibuat oleh</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Avatar name={task.creator.fullName} avatar={task.creator.avatar} size={16} />
                <span className="text-xs text-gray-500">{task.creator.fullName}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Description */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <FileText size={13} className="text-gray-400" />
              <span className="text-xs font-medium text-gray-500">Deskripsi</span>
            </div>
            <textarea value={descVal} onChange={(e) => setDescVal(e.target.value)}
              onFocus={() => setDescFocus(true)} onBlur={saveDesc}
              rows={descFocus ? 5 : 3} placeholder="Tambah deskripsi…"
              className="w-full text-sm text-gray-700 placeholder:text-gray-300 outline-none resize-none leading-relaxed" />
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

            {/* Subtasks tab */}
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
                    <button onClick={() => setSubInput(true)}
                      className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-navy ml-2">
                      <Plus size={12} /> Tambah
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
                      <button onClick={() => deleteSubTask(sub.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all">
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
                      placeholder="Nama subtask…"
                      className="flex-1 text-sm text-gray-800 outline-none placeholder:text-gray-300" />
                    {addingSub ? <Loader2 size={13} className="animate-spin text-gray-400" /> :
                      <div className="flex gap-1">
                        <button type="submit" disabled={!newSub.trim()} className="text-[11px] px-2 py-1 bg-navy text-white rounded disabled:opacity-40">OK</button>
                        <button type="button" onClick={() => setSubInput(false)} className="text-[11px] px-2 py-1 text-gray-500 hover:bg-gray-100 rounded">Batal</button>
                      </div>}
                  </form>
                )}
              </div>
            )}

            {/* Links tab */}
            {tab === 'links' && (
              <div className="space-y-2">
                {task.links.map((link) => (
                  <div key={link.id} className="group flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <Link2 size={13} className="text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      {link.title && <p className="text-xs font-medium text-gray-700 truncate">{link.title}</p>}
                      <a href={link.url} target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
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
                  <button onClick={() => setLinkInput(true)}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-navy transition-colors">
                    <Plus size={12} /> Tambah link
                  </button>
                ) : (
                  <form onSubmit={addLink} className="space-y-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <input value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)}
                      placeholder="https://…" autoFocus
                      className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-navy" />
                    <input value={newLinkTitle} onChange={(e) => setNewLinkTitle(e.target.value)}
                      placeholder="Nama link (opsional)"
                      className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-navy" />
                    <div className="flex gap-1">
                      <button type="submit" disabled={!newLinkUrl.trim() || addingLink}
                        className="text-[11px] px-2 py-1 bg-navy text-white rounded disabled:opacity-40">
                        {addingLink ? <Loader2 size={10} className="animate-spin inline mr-1" /> : null}Tambah
                      </button>
                      <button type="button" onClick={() => { setLinkInput(false); setNewLinkUrl(''); setNewLinkTitle(''); }}
                        className="text-[11px] px-2 py-1 text-gray-500 hover:bg-gray-200 rounded">Batal</button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Comments tab */}
            {tab === 'comments' && (
              <div className="space-y-3">
                {commLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 size={16} className="animate-spin text-gray-300" />
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">Belum ada catatan</p>
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
                    placeholder="Tulis catatan… (Enter kirim, Shift+Enter baris baru)"
                    rows={2}
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-navy resize-none" />
                  <button type="submit" disabled={!newComment.trim() || submitting}
                    className="flex-shrink-0 px-3 py-1 text-xs font-medium text-white bg-navy rounded-lg hover:bg-navy-light disabled:opacity-40 self-end">
                    {submitting ? <Loader2 size={12} className="animate-spin" /> : 'Kirim'}
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
function CreateTaskModal({ onClose, onCreated, defaultListId }: {
  onClose: () => void; onCreated: (t: Task) => void; defaultListId?: string | null;
}) {
  const [title,      setTitle]      = useState('');
  const [desc,       setDesc]       = useState('');
  const [status,     setStatus]     = useState<TaskStatus>('TODO');
  const [priority,   setPriority]   = useState<TaskPriority>('MEDIUM');
  const [dueDate,    setDueDate]    = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [isPrivate,  setIsPrivate]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');
  const [users,      setUsers]      = useState<UserOption[]>([]);

  useEffect(() => {
    api.get('/users', { params: { limit: 100 } })
      .then((r) => setUsers(r.data.data?.items ?? r.data.data ?? []))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Judul wajib diisi'); return; }
    setSaving(true); setError('');
    try {
      const payload: Record<string, unknown> = { title: title.trim(), status, priority, isPrivate };
      if (desc.trim())      payload.description  = desc.trim();
      if (dueDate)          payload.dueDate       = toLocalISO(dueDate);
      if (assignedTo)       payload.assignedToId  = assignedTo;
      if (defaultListId)    payload.listId        = defaultListId;
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
          <h2 className="text-sm font-semibold text-gray-800">Task Baru</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <input autoFocus type="text" placeholder="Judul task…" value={title}
            onChange={(e) => { setTitle(e.target.value); setError(''); }}
            className="w-full text-base font-medium text-gray-900 outline-none placeholder:text-gray-300 border-b border-gray-200 pb-2 focus:border-navy transition-colors" />

          <textarea placeholder="Deskripsi (opsional)…" value={desc} onChange={(e) => setDesc(e.target.value)}
            rows={2}
            className="w-full text-sm text-gray-700 placeholder:text-gray-300 outline-none resize-none border-b border-gray-100 pb-2 focus:border-gray-200" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 outline-none focus:border-navy">
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Prioritas</label>
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
              <label className="block text-xs text-gray-500 mb-1">Assign ke</label>
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 outline-none focus:border-navy">
                <option value="">— Tidak diassign —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 accent-navy" />
            <Lock size={13} className="text-gray-400" />
            <span className="text-xs text-gray-600">Private (hanya saya yang bisa melihat)</span>
          </label>

          {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50">Batal</button>
            <button type="submit" disabled={saving || !title.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-navy rounded hover:bg-navy-light disabled:opacity-50">
              {saving && <Loader2 size={13} className="animate-spin" />} Buat Task
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
  const [name,  setName]  = useState('');
  const [color, setColor] = useState('#6366f1');
  const [icon,  setIcon]  = useState('');
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
    } catch { /* silent */ } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">List Baru</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <input autoFocus type="text" placeholder="Nama list…" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded px-3 py-2 outline-none focus:border-navy" />
          <input type="text" placeholder="Emoji icon (opsional)" value={icon} onChange={(e) => setIcon(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded px-3 py-2 outline-none focus:border-navy" />
          <div>
            <p className="text-xs text-gray-500 mb-2">Warna</p>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={cn('w-6 h-6 rounded-full transition-all', color === c && 'ring-2 ring-offset-1 ring-gray-400')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50">Batal</button>
            <button type="submit" disabled={saving || !name.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-navy rounded hover:bg-navy-light disabled:opacity-50">
              {saving && <Loader2 size={13} className="animate-spin" />} Buat List
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function TasksPage() {
  const { user } = useAuthStore();
  const canSeeTeam = MANAGER_ROLES.includes(user?.role ?? '');
  const location   = useLocation();

  const [sidebarView,  setSidebarView]  = useState<SidebarView>('my_day');
  const [viewMode,     setViewMode]     = useState<ViewMode>('list');
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
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [priFilter,    setPriFilter]   = useState<TaskPriority | ''>('');
  const [toggleError,  setToggleError]  = useState<string | null>(null);

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

  // Load pending count
  const loadPendingCount = useCallback(async () => {
    try {
      const res = await api.get('/tasks/pending-count');
      setPendingCount(res.data.data?.count ?? 0);
    } catch { /* silent */ }
  }, []);

  // Single mount effect — load lists + pending count together
  useEffect(() => {
    loadLists();
    loadPendingCount();
  }, [loadLists, loadPendingCount]);

  // Open task from navigation state (e.g. from Dashboard)
  useEffect(() => {
    const state = location.state as { selectedTaskId?: string } | null;
    if (state?.selectedTaskId) {
      setSelectedId(state.selectedTaskId);
      setSidebarView('all');
      window.history.replaceState({}, '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load tasks when view/filters change
  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      let tasks: Task[] = [];
      if (sidebarView === 'team') {
        const params: Record<string, string> = { limit: '100' };
        if (debSearch)    params.search   = debSearch;
        if (statusFilter) params.status   = statusFilter;
        if (priFilter)    params.priority = priFilter;
        const res = await api.get('/tasks/team', { params });
        tasks = res.data.data ?? [];
      } else {
        const params: Record<string, string> = { limit: '100' };
        if (sidebarView.startsWith('list:')) {
          params.view   = 'list';
          params.listId = sidebarView.slice(5);
        } else {
          params.view = sidebarView;
        }
        if (debSearch)    params.search   = debSearch;
        if (statusFilter) params.status   = statusFilter;
        if (priFilter)    params.priority = priFilter;
        const res = await api.get('/tasks', { params });
        tasks = res.data.data ?? [];
      }
      setTasks(tasks);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [sidebarView, debSearch, statusFilter, priFilter]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // View labels
  const VIEW_LABELS: Record<string, string> = {
    my_day: 'My Day', assigned: 'Assigned to Me', all: 'All Tasks', team: 'Team Tasks',
  };
  const activeListId = sidebarView.startsWith('list:') ? sidebarView.slice(5) : null;
  const activeList   = taskLists.find((l) => l.id === activeListId);
  const pageTitle    = activeList ? `${activeList.icon ?? ''}${activeList.icon ? ' ' : ''}${activeList.name}` : (VIEW_LABELS[sidebarView] ?? 'Tasks');

  const handleTaskUpdated = useCallback((task: Task) => {
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, ...task } : t));
    loadPendingCount();
  }, [loadPendingCount]);

  const handleTaskCreated = useCallback((task: Task) => {
    setTasks((prev) => [task, ...prev]);
    setSelectedId(task.id);
    loadPendingCount();
    loadLists();
  }, [loadPendingCount, loadLists]);

  const handleTaskDeleted = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSelectedId((prev) => prev === id ? null : prev);
    loadLists();
  }, [loadLists]);

  const handleToggle = useCallback(async (task: Task) => {
    // Block toggle if task is pending assignment
    if (task.assignmentStatus === 'PENDING') return;

    const next: TaskStatus = task.status === 'DONE' ? 'TODO' : 'DONE';
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: next } : t));
    try {
      const res = await api.patch(`/tasks/${task.id}`, { status: next });
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, ...res.data.data } : t));
    } catch (err) {
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: task.status } : t));
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) {
        setToggleError(msg);
        setTimeout(() => setToggleError(null), 4000);
      }
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Hapus task ini?')) return;
    handleTaskDeleted(id);
    try { await api.delete(`/tasks/${id}`); } catch { loadTasks(); }
  }, [handleTaskDeleted, loadTasks]);

  const doneCount = tasks.filter((t) => t.status === 'DONE').length;

  return (
    <div className="flex h-full -m-6 overflow-hidden">
      {/* Toggle error toast */}
      {toggleError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg max-w-sm text-center">
          <AlertCircle size={15} className="text-amber-400 flex-shrink-0" />
          {toggleError}
        </div>
      )}

      {/* Sidebar */}
      <Sidebar
        active={sidebarView}
        onSelect={(v) => { setSidebarView(v); setSelectedId(null); }}
        taskLists={taskLists}
        pendingCount={pendingCount}
        canSeeTeam={canSeeTeam}
        onNewList={() => setShowNewList(true)}
        loadingLists={loadingLists}
      />

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-white">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 flex-shrink-0 flex-wrap bg-white">
          <h1 className="text-sm font-semibold text-gray-800 mr-1">{pageTitle}</h1>

          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {([
              { v: 'list'     as const, icon: LayoutList,   label: 'List'  },
              { v: 'board'    as const, icon: Columns3,     label: 'Board' },
              { v: 'calendar' as const, icon: CalendarDays, label: 'Cal'   },
            ]).map(({ v, icon: Icon, label }) => (
              <button key={v} onClick={() => setViewMode(v)}
                className={cn('flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
                  viewMode === v ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                <Icon size={12} />{label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Cari…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-7 pr-6 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-navy w-36" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X size={11} /></button>}
          </div>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TaskStatus | '')}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-navy text-gray-600">
            <option value="">Status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>

          <select value={priFilter} onChange={(e) => setPriFilter(e.target.value as TaskPriority | '')}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-navy text-gray-600">
            <option value="">Prioritas</option>
            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>

          {(search || statusFilter || priFilter) && (
            <button onClick={() => { setSearch(''); setStatusFilter(''); setPriFilter(''); }}
              className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
              <X size={11} /> Reset
            </button>
          )}

          <div className="flex-1" />
          {!loading && <span className="text-xs text-gray-400">{doneCount}/{tasks.length} selesai</span>}

          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-navy hover:bg-navy-light rounded-lg">
            <Plus size={13} /> Task Baru
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-2">
                <Loader2 size={24} className="animate-spin text-gray-300" />
                <p className="text-sm text-gray-400">Memuat tasks…</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-3 text-gray-400">
                <LayoutList size={32} className="text-gray-200" />
                <p className="text-sm">Belum ada task di sini</p>
                <button onClick={() => setShowCreate(true)}
                  className="flex items-center gap-1.5 text-xs text-navy hover:underline">
                  <Plus size={12} /> Buat task pertama
                </button>
              </div>
            ) : viewMode === 'list' ? (
              <ListView
                tasks={tasks}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onCreated={handleTaskCreated}
                listId={activeListId}
                showUser={sidebarView === 'team'}
              />
            ) : viewMode === 'board' ? (
              <BoardView
                tasks={tasks}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onCreated={handleTaskCreated}
              />
            ) : (
              <CalendarView tasks={tasks} onSelect={setSelectedId} />
            )}
          </div>

          {/* Detail panel */}
          {selectedId && (
            <div className="w-[400px] flex-shrink-0 border-l border-gray-200 flex flex-col min-h-0">
              <TaskDetailPanel
                key={selectedId}
                taskId={selectedId}
                onClose={() => setSelectedId(null)}
                onUpdated={handleTaskUpdated}
                onDeleted={handleTaskDeleted}
                currentUserId={user?.id ?? ''}
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
