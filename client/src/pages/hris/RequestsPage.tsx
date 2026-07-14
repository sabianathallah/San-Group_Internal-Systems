import { useEffect, useState, useCallback } from 'react';
import {
  ClipboardEdit, Plus, Loader2, X, CheckCircle2, XCircle, Clock,
  AlertCircle, CalendarClock, AlarmClock, Users, User, RefreshCw,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { useAuthStore } from '@/stores/authStore';
import { usePermStore } from '@/stores/permStore';
import { toast } from '@/stores/toastStore';
import { PageSizeSelect } from '@/components/shared/PageSizeSelect';

// ── Types ──────────────────────────────────────────────────────
type ReqStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
type ReqKind = 'late' | 'shift';

interface ReqUser { id: string; fullName: string; username: string; avatar: string | null }

interface LateExcuse {
  id: string; date: string; expectedTime: string | null; reason: string;
  status: ReqStatus; reviewNote: string | null; createdAt: string;
  user: ReqUser; reviewedBy: { id: string; fullName: string } | null;
}

interface ShiftChange {
  id: string; effectiveDate: string; reason: string;
  status: ReqStatus; reviewNote: string | null; createdAt: string;
  requestedShift: { id: string; name: string; startTime: string; endTime: string; color: string };
  user: ReqUser; reviewedBy: { id: string; fullName: string } | null;
}

interface ShiftOption { id: string; name: string; startTime: string; endTime: string; isActive: boolean }
interface Meta { total: number; page: number; limit: number; totalPages: number }

const STATUS_CONFIG: Record<ReqStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  PENDING:   { label: 'Pending',   color: 'text-yellow-700', bg: 'bg-yellow-50', icon: Clock        },
  APPROVED:  { label: 'Approved',  color: 'text-green-700',  bg: 'bg-green-50',  icon: CheckCircle2 },
  REJECTED:  { label: 'Rejected',  color: 'text-red-700',    bg: 'bg-red-50',    icon: XCircle      },
  CANCELLED: { label: 'Cancelled', color: 'text-gray-500',   bg: 'bg-gray-100',  icon: X            },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

// ── Create: Late Excuse ────────────────────────────────────────
function CreateLateExcuseModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const [form, setForm] = useState({ date: today, expectedTime: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  useEscapeClose(onClose);

  async function handleSubmit() {
    if (form.reason.trim().length < 5) return;
    setSubmitting(true);
    try {
      await api.post('/hris/late-excuses', {
        date: form.date, expectedTime: form.expectedTime || null, reason: form.reason.trim(),
      });
      toast.success('Late excuse submitted');
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to submit');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlarmClock size={18} className="text-navy" />
            <h3 className="font-semibold text-gray-900">Late Excuse (Advance Notice)</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            Submit <span className="font-medium">before you check in</span>. If approved, that day&apos;s
            check-in won&apos;t count as late.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Date</label>
              <input type="date" value={form.date} min={today} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-navy/20" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Expected Arrival</label>
              <input type="time" value={form.expectedTime} onChange={(e) => setForm((f) => ({ ...f, expectedTime: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-navy/20" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Reason <span className="text-red-500">*</span></label>
            <textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              rows={3} placeholder="e.g. morning doctor's appointment (min. 5 characters)"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-navy/20 resize-none" />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting || form.reason.trim().length < 5}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-navy hover:bg-navy/90 disabled:opacity-40 rounded-lg transition-colors flex items-center justify-center gap-2">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <AlarmClock size={14} />}
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create: Shift Change ───────────────────────────────────────
function CreateShiftChangeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [form, setForm] = useState({ requestedShiftId: '', effectiveDate: today, reason: '' });
  const [submitting, setSubmitting] = useState(false);
  useEscapeClose(onClose);

  useEffect(() => {
    api.get('/hris/shifts')
      .then((res) => setShifts((res.data.data ?? []).filter((s: ShiftOption) => s.isActive)))
      .catch(() => { /* silent */ });
  }, []);

  async function handleSubmit() {
    if (!form.requestedShiftId || form.reason.trim().length < 5) return;
    setSubmitting(true);
    try {
      await api.post('/hris/shift-changes', {
        requestedShiftId: form.requestedShiftId, effectiveDate: form.effectiveDate, reason: form.reason.trim(),
      });
      toast.success('Shift change request submitted');
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to submit');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <CalendarClock size={18} className="text-navy" />
            <h3 className="font-semibold text-gray-900">Request Shift Change</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">New Shift <span className="text-red-500">*</span></label>
            <select value={form.requestedShiftId} onChange={(e) => setForm((f) => ({ ...f, requestedShiftId: e.target.value }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-navy/20">
              <option value="">— Select shift —</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Effective From</label>
            <input type="date" value={form.effectiveDate} min={today} onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-navy/20" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Reason <span className="text-red-500">*</span></label>
            <textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              rows={3} placeholder="Why do you need to change shifts? (min. 5 characters)"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-navy/20 resize-none" />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting || !form.requestedShiftId || form.reason.trim().length < 5}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-navy hover:bg-navy/90 disabled:opacity-40 rounded-lg transition-colors flex items-center justify-center gap-2">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CalendarClock size={14} />}
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Review Modal (shared) ──────────────────────────────────────
function ReviewModal({
  kind, item, onClose, onDone,
}: {
  kind: ReqKind; item: LateExcuse | ShiftChange; onClose: () => void; onDone: () => void;
}) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEscapeClose(onClose);

  async function handleReview(status: 'APPROVED' | 'REJECTED') {
    setSubmitting(true);
    try {
      const base = kind === 'late' ? 'late-excuses' : 'shift-changes';
      await api.patch(`/hris/${base}/${item.id}/review`, { status, reviewNote: note.trim() || null });
      toast.success(status === 'APPROVED' ? 'Request approved' : 'Request rejected');
      onDone();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to process');
    } finally { setSubmitting(false); }
  }

  const late  = kind === 'late'  ? (item as LateExcuse)  : null;
  const shift = kind === 'shift' ? (item as ShiftChange) : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{kind === 'late' ? 'Review Late Excuse' : 'Review Shift Change'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Employee</span><span className="font-medium">{item.user.fullName}</span></div>
            {late && (
              <>
                <div className="flex justify-between"><span className="text-gray-500">Date</span><span>{fmtDate(late.date)}</span></div>
                {late.expectedTime && <div className="flex justify-between"><span className="text-gray-500">Expected arrival</span><span>{late.expectedTime}</span></div>}
              </>
            )}
            {shift && (
              <>
                <div className="flex justify-between"><span className="text-gray-500">New shift</span><span>{shift.requestedShift.name} ({shift.requestedShift.startTime}–{shift.requestedShift.endTime})</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Effective from</span><span>{fmtDate(shift.effectiveDate)}</span></div>
              </>
            )}
            <div className="flex justify-between items-start gap-4"><span className="text-gray-500 flex-shrink-0">Reason</span><span className="text-right">{item.reason}</span></div>
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
const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All',       value: ''          },
  { label: 'Pending',   value: 'PENDING'   },
  { label: 'Approved',  value: 'APPROVED'  },
  { label: 'Rejected',  value: 'REJECTED'  },
  { label: 'Cancelled', value: 'CANCELLED' },
];

export default function RequestsPage() {
  const user  = useAuthStore((s) => s.user);
  const perms = usePermStore((s) => s.perms);

  const [kind, setKind] = useState<ReqKind>('late');
  const canReview = kind === 'late' ? perms.hris.editAttendance !== 'none' : perms.hris.manageShifts;

  const [statusTab, setStatusTab] = useState('');
  const [viewMode, setViewMode]   = useState<'me' | 'team'>('me');
  const [items, setItems]         = useState<(LateExcuse | ShiftChange)[]>([]);
  const [meta, setMeta]           = useState<Meta | null>(null);
  const [loading, setLoading]     = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState(20);
  const [createOpen, setCreateOpen]       = useState(false);
  const [reviewTarget, setReviewTarget]   = useState<LateExcuse | ShiftChange | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const params: Record<string, string | number> = { page, limit: pageSize };
      if (statusTab) params.status = statusTab;
      if (!(canReview && viewMode === 'team')) params.userId = user!.id;
      const res = await api.get(kind === 'late' ? '/hris/late-excuses' : '/hris/shift-changes', { params });
      setItems(res.data.data);
      setMeta(res.data.meta);
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  }, [kind, statusTab, viewMode, page, pageSize, user, canReview]);

  useEffect(() => { fetch(); }, [fetch]);

  async function handleCancel(id: string) {
    try {
      await api.patch(`/hris/${kind === 'late' ? 'late-excuses' : 'shift-changes'}/${id}/cancel`);
      toast.success('Request cancelled');
      fetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to cancel');
    }
  }

  return (
    <>
      {createOpen && kind === 'late'  && <CreateLateExcuseModal  onClose={() => setCreateOpen(false)} onCreated={fetch} />}
      {createOpen && kind === 'shift' && <CreateShiftChangeModal onClose={() => setCreateOpen(false)} onCreated={fetch} />}
      {reviewTarget && <ReviewModal kind={kind} item={reviewTarget} onClose={() => setReviewTarget(null)} onDone={fetch} />}

      <div className="space-y-5 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardEdit size={20} className="text-navy" /> Requests
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Late excuses and shift change requests</p>
          </div>
          <button onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-navy text-white rounded-lg text-sm font-medium hover:bg-navy/90 transition-colors">
            <Plus size={15} /> {kind === 'late' ? 'Late Excuse' : 'Shift Change'}
          </button>
        </div>

        {/* Kind switch */}
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1 w-fit">
          {([
            { v: 'late'  as const, label: 'Late Excuses',  icon: AlarmClock    },
            { v: 'shift' as const, label: 'Shift Changes', icon: CalendarClock },
          ]).map(({ v, label, icon: Icon }) => (
            <button key={v} onClick={() => { setKind(v); setStatusTab(''); setPage(1); }}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                kind === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex gap-1 border-b border-gray-200 flex-1">
            {STATUS_TABS.map((t) => (
              <button key={t.value} onClick={() => { setStatusTab(t.value); setPage(1); }}
                className={cn('px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                  statusTab === t.value ? 'border-navy text-navy' : 'border-transparent text-gray-500 hover:text-gray-700')}>
                {t.label}
              </button>
            ))}
          </div>
          {canReview && (
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

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-gray-300" />
          </div>
        ) : loadError ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500 mb-3">Failed to load data. Check your connection and try again.</p>
            <button onClick={fetch} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardEdit size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No requests</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it) => {
              const cfg = STATUS_CONFIG[it.status];
              const StatusIcon = cfg.icon;
              const isOwn = it.user.id === user?.id;
              const showReview = canReview && it.status === 'PENDING' && !isOwn;
              const showCancel = isOwn && it.status === 'PENDING';
              const late  = kind === 'late'  ? (it as LateExcuse)  : null;
              const shift = kind === 'shift' ? (it as ShiftChange) : null;

              return (
                <div key={it.id} className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {viewMode === 'team' && (
                    <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                      {it.user.avatar
                        ? <img src={it.user.avatar} alt="" className="w-full h-full object-cover rounded-full" />
                        : getInitials(it.user.fullName)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {viewMode === 'team' && (
                      <p className="text-xs font-medium text-gray-500 mb-0.5">{it.user.fullName}</p>
                    )}
                    {late && (
                      <>
                        <p className="text-sm font-semibold text-gray-800">{fmtDate(late.date)}</p>
                        {late.expectedTime && <p className="text-xs text-gray-500 mt-0.5">Expected arrival {late.expectedTime}</p>}
                      </>
                    )}
                    {shift && (
                      <>
                        <p className="text-sm font-semibold text-gray-800">
                          → {shift.requestedShift.name}
                          <span className="ml-1.5 text-xs font-normal text-gray-500">({shift.requestedShift.startTime}–{shift.requestedShift.endTime})</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">Effective {fmtDate(shift.effectiveDate)}</p>
                      </>
                    )}
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">{it.reason}</p>
                    {it.reviewNote && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <AlertCircle size={10} /> {it.reviewNote}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full', cfg.color, cfg.bg)}>
                      <StatusIcon size={11} /> {cfg.label}
                    </span>
                    {showCancel && (
                      <button onClick={() => handleCancel(it.id)}
                        className="text-xs text-gray-500 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50">
                        Cancel
                      </button>
                    )}
                    {showReview && (
                      <button onClick={() => setReviewTarget(it)}
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
        {meta && (
          <div className="flex items-center justify-between gap-2 pt-2">
            <PageSizeSelect value={pageSize} onChange={(n) => { setPageSize(n); setPage(1); }} />
            {meta.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-2 text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors">‹</button>
                <span className="text-sm text-gray-500">{page} / {meta.totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages}
                  className="p-2 text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors">›</button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
