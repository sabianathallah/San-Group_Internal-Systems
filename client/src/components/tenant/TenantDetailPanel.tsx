import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Pencil, XCircle, Loader2, MapPin, Zap, Lock, Camera, Store } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toastStore';
import { usePermStore } from '@/stores/permStore';
import { type Tenant, STATUS_CONFIG, extractErr, fmtDate, fmtMoney } from '@/types/tenant';

// Read-only detail panel — editing lives on its own page (TenantFormPage),
// not inline here, so this component never renders a form.
export default function TenantDetailPanel({ tenantId, onClose, onChanged, onEdit, canEdit, canDelete }: {
  tenantId: string; onClose: () => void; onChanged: () => void; onEdit: (tenant: Tenant) => void;
  canEdit: boolean; canDelete: boolean;
}) {
  const { t } = useTranslation();
  const { perms } = usePermStore();
  const canViewFinancials = perms.tenant?.viewFinancials ?? false;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/tenants/${tenantId}`);
      setTenant(res.data.data);
    } catch (err) { toast.error(extractErr(err)); } finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    if (!confirm(t('tenant.detail.confirmDelete'))) return;
    try {
      await api.delete(`/tenants/${tenantId}`);
      toast.success(t('tenant.detail.deleteSuccess'));
      onChanged();
      onClose();
    } catch (err) { toast.error(extractErr(err)); }
  }

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const form = new FormData();
    form.append('logo', file);
    try {
      await api.patch(`/tenants/${tenantId}/logo`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(t('tenant.detail.logoUpdateSuccess'));
      load(); onChanged();
    } catch (err) { toast.error(extractErr(err)); } finally {
      setUploadingLogo(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="w-[26rem] flex-shrink-0 border-l border-gray-100 bg-white flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 text-sm">{t('tenant.detail.title')}</h2>
        <div className="flex items-center gap-0.5">
          {canEdit && tenant && (
            <button onClick={() => onEdit(tenant)} title={t('tenant.detail.edit')} className="text-gray-400 hover:text-navy hover:bg-gray-50 p-1.5 rounded-md transition-all duration-150 hover:scale-105">
              <Pencil size={15} />
            </button>
          )}
          {canDelete && (
            <button onClick={handleDelete} title={t('tenant.detail.delete')} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-all duration-150 hover:scale-105">
              <XCircle size={16} />
            </button>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-50 p-1.5 rounded-md transition-colors"><X size={17} /></button>
        </div>
      </div>

      {loading || !tenant ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-gray-300" size={24} /></div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="flex items-start gap-3">
            <div className="relative flex-shrink-0">
              {tenant.logoPath ? (
                <img src={tenant.logoPath} alt="" className="w-14 h-14 rounded-xl object-contain bg-gray-50 border border-gray-100" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                  <Store size={20} className="text-gray-300" />
                </div>
              )}
              {canEdit && (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingLogo}
                  title={t('tenant.detail.changeLogo')}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-navy text-white flex items-center justify-center shadow-sm hover:bg-navy-light transition-colors"
                >
                  {uploadingLogo ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
            </div>
            <div className="min-w-0 pt-1">
              <span className="font-mono text-[11px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded tracking-wide">{tenant.block} · {tenant.unitNo}</span>
              <h3 className="text-lg font-semibold text-gray-900 mt-1 leading-tight truncate">
                {tenant.name ?? <span className="text-gray-300 italic font-normal">{t('tenant.status.VACANT')}</span>}
              </h3>
              <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium mt-1.5', STATUS_CONFIG[tenant.status].bg, STATUS_CONFIG[tenant.status].color)}>
                <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', STATUS_CONFIG[tenant.status].dot)} />
                {t(`tenant.status.${tenant.status}`)}
              </span>
            </div>
          </div>

          <div className="w-8 h-px bg-gold/50" />

          <div className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 flex items-center gap-1.5"><MapPin size={12} /> {t('tenant.form.location')}</span>
              <span className="text-gray-700 font-medium">{t(`tenant.locations.${tenant.location}`)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">{t('tenant.form.area')}</span>
              <span className="text-gray-700 font-medium">{tenant.area ? `${tenant.area} m²` : '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 flex items-center gap-1.5"><Zap size={12} /> {t('tenant.form.power')}</span>
              <span className="text-gray-700 font-medium">{tenant.power != null ? `${tenant.power} VA` : '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">{t('tenant.form.leaseStart')}</span>
              <span className="text-gray-700 font-medium">{fmtDate(tenant.leaseStart)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">{t('tenant.form.leaseEnd')}</span>
              <span className="text-gray-700 font-medium">{fmtDate(tenant.leaseEnd)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">{t('tenant.form.fitOutDate')}</span>
              <span className="text-gray-700 font-medium">{fmtDate(tenant.fitOutDate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">{t('tenant.form.openDate')}</span>
              <span className="text-gray-700 font-medium">{fmtDate(tenant.openDate)}</span>
            </div>
          </div>

          {canViewFinancials ? (
            <div className="space-y-2.5 text-sm bg-gray-50 rounded-xl p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">{t('tenant.form.rentPrice')}</span>
                <span className="text-gray-900 font-semibold">{fmtMoney(tenant.rentPrice)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">{t('tenant.form.serviceCharge')}</span>
                <span className="text-gray-900 font-semibold">{fmtMoney(tenant.serviceCharge)}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 bg-gray-50 rounded-xl p-4 text-center">
              <Lock size={14} className="text-gray-300" />
              <p className="text-[11px] text-gray-400 leading-relaxed">{t('tenant.detail.financialsLocked')}</p>
            </div>
          )}

          {tenant.notes && (
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{t('tenant.form.notes')}</p>
              <p className="text-xs text-gray-600 leading-relaxed">{tenant.notes}</p>
            </div>
          )}

          <p className="text-[10px] text-gray-400 pt-1">{t('tenant.detail.createdBy')}: {tenant.createdBy.fullName} · {fmtDate(tenant.createdAt)}</p>
        </div>
      )}
    </div>
  );
}
