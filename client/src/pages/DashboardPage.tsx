import { useEffect, useState, useRef, useCallback, FormEvent } from 'react';
import {
  Star, AlertCircle, Megaphone, Users,
  ArrowRight, CheckCircle2, Circle,
  Loader2, CalendarDays, ChevronDown, ChevronRight,
  Plus, ExternalLink, StickyNote, Pin,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore, Task } from '@/stores/taskStore';
import { useNoteStore } from '@/stores/noteStore';
import { ROUTES } from '@/lib/constants';
import api from '@/lib/api';
import { cn } from '@/lib/cn';

// ── Helpers ────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

function formatDateShort(): string {
  return new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function relativeDate(iso: string | null): { label: string; overdue: boolean } {
  if (!iso) return { label: '', overdue: false };
  const d    = new Date(iso);
  const now  = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
  if (diff < 0)  return { label: `${Math.abs(diff)} hari lalu`, overdue: true };
  if (diff === 0) return { label: 'Hari ini', overdue: false };
  if (diff === 1) return { label: 'Besok', overdue: false };
  return {
    label: d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
    overdue: false,
  };
}

function bulletinDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
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

// ── Config ─────────────────────────────────────────────────
const PRIORITY_COLOR: Record<TaskPriority, string> = {
  URGENT: 'text-danger',
  HIGH:   'text-warning',
  MEDIUM: 'text-info',
  LOW:    'text-gray-300',
};

const BULLETIN_BADGE: Record<BulletinPriority, string> = {
  URGENT:    'bg-danger/10 text-danger',
  IMPORTANT: 'bg-warning/10 text-warning',
  NORMAL:    'bg-gray-100 text-gray-500',
};

const BULLETIN_LABEL: Record<BulletinPriority, string> = {
  URGENT: 'Mendesak', IMPORTANT: 'Penting', NORMAL: 'Umum',
};

// ── Note color map (dashboard widget) ─────────────────────
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
function ProgressRing({ done, total, size = 56 }: { done: number; total: number; size?: number }) {
  const pct    = total === 0 ? 0 : Math.round((done / total) * 100);
  const r      = (size - 8) / 2;
  const circ   = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={4} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="white" strokeWidth={4}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span className="absolute text-white font-semibold" style={{ fontSize: size * 0.22 }}>
        {pct}%
      </span>
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

  // Status indicator dot (read-only, no checkbox)
  const dotColor = isDone ? '#22c55e' : isPending ? '#f59e0b' : isProgress ? '#3b82f6' : '#d1d5db';

  return (
    <button
      onClick={() => onNavigate(task.id)}
      className={cn(
        'group flex items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-0 w-full text-left',
        'hover:bg-gray-50/70 transition-colors',
      )}
    >
      {/* Status dot — read only */}
      <span
        className="flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center"
        style={{ borderColor: dotColor, backgroundColor: isDone ? dotColor : 'transparent' }}
      >
        {isDone && <CheckCircle2 size={9} className="text-white" strokeWidth={3} />}
        {isProgress && !isDone && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dotColor }} />}
        {isPending && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dotColor }} />}
      </span>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm text-gray-800 truncate', isDone && 'line-through text-gray-400')}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {isPending && (
            <span className="text-[10px] font-medium text-amber-500">Waiting for confirmation</span>
          )}
          {isProgress && !isDone && !isPending && (
            <span className="text-[10px] font-medium text-info">On progress</span>
          )}
          {dueLabel && (
            <span className={cn('text-[10px]', overdue ? 'text-danger font-semibold' : 'text-gray-400')}>
              {overdue && '⚠ '}{dueLabel}
            </span>
          )}
          {task.assignee && (
            <span className="text-[10px] text-gray-400">· {task.assignee.fullName}</span>
          )}
        </div>
      </div>

      {/* Priority star */}
      <Star
        size={13}
        className={cn('flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity', PRIORITY_COLOR[task.priority])}
        fill={task.priority === 'URGENT' || task.priority === 'HIGH' ? 'currentColor' : 'none'}
      />
      <ArrowRight size={13} className="flex-shrink-0 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ── Quick Add Task ─────────────────────────────────────────
