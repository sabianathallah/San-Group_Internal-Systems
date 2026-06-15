import { useEffect, useState, useRef, useCallback, FormEvent } from 'react';
import {
  Star, AlertCircle, Megaphone, Users,
  ArrowRight, CheckCircle2, Circle,
  Loader2, Sun, ChevronDown, ChevronRight,
  Plus, Pin,
  TrendingUp,
  BarChart3, UserCheck,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore, Task, isInMyDay } from '@/stores/taskStore';
import { useNoteStore } from '@/stores/noteStore';
import { ROUTES } from '@/lib/constants';
import api from '@/lib/api';
import { cn } from '@/lib/cn';

// ── Helpers ────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Good morning';
  if (h < 15) return 'Good afternoon';
  return 'Good evening';
}

function formatDateShort(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function relativeDate(iso: string | null): { label: string; overdue: boolean } {
  if (!iso) return { label: '', overdue: false };
  const d    = new Date(iso);
  const now  = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
  if (diff < 0)  return { label: `${Math.abs(diff)}d overdue`, overdue: true };
  if (diff === 0) return { label: 'Today', overdue: false };
  if (diff === 1) return { label: 'Tomorrow', overdue: false };
  return {
    label: d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
    overdue: false,
  };
}

function bulletinAge(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7)  return `${diff} days ago`;
  return new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
}

// ── Types ──────────────────────────────────────────────────
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type BulletinPriority = 'NORMAL' | 'IMPORTANT' | 'URGENT';

interface Bulletin {
  id:          string;
  title:       string;
  priority:    BulletinPriority;
  category:    string;
  publishedAt: string | null;
  isRead:      boolean;
}

interface TaskStats {
  personal: { todo: number; inProgress: number; done: number; assigned: number };
  team:     { total: number; done: number; inProgress: number; memberCount: number } | null;
  system:   { totalUsers: number; totalTasks: number; totalBulletins: number } | null;
}

// ── Config ─────────────────────────────────────────────────
const PRIORITY_COLOR: Record<TaskPriority, string> = {
  URGENT: 'text-danger',
  HIGH:   'text-warning',
  MEDIUM: 'text-info',
  LOW:    'text-gray-300',
};

const BULLETIN_BADGE: Record<BulletinPriority, { bg: string; dot: string }> = {
  URGENT:    { bg: 'bg-danger/10 text-danger',   dot: 'bg-danger'  },
  IMPORTANT: { bg: 'bg-warning/10 text-warning', dot: 'bg-warning' },
  NORMAL:    { bg: 'bg-gray-100 text-gray-500',  dot: 'bg-gray-400'},
};

const BULLETIN_LABEL: Record<BulletinPriority, string> = {
  URGENT: 'Urgent', IMPORTANT: 'Important', NORMAL: 'General',
};

const NOTE_COLOR: Record<string, { bg: string; border: string }> = {
  yellow: { bg: 'bg-yellow-50',  border: 'border-yellow-200' },
  blue:   { bg: 'bg-blue-50',    border: 'border-blue-200'   },
  green:  { bg: 'bg-green-50',   border: 'border-green-200'  },
  pink:   { bg: 'bg-pink-50',    border: 'border-pink-200'   },
  purple: { bg: 'bg-purple-50',  border: 'border-purple-200' },
  gray:   { bg: 'bg-gray-50',    border: 'border-gray-300'   },
  orange: { bg: 'bg-orange-50',  border: 'border-orange-200' },
};

// ── Progress Ring ──────────────────────────────────────────
function ProgressRing({ done, total, size = 60 }: { done: number; total: number; size?: number }) {
  const pct    = total === 0 ? 0 : Math.round((done / total) * 100);
  const r      = (size - 8) / 2;
  const circ   = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={4} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke="white" strokeWidth={4}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-white font-bold" style={{ fontSize: size * 0.22 }}>
          {total === 0 ? '—' : `${pct}%`}
        </span>
      </div>
    </div>
  );
}

