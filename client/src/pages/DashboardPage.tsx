import { useEffect, useState, useRef, useCallback, FormEvent } from 'react';
import {
  Star, AlertCircle, Users,
  ArrowRight, CheckCircle2, Circle,
  Loader2, Sun, ChevronDown, ChevronRight,
  Plus, StickyNote as StickyNoteIcon,
  TrendingUp, MapPin, Timer,
  BarChart3, UserCheck, CheckSquare2, Database,
  Wrench, HardHat, Shield, Bell, ImagePlus, Check, Upload,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore, Task, isInMyDay } from '@/stores/taskStore';
import { useNoteStore } from '@/stores/noteStore';
import { usePermStore } from '@/stores/permStore';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useLanguageStore } from '@/stores/languageStore';
import { ROUTES } from '@/lib/constants';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import CreateTaskModal, { type CreatedTask } from '@/components/shared/CreateTaskModal';

// ── Helpers ────────────────────────────────────────────────
/** Locale for date formatting — mirrors i18next's active language. */
function dateLocale(language: string): string {
  return language === 'id' ? 'id-ID' : 'en-US';
}

function formatDateShort(language: string): string {
  return new Date().toLocaleDateString(dateLocale(language), {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function relativeDate(iso: string | null, language: string): { label: string; overdue: boolean } {
  if (!iso) return { label: '', overdue: false };
  const d    = new Date(iso);
  const now  = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
  if (diff < 0)  return { label: `${Math.abs(diff)}d overdue`, overdue: true };
  if (diff === 0) return { label: 'Today', overdue: false };
  if (diff === 1) return { label: 'Tomorrow', overdue: false };
  return {
    label: d.toLocaleDateString(dateLocale(language), { day: '2-digit', month: 'short' }),
    overdue: false,
  };
}

function fmtTime(iso: string | null, language: string): string {
  return iso ? new Date(iso).toLocaleTimeString(dateLocale(language), { hour: '2-digit', minute: '2-digit' }) : '—';
}

function fmtMins(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

// ── Types ──────────────────────────────────────────────────
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type AttendanceStatus = 'PRESENT' | 'LATE' | 'WFH' | 'PERMISSION' | 'ABSENT' | 'HOLIDAY';

interface TaskStats {
  personal: { todo: number; inProgress: number; done: number; assigned: number };
  team:     { total: number; done: number; inProgress: number; memberCount: number } | null;
  system:   { totalUsers: number; totalTasks: number; totalBulletins: number } | null;
}

interface TodayAttendance {
  status:      AttendanceStatus;
  checkIn:     string | null;
  checkOut:    string | null;
  isLate:      boolean;
  lateMinutes: number;
  workMinutes: number | null;
  locationName: string | null;
  shift: { name: string; startTime: string } | null;
}

// ── Config ─────────────────────────────────────────────────
const PRIORITY_COLOR: Record<TaskPriority, string> = {
  URGENT: 'text-danger',
  HIGH:   'text-warning',
  MEDIUM: 'text-info',
  LOW:    'text-gray-300',
};

// Keep keys in sync with WALLPAPER_PRESET_KEYS on the server (user.service.ts) —
// server only validates the key, the gradient/label lives here.
const WALLPAPER_PRESETS: Record<string, { label: string; gradient: string }> = {
  default:  { label: 'Navy Classic',   gradient: '#0F2942' },
  ocean:    { label: 'Ocean Depth',    gradient: 'linear-gradient(135deg, #0F2942 0%, #164e63 55%, #0891b2 130%)' },
  golden:   { label: 'Golden Hour',    gradient: 'linear-gradient(135deg, #0F2942 0%, #4a3510 60%, #C9A84C 140%)' },
  emerald:  { label: 'Emerald Dusk',   gradient: 'linear-gradient(135deg, #0F2942 0%, #064e3b 55%, #059669 130%)' },
  slate:    { label: 'Slate Fade',     gradient: 'linear-gradient(135deg, #1F2937 0%, #0F2942 100%)' },
  midnight: { label: 'Midnight Bloom', gradient: 'linear-gradient(135deg, #0F2942 0%, #312e81 60%, #4c1d95 130%)' },
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
// IN_PROGRESS is merged into "To Do" visually (backend enum/logic untouched) —
// so a task row no longer special-cases it, it just reads as a plain to-do.
function TaskRow({ task, onNavigate }: { task: Task; onNavigate: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const isDone    = task.status === 'DONE';
  const isPending = task.assignmentStatus === 'PENDING';
  const { label: dueLabel, overdue } = task.dueDate
    ? relativeDate(task.dueDate, i18n.language)
    : { label: '', overdue: false };

  const dotColor = isDone ? '#22c55e' : isPending ? '#f59e0b' : '#d1d5db';

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
        {!isDone && isPending && (
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
        )}
      </span>

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm text-gray-800 truncate', isDone && 'line-through text-gray-400')}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {isPending && (
            <span className="text-[10px] font-medium text-amber-500">{t('dashboard.toDoToday.waiting')}</span>
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
  const { t } = useTranslation();
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
        {t('dashboard.toDoToday.addTask')}
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
        placeholder={t('dashboard.toDoToday.titlePlaceholder')}
        className="flex-1 text-sm bg-transparent outline-none text-gray-800 placeholder:text-gray-400"
      />
      <button
        type="submit" disabled={saving || !title.trim()}
        className="px-3 py-1 text-xs font-medium text-white bg-navy rounded hover:bg-navy-light disabled:opacity-40 transition-colors"
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : t('dashboard.toDoToday.add')}
      </button>
      <button type="button" onClick={() => setActive(false)} className="text-xs text-gray-400 hover:text-gray-600">
        {t('dashboard.toDoToday.cancel')}
      </button>
    </form>
  );
}

// ── Header wallpaper picker ─────────────────────────────────
function WallpaperPicker({
  wallpaperType, wallpaperValue, onChange,
}: {
  wallpaperType: string | null; wallpaperValue: string | null;
  onChange: (type: string, value: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen]         = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const popRef  = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useClickOutside(popRef, () => setOpen(false));

  async function selectPreset(key: string) {
    setSaving(true);
    setError('');
    try {
      const res = await api.patch('/users/me/wallpaper', { presetKey: key });
      onChange(res.data.data.wallpaperType, res.data.data.wallpaperValue);
      setOpen(false);
    } catch {
      setError(t('dashboard.wallpaper.applyError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setError(t('dashboard.wallpaper.maxSize')); return; }
    setSaving(true);
    setError('');
    const form = new FormData();
    form.append('wallpaper', file);
    try {
      const res = await api.patch('/users/me/wallpaper', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(res.data.data.wallpaperType, res.data.data.wallpaperValue);
      setOpen(false);
    } catch {
      setError(t('dashboard.wallpaper.uploadError'));
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div ref={popRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={t('dashboard.wallpaper.changeTitle')}
        className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
      >
        <ImagePlus size={14} />
      </button>

      {open && (
        <div className="absolute right-0 top-9 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-3">
          <p className="text-xs font-semibold text-gray-700 mb-2">{t('dashboard.wallpaper.header')}</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {Object.entries(WALLPAPER_PRESETS).map(([key, { label, gradient }]) => {
              const isActive = wallpaperType === 'preset' && wallpaperValue === key
                || (wallpaperType == null && key === 'default');
              return (
                <button
                  key={key}
                  title={label}
                  disabled={saving}
                  onClick={() => selectPreset(key)}
                  className="group relative h-11 rounded-lg overflow-hidden ring-1 ring-gray-200 hover:ring-navy/40 transition-shadow disabled:opacity-50"
                  style={{ background: gradient }}
                >
                  {isActive && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Check size={14} className="text-white" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={saving}
            className="flex items-center justify-center gap-1.5 w-full text-xs font-medium text-navy bg-navy/5 hover:bg-navy/10 rounded-lg py-2 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {t('dashboard.wallpaper.upload')}
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          {error && <p className="text-[10px] text-danger mt-1.5">{error}</p>}
        </div>
      )}
    </div>
  );
}

// ── Attendance / Check-in widget ────────────────────────────
// Deliberately status-only: the real check-in/out action (GPS + optional
// selfie) stays on the HRIS Attendance page. Duplicating that flow here
// would re-implement geofencing/photo logic twice for no benefit — this
// widget just answers "am I checked in" and deep-links to the real page.
const DEFAULT_MIN_WORK_MINUTES = 480;

function CheckInWidget({ today, loading }: { today: TodayAttendance | null; loading: boolean }) {
  const { t, i18n } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!today?.checkIn || today?.checkOut) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [today?.checkIn, today?.checkOut]);

  const worked = today?.checkIn && !today?.checkOut
    ? Math.max(0, Math.floor((now - new Date(today.checkIn).getTime()) / 60_000))
    : 0;
  const pct = Math.min(100, Math.round((worked / DEFAULT_MIN_WORK_MINUTES) * 100));

  return (
    <Link
      to={ROUTES.HRIS}
      className="block rounded-xl border border-gray-100 bg-white px-4 py-3.5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-info/10">
            <MapPin size={17} className="text-info" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800">{t('dashboard.checkIn.title')}</p>
            {loading ? (
              <div className="h-3.5 w-28 bg-gray-100 rounded animate-pulse mt-1" />
            ) : !today?.checkIn ? (
              <p className="text-xs text-gray-400">{t('dashboard.checkIn.notCheckedIn')}</p>
            ) : !today?.checkOut ? (
              <p className="text-xs text-gray-400 truncate">
                {t('dashboard.checkIn.checkedIn', { time: fmtTime(today.checkIn, i18n.language) })}
                {today.isLate && <span className="text-warning font-medium"> · {t('dashboard.checkIn.late', { minutes: today.lateMinutes })}</span>}
              </p>
            ) : (
              <p className="text-xs text-success font-medium">
                {t('dashboard.checkIn.done', { checkIn: fmtTime(today.checkIn, i18n.language), checkOut: fmtTime(today.checkOut, i18n.language) })}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!today?.checkIn ? (
            <span className="text-xs font-medium text-white bg-navy px-3 py-1.5 rounded-lg">{t('dashboard.checkIn.checkInBtn')}</span>
          ) : !today?.checkOut ? (
            <span className="text-xs font-medium text-navy bg-navy/10 px-3 py-1.5 rounded-lg">{t('dashboard.checkIn.checkOutBtn')}</span>
          ) : (
            <span className="text-[10px] font-bold text-success bg-success/10 px-2 py-1 rounded-full">{t('dashboard.checkIn.complete')}</span>
          )}
          <ChevronRight size={15} className="text-gray-300" />
        </div>
      </div>

      {today?.checkIn && !today?.checkOut && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="flex items-center gap-1 font-medium text-gray-500">
              <Timer size={11} /> {fmtMins(worked)} / {fmtMins(DEFAULT_MIN_WORK_MINUTES)}
            </span>
            {today.shift && <span className="text-gray-400">{t('dashboard.checkIn.shift', { name: today.shift.name })}</span>}
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-info transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </Link>
  );
}

// ── Quick Access grid ───────────────────────────────────────
interface QuickAccessItem { label: string; to: string; icon: React.ElementType; accent: string }

function QuickAccessGrid({ items }: { items: QuickAccessItem[] }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3.5">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">{t('dashboard.quickAccess.title')}</p>
      <div className="grid grid-cols-3 gap-2">
        {items.map(({ label, to, icon: Icon, accent }) => (
          <Link
            key={to}
            to={to}
            className="group flex flex-col items-center gap-1.5 rounded-lg py-3 px-1 text-center hover:bg-gray-50 transition-colors"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
              style={{ backgroundColor: `${accent}18` }}
            >
              <Icon size={17} style={{ color: accent }} />
            </div>
            <span className="text-[11px] font-medium text-gray-600 leading-tight">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Team Stats ─────────────────────────────────────────────
function TeamStats({ stats, loading, roleLevel }: { stats: TaskStats | null; loading: boolean; roleLevel: number }) {
  const { t } = useTranslation();
  if (roleLevel > 5) return null;

  const teamDonePct = stats?.team && stats.team.total > 0
    ? Math.round((stats.team.done / stats.team.total) * 100)
    : 0;

  const label = roleLevel <= 3 ? t('dashboard.team.myDivision') : t('dashboard.team.myTeam');

  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3.5">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      {loading ? (
        <div className="h-12 rounded-lg bg-gray-50 animate-pulse" />
      ) : stats?.team ? (
        <div className="rounded-lg bg-gray-50 px-3 py-2.5 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-base font-bold text-gray-800">{stats.team.total}</p>
            <p className="text-[10px] text-gray-400">{t('dashboard.team.tasks')}</p>
          </div>
          <div>
            <p className="text-base font-bold text-navy">{teamDonePct}%</p>
            <p className="text-[10px] text-gray-400">{t('dashboard.team.done')}</p>
          </div>
          <div>
            <p className="text-base font-bold text-gray-800">{stats.team.memberCount}</p>
            <p className="text-[10px] text-gray-400">{t('dashboard.team.members')}</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400 py-2 text-center">{t('dashboard.team.noData')}</p>
      )}
    </div>
  );
}

// ── System Stats (Admin only) ──────────────────────────────
function SystemStats({ stats, loading }: { stats: TaskStats | null; loading: boolean }) {
  const { t } = useTranslation();
  if (!stats?.system) return null;

  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3.5">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('dashboard.system.title')}</p>
      <div className="grid grid-cols-2 gap-1.5 text-center">
        {[
          { label: t('dashboard.system.users'), value: stats.system.totalUsers },
          { label: t('dashboard.system.tasks'), value: stats.system.totalTasks },
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
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const user       = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const navigate  = useNavigate();
  const roleLevel = user?.role?.level ?? 99;
  const isAdmin   = roleLevel <= 2;
  const perms     = usePermStore((s) => s.perms);
  const canAnalytics = perms.analytics?.view !== 'none';

  const allTasks    = useTaskStore((s) => s.tasks);
  const taskLoading = useTaskStore((s) => s.loading);
  const addTask     = useTaskStore((s) => s.addTask);

  const goToTask = useCallback((taskId: string) => {
    navigate(ROUTES.TASKS, { state: { selectedTaskId: taskId } });
  }, [navigate]);

  const allNotes = useNoteStore((s) => s.notes);

  const [activeUsers,  setActiveUsers]  = useState(0);
  const [showDone,     setShowDone]     = useState(false);
  const [stats,        setStats]        = useState<TaskStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [attendance,        setAttendance]        = useState<TodayAttendance | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [taskLists, setTaskLists] = useState<{ id: string; name: string; color: string; icon: string | null }[]>([]);

  useEffect(() => {
    useTaskStore.getState().fetchTasks();
    useNoteStore.getState().fetchNotes();

    api.get('/tasks/stats')
      .then((r) => setStats(r.data.data ?? null))
      .catch(() => {})
      .finally(() => setStatsLoading(false));

    api.get('/hris/attendance/today')
      .then((r) => setAttendance(r.data.data ?? null))
      .catch(() => {})
      .finally(() => setAttendanceLoading(false));

    api.get('/task-lists')
      .then((r) => setTaskLists(r.data.data ?? []))
      .catch(() => {});

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

  const isCustomWallpaper = user?.wallpaperType === 'custom' && !!user.wallpaperValue;
  const headerStyle: React.CSSProperties = isCustomWallpaper
    ? { backgroundImage: `linear-gradient(rgba(15,41,66,0.55), rgba(15,41,66,0.75)), url(${user!.wallpaperValue})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: WALLPAPER_PRESETS[user?.wallpaperValue ?? 'default']?.gradient ?? WALLPAPER_PRESETS.default.gradient };

  const quickAccessItems: QuickAccessItem[] = [
    { label: t('dashboard.quickAccess.tasks'),      to: ROUTES.TASKS,       icon: CheckSquare2,   accent: '#0F2942' },
    { label: t('dashboard.quickAccess.bulletin'),   to: ROUTES.BULLETIN,    icon: Bell,           accent: '#D97706' },
    { label: t('dashboard.quickAccess.notes'),      to: ROUTES.NOTES,       icon: StickyNoteIcon, accent: '#C9A84C' },
    { label: t('dashboard.quickAccess.dbLinks'),    to: ROUTES.DATABASE,    icon: Database,       accent: '#2563EB' },
    { label: t('dashboard.quickAccess.workOrders'), to: ROUTES.WORK_ORDERS, icon: Wrench,         accent: '#EA580C' },
    { label: t('dashboard.quickAccess.hris'),       to: ROUTES.HRIS,        icon: HardHat,        accent: '#059669' },
    ...(canAnalytics ? [{ label: t('dashboard.quickAccess.analytics'), to: ROUTES.ANALYTICS, icon: BarChart3, accent: '#7C3AED' }] : []),
    ...(isAdmin ? [{ label: t('dashboard.quickAccess.admin'), to: ROUTES.ADMIN_USERS, icon: Shield, accent: '#4B5563' }] : []),
  ];

  function greetingKey(): 'morning' | 'afternoon' | 'evening' {
    const h = new Date().getHours();
    if (h < 11) return 'morning';
    if (h < 15) return 'afternoon';
    return 'evening';
  }

  return (
    <div className="space-y-0 -m-6">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="relative px-8 pt-8 pb-6" style={headerStyle}>
        <div className="absolute top-3 right-3">
          <WallpaperPicker
            wallpaperType={user?.wallpaperType ?? null}
            wallpaperValue={user?.wallpaperValue ?? null}
            onChange={(wallpaperType, wallpaperValue) => updateUser({ wallpaperType, wallpaperValue })}
          />
        </div>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white/40 text-xs font-medium tracking-widest uppercase mb-1">
              {formatDateShort(language)}
            </p>
            <h1 className="text-white text-2xl font-semibold leading-tight">
              {t(`dashboard.greeting.${greetingKey()}`)}, {firstName}
            </h1>
            <p className="text-white/50 text-sm mt-1">
              {myDayTasks.length === 0
                ? t('dashboard.subtitle.empty')
                : active.length === 0
                  ? t('dashboard.subtitle.allDone')
                  : t('dashboard.subtitle.remaining', { count: active.length })}
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
              {done.length}/{myDayTasks.length} {t('dashboard.done')}
            </p>
          </div>
        </div>

        {/* Alert chips — only shown when non-zero */}
        {(overdue.length > 0 || awaiting > 0 || (isAdmin && activeUsers > 0)) && (
          <div className="flex items-center gap-2.5 mt-5 flex-wrap">
            {overdue.length > 0 && (
              <AlertChip icon={AlertCircle} label={t('dashboard.alerts.overdue', { count: overdue.length })} danger />
            )}
            {awaiting > 0 && (
              <AlertChip icon={UserCheck} label={t('dashboard.alerts.awaiting', { count: awaiting })} />
            )}
            {isAdmin && activeUsers > 0 && (
              <AlertChip icon={Users} label={t('dashboard.alerts.users', { count: activeUsers })} />
            )}
          </div>
        )}
      </div>

      {/* ── Body ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 bg-gray-50 min-h-[calc(100vh-320px)]">

        {/* ── Left: Check-in + My Day tasks + Sticky Notes (2/3) ── */}
        <div className="col-span-2 border-r border-gray-100 p-5 space-y-4">

          <CheckInWidget today={attendance} loading={attendanceLoading} />

          <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Sun size={15} className="text-navy" />
                <span className="text-sm font-semibold text-gray-800">{t('dashboard.toDoToday.title')}</span>
                {active.length > 0 && (
                  <span className="text-[10px] font-semibold text-white bg-navy rounded-full px-1.5 py-0.5 leading-none">
                    {active.length}
                  </span>
                )}
              </div>
              <Link to={ROUTES.TASKS} className="flex items-center gap-1 text-xs text-gray-400 hover:text-navy transition-colors">
                {t('dashboard.toDoToday.allTasks')} <ArrowRight size={11} />
              </Link>
            </div>

            {taskLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <Loader2 size={22} className="animate-spin text-gray-300" />
                <p className="text-xs text-gray-400">{t('dashboard.toDoToday.loading')}</p>
              </div>
            ) : sortedActive.length === 0 && done.length === 0 ? (
              <EmptyMyDay onCreateTask={() => setShowCreateTask(true)} />
            ) : (
              <>
                {sortedActive.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <CheckCircle2 size={28} className="text-success" />
                    <p className="text-sm font-medium text-gray-700">{t('dashboard.toDoToday.allDone')}</p>
                  </div>
                ) : (
                  sortedActive.map((task) => (
                    <TaskRow key={task.id} task={task} onNavigate={goToTask} />
                  ))
                )}

                <QuickAddTask onAdded={(task) => addTask(task)} />

                {done.length > 0 && (
                  <div className="border-t border-gray-100">
                    <button
                      onClick={() => setShowDone((v) => !v)}
                      className="flex items-center gap-2 w-full px-5 py-3 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      {showDone ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      <span className="font-medium">{t('dashboard.toDoToday.completed')}</span>
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

          {/* Sticky Notes — directly under Tasks, per feedback */}
          <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <StickyNoteIcon size={15} className="text-navy" />
                <span className="text-sm font-semibold text-gray-800">{t('dashboard.stickyNotes.title')}</span>
              </div>
              <Link to={ROUTES.NOTES} className="flex items-center gap-1 text-xs text-gray-400 hover:text-navy transition-colors">
                {t('dashboard.stickyNotes.all')} <ArrowRight size={11} />
              </Link>
            </div>

            {dashNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center px-4">
                <StickyNoteIcon size={18} className="text-gray-200 mb-1.5" />
                <p className="text-xs text-gray-400">{t('dashboard.stickyNotes.empty')}</p>
              </div>
            ) : (
              <div className="p-3 grid grid-cols-2 gap-2">
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
                  <Link to={ROUTES.NOTES} className="col-span-2 block text-center text-xs text-gray-400 hover:text-navy py-1 transition-colors">
                    {t('dashboard.stickyNotes.more', { count: allNotes.filter((n) => n.isPinned).length - 4 })}
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Quick access + stats (1/3) ── */}
        <div className="col-span-1 p-5 space-y-4">

          <QuickAccessGrid items={quickAccessItems} />

          <TeamStats stats={stats} loading={statsLoading} roleLevel={roleLevel} />

          {isAdmin && <SystemStats stats={stats} loading={statsLoading} />}

        </div>
      </div>

      {showCreateTask && (
        <CreateTaskModal
          onClose={() => setShowCreateTask(false)}
          onCreated={(task: CreatedTask) => addTask(task)}
          extraPayload={{ myDay: true }}
          taskLists={taskLists}
        />
      )}
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

function EmptyMyDay({ onCreateTask }: { onCreateTask: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-8">
      <div className="w-14 h-14 rounded-full bg-navy/5 flex items-center justify-center mb-4">
        <Sun size={24} className="text-navy/30" />
      </div>
      <p className="text-sm font-semibold text-gray-700">{t('dashboard.emptyMyDay.title')}</p>
      <p className="text-xs text-gray-400 mt-1 leading-relaxed max-w-[220px]">
        {t('dashboard.emptyMyDay.subtitle')}
      </p>
      <button
        onClick={onCreateTask}
        className="mt-4 text-xs text-white bg-navy hover:bg-navy-light px-4 py-2 rounded transition-colors"
      >
        {t('dashboard.emptyMyDay.cta')}
      </button>
    </div>
  );
}
