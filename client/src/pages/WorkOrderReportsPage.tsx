import { useEffect, useState, useCallback } from 'react';
import {
  BarChart3, ChevronLeft, ChevronRight, Loader2, CheckCircle2, Wrench, Clock, Download, Hourglass,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toastStore';
import { STATUS_CONFIG, PRIORITY_CONFIG, extractErr, type WOStatus, type WOPriority } from '@/pages/WorkOrderPage';

// ── Types ──────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  ELECTRICAL: 'Electrical', PLUMBING: 'Plumbing', HVAC: 'HVAC', CIVIL: 'Civil',
  CLEANING: 'Cleaning', SECURITY: 'Security', OTHER: 'Other',
};

interface CategoryRow { category: string; avgResolutionMinutes: number; count: number }
interface TechnicianRow { technicianId: string; fullName: string; assigned: number; completed: number }
interface OpenAging { under1d: number; d1to3: number; d3to7: number; over7d: number; total: number }
interface OldestOpenRow {
  id: string; code: string; title: string; status: WOStatus; priority: WOPriority;
  createdAt: string; assigneeName: string | null; openMinutes: number;
}
interface Report {
  total: number; completed: number; completionRate: number;
  avgResolutionByCategory: CategoryRow[]; byTechnician: TechnicianRow[];
  openAging: OpenAging; oldestOpen: OldestOpenRow[];
}

function fmtDuration(mins: number) {
  const days = Math.floor(mins / (60 * 24));
  const hrs  = Math.floor((mins % (60 * 24)) / 60);
  if (days > 0) return `${days}d ${hrs}h`;
  return `${hrs}h ${mins % 60}m`;
}

