import { useEffect, useState, useCallback } from 'react';
import {
  Timer, Plus, ChevronLeft, ChevronRight, Loader2, X,
  CheckCircle2, XCircle, Clock, Users, User, AlertCircle,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/authStore';
import { usePermStore } from '@/stores/permStore';
import { toast } from '@/stores/toastStore';

// ── Types ──────────────────────────────────────────────────────
type OTStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

interface OvertimeRequest {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  reason: string;
  status: OTStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  user: { id: string; fullName: string; username: string; avatar: string | null; divisionId: string };
  reviewedBy: { id: string; fullName: string } | null;
}

interface Meta { total: number; page: number; limit: number; totalPages: number }

// ── Helpers ────────────────────────────────────────────────────
const STATUS_CONFIG: Record<OTStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  PENDING:   { label: 'Pending',   color: 'text-yellow-700', bg: 'bg-yellow-50',  icon: Clock        },
  APPROVED:  { label: 'Approved',  color: 'text-green-700',  bg: 'bg-green-50',   icon: CheckCircle2 },
  REJECTED:  { label: 'Rejected',  color: 'text-red-700',    bg: 'bg-red-50',     icon: XCircle      },
  CANCELLED: { label: 'Cancelled', color: 'text-gray-500',   bg: 'bg-gray-100',   icon: X            },
};

function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function calcDuration(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const d = (eh * 60 + em) - (sh * 60 + sm);
  return d > 0 ? d : 0;
}

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

