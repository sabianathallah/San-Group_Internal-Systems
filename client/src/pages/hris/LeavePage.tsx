import { useEffect, useState, useCallback } from 'react';
import {
  Plus, X, Loader2, CheckCircle2, XCircle,
  CalendarRange, RefreshCw, ChevronDown, Users, Clock,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { getHolidaySet, countWorkdays } from '@/lib/holidays';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { useAuthStore } from '@/stores/authStore';
import { usePermStore } from '@/stores/permStore';
import { toast } from '@/stores/toastStore';
import { PageSizeSelect } from '@/components/shared/PageSizeSelect';

// ── Types ──────────────────────────────────────────────────────
type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

interface LeaveType {
  id: string; name: string; slug: string; color: string;
  maxDaysPerYear: number; isPaid: boolean; requiresDoc: boolean;
  requiresDocAfterDays: number; allowCarryOver: boolean;
  tenureMonthsRequired: number; earnedBalance: boolean;
}

interface LeaveBalance {
  leaveType: LeaveType;
  totalDays: number; usedDays: number;
  pendingDays: number; carriedOverDays: number; remainingDays: number | null;
}

interface LeaveRequest {
  id: string; status: LeaveStatus;
  startDate: string; endDate: string; totalDays: number; reason: string;
  isUnpaid: boolean; attachmentUrl: string | null; attachmentName: string | null;
  reviewNote: string | null; reviewedAt: string | null;
  createdAt: string;
  leaveType: LeaveType;
  user: { id: string; fullName: string; avatar: string | null };
  reviewedBy: { id: string; fullName: string } | null;
}

interface Meta { total: number; page: number; limit: number; totalPages: number }

// ── Helpers ────────────────────────────────────────────────────
const STATUS_STYLE: Record<LeaveStatus, { label: string; cls: string }> = {
  PENDING:   { label: 'Pending',  cls: 'bg-yellow-50 text-yellow-700 border-yellow-200'  },
  APPROVED:  { label: 'Approved',  cls: 'bg-green-50 text-green-700 border-green-200'     },
  REJECTED:  { label: 'Rejected',  cls: 'bg-red-50 text-red-700 border-red-200'           },
  CANCELLED: { label: 'Cancelled', cls: 'bg-gray-50 text-gray-500 border-gray-200'        },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Create Modal ───────────────────────────────────────────────
function CreateLeaveModal({
  open, onClose, leaveTypes, balances, onCreated,
}: {
  open: boolean; onClose: () => void;
  leaveTypes: LeaveType[]; balances: LeaveBalance[];
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
  const [attachment, setAttachment] = useState<{ base64: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  useEscapeClose(onClose);

  // Holiday set for the year being requested, so the preview day count
  // matches what the server will compute.
  const startYear = form.startDate ? Number(form.startDate.slice(0, 4)) : new Date().getFullYear();
  useEffect(() => {
    if (open) getHolidaySet(startYear).then(setHolidays);
  }, [open, startYear]);

  const totalDays = form.startDate && form.endDate ? countWorkdays(form.startDate, form.endDate, holidays) : 0;
  const selType   = leaveTypes.find((t) => t.id === form.leaveTypeId);
  const selBal    = balances.find((b) => b.leaveType.id === form.leaveTypeId);
  // Document mandatory when the type requires one and the request exceeds the
  // free-days threshold (SICK: >1 day; Special Leave: always).
  const docRequired = !!selType?.requiresDoc && totalDays > (selType?.requiresDocAfterDays ?? 0);

  useEffect(() => {
    if (open) {
      setForm({ leaveTypeId: leaveTypes[0]?.id ?? '', startDate: '', endDate: '', reason: '' });
      setAttachment(null);
    }
  }, [open, leaveTypes]);

  function handleFile(file?: File) {
    if (!file) { setAttachment(null); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Maximum file size is 5 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setAttachment({ base64: reader.result as string, name: file.name });
    reader.readAsDataURL(file);
  }

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.leaveTypeId || !form.startDate || !form.endDate || !form.reason.trim()) return;
    if (docRequired && !attachment) { toast.error('A supporting document is required for this leave'); return; }
    setSaving(true);
    try {
      const res = await api.post('/hris/leave-requests', {
        ...form,
        attachmentBase64: attachment?.base64 ?? null,
        attachmentName:   attachment?.name ?? null,
      });
      if (res.data.data?.isUnpaid) {
        toast.success('Request submitted as UNPAID leave (tenure below 1 year — salary deduction applies)');
      } else {
        toast.success('Leave request submitted');
      }
      onCreated();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to submit leave request';
      toast.error(msg);
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Request Leave</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Leave Type</label>
            <div className="relative">
              <select
                value={form.leaveTypeId}
                onChange={(e) => setForm((f) => ({ ...f, leaveTypeId: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-navy/20"
                required
              >
                {leaveTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            {selBal && selBal.remainingDays !== null && (
              <p className="text-xs text-gray-400 mt-1">Remaining balance: <strong className="text-gray-600">{selBal.remainingDays} days</strong></p>
            )}
            {selType?.requiresDoc && (
              <p className="text-xs text-orange-500 mt-1">
                ⚠ Requires supporting document{(selType.requiresDocAfterDays ?? 0) > 0 ? ` when longer than ${selType.requiresDocAfterDays} day(s)` : ''}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-navy/20"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">End Date</label>
              <input
                type="date"
                value={form.endDate}
                min={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-navy/20"
                required
              />
            </div>
          </div>

          {totalDays > 0 && (
            <p className="text-xs text-gray-500 -mt-2">
              Total: <strong className="text-gray-800">{totalDays} working days</strong>
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Supporting Document {docRequired ? <span className="text-red-500">*</span> : <span className="text-gray-400">(optional)</span>}
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="w-full text-xs text-gray-500 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-navy/10 file:text-navy file:text-xs file:font-medium hover:file:bg-navy/20"
            />
            {attachment && <p className="text-xs text-gray-400 mt-1">📎 {attachment.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Reason</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              rows={3}
              placeholder="Enter leave reason..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-navy/20"
              required
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.leaveTypeId || !form.startDate || !form.endDate || !form.reason.trim()}
              className="flex-1 px-4 py-2 text-sm font-medium bg-navy text-white rounded-lg hover:bg-navy/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Review Modal (Manager) ─────────────────────────────────────
function ReviewModal({
  request, onClose, onDone,
}: { request: LeaveRequest; onClose: () => void; onDone: () => void }) {
  const [note, setNote]     = useState('');
  const [saving, setSaving] = useState(false);
  useEscapeClose(onClose);
  // The approver should see the requester's balance while deciding — the
  // server already validated it at submission, this is decision context.
  const [reqBalance, setReqBalance] = useState<LeaveBalance | null | 'loading'>('loading');

  useEffect(() => {
    const year = new Date(request.startDate).getFullYear();
    api.get('/hris/leave-balances', { params: { userId: request.user.id, year } })
      .then((res) => {
        const balances: LeaveBalance[] = res.data.data ?? [];
        setReqBalance(balances.find((b) => b.leaveType.id === request.leaveType.id) ?? null);
      })
      .catch(() => setReqBalance(null));
  }, [request]);

  async function handle(status: 'APPROVED' | 'REJECTED') {
    setSaving(true);
    try {
      await api.patch(`/hris/leave-requests/${request.id}/review`, { status, reviewNote: note || null });
      toast.success(status === 'APPROVED' ? 'Leave approved' : 'Leave rejected');
      onDone();
      onClose();
    } catch {
      toast.error('Failed to process request');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Review Leave Request</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-navy/10 flex items-center justify-center text-navy text-xs font-semibold">
                {request.user.fullName.slice(0, 2).toUpperCase()}
              </div>
              <span className="font-medium text-gray-800">{request.user.fullName}</span>
            </div>
            <p className="text-sm text-gray-700">
              <span className="font-medium" style={{ color: request.leaveType.color }}>{request.leaveType.name}</span>
              {' · '}{fmtDate(request.startDate)} — {fmtDate(request.endDate)} ({request.totalDays} days)
            </p>
            <p className="text-xs text-gray-500">{request.reason}</p>
            {reqBalance !== 'loading' && reqBalance && !request.isUnpaid && (
              <p className="text-xs text-gray-600">
                Remaining balance:{' '}
                {reqBalance.remainingDays === null
                  ? 'no fixed quota'
                  : <strong>{reqBalance.remainingDays} of {reqBalance.totalDays} days</strong>}
                {reqBalance.remainingDays !== null && request.status === 'PENDING' && (
                  <span className="text-gray-400"> (incl. {request.totalDays} pending for this request)</span>
                )}
              </p>
            )}
            {request.isUnpaid && (
              <p className="text-xs font-medium text-orange-600 bg-orange-50 rounded px-2 py-1 inline-block">
                UNPAID — tenure below requirement, salary deduction applies
              </p>
            )}
            {request.attachmentUrl && (
              <a href={request.attachmentUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-navy hover:underline inline-flex items-center gap-1">
                📎 {request.attachmentName ?? 'View attachment'}
              </a>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Add a note for the employee..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-navy/20"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              disabled={saving}
              onClick={() => handle('REJECTED')}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={14} />}
              Reject
            </button>
            <button
              disabled={saving}
              onClick={() => handle('APPROVED')}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Grant Comp-Off Modal (HR only) ─────────────────────────────
function GrantCompOffModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [users, setUsers] = useState<{ id: string; fullName: string }[]>([]);
  const [form, setForm] = useState({ userId: '', days: 1, reason: '' });
  const [saving, setSaving] = useState(false);
  useEscapeClose(onClose);

  useEffect(() => {
    api.get('/users', { params: { limit: 100, isActive: true } })
      .then((res) => setUsers(res.data.data ?? []))
      .catch(() => { /* silent */ });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.userId || form.reason.trim().length < 5) return;
    setSaving(true);
    try {
      await api.post('/hris/comp-off', { userId: form.userId, days: form.days, reason: form.reason.trim() });
      toast.success('Comp-off granted');
      onDone();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to grant comp-off';
      toast.error(msg);
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Grant Comp Off</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            Give extra off days for working weekends or public holidays. The days
            land on the employee&apos;s <span className="font-medium">Comp Off</span> balance.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Employee</label>
            <select value={form.userId} onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/20" required>
              <option value="">— Select employee —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Days</label>
            <input type="number" min={1} max={10} value={form.days}
              onChange={(e) => setForm((f) => ({ ...f, days: Number(e.target.value) }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Reason</label>
            <textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              rows={2} placeholder="e.g. worked Saturday July 5 (building event)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-navy/20" required />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || !form.userId || form.reason.trim().length < 5}
              className="flex-1 px-4 py-2 text-sm font-medium bg-navy text-white rounded-lg hover:bg-navy/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 size={13} className="animate-spin" />}
              Grant
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function LeavePage() {
  const user = useAuthStore((s) => s.user);
  const perms = usePermStore((s) => s.perms);
  const isManager = perms.hris.reviewLeave !== 'none';

  const [leaveTypes,   setLeaveTypes]   = useState<LeaveType[]>([]);
  const [balances,     setBalances]     = useState<LeaveBalance[]>([]);
  const [requests,     setRequests]     = useState<LeaveRequest[]>([]);
  const [meta,         setMeta]         = useState<Meta | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState(false);
  const [createOpen,   setCreateOpen]   = useState(false);
  const [grantOpen,    setGrantOpen]    = useState(false);
  const [reviewTarget, setReviewTarget] = useState<LeaveRequest | null>(null);
  const [viewMode,     setViewMode]     = useState<'mine' | 'team'>('mine');
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | ''>('');
  const [year,         setYear]         = useState(new Date().getFullYear());
  const [page,         setPage]         = useState(1);
  const [pageSize,     setPageSize]     = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const params: Record<string, unknown> = { limit: pageSize, year, page };
      if (statusFilter) params.status = statusFilter;
      if (viewMode === 'mine' && user?.id) params.userId = user.id;

      const [typesRes, balRes, reqRes] = await Promise.all([
        api.get('/hris/leave-types'),
        api.get('/hris/leave-balances', { params: { year } }),
        api.get('/hris/leave-requests', { params }),
      ]);
      setLeaveTypes(typesRes.data.data);
      setBalances(balRes.data.data);
      setRequests(reqRes.data.data);
      setMeta(reqRes.data.meta);
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  }, [statusFilter, year, page, pageSize, viewMode, user?.id]);

  function handlePageSizeChange(n: number) { setPageSize(n); setPage(1); }

  useEffect(() => { load(); }, [load]);

  // Next year is allowed so a December request for January stays visible.
  function prevYear() { setYear((y) => y - 1); setPage(1); }
  function nextYear() { setYear((y) => Math.min(new Date().getFullYear() + 1, y + 1)); setPage(1); }

  async function handleCancel(id: string) {
    try {
      await api.patch(`/hris/leave-requests/${id}/cancel`);
      toast.success('Leave request cancelled');
      load();
    } catch { toast.error('Failed to cancel request'); }
  }

  const displayed = viewMode === 'mine'
    ? requests.filter((r) => r.user.id === user?.id)
    : requests;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Leave</h1>
          <p className="text-sm text-gray-500 mt-0.5">Leave requests and balance</p>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              <button onClick={() => { setViewMode('mine'); setPage(1); }} className={cn('px-3 py-1.5 flex items-center gap-1.5 transition-colors', viewMode === 'mine' ? 'bg-navy text-white' : 'text-gray-600 hover:bg-gray-50')}>
                <Clock size={13} /> Me
              </button>
              <button onClick={() => { setViewMode('team'); setPage(1); }} className={cn('px-3 py-1.5 flex items-center gap-1.5 transition-colors', viewMode === 'team' ? 'bg-navy text-white' : 'text-gray-600 hover:bg-gray-50')}>
                <Users size={13} /> Team
              </button>
            </div>
          )}
          <button onClick={load} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          {isManager && (
            <button
              onClick={() => setGrantOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <Plus size={15} /> Comp Off
            </button>
          )}
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-navy text-white rounded-lg text-sm font-medium hover:bg-navy/90 transition-colors"
          >
            <Plus size={15} /> Request Leave
          </button>
        </div>
      </div>

      {/* Balance cards */}
      {viewMode === 'mine' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {balances.map((b) => (
            <div key={b.leaveType.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: b.leaveType.color }} />
                <span className="text-xs font-medium text-gray-600 truncate">{b.leaveType.name}</span>
              </div>
              {b.remainingDays !== null ? (
                <>
                  <p className="text-2xl font-bold text-gray-900">{b.remainingDays}</p>
                  <p className="text-xs text-gray-400 mt-0.5">of {b.totalDays} days · {b.usedDays} used</p>
                  {b.carriedOverDays > 0 && (
                    <p className="text-[11px] text-amber-600 mt-0.5">incl. {b.carriedOverDays} carried over — expires Mar 31</p>
                  )}
                  <div className="h-1 bg-gray-100 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(0, (b.remainingDays / b.totalDays) * 100)}%`,
                        backgroundColor: b.leaveType.color,
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-gray-600 mt-1">As needed</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">No fixed quota — every request still needs approval{b.leaveType.requiresDoc ? ' + document' : ''}</p>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Year nav + Filter */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={prevYear} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronLeft size={16} className="text-gray-500" />
          </button>
          <span className="text-sm font-semibold text-gray-700 min-w-[48px] text-center">{year}</span>
          <button onClick={nextYear} disabled={year >= new Date().getFullYear() + 1} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30">
            <ChevronRight size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s as LeaveStatus | ''); setPage(1); }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                statusFilter === s
                  ? 'bg-navy text-white border-navy'
                  : 'text-gray-600 border-gray-200 hover:bg-gray-50',
              )}
            >
              {s === '' ? 'All' : STATUS_STYLE[s as LeaveStatus].label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={20} className="animate-spin text-gray-300" />
          </div>
        ) : loadError ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-500 mb-3">Failed to load data. Check your connection and try again.</p>
            <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-16 text-center">
            <CalendarRange size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No leave requests yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {displayed.map((r) => {
              const cfg = STATUS_STYLE[r.status];
              const isOwn = r.user.id === user?.id;
              return (
                <div key={r.id} className="px-5 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {viewMode === 'team' && (
                          <span className="text-sm font-medium text-gray-800">{r.user.fullName} ·</span>
                        )}
                        <span className="text-sm font-semibold" style={{ color: r.leaveType.color }}>
                          {r.leaveType.name}
                        </span>
                        <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full border', cfg.cls)}>
                          {cfg.label}
                        </span>
                        {r.isUnpaid && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-orange-50 text-orange-600 border-orange-200">
                            Unpaid
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {fmtDate(r.startDate)} — {fmtDate(r.endDate)} · <strong>{r.totalDays} working days</strong>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{r.reason}</p>
                      {r.attachmentUrl && (
                        <a href={r.attachmentUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-navy hover:underline inline-flex items-center gap-1 mt-0.5">
                          📎 {r.attachmentName ?? 'Attachment'}
                        </a>
                      )}
                      {r.reviewNote && (
                        <p className="text-xs text-gray-500 mt-1 italic bg-gray-50 rounded px-2 py-1">"{r.reviewNote}"</p>
                      )}
                      {r.reviewedBy && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {r.status === 'APPROVED' ? 'Approved' : 'Rejected'} by <span className="font-medium">{r.reviewedBy.fullName}</span>
                          {r.reviewedAt && ` · ${new Date(r.reviewedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isManager && !isOwn && r.status === 'PENDING' && (
                        <button
                          onClick={() => setReviewTarget(r)}
                          className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-lg hover:bg-navy/90 transition-colors"
                        >
                          Review
                        </button>
                      )}
                      {isOwn && r.status === 'PENDING' && (
                        <button
                          onClick={() => handleCancel(r.id)}
                          className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {meta && (
        <div className="flex items-center justify-between gap-2">
          <PageSizeSelect value={pageSize} onChange={handlePageSizeChange} />
          {meta.totalPages > 1 && (
            <div className="flex items-center gap-2">
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
      )}

      {/* Modals */}
      <CreateLeaveModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        leaveTypes={leaveTypes}
        balances={balances}
        onCreated={load}
      />
      {grantOpen && <GrantCompOffModal onClose={() => setGrantOpen(false)} onDone={load} />}
      {reviewTarget && (
        <ReviewModal
          request={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onDone={load}
        />
      )}
    </div>
  );
}
