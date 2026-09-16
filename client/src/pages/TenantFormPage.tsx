import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Building2 } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toastStore';
import { usePermStore } from '@/stores/permStore';
import { ROUTES } from '@/lib/constants';
import {
  type Tenant, type TenantLocation, type TenantStatus,
  LOCATIONS, STATUSES, extractErr,
} from '@/types/tenant';

const INPUT_CLS = 'w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-navy focus:ring-2 focus:ring-navy/10 transition-shadow';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-gray-500">
      {label}
      {children}
    </label>
  );
}

// Full-page create/edit form — Tenant Database CRUD deliberately doesn't use
// popup/modal forms; this page is reached from "Tenant Baru" or the detail
// panel's Edit button, and always navigates back to the list on save/cancel.
export default function TenantFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;
  const { perms } = usePermStore();
  const canViewFinancials = perms.tenant?.viewFinancials ?? false;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [location, setLocation] = useState<TenantLocation>(
    (searchParams.get('location') as TenantLocation) ?? 'GREEN_TERRACE',
  );
  const [block, setBlock] = useState('');
  const [unitNo, setUnitNo] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<TenantStatus>('VACANT');
  const [area, setArea] = useState('');
  const [power, setPower] = useState('');
  const [leaseStart, setLeaseStart] = useState('');
  const [leaseEnd, setLeaseEnd] = useState('');
  const [fitOutDate, setFitOutDate] = useState('');
  const [openDate, setOpenDate] = useState('');
  const [rentPrice, setRentPrice] = useState('');
  const [serviceCharge, setServiceCharge] = useState('');
  const [notes, setNotes] = useState('');

  const backToList = useCallback(() => navigate(`${ROUTES.TENANTS_MANAGE}?location=${location}`), [navigate, location]);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    api.get(`/tenants/${id}`)
      .then((res) => {
        const tn: Tenant = res.data.data;
        setLocation(tn.location);
        setBlock(tn.block);
        setUnitNo(tn.unitNo);
        setName(tn.name ?? '');
        setStatus(tn.status);
        setArea(tn.area ?? '');
        setPower(tn.power != null ? String(tn.power) : '');
        setLeaseStart(tn.leaseStart ? tn.leaseStart.slice(0, 10) : '');
        setLeaseEnd(tn.leaseEnd ? tn.leaseEnd.slice(0, 10) : '');
        setFitOutDate(tn.fitOutDate ? tn.fitOutDate.slice(0, 10) : '');
        setOpenDate(tn.openDate ? tn.openDate.slice(0, 10) : '');
        setRentPrice(tn.rentPrice ?? '');
        setServiceCharge(tn.serviceCharge ?? '');
        setNotes(tn.notes ?? '');
      })
      .catch((err) => toast.error(extractErr(err)))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!block.trim() || !unitNo.trim()) { toast.error(t('tenant.form.validationError')); return; }
    setSaving(true);
    const body = {
      location, block: block.trim(), unitNo: unitNo.trim(), name: name.trim() || null, status,
      area: area ? Number(area) : null, power: power ? Number(power) : null,
      leaseStart: leaseStart ? new Date(leaseStart).toISOString() : null,
      leaseEnd: leaseEnd ? new Date(leaseEnd).toISOString() : null,
      fitOutDate: fitOutDate ? new Date(fitOutDate).toISOString() : null,
      openDate: openDate ? new Date(openDate).toISOString() : null,
      rentPrice: rentPrice ? Number(rentPrice) : null,
      serviceCharge: serviceCharge ? Number(serviceCharge) : null,
      notes: notes.trim() || null,
    };
    try {
      if (isEdit) {
        await api.patch(`/tenants/${id}`, body);
        toast.success(t('tenant.form.editSuccess'));
      } else {
        await api.post('/tenants', body);
        toast.success(t('tenant.form.createSuccess'));
      }
      navigate(`${ROUTES.TENANTS_MANAGE}?location=${location}`);
    } catch (err) { toast.error(extractErr(err)); } finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto -m-6 bg-gray-50">
      <div className="flex items-center gap-3.5 px-6 pt-6 pb-5">
        <button
          onClick={backToList}
          className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 text-gray-500 hover:text-navy hover:border-navy/40 transition-colors"
        >
          <ArrowLeft size={17} />
        </button>
        <div className="w-10 h-10 rounded-xl bg-navy/10 flex items-center justify-center flex-shrink-0">
          <Building2 size={19} className="text-navy" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900 leading-tight tracking-tight">
            {isEdit ? t('tenant.detail.edit') : t('tenant.newTenant')}
          </h1>
          {isEdit && <p className="text-xs text-gray-400 mt-0.5">{block} · {unitNo}</p>}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-24"><Loader2 className="animate-spin text-gray-300" size={26} /></div>
      ) : (
        <form onSubmit={handleSubmit} className="px-6 pb-10 max-w-3xl">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('tenant.form.location')}>
                <select value={location} onChange={(e) => setLocation(e.target.value as TenantLocation)} className={INPUT_CLS}>
                  {LOCATIONS.map((l) => <option key={l} value={l}>{t(`tenant.locations.${l}`)}</option>)}
                </select>
              </Field>
              <Field label={t('tenant.form.status')}>
                <select value={status} onChange={(e) => setStatus(e.target.value as TenantStatus)} className={INPUT_CLS}>
                  {STATUSES.map((s) => <option key={s} value={s}>{t(`tenant.status.${s}`)}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label={t('tenant.form.block')}>
                <input value={block} onChange={(e) => setBlock(e.target.value)} placeholder="Block A, Ground Floor..." className={INPUT_CLS} />
              </Field>
              <Field label={t('tenant.form.unitNo')}>
                <input value={unitNo} onChange={(e) => setUnitNo(e.target.value)} className={INPUT_CLS} />
              </Field>
            </div>

            <Field label={t('tenant.form.name')}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('tenant.form.namePlaceholder')} className={INPUT_CLS} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label={t('tenant.form.area')}>
                <input type="number" min={0} step="0.01" value={area} onChange={(e) => setArea(e.target.value)} className={INPUT_CLS} />
              </Field>
              <Field label={t('tenant.form.power')}>
                <input type="number" min={0} value={power} onChange={(e) => setPower(e.target.value)} className={INPUT_CLS} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label={t('tenant.form.leaseStart')}>
                <input type="date" value={leaseStart} onChange={(e) => setLeaseStart(e.target.value)} className={INPUT_CLS} />
              </Field>
              <Field label={t('tenant.form.leaseEnd')}>
                <input type="date" value={leaseEnd} onChange={(e) => setLeaseEnd(e.target.value)} className={INPUT_CLS} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label={t('tenant.form.fitOutDate')}>
                <input type="date" value={fitOutDate} onChange={(e) => setFitOutDate(e.target.value)} className={INPUT_CLS} />
              </Field>
              <Field label={t('tenant.form.openDate')}>
                <input type="date" value={openDate} onChange={(e) => setOpenDate(e.target.value)} className={INPUT_CLS} />
              </Field>
            </div>

            {canViewFinancials && (
              <div className="grid grid-cols-2 gap-4 pt-1 border-t border-gray-100">
                <Field label={t('tenant.form.rentPrice')}>
                  <input type="number" min={0} value={rentPrice} onChange={(e) => setRentPrice(e.target.value)} className={cn(INPUT_CLS, 'mt-1')} />
                </Field>
                <Field label={t('tenant.form.serviceCharge')}>
                  <input type="number" min={0} value={serviceCharge} onChange={(e) => setServiceCharge(e.target.value)} className={cn(INPUT_CLS, 'mt-1')} />
                </Field>
              </div>
            )}

            <Field label={t('tenant.form.notes')}>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={cn(INPUT_CLS, 'resize-none')} />
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-5">
            <button type="button" onClick={backToList} className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
              {t('tenant.form.cancel')}
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2.5 text-sm font-medium bg-navy text-white rounded-lg disabled:opacity-50 flex items-center gap-1.5 hover:bg-navy-light transition-colors shadow-sm shadow-navy/20">
              {saving && <Loader2 size={13} className="animate-spin" />} {t('tenant.form.save')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