function QuickAddTask({ onAdded }: { onAdded: (task: Task) => void }) {
  const [active, setActive] = useState(false);
  const [title, setTitle]   = useState('');
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
      const res = await api.post('/tasks', { title: title.trim(), status: 'TODO', priority: 'MEDIUM' });
      onAdded(res.data.data);
      setTitle('');
      setActive(false);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  if (!active) {
    return (
      <button
        onClick={open}
        className="flex items-center gap-2.5 w-full px-5 py-3.5 text-sm text-gray-400 hover:text-navy hover:bg-gray-50/60 transition-colors border-t border-gray-100"
      >
        <Plus size={16} className="text-navy" />
        Tambahkan tugas
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2.5 px-5 py-3 border-t border-navy/20 bg-navy/5"
    >
      <Circle size={18} className="text-gray-300 flex-shrink-0" />
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setActive(false)}
        placeholder="Tulis judul tugas..."
        className="flex-1 text-sm bg-transparent outline-none text-gray-800 placeholder:text-gray-400"
      />
      <button
        type="submit"
        disabled={saving || !title.trim()}
        className="px-3 py-1 text-xs font-medium text-white bg-navy rounded hover:bg-navy-light disabled:opacity-40 transition-colors"
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : 'Tambah'}
      </button>
      <button
        type="button"
        onClick={() => setActive(false)}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        Batal
      </button>
    </form>
  );
}

