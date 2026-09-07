import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, Clock, AlertTriangle, TrendingUp,
  Users, Plus, Loader2, AlertCircle, Lock, SlidersHorizontal,
  Download, X, RotateCcw, Timer, Trophy, History,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { usePermStore } from '@/stores/permStore';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/cn';

// ── Types ─────────────────────────────────────────────────────
interface AnalyticsData {
  overview: {
    total: number; done: number; inProgress: number; todo: number;
    completionRate: number; overdue: number; newInRange: number;
  };
  completionTrend: { date: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  perDivision: { divisionId: string; divisionName: string; color: string; total: number; done: number }[];
  topAssignees: { userId: string; fullName: string; avatar: string | null; completed: number; total: number }[];
  overdueAging: { bucket: string; count: number }[];
  avgCompletionDays: number | null;
  users: { active: number; total: number };
}

interface DivisionOption { id: string; name: string; color: string }
interface UserOption { id: string; fullName: string }

type WidgetKey = 'trend' | 'priority' | 'division' | 'leaderboard' | 'aging';
const ALL_WIDGETS: WidgetKey[] = ['trend', 'priority', 'division', 'leaderboard', 'aging'];

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'bg-red-500',
  HIGH:   'bg-orange-500',
  MEDIUM: 'bg-blue-400',
  LOW:    'bg-gray-300',
};

// Sequential, single hue (red), light → dark — the more overdue a bucket
// is, the darker it reads, so severity is visible before anyone reads a
// number.
const AGING_COLORS = ['#FCA5A5', '#F87171', '#EF4444', '#B91C1C'];

/** Locale for date formatting — mirrors i18next's active language. */
function dateLocale(language: string): string {
  return language === 'id' ? 'id-ID' : 'en-US';
}

function fmtShort(iso: string, language: string) {
  return new Date(iso).toLocaleDateString(dateLocale(language), { day: '2-digit', month: 'short' });
}

function fmtFull(iso: string, language: string) {
  return new Date(iso).toLocaleDateString(dateLocale(language), { weekday: 'long', day: 'numeric', month: 'long' });
}

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, sub, color = 'text-navy', bg = 'bg-navy/5',
}: {
  icon: React.ElementType; label: string; value: number | string;
  sub?: string; color?: string; bg?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', bg)}>
          <Icon size={20} className={color} />
        </div>
      </div>
    </div>
  );
}

// ── Section wrapper (title + optional subtitle) ────────────────
function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      {sub && <p className="text-xs text-gray-400 mt-0.5 mb-1">{sub}</p>}
      <div className={sub ? 'mt-3' : 'mt-4'}>{children}</div>
    </div>
  );
}

