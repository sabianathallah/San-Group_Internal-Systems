import { useEffect, useState } from 'react';
import {
  BarChart3, CheckCircle2, Clock, AlertTriangle, TrendingUp,
  Users, Plus, Loader2, AlertCircle, Lock,
} from 'lucide-react';
import api from '@/lib/api';
import { usePermStore } from '@/stores/permStore';
import { cn } from '@/lib/cn';

// ── Types ─────────────────────────────────────────────────────
interface AnalyticsData {
  overview: {
    total: number; done: number; inProgress: number; todo: number;
    completionRate: number; overdue: number; newThisWeek: number;
  };
  completionTrend: { date: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  perDivision: { divisionName: string; total: number; done: number }[];
  users: { active: number; total: number };
}

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'bg-red-500',
  HIGH:   'bg-orange-400',
  MEDIUM: 'bg-yellow-400',
  LOW:    'bg-gray-300',
};
const PRIORITY_LABELS: Record<string, string> = {
  URGENT: 'Urgen', HIGH: 'Tinggi', MEDIUM: 'Sedang', LOW: 'Rendah',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' });
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
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', bg)}>
          <Icon size={20} className={color} />
        </div>
      </div>
    </div>
  );
}

// ── Bar Chart (CSS-based) ─────────────────────────────────────
function BarChart({
  data, maxValue, colorClass = 'bg-navy',
}: {
  data: { label: string; value: number }[];
  maxValue: number;
  colorClass?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-1 h-28">
      {data.map((d) => {
        const pct = maxValue > 0 ? (d.value / maxValue) * 100 : 0;
        return (
          <div key={d.label} className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <span className="text-xs text-gray-500 font-medium">{d.value || ''}</span>
            <div className="w-full flex items-end" style={{ height: '80px' }}>
              <div
                className={cn('w-full rounded-t transition-all', colorClass)}
                style={{ height: `${Math.max(pct, d.value > 0 ? 4 : 0)}%`, minHeight: d.value > 0 ? 4 : 0 }}
              />
            </div>
            <span className="text-[10px] text-gray-400 truncate max-w-full text-center leading-tight">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────
function ProgressBar({ value, max, colorClass = 'bg-navy' }: { value: number; max: number; colorClass?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', colorClass)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function AnalyticsPage() {
  const perms   = usePermStore((s) => s.perms);
  const loaded  = usePermStore((s) => s.loaded);

  const [data,    setData]    = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const canView = perms.analytics?.view !== 'none';

  useEffect(() => {
    if (!loaded) return;
    if (!canView) { setLoading(false); return; }
    api.get('/analytics')
      .then((res) => setData(res.data.data))
      .catch(() => setError('Gagal memuat data analitik'))
      .finally(() => setLoading(false));
  }, [loaded, canView]);

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
        <h2 className="text-base font-semibold text-gray-700 mb-1">Akses Terbatas</h2>
        <p className="text-sm text-gray-400">Anda tidak memiliki izin untuk melihat halaman analitik.</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle size={32} className="text-red-400 mb-3" />
        <p className="text-sm text-gray-600">{error || 'Gagal memuat data'}</p>
        <button onClick={() => window.location.reload()}
          className="mt-3 px-4 py-1.5 text-sm text-navy border border-navy rounded hover:bg-navy-50">
          Coba lagi
        </button>
      </div>
    );
  }

  const { overview, completionTrend, byPriority, perDivision, users } = data;

  const trendMax   = Math.max(...completionTrend.map((t) => t.count), 1);
  const priorityMax = Math.max(...byPriority.map((p) => p.count), 1);

  const scopeLabel = perms.analytics?.view === 'all'
    ? 'Semua Divisi'
    : perms.analytics?.view === 'division'
    ? 'Divisi Saya'
    : 'Milik Saya';

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ringkasan produktivitas · {scopeLabel}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">
          <BarChart3 size={12} />
          30 hari terakhir
        </div>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={CheckCircle2} label="Total Task" value={overview.total}
          sub={`${overview.completionRate}% selesai`} color="text-navy" bg="bg-navy/5" />
        <StatCard icon={TrendingUp} label="Selesai" value={overview.done}
          color="text-green-600" bg="bg-green-50" />
        <StatCard icon={Clock} label="Berjalan" value={overview.inProgress}
          color="text-blue-600" bg="bg-blue-50" />
        <StatCard icon={AlertTriangle} label="Terlambat" value={overview.overdue}
          color="text-red-500" bg="bg-red-50" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Plus} label="Baru minggu ini" value={overview.newThisWeek}
          color="text-purple-600" bg="bg-purple-50" />
        <StatCard icon={CheckCircle2} label="Todo" value={overview.todo}
          color="text-gray-500" bg="bg-gray-100" />
        <StatCard icon={Users} label="User aktif" value={users.active}
          sub={`dari ${users.total} total`} color="text-cyan-600" bg="bg-cyan-50" />
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-center">
          <p className="text-xs text-gray-500 mb-2">Completion rate</p>
          <p className="text-2xl font-bold text-gray-800 mb-2">{overview.completionRate}%</p>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${overview.completionRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Completion trend */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Task Selesai — 7 Hari Terakhir</h3>
          <BarChart
            data={completionTrend.map((t) => ({ label: fmt(t.date), value: t.count }))}
            maxValue={trendMax}
            colorClass="bg-navy"
          />
        </div>

        {/* By priority */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Distribusi Prioritas</h3>
          {byPriority.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Belum ada data</p>
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
                  <ProgressBar value={p.count} max={priorityMax}
                    colorClass={PRIORITY_COLORS[p.priority] ?? 'bg-gray-300'} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Per division (only for all-scope) */}
      {perDivision.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Produktivitas per Divisi</h3>
          <div className="space-y-3">
            {perDivision
              .sort((a, b) => b.total - a.total)
              .map((d) => {
                const rate = d.total > 0 ? Math.round((d.done / d.total) * 100) : 0;
                return (
                  <div key={d.divisionName}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700">{d.divisionName}</span>
                      <span className="text-xs text-gray-500">{d.done}/{d.total} selesai ({rate}%)</span>
                    </div>
                    <ProgressBar value={d.done} max={d.total} colorClass="bg-navy" />
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
