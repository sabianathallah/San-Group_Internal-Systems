import { useEffect, useState, useCallback } from 'react';
import {
  CalendarRange, Plus, Pencil, Loader2, X, RefreshCw,
  Power, FileText, ArrowRightLeft, Hourglass, Gift,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { toast } from '@/stores/toastStore';

interface LeaveType {
  id: string; name: string; slug: string; color: string;
  maxDaysPerYear: number; isPaid: boolean; requiresDoc: boolean;
  requiresDocAfterDays: number; allowCarryOver: boolean;
  tenureMonthsRequired: number; earnedBalance: boolean; isActive: boolean;
}

interface FormState {
  name: string; color: string; maxDaysPerYear: number;
  isPaid: boolean; requiresDoc: boolean; requiresDocAfterDays: number;
  allowCarryOver: boolean; tenureMonthsRequired: number;
}

const EMPTY_FORM: FormState = {
  name: '', color: '#6366f1', maxDaysPerYear: 0,
  isPaid: true, requiresDoc: false, requiresDocAfterDays: 0,
  allowCarryOver: false, tenureMonthsRequired: 0,
};

const COLORS = ['#6366f1', '#ef4444', '#f97316', '#3b82f6', '#8b5cf6', '#10b981', '#eab308', '#ec4899'];

// ── Create / Edit Modal ────────────────────────────────────────
function LeaveTypeModal({
  initial, onClose, onSaved,
}: { initial: LeaveType | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(initial ? {
    name: initial.name, color: initial.color, maxDaysPerYear: initial.maxDaysPerYear,
    isPaid: initial.isPaid, requiresDoc: initial.requiresDoc, requiresDocAfterDays: initial.requiresDocAfterDays,
    allowCarryOver: initial.allowCarryOver, tenureMonthsRequired: initial.tenureMonthsRequired,
  } : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  useEscapeClose(onClose);

  const isEarned = initial?.earnedBalance ?? false;
  const quotaChanged = initial && form.maxDaysPerYear !== initial.maxDaysPerYear;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.name.trim().length < 2) return;
    setSaving(true);
    try {
      if (initial) {
        await api.put(`/hris/leave-types/${initial.id}`, form);
        toast.success(t('hris.admin.leaveTypes.toast.updated'));
      } else {
        await api.post('/hris/leave-types', form);
        toast.success(t('hris.admin.leaveTypes.toast.created'));
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t('hris.admin.leaveTypes.toast.saveFailed'));
    } finally { setSaving(false); }
  }

  function num(v: string) { return Math.max(0, Number(v) || 0); }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">
            {initial ? t('hris.admin.leaveTypes.modal.editTitle', { name: initial.name }) : t('hris.admin.leaveTypes.modal.newTitle')}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('hris.admin.leaveTypes.modal.name')}</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('hris.admin.leaveTypes.modal.namePlaceholder')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20" required />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('hris.admin.leaveTypes.modal.color')}</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className={cn('w-7 h-7 rounded-full transition-transform', form.color === c && 'ring-2 ring-offset-2 ring-navy scale-110')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('hris.admin.leaveTypes.modal.quotaPerYear')}</label>
              <input type="number" min={0} max={365} value={form.maxDaysPerYear} disabled={isEarned}
                onChange={(e) => setForm((f) => ({ ...f, maxDaysPerYear: num(e.target.value) }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 disabled:bg-gray-50 disabled:text-gray-400" />
              <p className="text-[11px] text-gray-400 mt-1">
                {isEarned ? t('hris.admin.leaveTypes.modal.quotaEarnedHint') : t('hris.admin.leaveTypes.modal.quotaFreeHint')}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('hris.admin.leaveTypes.modal.minTenure')}</label>
              <input type="number" min={0} max={120} value={form.tenureMonthsRequired}
                onChange={(e) => setForm((f) => ({ ...f, tenureMonthsRequired: num(e.target.value) }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20" />
              <p className="text-[11px] text-gray-400 mt-1">{t('hris.admin.leaveTypes.modal.tenureHint')}</p>
            </div>
          </div>

          {quotaChanged && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              {t('hris.admin.leaveTypes.modal.quotaChangedWarning')}
            </p>
          )}

          <div className="space-y-2.5">
            <label className="flex items-center justify-between gap-3 text-sm text-gray-700">
              <span>{t('hris.admin.leaveTypes.modal.paidLeave')}</span>
              <input type="checkbox" checked={form.isPaid}
                onChange={(e) => setForm((f) => ({ ...f, isPaid: e.target.checked }))} className="accent-navy w-4 h-4" />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm text-gray-700">
              <span>{t('hris.admin.leaveTypes.modal.carryOverLabel')} <span className="text-gray-400">{t('hris.admin.leaveTypes.modal.carryOverExpiry')}</span></span>
              <input type="checkbox" checked={form.allowCarryOver}
                onChange={(e) => setForm((f) => ({ ...f, allowCarryOver: e.target.checked }))} className="accent-navy w-4 h-4" />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm text-gray-700">
              <span>{t('hris.admin.leaveTypes.modal.requiresDoc')}</span>
              <input type="checkbox" checked={form.requiresDoc}
                onChange={(e) => setForm((f) => ({ ...f, requiresDoc: e.target.checked }))} className="accent-navy w-4 h-4" />
            </label>
            {form.requiresDoc && (
              <div className="flex items-center justify-between gap-3 pl-4">
                <span className="text-xs text-gray-500">{t('hris.admin.leaveTypes.modal.requiresDocAfterLabel')} <span className="text-gray-400">{t('hris.admin.leaveTypes.modal.requiresDocAfterHint')}</span></span>
                <input type="number" min={0} max={365} value={form.requiresDocAfterDays}
                  onChange={(e) => setForm((f) => ({ ...f, requiresDocAfterDays: num(e.target.value) }))}
                  className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20" />
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              {t('hris.admin.leaveTypes.modal.cancel')}
            </button>
            <button type="submit" disabled={saving || form.name.trim().length < 2}
              className="flex-1 px-4 py-2 text-sm font-medium bg-navy text-white rounded-lg hover:bg-navy/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 size={13} className="animate-spin" />}
              {initial ? t('hris.admin.leaveTypes.modal.saveChanges') : t('hris.admin.leaveTypes.modal.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function LeaveTypesAdminPage() {
  const { t: tr } = useTranslation();
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; initial: LeaveType | null }>({ open: false, initial: null });
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get('/hris/leave-types', { params: { all: true } });
      setTypes(res.data.data ?? []);
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  async function handleToggle(t: LeaveType) {
    setTogglingId(t.id);
    try {
      await api.put(`/hris/leave-types/${t.id}`, { isActive: !t.isActive });
      toast.success(t.isActive
        ? tr('hris.admin.leaveTypes.toast.deactivated', { name: t.name })
        : tr('hris.admin.leaveTypes.toast.activated', { name: t.name }));
      fetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? tr('hris.admin.leaveTypes.toast.updateFailed'));
    } finally { setTogglingId(null); }
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {modal.open && (
        <LeaveTypeModal initial={modal.initial} onClose={() => setModal({ open: false, initial: null })} onSaved={fetch} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarRange size={20} className="text-navy" /> {tr('hris.admin.leaveTypes.header.title')}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {tr('hris.admin.leaveTypes.header.subtitle')}
          </p>
        </div>
        <button onClick={() => setModal({ open: true, initial: null })}
          className="flex items-center gap-1.5 px-3 py-2 bg-navy text-white rounded-lg text-sm font-medium hover:bg-navy/90 transition-colors">
          <Plus size={15} /> {tr('hris.admin.leaveTypes.newType')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-gray-300" />
        </div>
      ) : loadError ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500 mb-3">{tr('hris.admin.leaveTypes.loadError')}</p>
          <button onClick={fetch} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <RefreshCw size={14} /> {tr('hris.admin.leaveTypes.retry')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {types.map((t) => (
            <div key={t.id} className={cn('bg-white border rounded-xl p-4', t.isActive ? 'border-gray-200' : 'border-gray-200 opacity-60')}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                  <p className="text-sm font-semibold text-gray-800 truncate">{t.name}</p>
                  {!t.isActive && (
                    <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full flex-shrink-0">{tr('hris.admin.leaveTypes.card.inactive')}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setModal({ open: true, initial: t })}
                    className="p-1.5 text-gray-400 hover:text-navy hover:bg-navy/5 rounded-lg transition-colors" title={tr('hris.admin.leaveTypes.card.edit')}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleToggle(t)} disabled={togglingId === t.id}
                    className={cn('p-1.5 rounded-lg transition-colors disabled:opacity-40',
                      t.isActive ? 'text-gray-400 hover:text-red-500 hover:bg-red-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50')}
                    title={t.isActive ? tr('hris.admin.leaveTypes.card.deactivate') : tr('hris.admin.leaveTypes.card.activate')}>
                    {togglingId === t.id ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />}
                  </button>
                </div>
              </div>

              <p className="text-2xl font-bold text-gray-900 mt-2">
                {t.earnedBalance ? '—' : t.maxDaysPerYear > 0 ? t.maxDaysPerYear : '∞'}
                {!t.earnedBalance && t.maxDaysPerYear > 0 && <span className="text-xs font-normal text-gray-400"> {tr('hris.admin.leaveTypes.card.daysPerYear')}</span>}
                {!t.earnedBalance && t.maxDaysPerYear === 0 && <span className="text-xs font-normal text-gray-400"> {tr('hris.admin.leaveTypes.card.asNeeded')}</span>}
                {t.earnedBalance && <span className="text-xs font-normal text-gray-400"> {tr('hris.admin.leaveTypes.card.earnedViaGrants')}</span>}
              </p>

              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {!t.isPaid && (
                  <span className="text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">{tr('hris.admin.leaveTypes.card.unpaid')}</span>
                )}
                {t.requiresDoc && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded-full">
                    <FileText size={9} /> {t.requiresDocAfterDays > 0 ? tr('hris.admin.leaveTypes.card.documentAfterDays', { days: t.requiresDocAfterDays }) : tr('hris.admin.leaveTypes.card.document')}
                  </span>
                )}
                {t.allowCarryOver && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                    <ArrowRightLeft size={9} /> {tr('hris.admin.leaveTypes.card.carryOver')}
                  </span>
                )}
                {t.tenureMonthsRequired > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                    <Hourglass size={9} /> {tr('hris.admin.leaveTypes.card.tenure', { months: t.tenureMonthsRequired })}
                  </span>
                )}
                {t.earnedBalance && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                    <Gift size={9} /> {tr('hris.admin.leaveTypes.card.earnedBalance')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400">
        {tr('hris.admin.leaveTypes.footerNote')}
      </p>
    </div>
  );
}
