import { useEffect, useState, useCallback } from 'react';
import {
  BarChart3, ChevronLeft, ChevronRight, Download, Loader2,
  Users, CheckCircle2, Clock, XCircle, MapPinOff, Filter, Search,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

// ── Types ──────────────────────────────────────────────────────
type AttStatus = 'PRESENT' | 'LATE' | 'WFH' | 'PERMISSION' | 'ABSENT' | 'HOLIDAY';

interface ReportRow {
  userId: string;
  fullName: string;
  username: string;
  avatar: string | null;
  divisionName: string;
  shiftName: string | null;
  totalPresent: number;
  totalLate: number;
  totalAbsent: number;
  totalWFH: number;
  totalPermission: number;
  totalHoliday: number;
  totalWorkMinutes: number;
  totalLateMinutes: number;
  outOfAreaCount: number;
  attendanceRate: number;
}

interface Division { id: string; name: string }

// ── Helpers ────────────────────────────────────────────────────
function fmtHours(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m > 0 ? ` ${m}m` : ''}`;
}

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

const ATT_COLORS: Record<AttStatus, string> = {
  PRESENT:    'bg-green-500',
  LATE:       'bg-orange-400',
  WFH:        'bg-blue-400',
  PERMISSION: 'bg-purple-400',
  ABSENT:     'bg-red-400',
  HOLIDAY:    'bg-gray-300',
};

function AttBadge({ label, count, color }: { label: string; count: number; color: string }) {
  if (count === 0) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded text-white', color)}>
      {count} {label}
    </span>
  );
}

// ── Export CSV ─────────────────────────────────────────────────
function exportCSV(rows: ReportRow[], month: number, year: number) {
  const monthLabel = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const header = ['Name', 'Username', 'Division', 'Shift', 'Present', 'Late', 'Absent', 'WFH', 'Permission', 'Holiday', 'Total Work Hours', 'Total Late (min)', 'Out of Area', 'Attendance (%)'];
  const csvRows = rows.map((r) => [
    r.fullName, r.username, r.divisionName, r.shiftName ?? '-',
    r.totalPresent, r.totalLate, r.totalAbsent, r.totalWFH, r.totalPermission, r.totalHoliday,
    fmtHours(r.totalWorkMinutes), r.totalLateMinutes, r.outOfAreaCount, r.attendanceRate.toFixed(1),
  ]);
  const csv = [header, ...csvRows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance-report-${monthLabel.replace(' ', '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('CSV file downloaded');
}

// ── Component ──────────────────────────────────────────────────
export default function ReportsPage() {
  const user = useAuthStore((s) => s.user);
  const roleLevel = user?.role?.level ?? 99;
  const isHRAdmin = roleLevel <= 2;

  const now = new Date();
  const [month, setMonth]     = useState(now.getMonth() + 1);
  const [year, setYear]       = useState(now.getFullYear());
  const [search, setSearch]   = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [divisions, setDivisions]   = useState<Division[]>([]);

  const [rows, setRows]         = useState<ReportRow[]>([]);
  const [loading, setLoading]   = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get('/admin/divisions').then((r) => setDivisions(r.data.data ?? [])).catch(() => {});
  }, []);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { month, year };
      if (divisionId) params.divisionId = divisionId;
      if (search.trim()) params.search = search.trim();
      const res = await api.get('/hris/reports/attendance', { params });
      setRows(Array.isArray(res.data.data) ? res.data.data : []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [month, year, divisionId, search]);

  useEffect(() => { fetch(); }, [fetch]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  const monthLabel = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const totals = rows.reduce((acc, r) => ({
    present:  acc.present  + r.totalPresent,
    late:     acc.late     + r.totalLate,
    absent:   acc.absent   + r.totalAbsent,
    wfh:      acc.wfh      + r.totalWFH,
    outArea:  acc.outArea  + r.outOfAreaCount,
  }), { present: 0, late: 0, absent: 0, wfh: 0, outArea: 0 });

  const avgRate = rows.length > 0 ? rows.reduce((s, r) => s + r.attendanceRate, 0) / rows.length : 0;

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 size={20} className="text-navy" /> Attendance Report
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Monthly employee attendance summary</p>
        </div>
        <button
          onClick={() => { setExporting(true); exportCSV(rows, month, year); setExporting(false); }}
          disabled={exporting || rows.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-40"
        >
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-1 flex-shrink-0">
          <button onClick={prevMonth} className="p-2 text-gray-400 hover:text-gray-700 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-gray-700 px-2 capitalize min-w-[130px] text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="p-2 text-gray-400 hover:text-gray-700 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>

        {isHRAdmin && (
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 flex-shrink-0">
            <Filter size={14} className="text-gray-400" />
            <select value={divisionId} onChange={(e) => setDivisionId(e.target.value)}
              className="text-sm text-gray-700 bg-transparent focus:outline-none">
              <option value="">All Divisions</option>
              {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}

        <div className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee..."
            className="flex-1 text-sm text-gray-700 bg-transparent focus:outline-none placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total Present', value: totals.present, icon: CheckCircle2, color: 'text-green-600',  bg: 'bg-green-50'  },
          { label: 'Late',          value: totals.late,    icon: Clock,        color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Absent',        value: totals.absent,  icon: XCircle,      color: 'text-red-600',    bg: 'bg-red-50'    },
          { label: 'WFH',           value: totals.wfh,     icon: Users,        color: 'text-blue-600',   bg: 'bg-blue-50'   },
          { label: 'Out of Area',   value: totals.outArea, icon: MapPinOff,    color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={cn('rounded-xl p-4', s.bg)}>
              <div className="flex items-center justify-between mb-1">
                <Icon size={16} className={s.color} />
              </div>
              <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
              <p className="text-xs text-gray-600 mt-0.5">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Rate bar */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Average Attendance Rate</span>
          <span className="text-sm font-bold text-navy">{avgRate.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', avgRate >= 90 ? 'bg-green-500' : avgRate >= 75 ? 'bg-orange-400' : 'bg-red-400')}
            style={{ width: `${Math.min(100, avgRate)}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1.5">{rows.length} employees · {monthLabel}</p>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-gray-300" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16">
          <BarChart3 size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No attendance data for this period</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Shift</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">P</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">L</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">WFH</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">A</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Out of Area</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Work Hours</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((r) => (
                  <tr key={r.userId} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 overflow-hidden">
                          {r.avatar
                            ? <img src={r.avatar} alt="" className="w-full h-full object-cover" />
                            : getInitials(r.fullName)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 leading-tight">{r.fullName}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{r.divisionName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-600">{r.shiftName ?? '—'}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={cn('text-sm font-semibold', r.totalPresent > 0 ? 'text-green-600' : 'text-gray-300')}>
                        {r.totalPresent}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={cn('text-sm font-semibold', r.totalLate > 0 ? 'text-orange-500' : 'text-gray-300')}>
                        {r.totalLate}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={cn('text-sm font-semibold', r.totalWFH > 0 ? 'text-blue-500' : 'text-gray-300')}>
                        {r.totalWFH}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={cn('text-sm font-semibold', r.totalAbsent > 0 ? 'text-red-500' : 'text-gray-300')}>
                        {r.totalAbsent}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {r.outOfAreaCount > 0 ? (
                        <span className="text-xs font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                          {r.outOfAreaCount}x
                        </span>
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm text-gray-600">{r.totalWorkMinutes > 0 ? fmtHours(r.totalWorkMinutes) : '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={cn('text-sm font-bold',
                          r.attendanceRate >= 90 ? 'text-green-600' :
                          r.attendanceRate >= 75 ? 'text-orange-500' : 'text-red-500')}>
                          {r.attendanceRate.toFixed(0)}%
                        </span>
                        <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full',
                            r.attendanceRate >= 90 ? 'bg-green-500' :
                            r.attendanceRate >= 75 ? 'bg-orange-400' : 'bg-red-400')}
                            style={{ width: `${Math.min(100, r.attendanceRate)}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50/60">
                  <td className="px-4 py-3 text-xs font-semibold text-gray-600" colSpan={2}>
                    Total ({rows.length} employees)
                  </td>
                  <td className="px-3 py-3 text-center text-xs font-bold text-green-600">{totals.present}</td>
                  <td className="px-3 py-3 text-center text-xs font-bold text-orange-500">{totals.late}</td>
                  <td className="px-3 py-3 text-center text-xs font-bold text-blue-500">{totals.wfh}</td>
                  <td className="px-3 py-3 text-center text-xs font-bold text-red-500">{totals.absent}</td>
                  <td className="px-3 py-3 text-center text-xs font-bold text-purple-600">{totals.outArea > 0 ? `${totals.outArea}x` : '—'}</td>
                  <td className="px-4 py-3 text-center text-xs font-bold text-gray-600">
                    {fmtHours(rows.reduce((s, r) => s + r.totalWorkMinutes, 0))}
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-bold text-navy">{avgRate.toFixed(1)}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">
        P = Present · L = Late · A = Absent · Out of Area = Check-in outside office radius
      </p>
    </div>
  );
}
