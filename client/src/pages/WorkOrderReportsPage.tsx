import { useEffect, useState, useCallback } from 'react';
import {
  BarChart3, ChevronLeft, ChevronRight, Loader2, CheckCircle2, Wrench, Clock, Download,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';

// ── Types ──────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  ELECTRICAL: 'Electrical', PLUMBING: 'Plumbing', HVAC: 'HVAC', CIVIL: 'Civil',
  CLEANING: 'Cleaning', SECURITY: 'Security', OTHER: 'Other',
};

interface CategoryRow { category: string; avgResolutionMinutes: number; count: number }
interface TechnicianRow { technicianId: string; fullName: string; assigned: number; completed: number }
interface Report {
  total: number; completed: number; completionRate: number;
  avgResolutionByCategory: CategoryRow[]; byTechnician: TechnicianRow[];
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
  ];
  const csv = [header, ...rows].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
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
  const [exporting, setExporting] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/work-orders/reports', { params: { month, year } });
      setReport(res.data.data);
    } catch { /* silent */ }
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
            disabled={exporting || !report || report.total === 0}
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
      ) : !report || report.total === 0 ? (
        <div className="text-center py-16">
          <BarChart3 size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No work orders in this period</p>
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
    </div>
  );
}
