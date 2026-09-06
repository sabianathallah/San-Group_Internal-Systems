import { useEffect, useState, useCallback } from 'react';
import {
  ClipboardEdit, Plus, Loader2, X, CheckCircle2, XCircle, Clock,
  AlertCircle, CalendarClock, AlarmClock, Users, User, RefreshCw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
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

const STATUS_CONFIG: Record<ReqStatus, { labelKey: string; color: string; bg: string; icon: React.ElementType }> = {
  PENDING:   { labelKey: 'hris.requests.status.pending',   color: 'text-yellow-700', bg: 'bg-yellow-50', icon: Clock        },
  APPROVED:  { labelKey: 'hris.requests.status.approved',  color: 'text-green-700',  bg: 'bg-green-50',  icon: CheckCircle2 },
  REJECTED:  { labelKey: 'hris.requests.status.rejected',  color: 'text-red-700',    bg: 'bg-red-50',    icon: XCircle      },
  CANCELLED: { labelKey: 'hris.requests.status.cancelled', color: 'text-gray-500',   bg: 'bg-gray-100',  icon: X            },
};

function fmtDate(iso: string, language: string) {
  return new Date(iso).toLocaleDateString(dateLocale(language), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

// ── Create: Late Excuse ────────────────────────────────────────
function CreateLateExcuseModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation();
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
      toast.success(t('hris.requests.createLateModal.toast.submitted'));
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t('hris.requests.createLateModal.toast.failed'));
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlarmClock size={18} className="text-navy" />
            <h3 className="font-semibold text-gray-900">{t('hris.requests.createLateModal.title')}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            {t('hris.requests.createLateModal.description')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('hris.requests.createLateModal.dateLabel')}</label>
              <input type="date" value={form.date} min={today} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-navy/20" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('hris.requests.createLateModal.expectedArrivalLabel')}</label>
              <input type="time" value={form.expectedTime} onChange={(e) => setForm((f) => ({ ...f, expectedTime: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-navy/20" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('hris.requests.createLateModal.reasonLabel')} <span className="text-red-500">*</span></label>
            <textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              rows={3} placeholder={t('hris.requests.createLateModal.reasonPlaceholder')}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-navy/20 resize-none" />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            {t('hris.requests.createLateModal.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={submitting || form.reason.trim().length < 5}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-navy hover:bg-navy/90 disabled:opacity-40 rounded-lg transition-colors flex items-center justify-center gap-2">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <AlarmClock size={14} />}
            {t('hris.requests.createLateModal.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create: Shift Change ───────────────────────────────────────
function CreateShiftChangeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation();
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
      toast.success(t('hris.requests.createShiftModal.toast.submitted'));
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t('hris.requests.createShiftModal.toast.failed'));
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <CalendarClock size={18} className="text-navy" />
            <h3 className="font-semibold text-gray-900">{t('hris.requests.createShiftModal.title')}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('hris.requests.createShiftModal.newShiftLabel')} <span className="text-red-500">*</span></label>
            <select value={form.requestedShiftId} onChange={(e) => setForm((f) => ({ ...f, requestedShiftId: e.target.value }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-navy/20">
              <option value="">{t('hris.requests.createShiftModal.selectShiftPlaceholder')}</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('hris.requests.createShiftModal.effectiveFromLabel')}</label>
            <input type="date" value={form.effectiveDate} min={today} onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-navy/20" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('hris.requests.createShiftModal.reasonLabel')} <span className="text-red-500">*</span></label>
            <textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              rows={3} placeholder={t('hris.requests.createShiftModal.reasonPlaceholder')}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-navy/20 resize-none" />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            {t('hris.requests.createShiftModal.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={submitting || !form.requestedShiftId || form.reason.trim().length < 5}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-navy hover:bg-navy/90 disabled:opacity-40 rounded-lg transition-colors flex items-center justify-center gap-2">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CalendarClock size={14} />}
            {t('hris.requests.createShiftModal.submit')}
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
  const { t, i18n } = useTranslation();
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEscapeClose(onClose);

  async function handleReview(status: 'APPROVED' | 'REJECTED') {
    setSubmitting(true);
    try {
      const base = kind === 'late' ? 'late-excuses' : 'shift-changes';
      await api.patch(`/hris/${base}/${item.id}/review`, { status, reviewNote: note.trim() || null });
      toast.success(status === 'APPROVED' ? t('hris.requests.reviewModal.toast.approved') : t('hris.requests.reviewModal.toast.rejected'));
      onDone();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t('hris.requests.reviewModal.toast.failed'));
    } finally { setSubmitting(false); }
  }

  const late  = kind === 'late'  ? (item as LateExcuse)  : null;
  const shift = kind === 'shift' ? (item as ShiftChange) : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{kind === 'late' ? t('hris.requests.reviewModal.titleLate') : t('hris.requests.reviewModal.titleShift')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">{t('hris.requests.reviewModal.employee')}</span><span className="font-medium">{item.user.fullName}</span></div>
            {late && (
              <>
                <div className="flex justify-between"><span className="text-gray-500">{t('hris.requests.reviewModal.date')}</span><span>{fmtDate(late.date, i18n.language)}</span></div>
                {late.expectedTime && <div className="flex justify-between"><span className="text-gray-500">{t('hris.requests.reviewModal.expectedArrival')}</span><span>{late.expectedTime}</span></div>}
              </>
            )}
            {shift && (
              <>
                <div className="flex justify-between"><span className="text-gray-500">{t('hris.requests.reviewModal.newShift')}</span><span>{shift.requestedShift.name} ({shift.requestedShift.startTime}–{shift.requestedShift.endTime})</span></div>
                <div className="flex justify-between"><span className="text-gray-500">{t('hris.requests.reviewModal.effectiveFrom')}</span><span>{fmtDate(shift.effectiveDate, i18n.language)}</span></div>
              </>
            )}
            <div className="flex justify-between items-start gap-4"><span className="text-gray-500 flex-shrink-0">{t('hris.requests.reviewModal.reason')}</span><span className="text-right">{item.reason}</span></div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('hris.requests.reviewModal.noteLabel')}</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t('hris.requests.reviewModal.notePlaceholder')}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none" />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={() => handleReview('REJECTED')} disabled={submitting}
            className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-40">
            <XCircle size={14} /> {t('hris.requests.reviewModal.reject')}
          </button>
          <button onClick={() => handleReview('APPROVED')} disabled={submitting}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-navy hover:bg-navy/90 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-40">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {t('hris.requests.reviewModal.approve')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
const STATUS_TABS: { labelKey: string; value: string }[] = [
  { labelKey: 'hris.requests.statusTabs.all',       value: ''          },
  { labelKey: 'hris.requests.statusTabs.pending',   value: 'PENDING'   },
  { labelKey: 'hris.requests.statusTabs.approved',  value: 'APPROVED'  },
  { labelKey: 'hris.requests.statusTabs.rejected',  value: 'REJECTED'  },
  { labelKey: 'hris.requests.statusTabs.cancelled', value: 'CANCELLED' },
];

export default function RequestsPage() {
  const { t, i18n } = useTranslation();
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
      toast.success(t('hris.requests.list.toast.cancelled'));
      fetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t('hris.requests.list.toast.cancelFailed'));
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
              <ClipboardEdit size={20} className="text-navy" /> {t('hris.requests.header.title')}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">{t('hris.requests.header.subtitle')}</p>
          </div>
          <button onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-navy text-white rounded-lg text-sm font-medium hover:bg-navy/90 transition-colors">
            <Plus size={15} /> {kind === 'late' ? t('hris.requests.kind.late') : t('hris.requests.kind.shift')}
          </button>
        </div>

        {/* Kind switch */}
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1 w-fit">
          {([
            { v: 'late'  as const, label: t('hris.requests.kind.lateTabs'),  icon: AlarmClock    },
            { v: 'shift' as const, label: t('hris.requests.kind.shiftTabs'), icon: CalendarClock },
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
            {STATUS_TABS.map((st) => (
              <button key={st.value} onClick={() => { setStatusTab(st.value); setPage(1); }}
                className={cn('px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                  statusTab === st.value ? 'border-navy text-navy' : 'border-transparent text-gray-500 hover:text-gray-700')}>
                {t(st.labelKey)}
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
                  {v === 'me' ? t('hris.requests.viewMode.me') : t('hris.requests.viewMode.team')}
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
            <p className="text-sm text-gray-500 mb-3">{t('hris.requests.loadError')}</p>
            <button onClick={fetch} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <RefreshCw size={14} /> {t('hris.requests.retry')}
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardEdit size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">{t('hris.requests.empty')}</p>
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
                        <p className="text-sm font-semibold text-gray-800">{fmtDate(late.date, i18n.language)}</p>
                        {late.expectedTime && <p className="text-xs text-gray-500 mt-0.5">{t('hris.requests.list.expectedArrival', { time: late.expectedTime })}</p>}
                      </>
                    )}
                    {shift && (
                      <>
                        <p className="text-sm font-semibold text-gray-800">
                          → {shift.requestedShift.name}
                          <span className="ml-1.5 text-xs font-normal text-gray-500">({shift.requestedShift.startTime}–{shift.requestedShift.endTime})</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{t('hris.requests.list.effective', { date: fmtDate(shift.effectiveDate, i18n.language) })}</p>
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
                      <StatusIcon size={11} /> {t(cfg.labelKey)}
                    </span>
                    {showCancel && (
                      <button onClick={() => handleCancel(it.id)}
                        className="text-xs text-gray-500 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50">
                        {t('hris.requests.list.cancel')}
                      </button>
                    )}
                    {showReview && (
                      <button onClick={() => setReviewTarget(it)}
                        className="text-xs font-medium text-navy hover:underline px-2 py-1 rounded hover:bg-navy/5 transition-colors">
                        {t('hris.requests.list.review')}
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
                <span className="text-sm text-gray-500">{t('hris.requests.pagination', { page, totalPages: meta.totalPages })}</span>
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