// ── Main ───────────────────────────────────────────────────
export default function DashboardPage() {
  const user      = useAuthStore((s) => s.user);
  const navigate  = useNavigate();
  const isAdmin   = (user?.role?.level ?? 99) <= 2;

  // ── Shared task store ──
  const allTasks    = useTaskStore((s) => s.tasks);
  const taskLoading = useTaskStore((s) => s.loading);
  const addTask     = useTaskStore((s) => s.addTask);

  const goToTask = useCallback((taskId: string) => {
    navigate(ROUTES.TASKS, { state: { selectedTaskId: taskId } });
  }, [navigate]);

  // ── Shared note store ──
  const allNotes = useNoteStore((s) => s.notes);

  const [bulletins,   setBulletins]   = useState<Bulletin[]>([]);
  const [activeUsers, setActiveUsers] = useState(0);
  const [showDone,    setShowDone]    = useState(false);

  // Single mount effect — fetch all dashboard data once
  useEffect(() => {
    useTaskStore.getState().fetchTasks();
    useNoteStore.getState().fetchNotes();
    api.get('/bulletins', { params: { limit: 50 } })
      .then((r) => setBulletins(r.data.data ?? []))
      .catch(() => {});
    if (isAdmin) {
      api.get('/users', { params: { isActive: 'true', limit: 1 } })
        .then((r) => setActiveUsers(r.data.meta?.total ?? 0))
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTaskAdded(task: Task) {
    addTask(task);
  }

  // Derived
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const active  = allTasks.filter((t) => t.status !== 'DONE');
  const done    = allTasks.filter((t) => t.status === 'DONE');
  const overdue = active.filter((t) => t.dueDate && new Date(t.dueDate) < now);
  const unreadBulletins = bulletins.filter((b) => !b.isRead);

  // Sort active tasks: overdue first, then by due date, then no date
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

  // Notes widget: pinned first, then recent, max 4
  const dashNotes = [
    ...allNotes.filter((n) => n.isPinned),
    ...allNotes.filter((n) => !n.isPinned),
  ].slice(0, 4);

  const firstName = user?.fullName?.split(' ')[0] ?? 'User';

  return (
    <div className="space-y-0 -m-6">
      {/* ── Header / My Day ─────────────────────────────── */}
      <div className="bg-navy px-8 pt-8 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-navy-100/70 text-xs font-medium tracking-widest uppercase mb-1">
              {formatDateShort()}
            </p>
            <h1 className="text-white text-2xl font-semibold leading-tight">
              {getGreeting()}, {firstName}
            </h1>
            <p className="text-white/50 text-sm mt-1">
              {active.length === 0
                ? 'Semua tugas selesai!'
                : `${active.length} tugas menunggu diselesaikan`}
            </p>
          </div>

          {/* Progress ring */}
          <div className="flex flex-col items-center gap-1">
            {taskLoading
              ? <div className="w-14 h-14 rounded-full border-4 border-white/20 animate-pulse" />
              : <ProgressRing done={done.length} total={allTasks.length} size={60} />
            }
            <p className="text-white/60 text-[10px] mt-0.5">
              {done.length}/{allTasks.length} selesai
            </p>
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-5 mt-5 flex-wrap">
          <StatChip
            icon={AlertCircle}
            label={`${overdue.length} overdue`}
            active={overdue.length > 0}
            danger
          />
          <StatChip
            icon={Megaphone}
            label={`${unreadBulletins.length} bulletin belum dibaca`}
            active={unreadBulletins.length > 0}
          />
          {isAdmin && (
            <StatChip
              icon={Users}
              label={`${activeUsers} staff aktif`}
              active={false}
            />
          )}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-0 bg-gray-50 min-h-[calc(100vh-220px)]">

        {/* ── Task List (2/3) ── */}
        <div className="col-span-2 bg-white border-r border-gray-100">
          {/* Section header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 sticky top-0 bg-white z-10">
            <div className="flex items-center gap-2">
              <CalendarDays size={15} className="text-navy" />
              <span className="text-sm font-semibold text-gray-800">Tugas Saya</span>
              {active.length > 0 && (
                <span className="text-[10px] font-semibold text-white bg-navy rounded-full px-1.5 py-0.5 leading-none">
                  {active.length}
                </span>
              )}
            </div>
            <Link
              to={ROUTES.TASKS}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-navy transition-colors"
            >
              Lihat semua <ArrowRight size={11} />
            </Link>
          </div>

          {/* Task rows */}
          {taskLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Loader2 size={22} className="animate-spin text-gray-300" />
              <p className="text-xs text-gray-400">Memuat tugas…</p>
            </div>
          ) : sortedActive.length === 0 && done.length === 0 ? (
            <EmptyTasks onNavigate={() => navigate(ROUTES.TASKS)} />
          ) : (
            <>
              {sortedActive.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <CheckCircle2 size={28} className="text-success" />
                  <p className="text-sm font-medium text-gray-700">Semua tugas selesai!</p>
                  <p className="text-xs text-gray-400">Tidak ada tugas aktif saat ini.</p>
                </div>
              ) : (
                <div>
                  {sortedActive.map((task) => (
                    <TaskRow key={task.id} task={task} onNavigate={goToTask} />
                  ))}
                </div>
              )}

              {/* Quick add */}
              <QuickAddTask onAdded={handleTaskAdded} />

              {/* Completed section */}
              {done.length > 0 && (
                <div className="border-t border-gray-100">
                  <button
                    onClick={() => setShowDone((v) => !v)}
                    className="flex items-center gap-2 w-full px-5 py-3 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    {showDone ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    <span className="font-medium">Selesai</span>
                    <span className="text-gray-400">{done.length}</span>
                  </button>
                  {showDone && done.map((task) => (
                    <TaskRow key={task.id} task={task} onNavigate={goToTask} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Right Panel (1/3) ── */}
        <div className="col-span-1 flex flex-col gap-0">

          {/* Bulletin terbaru */}
          <div className="flex-1 border-b border-gray-100">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 bg-white sticky top-0 z-10">
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
                Semua <ArrowRight size={11} />
              </Link>
            </div>

            <div className="bg-white">
              {bulletins.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                  <Megaphone size={24} className="text-gray-200 mb-2" />
                  <p className="text-xs text-gray-400">Belum ada pengumuman</p>
                </div>
              ) : (
                <ul>
                  {bulletins.slice(0, 6).map((b) => (
                    <li
                      key={b.id}
                      className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors"
                    >
                      {/* Unread dot */}
                      <div className="flex-shrink-0 mt-1.5">
                        {!b.isRead
                          ? <span className="block w-1.5 h-1.5 rounded-full bg-navy" />
                          : <span className="block w-1.5 h-1.5 rounded-full bg-transparent" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-xs leading-snug',
                          !b.isRead ? 'font-semibold text-gray-800' : 'text-gray-600',
                        )}>
                          {b.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', BULLETIN_BADGE[b.priority])}>
                            {BULLETIN_LABEL[b.priority]}
                          </span>
                          {b.publishedAt && (
                            <span className="text-[10px] text-gray-400">{bulletinDate(b.publishedAt)}</span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Notes widget */}
          <div className="border-b border-gray-100 bg-white">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <StickyNote size={14} className="text-navy" />
                <span className="text-sm font-semibold text-gray-800">Catatan</span>
                {allNotes.length > 0 && (
                  <span className="text-[10px] text-gray-400">({allNotes.length})</span>
                )}
              </div>
              <Link to={ROUTES.NOTES} className="flex items-center gap-1 text-xs text-gray-400 hover:text-navy transition-colors">
                Semua <ArrowRight size={11} />
              </Link>
            </div>

            {allNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center px-4">
                <StickyNote size={20} className="text-gray-200 mb-1.5" />
                <p className="text-xs text-gray-400">Belum ada catatan</p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {dashNotes.map((note) => {
                  const { bg, border } = NOTE_COLOR[note.color] ?? NOTE_COLOR.yellow;
                  return (
                    <Link
                      key={note.id}
                      to={ROUTES.NOTES}
                      className={cn(
                        'block rounded border px-3 py-2 hover:shadow-sm transition-shadow',
                        bg, border,
                      )}
                    >
                      <div className="flex items-start gap-1.5">
                        {note.isPinned && <Pin size={9} className="text-gray-400 flex-shrink-0 mt-0.5" />}
                        <div className="min-w-0">
                          {note.title && (
                            <p className="text-xs font-semibold text-gray-800 truncate">{note.title}</p>
                          )}
                          <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                            {note.content}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
                {allNotes.length > 4 && (
                  <Link
                    to={ROUTES.NOTES}
                    className="block text-center text-xs text-gray-400 hover:text-navy py-1 transition-colors"
                  >
                    +{allNotes.length - 4} catatan lainnya
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Quick nav */}
          <div className="bg-white px-4 py-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Menu Cepat</p>
            <div className="space-y-0.5">
              <NavLink to={ROUTES.TASKS}   label="Manajemen Tugas"   />
              <NavLink to={ROUTES.NOTES}   label="Catatan Saya"      />
              <NavLink to={ROUTES.BULLETIN} label="Papan Pengumuman" />
              <NavLink to={ROUTES.DATABASE} label="Database Links"   />
              {isAdmin && (
                <NavLink to={ROUTES.ADMIN_USERS} label="Kelola Pengguna" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────
function StatChip({ icon: Icon, label, active, danger }: {
  icon:   React.ElementType;
  label:  string;
  active: boolean;
  danger?: boolean;
}) {
  return (
    <div className={cn(
      'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full',
      active && danger  ? 'bg-danger/20 text-danger font-semibold'  :
      active            ? 'bg-white/20 text-white font-medium'       :
                          'text-white/40',
    )}>
      <Icon size={11} />
      {label}
    </div>
  );
}

function NavLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between px-2 py-2 rounded text-xs text-gray-600 hover:bg-gray-50 hover:text-navy transition-colors group"
    >
      {label}
      <ExternalLink size={10} className="text-gray-300 group-hover:text-navy opacity-0 group-hover:opacity-100 transition-all" />
    </Link>
  );
}

function EmptyTasks({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-8">
      <div className="w-16 h-16 rounded-full bg-navy/5 flex items-center justify-center mb-4">
        <CheckCircle2 size={28} className="text-navy/30" />
      </div>
      <p className="text-sm font-semibold text-gray-700">Belum ada tugas</p>
      <p className="text-xs text-gray-400 mt-1 leading-relaxed max-w-[200px]">
        Buat tugas pertama kamu atau minta admin untuk menugaskan.
      </p>
      <button
        onClick={onNavigate}
        className="mt-4 text-xs text-white bg-navy hover:bg-navy-light px-4 py-2 rounded transition-colors"
      >
        Buka Tasks
      </button>
    </div>
  );
}