// ── Task Row ───────────────────────────────────────────────
function TaskRow({ task, onNavigate }: { task: Task; onNavigate: (id: string) => void }) {
  const isDone     = task.status === 'DONE';
  const isProgress = task.status === 'IN_PROGRESS';
  const isPending  = task.assignmentStatus === 'PENDING';
  const { label: dueLabel, overdue } = task.dueDate
    ? relativeDate(task.dueDate)
    : { label: '', overdue: false };

  const dotColor = isDone ? '#22c55e' : isPending ? '#f59e0b' : isProgress ? '#3b82f6' : '#d1d5db';

  return (
    <button
      onClick={() => onNavigate(task.id)}
      className="group flex items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-0 w-full text-left hover:bg-gray-50/70 transition-colors"
    >
      <span
        className="flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center"
        style={{ borderColor: dotColor, backgroundColor: isDone ? dotColor : 'transparent' }}
      >
        {isDone && <CheckCircle2 size={9} className="text-white" strokeWidth={3} />}
        {!isDone && (isProgress || isPending) && (
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
        )}
      </span>

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm text-gray-800 truncate', isDone && 'line-through text-gray-400')}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {isPending && (
            <span className="text-[10px] font-medium text-amber-500">Waiting</span>
          )}
          {isProgress && !isPending && (
            <span className="text-[10px] font-medium text-info">In progress</span>
          )}
          {dueLabel && (
            <span className={cn('text-[10px]', overdue ? 'text-danger font-semibold' : 'text-gray-400')}>
              {dueLabel}
            </span>
          )}
          {task.assignee && !isDone && (
            <span className="text-[10px] text-gray-400 truncate">· {task.assignee.fullName}</span>
          )}
        </div>
      </div>

      <Star
        size={12}
        className={cn('flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity', PRIORITY_COLOR[task.priority])}
        fill={task.priority === 'URGENT' || task.priority === 'HIGH' ? 'currentColor' : 'none'}
      />
      <ArrowRight size={12} className="flex-shrink-0 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ── Quick Add Task ─────────────────────────────────────────
function QuickAddTask({ onAdded }: { onAdded: (task: Task) => void }) {
  const [active, setActive] = useState(false);
  const [title,  setTitle]  = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function open() {
    setActive(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await api.post('/tasks', { title: title.trim(), status: 'TODO', priority: 'MEDIUM', myDay: true });
      onAdded(res.data.data);
      setTitle('');
      setActive(false);
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  }

  if (!active) {
    return (
      <button
        onClick={open}
        className="flex items-center gap-2.5 w-full px-5 py-3.5 text-sm text-gray-400 hover:text-navy hover:bg-gray-50/60 transition-colors border-t border-gray-100"
      >
        <Plus size={15} className="text-navy" />
        Add task to My Day
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2.5 px-5 py-3 border-t border-navy/20 bg-navy/5">
      <Circle size={16} className="text-gray-300 flex-shrink-0" />
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setActive(false)}
        placeholder="Enter task title..."
        className="flex-1 text-sm bg-transparent outline-none text-gray-800 placeholder:text-gray-400"
      />
      <button
        type="submit" disabled={saving || !title.trim()}
        className="px-3 py-1 text-xs font-medium text-white bg-navy rounded hover:bg-navy-light disabled:opacity-40 transition-colors"
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : 'Add'}
      </button>
      <button type="button" onClick={() => setActive(false)} className="text-xs text-gray-400 hover:text-gray-600">
        Cancel
      </button>
    </form>
  );
}

