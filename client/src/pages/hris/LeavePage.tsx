import { useEffect, useState, useCallback } from 'react';
import {
  Plus, X, Loader2, CheckCircle2, XCircle,
  CalendarRange, RefreshCw, ChevronDown, Users, Clock,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { getHolidaySet, countWorkdays } from '@/lib/holidays';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { useAuthStore } from '@/stores/authStore';
import { usePermStore } from '@/stores/permStore';
import { toast } from '@/stores/toastStore';
import { PageSizeSelect } from '@/components/shared/PageSizeSelect';

/** Locale for date formatting — mirrors i18next's active language. */
function dateLocale(language: string): string {
  return language === 'id' ? 'id-ID' : 'en-US';
}

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
const STATUS_STYLE: Record<LeaveStatus, { labelKey: string; cls: string }> = {
  PENDING:   { labelKey: 'hris.leave.status.pending',  cls: 'bg-yellow-50 text-yellow-700 border-yellow-200'  },
  APPROVED:  { labelKey: 'hris.leave.status.approved',  cls: 'bg-green-50 text-green-700 border-green-200'     },
  REJECTED:  { labelKey: 'hris.leave.status.rejected',  cls: 'bg-red-50 text-red-700 border-red-200'           },
  CANCELLED: { labelKey: 'hris.leave.status.cancelled', cls: 'bg-gray-50 text-gray-500 border-gray-200'        },
};

function fmtDate(iso: string, language: string) {
  return new Date(iso).toLocaleDateString(dateLocale(language), { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Create Modal ───────────────────────────────────────────────
function CreateLeaveModal({
  open, onClose, leaveTypes, balances, onCreated,
}: {
  open: boolean; onClose: () => void;
  leaveTypes: LeaveType[]; balances: LeaveBalance[];
  onCreated: () => void;
}) {
  const { t } = useTranslation();
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
    if (file.size > 5 * 1024 * 1024) { toast.error(t('hris.leave.createModal.toast.maxFileSize')); return; }
    const reader = new FileReader();
    reader.onload = () => setAttachment({ base64: reader.result as string, name: file.name });
    reader.readAsDataURL(file);
  }

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.leaveTypeId || !form.startDate || !form.endDate || !form.reason.trim()) return;
    if (docRequired && !attachment) { toast.error(t('hris.leave.createModal.toast.docRequired')); return; }
    setSaving(true);
    try {
      const res = await api.post('/hris/leave-requests', {
        ...form,
        attachmentBase64: attachment?.base64 ?? null,
        attachmentName:   attachment?.name ?? null,
      });
      if (res.data.data?.isUnpaid) {
        toast.success(t('hris.leave.createModal.toast.unpaidSubmitted'));
      } else {
        toast.success(t('hris.leave.createModal.toast.submitted'));
      }
      onCreated();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('hris.leave.createModal.toast.submitFailed');
      toast.error(msg);
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">{t('hris.leave.createModal.title')}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('hris.leave.createModal.leaveTypeLabel')}</label>
            <div className="relative">
              <select
                value={form.leaveTypeId}
                onChange={(e) => setForm((f) => ({ ...f, leaveTypeId: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-navy/20"
                required
              >
                {leaveTypes.map((lt) => (
                  <option key={lt.id} value={lt.id}>{lt.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            {selBal && selBal.remainingDays !== null && (
              <p className="text-xs text-gray-400 mt-1">{t('hris.leave.createModal.remainingBalance', { days: selBal.remainingDays })}</p>
            )}
            {selType?.requiresDoc && (
              <p className="text-xs text-orange-500 mt-1">
                {(selType.requiresDocAfterDays ?? 0) > 0
                  ? t('hris.leave.createModal.requiresDocAfterDays', { days: selType.requiresDocAfterDays })
                  : t('hris.leave.createModal.requiresDoc')}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('hris.leave.createModal.startDateLabel')}</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-navy/20"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('hris.leave.createModal.endDateLabel')}</label>
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
              {t('hris.leave.createModal.totalWorkingDays', { count: totalDays })}
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {t('hris.leave.createModal.documentLabel')} {docRequired ? <span className="text-red-500">*</span> : <span className="text-gray-400">{t('hris.leave.createModal.optional')}</span>}
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="w-full text-xs text-gray-500 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-navy/10 file:text-navy file:text-xs file:font-medium hover:file:bg-navy/20"
            />
            {attachment && <p className="text-xs text-gray-400 mt-1">{t('hris.leave.createModal.attachmentName', { name: attachment.name })}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('hris.leave.createModal.reasonLabel')}</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              rows={3}
              placeholder={t('hris.leave.createModal.reasonPlaceholder')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-navy/20"
              required
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              {t('hris.leave.createModal.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || !form.leaveTypeId || !form.startDate || !form.endDate || !form.reason.trim()}
              className="flex-1 px-4 py-2 text-sm font-medium bg-navy text-white rounded-lg hover:bg-navy/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {t('hris.leave.createModal.submit')}
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
  const { t, i18n } = useTranslation();
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
      toast.success(status === 'APPROVED' ? t('hris.leave.reviewModal.toast.approved') : t('hris.leave.reviewModal.toast.rejected'));
      onDone();
      onClose();
    } catch {
      toast.error(t('hris.leave.reviewModal.toast.failed'));
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">{t('hris.leave.reviewModal.title')}</h2>
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
              {' · '}{fmtDate(request.startDate, i18n.language)} — {fmtDate(request.endDate, i18n.language)} ({request.totalDays} days)
            </p>
            <p className="text-xs text-gray-500">{request.reason}</p>
            {reqBalance !== 'loading' && reqBalance && !request.isUnpaid && (
              <p className="text-xs text-gray-600">
                {t('hris.leave.reviewModal.remainingBalance')}{' '}
                {reqBalance.remainingDays === null
                  ? t('hris.leave.reviewModal.noFixedQuota')
                  : <strong>{t('hris.leave.reviewModal.remainingOfTotal', { remaining: reqBalance.remainingDays, total: reqBalance.totalDays })}</strong>}
                {reqBalance.remainingDays !== null && request.status === 'PENDING' && (
                  <span className="text-gray-400"> {t('hris.leave.reviewModal.pendingIncluded', { count: request.totalDays })}</span>
                )}
              </p>
            )}
            {request.isUnpaid && (
              <p className="text-xs font-medium text-orange-600 bg-orange-50 rounded px-2 py-1 inline-block">
                {t('hris.leave.reviewModal.unpaidNote')}
              </p>
            )}
            {request.attachmentUrl && (
              <a href={request.attachmentUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-navy hover:underline inline-flex items-center gap-1">
                📎 {request.attachmentName ?? t('hris.leave.reviewModal.viewAttachment')}
              </a>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('hris.leave.reviewModal.noteLabel')}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder={t('hris.leave.reviewModal.notePlaceholder')}
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
              {t('hris.leave.reviewModal.reject')}
            </button>
            <button
              disabled={saving}
              onClick={() => handle('APPROVED')}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {t('hris.leave.reviewModal.approve')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Grant Comp-Off Modal (HR only) ─────────────────────────────
function GrantCompOffModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
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
      toast.success(t('hris.leave.grantModal.toast.granted'));
      onDone();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('hris.leave.grantModal.toast.grantFailed');
      toast.error(msg);
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">{t('hris.leave.grantModal.title')}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            {t('hris.leave.grantModal.descriptionPrefix')}{' '}
            <span className="font-medium">Comp Off</span>{' '}
            {t('hris.leave.grantModal.descriptionSuffix')}
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('hris.leave.grantModal.employeeLabel')}</label>
            <select value={form.userId} onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/20" required>
              <option value="">{t('hris.leave.grantModal.selectEmployee')}</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('hris.leave.grantModal.daysLabel')}</label>
            <input type="number" min={1} max={10} value={form.days}
              onChange={(e) => setForm((f) => ({ ...f, days: Number(e.target.value) }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('hris.leave.grantModal.reasonLabel')}</label>
            <textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              rows={2} placeholder={t('hris.leave.grantModal.reasonPlaceholder')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-navy/20" required />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              {t('hris.leave.grantModal.cancel')}
            </button>
            <button type="submit" disabled={saving || !form.userId || form.reason.trim().length < 5}
              className="flex-1 px-4 py-2 text-sm font-medium bg-navy text-white rounded-lg hover:bg-navy/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 size={13} className="animate-spin" />}
              {t('hris.leave.grantModal.grant')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function LeavePage() {
  const { t, i18n } = useTranslation();
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
      toast.success(t('hris.leave.toast.cancelSuccess'));
      load();
    } catch { toast.error(t('hris.leave.toast.cancelFailed')); }
  }

  const displayed = viewMode === 'mine'
    ? requests.filter((r) => r.user.id === user?.id)
    : requests;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('hris.leave.header.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('hris.leave.header.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              <button onClick={() => { setViewMode('mine'); setPage(1); }} className={cn('px-3 py-1.5 flex items-center gap-1.5 transition-colors', viewMode === 'mine' ? 'bg-navy text-white' : 'text-gray-600 hover:bg-gray-50')}>
                <Clock size={13} /> {t('hris.leave.viewMode.mine')}
              </button>
              <button onClick={() => { setViewMode('team'); setPage(1); }} className={cn('px-3 py-1.5 flex items-center gap-1.5 transition-colors', viewMode === 'team' ? 'bg-navy text-white' : 'text-gray-600 hover:bg-gray-50')}>
                <Users size={13} /> {t('hris.leave.viewMode.team')}
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
              <Plus size={15} /> {t('hris.leave.grantCompOffBtn')}
            </button>
          )}
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-navy text-white rounded-lg text-sm font-medium hover:bg-navy/90 transition-colors"
          >
            <Plus size={15} /> {t('hris.leave.requestLeaveBtn')}
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
                  <p className="text-xs text-gray-400 mt-0.5">{t('hris.leave.balanceCard.ofDaysUsed', { total: b.totalDays, used: b.usedDays })}</p>
                  {b.carriedOverDays > 0 && (
                    <p className="text-[11px] text-amber-600 mt-0.5">{t('hris.leave.balanceCard.carriedOver', { days: b.carriedOverDays })}</p>
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
                  <p className="text-sm font-semibold text-gray-600 mt-1">{t('hris.leave.balanceCard.asNeeded')}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {b.leaveType.requiresDoc ? t('hris.leave.balanceCard.asNeededHintDoc') : t('hris.leave.balanceCard.asNeededHint')}
                  </p>
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
              {s === '' ? t('hris.leave.filterAll') : t(STATUS_STYLE[s as LeaveStatus].labelKey)}
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
            <p className="text-sm text-gray-500 mb-3">{t('hris.leave.loadError')}</p>
            <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <RefreshCw size={14} /> {t('hris.leave.retry')}
            </button>
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-16 text-center">
            <CalendarRange size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">{t('hris.leave.empty')}</p>
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
                          {t(cfg.labelKey)}
                        </span>
                        {r.isUnpaid && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-orange-50 text-orange-600 border-orange-200">
                            {t('hris.leave.list.unpaidBadge')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {t('hris.leave.list.dateRange', {
                          start: fmtDate(r.startDate, i18n.language),
                          end: fmtDate(r.endDate, i18n.language),
                          count: r.totalDays,
                        })}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{r.reason}</p>
                      {r.attachmentUrl && (
                        <a href={r.attachmentUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-navy hover:underline inline-flex items-center gap-1 mt-0.5">
                          📎 {r.attachmentName ?? t('hris.leave.list.attachmentDefault')}
                        </a>
                      )}
                      {r.reviewNote && (
                        <p className="text-xs text-gray-500 mt-1 italic bg-gray-50 rounded px-2 py-1">"{r.reviewNote}"</p>
                      )}
                      {r.reviewedBy && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {r.status === 'APPROVED' ? t('hris.leave.list.approvedBy') : t('hris.leave.list.rejectedBy')}{' '}
                          <span className="font-medium">{r.reviewedBy.fullName}</span>
                          {r.reviewedAt && ` · ${new Date(r.reviewedAt).toLocaleDateString(dateLocale(i18n.language), { day: 'numeric', month: 'short' })}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isManager && !isOwn && r.status === 'PENDING' && (
                        <button
                          onClick={() => setReviewTarget(r)}
                          className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-lg hover:bg-navy/90 transition-colors"
                        >
                          {t('hris.leave.list.reviewBtn')}
                        </button>
                      )}
                      {isOwn && r.status === 'PENDING' && (
                        <button
                          onClick={() => handleCancel(r.id)}
                          className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          {t('hris.leave.list.cancelBtn')}
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
              <span className="text-sm text-gray-500">{t('hris.leave.pagination', { page, totalPages: meta.totalPages })}</span>
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