// ── Create Modal ───────────────────────────────────────────────
function CreateOvertimeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ date: today, startTime: '17:00', endTime: '19:00', reason: '', attendanceId: '' });
  const [submitting, setSubmitting] = useState(false);

  const duration = calcDuration(form.startTime, form.endTime);

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSubmit() {
    if (!form.date || !form.startTime || !form.endTime || form.reason.trim().length < 10) return;
    if (duration < 30) { toast.error('Minimum overtime is 30 minutes'); return; }
    setSubmitting(true);
    try {
      await api.post('/hris/overtime', {
        date: form.date, startTime: form.startTime, endTime: form.endTime, reason: form.reason.trim(),
        attendanceId: form.attendanceId || null,
      });
      toast.success('Overtime request submitted');
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to submit overtime');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Timer size={18} className="text-navy" />
            <h3 className="font-semibold text-gray-900">Request Overtime</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Date</label>
            <input type="date" value={form.date} max={today} onChange={(e) => set('date', e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-navy/20" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Start</label>
              <input type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-navy/20" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">End</label>
              <input type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-navy/20" />
            </div>
          </div>
          {duration > 0 && (
            <div className={cn('text-xs font-medium px-3 py-2 rounded-lg border', duration >= 30 ? 'bg-gray-50 text-gray-600 border-gray-200' : 'bg-gray-50 text-red-500 border-gray-200')}>
              {duration >= 30 ? `Duration: ${fmtDuration(duration)}` : 'Minimum 30 minutes'}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Overtime Reason <span className="text-red-500">*</span>
            </label>
            <textarea value={form.reason} onChange={(e) => set('reason', e.target.value)}
              rows={3} placeholder="Explain overtime reason (min. 10 characters)"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-navy/20 resize-none" />
            <p className="text-xs mt-1 text-gray-400">
              {form.reason.length}/10 characters minimum
            </p>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || form.reason.trim().length < 10 || duration < 30}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-navy hover:bg-navy/90 disabled:opacity-40 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Timer size={14} />}
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Review Modal ───────────────────────────────────────────────
function ReviewModal({ ot, onClose, onDone }: { ot: OvertimeRequest; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleReview(status: 'APPROVED' | 'REJECTED') {
    setSubmitting(true);
    try {
      await api.patch(`/hris/overtime/${ot.id}/review`, { status, reviewNote: note.trim() || null });
      toast.success(status === 'APPROVED' ? 'Overtime approved' : 'Overtime rejected');
      onDone();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to process');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Review Overtime</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Employee</span><span className="font-medium">{ot.user.fullName}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Date</span><span>{fmtDate(ot.date)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Time</span><span>{ot.startTime} – {ot.endTime} ({fmtDuration(ot.durationMinutes)})</span></div>
            <div className="flex justify-between items-start gap-4"><span className="text-gray-500 flex-shrink-0">Reason</span><span className="text-right">{ot.reason}</span></div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Note (optional)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note for employee..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none" />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={() => handleReview('REJECTED')} disabled={submitting}
            className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-40">
            <XCircle size={14} /> Reject
          </button>
          <button onClick={() => handleReview('APPROVED')} disabled={submitting}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-navy hover:bg-navy/90 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-40">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
const TABS: { label: string; value: string }[] = [
  { label: 'All',       value: ''          },
  { label: 'Pending',   value: 'PENDING'   },
  { label: 'Approved',  value: 'APPROVED'  },
  { label: 'Rejected',  value: 'REJECTED'  },
  { label: 'Cancelled', value: 'CANCELLED' },
];

export default function OvertimePage() {
  const user = useAuthStore((s) => s.user);
  const perms = usePermStore((s) => s.perms);
  const isManager = perms.hris.reviewOvertime;

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [activeTab, setActiveTab] = useState('');
  const [viewMode, setViewMode]   = useState<'me' | 'team'>('me');

  const [items, setItems]       = useState<OvertimeRequest[]>([]);
  const [meta, setMeta]         = useState<Meta | null>(null);
  const [loading, setLoading]   = useState(false);
  const [page, setPage]         = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<OvertimeRequest | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { month, year, page, limit: 20 };
      if (activeTab) params.status = activeTab;
      if (isManager && viewMode === 'team') { /* no userId filter — see all */ }
      else params.userId = user!.id;
      const res = await api.get('/hris/overtime', { params });
      setItems(res.data.data);
      setMeta(res.data.meta);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [month, year, activeTab, viewMode, page, user, isManager]);

  useEffect(() => { fetch(); }, [fetch]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
    setPage(1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
    setPage(1);
  }

  const monthLabel = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const myItems = items.filter((i) => i.user.id === user?.id);
  const stats = {
    pending:   myItems.filter((i) => i.status === 'PENDING').length,
    approved:  myItems.filter((i) => i.status === 'APPROVED').length,
    rejected:  myItems.filter((i) => i.status === 'REJECTED').length,
    totalMins: myItems.filter((i) => i.status === 'APPROVED').reduce((s, i) => s + i.durationMinutes, 0),
  };

  async function handleCancel(id: string) {
    try {
      await api.patch(`/hris/overtime/${id}/cancel`);
      toast.success('Request cancelled');
      fetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to cancel');
    }
  }

  return (
    <>
      {createOpen && <CreateOvertimeModal onClose={() => setCreateOpen(false)} onCreated={fetch} />}
      {reviewTarget && <ReviewModal ot={reviewTarget} onClose={() => setReviewTarget(null)} onDone={fetch} />}

      <div className="space-y-5 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Timer size={20} className="text-navy" /> Overtime
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Overtime requests and approvals</p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-navy text-white rounded-lg text-sm font-medium hover:bg-navy/90 transition-colors"
          >
            <Plus size={15} /> Request Overtime
          </button>
        </div>

        {/* Stats (own) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Pending',     value: stats.pending              },
            { label: 'Approved',    value: stats.approved             },
            { label: 'Rejected',    value: stats.rejected             },
            { label: 'Total Hours', value: fmtDuration(stats.totalMins) },
          ].map((s) => (
            <div key={s.label} className="rounded-xl p-4 bg-white border border-gray-200">
              <p className="text-xl font-bold text-gray-800">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Month nav */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-1">
            <button onClick={prevMonth} className="p-2 text-gray-400 hover:text-gray-700 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-gray-700 px-2 capitalize">{monthLabel}</span>
            <button onClick={nextMonth} className="p-2 text-gray-400 hover:text-gray-700 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* View toggle (manager) */}
          {isManager && (
            <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
              {(['me', 'team'] as const).map((v) => (
                <button key={v} onClick={() => { setViewMode(v); setPage(1); }}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    viewMode === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                  {v === 'me' ? <User size={13} /> : <Users size={13} />}
                  {v === 'me' ? 'Me' : 'Team'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {TABS.map((t) => (
            <button key={t.value} onClick={() => { setActiveTab(t.value); setPage(1); }}
              className={cn('px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                activeTab === t.value ? 'border-navy text-navy' : 'border-transparent text-gray-500 hover:text-gray-700')}>
              {t.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-gray-300" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <Timer size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No overtime data</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((ot) => {
              const cfg = STATUS_CONFIG[ot.status];
              const StatusIcon = cfg.icon;
              const isOwn = ot.user.id === user?.id;
              const canReview = isManager && ot.status === 'PENDING' && !isOwn;
              const canCancel = isOwn && ot.status === 'PENDING';

              return (
                <div key={ot.id} className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {/* Avatar (team view) */}
                  {viewMode === 'team' && (
                    <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                      {ot.user.avatar
                        ? <img src={ot.user.avatar} alt="" className="w-full h-full object-cover rounded-full" />
                        : getInitials(ot.user.fullName)}
                    </div>
                  )}

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    {viewMode === 'team' && (
                      <p className="text-xs font-medium text-gray-500 mb-0.5">{ot.user.fullName}</p>
                    )}
                    <p className="text-sm font-semibold text-gray-800">{fmtDate(ot.date)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {ot.startTime} – {ot.endTime}
                      <span className="ml-2 font-medium text-gray-600">{fmtDuration(ot.durationMinutes)}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">{ot.reason}</p>
                    {ot.reviewNote && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <AlertCircle size={10} /> {ot.reviewNote}
                      </p>
                    )}
                  </div>

                  {/* Status + Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full', cfg.color, cfg.bg)}>
                      <StatusIcon size={11} /> {cfg.label}
                    </span>
                    {canCancel && (
                      <button onClick={() => handleCancel(ot.id)}
                        className="text-xs text-gray-500 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50">
                        Cancel
                      </button>
                    )}
                    {canReview && (
                      <button onClick={() => setReviewTarget(ot)}
                        className="text-xs font-medium text-navy hover:underline px-2 py-1 rounded hover:bg-navy/5 transition-colors">
                        Review
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="p-2 text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-gray-500">{page} / {meta.totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages}
              className="p-2 text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