// ── Personal Stats Strip ───────────────────────────────────
function PersonalStats({ stats, loading }: { stats: TaskStats | null; loading: boolean }) {
  const items = [
    { label: 'To Do',    value: stats?.personal.todo,       color: 'text-blue-600'   },
    { label: 'Active',   value: stats?.personal.inProgress, color: 'text-amber-600'  },
    { label: 'Done',     value: stats?.personal.done,       color: 'text-green-600'  },
    { label: 'Awaiting', value: stats?.personal.assigned,   color: 'text-orange-600' },
  ];

  return (
    <div className="px-4 pt-3 pb-3 bg-white border-b border-gray-100">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">My Tasks</p>
      <div className="grid grid-cols-4 gap-1.5">
        {items.map(({ label, value, color }) => (
          <div key={label} className="rounded-lg bg-gray-50 py-2.5 text-center">
            {loading ? (
              <div className="h-5 w-6 mx-auto rounded bg-gray-200 animate-pulse mb-1" />
            ) : (
              <p className={cn('text-lg font-bold leading-tight', color)}>{value ?? 0}</p>
            )}
            <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Team Stats ─────────────────────────────────────────────
function TeamStats({ stats, loading, roleLevel }: { stats: TaskStats | null; loading: boolean; roleLevel: number }) {
  if (roleLevel > 5) return null;

  const teamDonePct = stats?.team && stats.team.total > 0
    ? Math.round((stats.team.done / stats.team.total) * 100)
    : 0;

  const label = roleLevel <= 3 ? 'My Division' : 'My Team';

  return (
    <div className="px-4 pt-3 pb-3 bg-white border-b border-gray-100">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      {loading ? (
        <div className="h-12 rounded-lg bg-gray-100 animate-pulse" />
      ) : stats?.team ? (
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-base font-bold text-gray-800">{stats.team.total}</p>
            <p className="text-[10px] text-gray-400">Tasks</p>
          </div>
          <div>
            <p className="text-base font-bold text-navy">{teamDonePct}%</p>
            <p className="text-[10px] text-gray-400">Done</p>
          </div>
          <div>
            <p className="text-base font-bold text-gray-800">{stats.team.memberCount}</p>
            <p className="text-[10px] text-gray-400">Members</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400 py-2 text-center">No team data</p>
      )}
    </div>
  );
}

// ── System Stats (Admin only) ──────────────────────────────
function SystemStats({ stats, loading }: { stats: TaskStats | null; loading: boolean }) {
  if (!stats?.system) return null;

  return (
    <div className="px-4 pt-3 pb-3 bg-white border-b border-gray-100">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">System</p>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        {[
          { label: 'Users',    value: stats.system.totalUsers     },
          { label: 'Tasks',    value: stats.system.totalTasks     },
          { label: 'Bulletin', value: stats.system.totalBulletins },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-gray-50 py-2.5">
            {loading ? (
              <div className="h-5 w-6 mx-auto rounded bg-gray-200 animate-pulse mb-1" />
            ) : (
              <p className="text-base font-bold text-gray-800">{value}</p>
            )}
            <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────
export default function DashboardPage() {
  const user      = useAuthStore((s) => s.user);
  const navigate  = useNavigate();
  const roleLevel = user?.role?.level ?? 99;
  const isAdmin   = roleLevel <= 2;

  const allTasks    = useTaskStore((s) => s.tasks);
  const taskLoading = useTaskStore((s) => s.loading);
  const addTask     = useTaskStore((s) => s.addTask);

  const goToTask = useCallback((taskId: string) => {
    navigate(ROUTES.TASKS, { state: { selectedTaskId: taskId } });
  }, [navigate]);

  const allNotes = useNoteStore((s) => s.notes);

  const [bulletins,    setBulletins]    = useState<Bulletin[]>([]);
  const [activeUsers,  setActiveUsers]  = useState(0);
  const [showDone,     setShowDone]     = useState(false);
  const [stats,        setStats]        = useState<TaskStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    useTaskStore.getState().fetchTasks();
    useNoteStore.getState().fetchNotes();

    api.get('/bulletins', { params: { limit: 50 } })
      .then((r) => setBulletins(r.data.data ?? []))
      .catch(() => {});

    api.get('/tasks/stats')
      .then((r) => setStats(r.data.data ?? null))
      .catch(() => {})
      .finally(() => setStatsLoading(false));

    if (isAdmin) {
      api.get('/users', { params: { isActive: 'true', limit: 1 } })
        .then((r) => setActiveUsers(r.data.meta?.total ?? 0))
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const myDayTasks      = allTasks.filter(isInMyDay);
  const active          = myDayTasks.filter((t) => t.status !== 'DONE');
  const done            = myDayTasks.filter((t) => t.status === 'DONE');
  const overdue         = active.filter((t) => t.dueDate && new Date(t.dueDate) < now);
  const unreadBulletins = bulletins.filter((b) => !b.isRead);
  const awaiting        = stats?.personal.assigned ?? 0;

  const sortedActive = [...active].sort((a, b) => {
    const aOver = a.dueDate && new Date(a.dueDate) < now;
    const bOver = b.dueDate && new Date(b.dueDate) < now;
    if (aOver && !bOver) return -1;
    if (!aOver && bOver) return  1;
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return  1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  const dashNotes  = allNotes.filter((n) => n.isPinned).slice(0, 4);
  const firstName  = user?.fullName?.split(' ')[0] ?? 'User';

  return (
    <div className="space-y-0 -m-6">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="bg-navy px-8 pt-8 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white/40 text-xs font-medium tracking-widest uppercase mb-1">
              {formatDateShort()}
            </p>
            <h1 className="text-white text-2xl font-semibold leading-tight">
              {getGreeting()}, {firstName}
            </h1>
            <p className="text-white/50 text-sm mt-1">
              {myDayTasks.length === 0
                ? 'No tasks in My Day — add one below'
                : active.length === 0
                  ? 'All My Day tasks completed!'
                  : `${active.length} task${active.length !== 1 ? 's' : ''} remaining today`}
            </p>
            {user?.role && (
              <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-medium text-white/50 bg-white/10 px-2 py-0.5 rounded-full">
                <TrendingUp size={9} />
                {user.role.name}
                {user.division?.name && ` · ${user.division.name}`}
              </span>
            )}
          </div>

          <div className="flex flex-col items-center gap-1">
            {taskLoading
              ? <div className="w-14 h-14 rounded-full border-4 border-white/20 animate-pulse" />
              : <ProgressRing done={done.length} total={myDayTasks.length} />
            }
            <p className="text-white/40 text-[10px]">
              {done.length}/{myDayTasks.length} done
            </p>
          </div>
        </div>

        {/* Alert chips — only shown when non-zero */}
        {(overdue.length > 0 || unreadBulletins.length > 0 || awaiting > 0 || (isAdmin && activeUsers > 0)) && (
          <div className="flex items-center gap-2.5 mt-5 flex-wrap">
            {overdue.length > 0 && (
              <AlertChip icon={AlertCircle} label={`${overdue.length} overdue`} danger />
            )}
            {unreadBulletins.length > 0 && (
              <AlertChip icon={Megaphone} label={`${unreadBulletins.length} unread`} />
            )}
            {awaiting > 0 && (
              <AlertChip icon={UserCheck} label={`${awaiting} awaiting`} />
            )}
            {isAdmin && activeUsers > 0 && (
              <AlertChip icon={Users} label={`${activeUsers} users`} />
            )}
          </div>
        )}
      </div>

      {/* ── Body ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 bg-gray-50 min-h-[calc(100vh-220px)]">

        {/* ── Left: My Day tasks (2/3) ── */}
        <div className="col-span-2 bg-white border-r border-gray-100">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 sticky top-0 bg-white z-10">
            <div className="flex items-center gap-2">
              <Sun size={15} className="text-navy" />
              <span className="text-sm font-semibold text-gray-800">My Day</span>
              {active.length > 0 && (
                <span className="text-[10px] font-semibold text-white bg-navy rounded-full px-1.5 py-0.5 leading-none">
                  {active.length}
                </span>
              )}
            </div>
            <Link to={ROUTES.TASKS} className="flex items-center gap-1 text-xs text-gray-400 hover:text-navy transition-colors">
              All tasks <ArrowRight size={11} />
            </Link>
          </div>

          {taskLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Loader2 size={22} className="animate-spin text-gray-300" />
              <p className="text-xs text-gray-400">Loading tasks…</p>
            </div>
          ) : sortedActive.length === 0 && done.length === 0 ? (
            <EmptyMyDay onNavigate={() => navigate(ROUTES.TASKS)} />
          ) : (
            <>
              {sortedActive.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <CheckCircle2 size={28} className="text-success" />
                  <p className="text-sm font-medium text-gray-700">All tasks done for today!</p>
                </div>
              ) : (
                sortedActive.map((task) => (
                  <TaskRow key={task.id} task={task} onNavigate={goToTask} />
                ))
              )}

              <QuickAddTask onAdded={(t) => addTask(t)} />

              {done.length > 0 && (
                <div className="border-t border-gray-100">
                  <button
                    onClick={() => setShowDone((v) => !v)}
                    className="flex items-center gap-2 w-full px-5 py-3 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    {showDone ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    <span className="font-medium">Completed</span>
                    <span className="ml-1 text-gray-400">{done.length}</span>
                  </button>
                  {showDone && done.map((task) => (
                    <TaskRow key={task.id} task={task} onNavigate={goToTask} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Right panel (1/3) ── */}
        <div className="col-span-1 flex flex-col overflow-y-auto">

          {/* Personal task stats */}
          <PersonalStats stats={stats} loading={statsLoading} />

          {/* Team / Division stats */}
          <TeamStats stats={stats} loading={statsLoading} roleLevel={roleLevel} />

          {/* System stats (Admin+) */}
          {isAdmin && <SystemStats stats={stats} loading={statsLoading} />}

          {/* Bulletin */}
          <div className="flex-shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Megaphone size={14} className="text-navy" />
                <span className="text-sm font-semibold text-gray-800">Bulletin</span>
                {unreadBulletins.length > 0 && (
                  <span className="text-[10px] font-semibold text-white bg-danger rounded-full px-1.5 py-0.5 leading-none">
                    {unreadBulletins.length}
                  </span>
                )}
              </div>
              <Link to={ROUTES.BULLETIN} className="flex items-center gap-1 text-xs text-gray-400 hover:text-navy transition-colors">
                All <ArrowRight size={11} />
              </Link>
            </div>

            <div className="bg-white">
              {bulletins.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                  <Megaphone size={22} className="text-gray-200 mb-2" />
                  <p className="text-xs text-gray-400">No announcements yet</p>
                </div>
              ) : (
                bulletins.slice(0, 5).map((b) => (
                  <Link
                    key={b.id}
                    to={ROUTES.BULLETIN}
                    className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors"
                  >
                    <span className={cn(
                      'flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full',
                      BULLETIN_BADGE[b.priority].dot,
                      b.isRead && 'opacity-30',
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs leading-snug', !b.isRead ? 'font-semibold text-gray-800' : 'text-gray-500')}>
                        {b.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', BULLETIN_BADGE[b.priority].bg)}>
                          {BULLETIN_LABEL[b.priority]}
                        </span>
                        {b.publishedAt && (
                          <span className="text-[10px] text-gray-400">{bulletinAge(b.publishedAt)}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Pinned Notes */}
          <div className="flex-shrink-0 border-t border-gray-100 bg-white">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Pin size={14} className="text-navy" />
                <span className="text-sm font-semibold text-gray-800">Pinned Notes</span>
              </div>
              <Link to={ROUTES.NOTES} className="flex items-center gap-1 text-xs text-gray-400 hover:text-navy transition-colors">
                All <ArrowRight size={11} />
              </Link>
            </div>

            {dashNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center px-4">
                <Pin size={18} className="text-gray-200 mb-1.5" />
                <p className="text-xs text-gray-400">No pinned notes</p>
              </div>
            ) : (
              <div className="p-3 space-y-1.5">
                {dashNotes.map((note) => {
                  const { bg, border } = NOTE_COLOR[note.color] ?? NOTE_COLOR.yellow;
                  return (
                    <Link
                      key={note.id}
                      to={ROUTES.NOTES}
                      className={cn('block rounded border px-3 py-2 hover:shadow-sm transition-shadow', bg, border)}
                    >
                      {note.title && (
                        <p className="text-xs font-semibold text-gray-800 truncate mb-0.5">{note.title}</p>
                      )}
                      <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{note.content}</p>
                    </Link>
                  );
                })}
                {allNotes.filter((n) => n.isPinned).length > 4 && (
                  <Link to={ROUTES.NOTES} className="block text-center text-xs text-gray-400 hover:text-navy py-1 transition-colors">
                    +{allNotes.filter((n) => n.isPinned).length - 4} more
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Analytics shortcut — for roles with analytics access */}
          {roleLevel <= 5 && (
            <Link
              to={ROUTES.ANALYTICS}
              className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-100 text-xs text-gray-500 hover:text-navy hover:bg-gray-50 transition-colors group"
            >
              <span className="flex items-center gap-2">
                <BarChart3 size={13} className="text-gray-400 group-hover:text-navy" />
                View full analytics
              </span>
              <ArrowRight size={11} className="text-gray-300 group-hover:text-navy" />
            </Link>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────
function AlertChip({ icon: Icon, label, danger }: {
  icon: React.ElementType; label: string; danger?: boolean;
}) {
  return (
    <div className={cn(
      'flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full',
      danger ? 'bg-danger/20 text-danger' : 'bg-white/15 text-white/80',
    )}>
      <Icon size={11} />
      {label}
    </div>
  );
}

function EmptyMyDay({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-8">
      <div className="w-14 h-14 rounded-full bg-navy/5 flex items-center justify-center mb-4">
        <Sun size={24} className="text-navy/30" />
      </div>
      <p className="text-sm font-semibold text-gray-700">My Day is empty</p>
      <p className="text-xs text-gray-400 mt-1 leading-relaxed max-w-[220px]">
        Add a task below, or open Tasks and mark any task as My Day.
      </p>
      <button
        onClick={onNavigate}
        className="mt-4 text-xs text-white bg-navy hover:bg-navy-light px-4 py-2 rounded transition-colors"
      >
        Open Tasks
      </button>
    </div>
  );
}