// ── Export CSV ─────────────────────────────────────────────────
function exportCSV(report: Report, monthLabel: string) {
  const header = ['Section', 'Name', 'Count/Assigned', 'Completed', 'Avg Resolution / Rate'];
  const rows: string[][] = [
    ['Summary', 'Total Work Orders', String(report.total), '', ''],
    ['Summary', 'Completed', String(report.completed), '', ''],
    ['Summary', 'Completion Rate', `${report.completionRate}%`, '', ''],
    ...report.avgResolutionByCategory.map((c) => [
      'Category', CATEGORY_LABELS[c.category] ?? c.category, String(c.count), '', fmtDuration(c.avgResolutionMinutes),
    ]),
    ...report.byTechnician.map((t) => [
      'Technician', t.fullName, String(t.assigned), String(t.completed),
      t.assigned === 0 ? '0%' : `${Math.round((t.completed / t.assigned) * 100)}%`,
    ]),
    ['Open Aging', 'Under 1 day', String(report.openAging.under1d), '', ''],
    ['Open Aging', '1–3 days', String(report.openAging.d1to3), '', ''],
    ['Open Aging', '3–7 days', String(report.openAging.d3to7), '', ''],
    ['Open Aging', 'Over 7 days', String(report.openAging.over7d), '', ''],
    ...report.oldestOpen.map((w) => [
      'Longest Open', `${w.code} — ${w.title}`, w.assigneeName ?? 'Unassigned', '', fmtDuration(w.openMinutes),
    ]),
  ];
  // Neutralize leading =, +, -, @ so Excel/Sheets never executes a cell as a formula.
  const csv = [header, ...rows]
    .map((r) => r.map((v) => {
      const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
      return `"${safe.replace(/"/g, '""')}"`;
    }).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `work-order-report-${monthLabel.replace(' ', '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function WorkOrderReportsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get('/work-orders/reports', { params: { month, year } });
      setReport(res.data.data);
    } catch (err) {
      // Surface the failure — a silent catch here would render "No report
      // data", which reads as "the month is empty" instead of "server error".
      const msg = extractErr(err);
      setLoadError(msg);
      toast.error(msg);
    }
    finally { setLoading(false); }
  }, [month, year]);

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

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 size={20} className="text-navy" /> Work Order Report
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Completion rate, resolution time, and technician performance</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-1">
            <button onClick={prevMonth} className="p-2 text-gray-400 hover:text-gray-700 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-gray-700 px-2 capitalize min-w-[130px] text-center">{monthLabel}</span>
            <button onClick={nextMonth} className="p-2 text-gray-400 hover:text-gray-700 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            onClick={() => { if (!report) return; setExporting(true); exportCSV(report, monthLabel); setExporting(false); }}
            disabled={exporting || !report}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-gray-300" />
        </div>
      ) : loadError ? (
        <div className="text-center py-16">
          <BarChart3 size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm mb-3">Failed to load report: {loadError}</p>
          <button
            onClick={fetch}
            className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Try again
          </button>
        </div>
      ) : !report ? (
        <div className="text-center py-16">
          <BarChart3 size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No report data</p>
        </div>
      ) : (
        <>
          {/* Currently-open snapshot — deliberately not month-bound: an old WO
              nobody closed must stay visible whichever month is selected. */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <Hourglass size={14} className="text-navy" /> Currently Open — How Long?
              </h2>
              <span className="text-xs text-gray-400">{report.openAging.total} active now</span>
            </div>
            <div className="grid grid-cols-4 divide-x divide-gray-100">
              {([
                { label: '< 1 day',  value: report.openAging.under1d, cls: 'text-green-600' },
                { label: '1–3 days', value: report.openAging.d1to3,   cls: 'text-blue-600' },
                { label: '3–7 days', value: report.openAging.d3to7,   cls: 'text-amber-600' },
                { label: '> 7 days', value: report.openAging.over7d,  cls: 'text-red-600' },
              ]).map((b) => (
                <div key={b.label} className="p-4 text-center">
                  <p className={cn('text-2xl font-bold', b.value === 0 ? 'text-gray-300' : b.cls)}>{b.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{b.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Longest-open work orders */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Longest Open Work Orders</h2>
            </div>
            {report.oldestOpen.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No open work orders — everything is closed 🎉</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Priority</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Assignee</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Open For</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {report.oldestOpen.map((w) => {
                    const days = w.openMinutes / (60 * 24);
                    return (
                      <tr key={w.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap">{w.code}</td>
                        <td className="px-4 py-2.5 text-gray-700 max-w-xs truncate">{w.title}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">{STATUS_CONFIG[w.status]?.label ?? w.status}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">{PRIORITY_CONFIG[w.priority]?.label ?? w.priority}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">{w.assigneeName ?? <span className="text-gray-400">Unassigned</span>}</td>
                        <td className="px-4 py-2.5 text-center whitespace-nowrap">
                          <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full',
                            days < 2 ? 'bg-green-50 text-green-600' : days < 7 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600')}>
                            <Clock size={11} /> {fmtDuration(w.openMinutes)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {report.total === 0 ? (
            <div className="text-center py-10">
              <BarChart3 size={28} className="text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">No work orders created in this period</p>
            </div>
          ) : (
            <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl p-4 bg-navy/5">
              <Wrench size={16} className="text-navy mb-1" />
              <p className="text-2xl font-bold text-navy">{report.total}</p>
              <p className="text-xs text-gray-600 mt-0.5">Total Work Orders</p>
            </div>
            <div className="rounded-xl p-4 bg-green-50">
              <CheckCircle2 size={16} className="text-green-600 mb-1" />
              <p className="text-2xl font-bold text-green-600">{report.completed}</p>
              <p className="text-xs text-gray-600 mt-0.5">Completed</p>
            </div>
            <div className="rounded-xl p-4 bg-amber-50">
              <Clock size={16} className="text-amber-600 mb-1" />
              <p className="text-2xl font-bold text-amber-600">{report.completionRate}%</p>
              <p className="text-xs text-gray-600 mt-0.5">Completion Rate</p>
            </div>
          </div>

          {/* Avg resolution by category */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Average Resolution Time by Category</h2>
            </div>
            {report.avgResolutionByCategory.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No completed work orders yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Completed</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Avg. Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {report.avgResolutionByCategory.map((c) => (
                    <tr key={c.category} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-2.5 text-gray-700">{CATEGORY_LABELS[c.category] ?? c.category}</td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{c.count}</td>
                      <td className="px-4 py-2.5 text-center font-medium text-navy">{fmtDuration(c.avgResolutionMinutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Per-technician performance */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Technician Performance</h2>
            </div>
            {report.byTechnician.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">No work orders assigned yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Technician</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Completed</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Completion Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {report.byTechnician
                    .sort((a, b) => b.completed - a.completed)
                    .map((t) => {
                      const rate = t.assigned === 0 ? 0 : Math.round((t.completed / t.assigned) * 100);
                      return (
                        <tr key={t.technicianId} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-gray-800">{t.fullName}</td>
                          <td className="px-4 py-2.5 text-center text-gray-600">{t.assigned}</td>
                          <td className="px-4 py-2.5 text-center text-green-600 font-medium">{t.completed}</td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={cn('text-sm font-bold',
                                rate >= 80 ? 'text-green-600' : rate >= 50 ? 'text-orange-500' : 'text-red-500')}>
                                {rate}%
                              </span>
                              <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                                <div className={cn('h-full rounded-full',
                                  rate >= 80 ? 'bg-green-500' : rate >= 50 ? 'bg-orange-400' : 'bg-red-400')}
                                  style={{ width: `${Math.min(100, rate)}%` }} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