// ── Trend bar chart with hover tooltip (single series, thin marks) ─
function TrendChart({ data, language, fallbackText }: { data: { date: string; count: number }[]; language: string; fallbackText: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const hasData = data.some((d) => d.count > 0);
  const maxValue = Math.max(...data.map((d) => d.count), 1);
  // Thin the x-axis labels once there are more than ~7 bars so the dates
  // don't collide — bars themselves stay evenly spaced either way. Labels
  // are positioned absolutely (not one-per-flex-column) so a kept label can
  // use its natural width instead of being squeezed to a single bar's slot.
  const labelStride = Math.max(1, Math.ceil(data.length / 7));
  const shown = data.map((d, i) => ({ ...d, i })).filter(({ i }) => i % labelStride === 0 || i === data.length - 1);

  if (!hasData) {
    return <p className="text-sm text-gray-400 text-center py-10">{fallbackText}</p>;
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-[3px] h-32">
        {data.map((d, i) => {
          const pct = (d.count / maxValue) * 100;
          return (
            <div
              key={d.date}
              className="relative flex-1 min-w-0 h-full flex flex-col justify-end items-center"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {hover === i && (
                <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[11px] leading-tight px-2 py-1 rounded-md whitespace-nowrap z-10 pointer-events-none shadow-lg">
                  <span className="font-semibold">{d.count}</span> · {fmtFull(d.date, language)}
                </div>
              )}
              <div
                className={cn(
                  'w-full rounded-t transition-colors cursor-default',
                  hover === i ? 'bg-navy-light' : 'bg-navy',
                )}
                style={{ height: `${Math.max(pct, d.count > 0 ? 4 : 1.5)}%`, minHeight: 2 }}
              />
            </div>
          );
        })}
      </div>
      <div className="relative h-4 mt-1.5">
        {shown.map(({ date, i }) => (
          <span
            key={date}
            className={cn(
              'absolute top-0 text-[9px] text-gray-400 whitespace-nowrap',
              i === 0 ? 'translate-x-0' : i === data.length - 1 ? '-translate-x-full' : '-translate-x-1/2',
            )}
            style={{ left: `${(i / Math.max(data.length - 1, 1)) * 100}%` }}
          >
            {fmtShort(date, language)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Overdue aging bar chart (sequential severity ramp) ──────────
function AgingChart({ data, t }: { data: { bucket: string; count: number }[]; t: (k: string, o?: Record<string, unknown>) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const maxValue = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end justify-between gap-3 h-32">
      {data.map((d, i) => {
        const pct = (d.count / maxValue) * 100;
        return (
          <div
            key={d.bucket}
            className="relative flex-1 h-full flex flex-col justify-end items-center gap-1.5"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            {hover === i && d.count > 0 && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[11px] px-2 py-1 rounded-md whitespace-nowrap z-10 pointer-events-none shadow-lg">
                {t('analytics.charts.tasksAssigned', { count: d.count })}
              </div>
            )}
            <span className="text-xs font-semibold text-gray-700">{d.count || ''}</span>
            <div className="w-full flex items-end" style={{ height: '72px' }}>
              <div
                className="w-full rounded-t transition-opacity cursor-default"
                style={{
                  height: `${Math.max(pct, d.count > 0 ? 6 : 0)}%`,
                  minHeight: d.count > 0 ? 4 : 0,
                  backgroundColor: AGING_COLORS[i] ?? AGING_COLORS[AGING_COLORS.length - 1],
                  opacity: hover === i ? 0.8 : 1,
                }}
              />
            </div>
            <span className="text-[10px] text-gray-400 text-center leading-tight">
              {t('analytics.charts.agingBucketDays', { bucket: d.bucket })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────
function ProgressBar({ value, max, colorClass, colorStyle }: { value: number; max: number; colorClass?: string; colorStyle?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', colorClass)}
          style={{ width: `${pct}%`, ...(colorStyle ? { backgroundColor: colorStyle } : {}) }}
        />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  );
}

// ── Leaderboard ──────────────────────────────────────────────
function Leaderboard({ items, t }: { items: AnalyticsData['topAssignees']; t: (k: string, o?: Record<string, unknown>) => string }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">{t('analytics.charts.leaderboardEmpty')}</p>;
  }
  const maxCompleted = Math.max(...items.map((i) => i.completed), 1);
  const medalColor = ['text-yellow-500', 'text-gray-400', 'text-orange-400'];
  return (
    <div className="space-y-3">
      {items.map((u, idx) => (
        <div key={u.userId} className="flex items-center gap-3" title={t('analytics.charts.tasksCompleted', { count: u.completed })}>
          <span className={cn('text-xs font-bold w-4 text-center flex-shrink-0', medalColor[idx] ?? 'text-gray-300')}>
            {idx + 1}
          </span>
          <div className="w-7 h-7 rounded-full bg-navy/10 flex items-center justify-center text-xs font-semibold text-navy flex-shrink-0">
            {u.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-sm text-gray-700 truncate">{u.fullName}</span>
              <span className="text-xs font-medium text-gray-800 flex-shrink-0">{u.completed}</span>
            </div>
            <ProgressBar value={u.completed} max={maxCompleted} colorClass="bg-navy" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Customize panel ──────────────────────────────────────────
function CustomizePanel({
  open, onClose, availableWidgets, visible, onToggle, onReset, t,
}: {
  open: boolean; onClose: () => void; availableWidgets: WidgetKey[];
  visible: Set<WidgetKey>; onToggle: (k: WidgetKey) => void; onReset: () => void;
  t: (k: string) => string;
}) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-800">{t('analytics.customize.title')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
        </div>
        <p className="text-xs text-gray-400 mb-3">{t('analytics.customize.subtitle')}</p>
        <div className="space-y-1">
          {availableWidgets.map((key) => (
            <label key={key} className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={visible.has(key)}
                onChange={() => onToggle(key)}
                className="rounded border-gray-300 text-navy focus:ring-navy"
              />
              <span className="text-sm text-gray-700">{t(`analytics.customize.widgets.${key}`)}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <button onClick={onReset} className="flex items-center gap-1 text-xs text-gray-500 hover:text-navy">
            <RotateCcw size={12} /> {t('analytics.customize.reset')}
          </button>
          <button onClick={onClose} className="text-xs font-medium text-navy hover:underline">
            {t('analytics.customize.done')}
          </button>
        </div>
      </div>
    </>
  );
}

// ── CSV export ─────────────────────────────────────────────────
function exportAnalyticsCSV(data: AnalyticsData, t: (k: string, o?: Record<string, unknown>) => string, filename: string) {
  const rows: string[] = [];
  const push = (...cells: (string | number)[]) => rows.push(cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));

  push(t('analytics.stats.totalTasks'), t('analytics.stats.completed'), t('analytics.stats.inProgress'), t('analytics.stats.todo'), t('analytics.stats.overdue'), t('analytics.stats.completionRate'));
  push(data.overview.total, data.overview.done, data.overview.inProgress, data.overview.todo, data.overview.overdue, `${data.overview.completionRate}%`);
  rows.push('');

  push(t('analytics.charts.completionTrend'));
  push('Date', 'Count');
  data.completionTrend.forEach((d) => push(d.date, d.count));
  rows.push('');

  push(t('analytics.charts.priorityDistribution'));
  push('Priority', 'Count');
  data.byPriority.forEach((p) => push(p.priority, p.count));
  rows.push('');

  if (data.perDivision.length > 0) {
    push(t('analytics.charts.perDivision'));
    push('Division', 'Done', 'Total');
    data.perDivision.forEach((d) => push(d.divisionName, d.done, d.total));
    rows.push('');
  }

  if (data.topAssignees.length > 0) {
    push(t('analytics.charts.leaderboard'));
    push('Name', 'Completed', 'Total Assigned');
    data.topAssignees.forEach((u) => push(u.fullName, u.completed, u.total));
    rows.push('');
  }

  push(t('analytics.charts.overdueAging'));
  push('Days overdue', 'Count');
  data.overdueAging.forEach((a) => push(a.bucket, a.count));

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Main Page ─────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { t, i18n } = useTranslation();
  const perms = usePermStore((s) => s.perms);
  const loaded = usePermStore((s) => s.loaded);
  const user   = useAuthStore((s) => s.user);

  const [data,    setData]    = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,   setError]   = useState('');

  const canView = perms.analytics?.view !== 'none';
  const scope = (perms.analytics?.view ?? 'own') as 'own' | 'division' | 'all';

  // ── Filters ────────────────────────────────────────────────
  const [rangeDays,  setRangeDays]  = useState(30);
  const [divisionId, setDivisionId] = useState('');
  const [priority,   setPriority]   = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const hasActiveFilters = !!divisionId || !!priority || !!assigneeId;
  const activeFilterCount = [divisionId, priority, assigneeId].filter(Boolean).length;

  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [assignees, setAssignees] = useState<UserOption[]>([]);

  useEffect(() => {
    if (scope === 'all') {
      api.get('/divisions').then((r) => setDivisions(r.data.data ?? [])).catch(() => {});
    }
    if (scope !== 'own') {
      api.get('/users', { params: { limit: 100, isActive: true } })
        .then((r) => setAssignees((r.data.data?.items ?? r.data.data ?? []).map((u: { id: string; fullName: string }) => ({ id: u.id, fullName: u.fullName }))))
        .catch(() => {});
    }
  }, [scope]);

  // ── Widget visibility (persisted per user) ──────────────────
  const storageKey = `analytics-widgets-${user?.id ?? 'anon'}`;
  const [visible, setVisible] = useState<Set<WidgetKey>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return new Set(JSON.parse(raw) as WidgetKey[]);
    } catch { /* ignore */ }
    return new Set(ALL_WIDGETS);
  });
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const availableWidgets = useMemo(
    () => ALL_WIDGETS.filter((k) => {
      if (k === 'division') return scope === 'all'; // cross-division comparison only makes sense with every division in view
      if (k === 'leaderboard') return scope !== 'own'; // a leaderboard of one (yourself) isn't one
      return true;
    }),
    [scope],
  );

  function toggleWidget(key: WidgetKey) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }
  function resetWidgets() {
    setVisible(new Set(ALL_WIDGETS));
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
  }

  // ── Fetch ────────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded) return;
    if (!canView) { setLoading(false); return; }
    setRefreshing(true);
    api.get('/analytics', { params: {
      rangeDays,
      ...(divisionId && { divisionId }),
      ...(priority   && { priority }),
      ...(assigneeId && { assigneeId }),
    } })
      .then((res) => { setData(res.data.data); setError(''); })
      .catch(() => setError(t('analytics.error.loadFailed')))
      .finally(() => { setLoading(false); setRefreshing(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, canView, rangeDays, divisionId, priority, assigneeId]);

  const PRIORITY_LABELS: Record<string, string> = {
    URGENT: t('analytics.priority.urgent'),
    HIGH: t('analytics.priority.high'),
    MEDIUM: t('analytics.priority.medium'),
    LOW: t('analytics.priority.low'),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Lock size={28} className="text-gray-400" />
        </div>
        <h2 className="text-base font-semibold text-gray-700 mb-1">{t('analytics.accessRestricted.title')}</h2>
        <p className="text-sm text-gray-400">{t('analytics.accessRestricted.message')}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle size={32} className="text-red-400 mb-3" />
        <p className="text-sm text-gray-600">{error || t('analytics.error.loadFailedGeneric')}</p>
        <button onClick={() => window.location.reload()}
          className="mt-3 px-4 py-1.5 text-sm text-navy border border-navy rounded hover:bg-navy-50">
          {t('analytics.error.tryAgain')}
        </button>
      </div>
    );
  }

  const { overview, completionTrend, byPriority, perDivision, topAssignees, overdueAging, avgCompletionDays, users } = data;
  const priorityMax = Math.max(...byPriority.map((p) => p.count), 1);

  const scopeLabel = scope === 'all' ? t('analytics.scope.all')
    : scope === 'division' ? t('analytics.scope.division')
    : t('analytics.scope.personal');

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">{t('analytics.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('analytics.subtitle', { scope: scopeLabel })}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportAnalyticsCSV(data, t, `analytics-${new Date().toISOString().slice(0, 10)}.csv`)}
            className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download size={13} /> {t('analytics.filters.export')}
          </button>
          <div className="relative">
            <button
              onClick={() => setCustomizeOpen((v) => !v)}
              className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <SlidersHorizontal size={13} /> {t('analytics.customize.button')}
            </button>
            <CustomizePanel
              open={customizeOpen}
              onClose={() => setCustomizeOpen(false)}
              availableWidgets={availableWidgets}
              visible={visible}
              onToggle={toggleWidget}
              onReset={resetWidgets}
              t={t}
            />
          </div>
        </div>
      </div>

      {/* Filter bar — one row, above the charts */}
      <div className="flex items-center gap-2 mb-5 flex-wrap bg-white border border-gray-200 rounded-xl p-3">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {[7, 30, 90].map((n) => (
            <button
              key={n}
              onClick={() => setRangeDays(n)}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                rangeDays === n ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {t(`analytics.filters.range${n}`)}
            </button>
          ))}
        </div>

        {scope === 'all' && (
          <select value={divisionId} onChange={(e) => setDivisionId(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 outline-none focus:border-navy bg-white">
            <option value="">{t('analytics.filters.allDivisions')}</option>
            {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}

        <select value={priority} onChange={(e) => setPriority(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 outline-none focus:border-navy bg-white">
          <option value="">{t('analytics.filters.allPriorities')}</option>
          {Object.entries(PRIORITY_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>

        {scope !== 'own' && (
          <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 outline-none focus:border-navy bg-white">
            <option value="">{t('analytics.filters.allAssignees')}</option>
            {assignees.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
        )}

        {hasActiveFilters && (
          <button
            onClick={() => { setDivisionId(''); setPriority(''); setAssigneeId(''); }}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-navy ml-auto"
          >
            <X size={12} /> {t('analytics.filters.reset')} ({activeFilterCount})
          </button>
        )}

        {refreshing && <Loader2 size={13} className={cn('animate-spin text-gray-300', !hasActiveFilters && 'ml-auto')} />}
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard icon={CheckCircle2} label={t('analytics.stats.totalTasks')} value={overview.total}
          sub={t('analytics.stats.completedPct', { pct: overview.completionRate })} color="text-navy" bg="bg-navy/5" />
        <StatCard icon={TrendingUp} label={t('analytics.stats.completed')} value={overview.done}
          color="text-green-600" bg="bg-green-50" />
        <StatCard icon={Clock} label={t('analytics.stats.inProgress')} value={overview.inProgress}
          color="text-blue-600" bg="bg-blue-50" />
        <StatCard icon={AlertTriangle} label={t('analytics.stats.overdue')} value={overview.overdue}
          color="text-red-500" bg="bg-red-50" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Plus} label={t('analytics.stats.newInRange')} value={overview.newInRange}
          color="text-purple-600" bg="bg-purple-50" />
        <StatCard icon={Timer} label={t('analytics.stats.avgCompletionTime')}
          value={avgCompletionDays !== null ? t('analytics.stats.days', { count: avgCompletionDays }) : '—'}
          sub={avgCompletionDays === null ? t('analytics.stats.noAvgData') : undefined}
          color="text-teal-600" bg="bg-teal-50" />
        <StatCard icon={Users} label={t('analytics.stats.activeUsers')} value={users.active}
          sub={t('analytics.stats.ofTotal', { total: users.total })} color="text-cyan-600" bg="bg-cyan-50" />
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-center">
          <p className="text-xs text-gray-500 mb-2">{t('analytics.stats.completionRate')}</p>
          <p className="text-2xl font-bold text-gray-800 mb-2">{overview.completionRate}%</p>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${overview.completionRate}%` }} />
          </div>
        </div>
      </div>

      {/* Customizable widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {visible.has('trend') && (
          <Section title={t('analytics.charts.completionTrend')}>
            <TrendChart data={completionTrend} language={i18n.language} fallbackText={t('analytics.charts.noData')} />
          </Section>
        )}

        {visible.has('priority') && (
          <Section title={t('analytics.charts.priorityDistribution')}>
            {byPriority.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">{t('analytics.charts.noData')}</p>
            ) : (
              <div className="space-y-3">
                {byPriority.map((p) => (
                  <div key={p.priority}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={cn('w-2 h-2 rounded-full', PRIORITY_COLORS[p.priority] ?? 'bg-gray-300')} />
                        <span className="text-sm text-gray-700">{PRIORITY_LABELS[p.priority] ?? p.priority}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-800">{p.count}</span>
                    </div>
                    <ProgressBar value={p.count} max={priorityMax} colorClass={PRIORITY_COLORS[p.priority] ?? 'bg-gray-300'} />
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {visible.has('division') && scope === 'all' && (
          <Section title={t('analytics.charts.perDivision')}>
            {perDivision.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">{t('analytics.charts.noData')}</p>
            ) : (
              <div className="space-y-3">
                {[...perDivision].sort((a, b) => b.total - a.total).map((d) => {
                  const rate = d.total > 0 ? Math.round((d.done / d.total) * 100) : 0;
                  return (
                    <div key={d.divisionId}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                          <span className="text-sm text-gray-700">{d.divisionName}</span>
                        </div>
                        <span className="text-xs text-gray-500">{t('analytics.charts.doneOfTotal', { done: d.done, total: d.total, rate })}</span>
                      </div>
                      <ProgressBar value={d.done} max={d.total} colorStyle={d.color} />
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {visible.has('leaderboard') && scope !== 'own' && (
          <Section title={t('analytics.charts.leaderboard')} sub={t('analytics.charts.leaderboardSub')}>
            <Leaderboard items={topAssignees} t={t} />
          </Section>
        )}

        {visible.has('aging') && (
          <Section title={t('analytics.charts.overdueAging')} sub={t('analytics.charts.overdueAgingSub')}>
            <AgingChart data={overdueAging} t={t} />
          </Section>
        )}
      </div>

      {visible.size === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-dashed border-gray-200 rounded-xl">
          <History size={26} className="text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">{t('analytics.charts.noData')}</p>
          <button onClick={() => setCustomizeOpen(true)} className="mt-2 text-xs text-navy hover:underline flex items-center gap-1">
            <Trophy size={12} /> {t('analytics.customize.button')}
          </button>
        </div>
      )}
    </div>
  );
}
