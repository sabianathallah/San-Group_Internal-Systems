import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import {
  Boxes, Plus, X, Search, Loader2, Package, MapPin, Tag,
  ArrowDownCircle, ArrowUpCircle, Check, Ban, Printer, Download,
  CheckCircle2, XCircle, Clock, Pencil, Wallet, ChevronLeft, ChevronRight, Scale,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toastStore';
import { usePermStore } from '@/stores/permStore';
import { PageSizeSelect } from '@/components/shared/PageSizeSelect';
import WarehouseSelect from '@/components/shared/WarehouseSelect';

// ── Types ──────────────────────────────────────────────────
interface MiniUser { id: string; fullName: string; username: string; avatar: string | null; divisionId: string }
interface AssetCategory { id: string; name: string; color: string | null }
type TxType = 'PURCHASE' | 'DISPOSAL';
type HistoryType = TxType | 'ADJUSTMENT';
type TxStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
interface AssetStockRow { id: string; location: string; qty: number; updatedAt: string }

interface AssetTransaction {
  id: string; type: HistoryType; location: string; quantity: number; cost: string | null; note: string | null;
  status: TxStatus; approvedAt: string | null; createdAt: string;
  requestedBy: MiniUser; approvedBy: MiniUser | null;
}

interface Asset {
  id: string; code: string; name: string; description: string | null;
  unit: string | null; stocks: AssetStockRow[]; totalQty: number;
  category: AssetCategory; createdBy: MiniUser;
  createdAt: string; updatedAt: string;
  _count: { history: number };
  history?: AssetTransaction[];
}

interface InventoryStats {
  totalAssets: number; pendingApprovals: number; monthlySpend: number;
  byLocation: { location: string; count: number; totalQty: number }[];
  byCategory: { category: AssetCategory | null; count: number; totalQty: number }[];
}

function extractErr(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    if (e.response && typeof e.response === 'object') {
      const r = e.response as Record<string, unknown>;
      if (r.data && typeof r.data === 'object') {
        const d = r.data as Record<string, unknown>;
        if (typeof d.message === 'string') return d.message;
      }
    }
    if (typeof e.message === 'string') return e.message;
  }
  return 'Something went wrong';
}

function csvCell(v: string) {
  const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

function exportAssetsCSV(assets: Asset[], t: (key: string) => string) {
  const header = [
    t('inventory.csv.code'), t('inventory.csv.name'), t('inventory.csv.category'),
    t('inventory.csv.qty'), t('inventory.csv.unit'), t('inventory.csv.location'), t('inventory.csv.createdBy'),
  ];
  const rows = assets.map((a) => [
    a.code, a.name, a.category.name, String(a.totalQty), a.unit ?? '',
    a.stocks.map((s) => `${s.location} (${s.qty})`).join('; '), a.createdBy.fullName,
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => csvCell(String(v))).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function formatMoney(n: number | string) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n));
}

/** Light tinted background from a category's hex color, for pill badges. */
function tint(hex: string | null, alpha: string) {
  return (hex ?? '#64748B') + alpha;
}

// ── Main page ────────────────────────────────────────────────
export default function InventoryPage() {
  const { t } = useTranslation();
  const { perms } = usePermStore();
  const canCreate = perms.inventory?.create ?? false;
  const canEdit   = perms.inventory?.edit !== 'none';
  const canDelete = perms.inventory?.delete !== 'none';
  const canApprove = (perms.inventory?.approvePurchase ?? false) || (perms.inventory?.approveDisposal ?? false);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const { id: qrAssetId } = useParams<{ id: string }>();
  const [selectedId, setSelectedId] = useState<string | null>(qrAssetId ?? null);
  const [showCreate, setShowCreate] = useState(false);
  const [showApprovals, setShowApprovals] = useState(false);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  // Bumped whenever a mutation happens outside the detail panel itself (e.g. an
  // approve/reject decided from the Approvals modal) so the open panel refetches
  // instead of showing a stale status for the asset it has selected.
  const [detailRefreshTick, setDetailRefreshTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory', {
        params: { page, limit: pageSize, search: search || undefined, categoryId: categoryFilter || undefined },
      });
      setAssets(res.data.data ?? []);
      setTotal(res.data.meta?.total ?? 0);
    } catch (err) { toast.error(extractErr(err)); } finally { setLoading(false); }
  }, [page, pageSize, search, categoryFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/inventory/categories').then((r) => setCategories(r.data.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    api.get('/inventory/stats').then((r) => setStats(r.data.data)).catch(() => {});
  }, [assets]);

  return (
    <div className="flex h-full overflow-hidden -m-6 bg-gray-50">
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy/10 flex items-center justify-center flex-shrink-0">
              <Boxes size={19} className="text-navy" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 leading-tight">{t('inventory.title')}</h1>
              <p className="text-xs text-gray-400">{t('inventory.assetCount', { count: total })}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canApprove && (
              <button
                onClick={() => setShowApprovals(true)}
                className="relative flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <Clock size={14} /> {t('inventory.pendingApprovals')}
                {stats && stats.pendingApprovals > 0 && (
                  <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-amber-600 text-white">
                    {stats.pendingApprovals}
                  </span>
                )}
              </button>
            )}
            <button
              onClick={() => exportAssetsCSV(assets, t)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Download size={14} /> {t('inventory.exportCsv')}
            </button>
            {canCreate && (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg bg-navy text-white hover:bg-navy-light transition-colors shadow-sm shadow-navy/20"
              >
                <Plus size={15} /> {t('inventory.newAsset')}
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 px-6 pb-4">
            <StatCard label={t('inventory.stats.totalAssets')} value={String(stats.totalAssets)} icon={Package} tone="navy" />
            <StatCard label={t('inventory.stats.pendingApprovals')} value={String(stats.pendingApprovals)} icon={Clock} tone="amber" />
            <StatCard label={t('inventory.stats.monthlySpend')} value={formatMoney(stats.monthlySpend)} icon={Wallet} tone="emerald" />
          </div>
        )}

        {/* Filter bar */}
        <div className="flex items-center gap-2 px-6 pb-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={t('inventory.searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:border-navy focus:ring-2 focus:ring-navy/10 transition-shadow"
            />
          </div>
          <select
            value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none text-gray-600 focus:border-navy"
          >
            <option value="">{t('inventory.allCategories')}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Table card */}
        <div className="flex-1 min-h-0 px-6 pb-6 flex flex-col">
          <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full min-h-[240px]"><Loader2 className="animate-spin text-gray-300" size={26} /></div>
              ) : assets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[280px] gap-3 text-center px-6">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                    <Boxes size={24} className="text-gray-300" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">{t('inventory.empty')}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t('inventory.emptyHint')}</p>
                  </div>
                  {canCreate && (
                    <button
                      onClick={() => setShowCreate(true)}
                      className="mt-1 flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg bg-navy text-white hover:bg-navy-light transition-colors"
                    >
                      <Plus size={14} /> {t('inventory.newAsset')}
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                      <th className="px-5 py-3">{t('inventory.colCode')}</th>
                      <th className="px-3 py-3">{t('inventory.colName')}</th>
                      <th className="px-3 py-3">{t('inventory.colCategory')}</th>
                      <th className="px-3 py-3 text-right">{t('inventory.colQty')}</th>
                      <th className="px-3 py-3">{t('inventory.colLocation')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((a) => (
                      <tr
                        key={a.id}
                        onClick={() => setSelectedId(a.id)}
                        className={cn(
                          'cursor-pointer border-b border-gray-50 last:border-0 transition-colors',
                          selectedId === a.id ? 'bg-navy/[0.04]' : 'hover:bg-gray-50/80',
                        )}
                      >
                        <td className="px-5 py-3">
                          <span className="font-mono text-[11px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{a.code}</span>
                        </td>
                        <td className="px-3 py-3 font-medium text-gray-800">{a.name}</td>
                        <td className="px-3 py-3">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
                            style={{ backgroundColor: tint(a.category.color, '1A'), color: a.category.color ?? '#475569' }}
                          >
                            {a.category.name}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-gray-700 font-medium tabular-nums">{a.totalQty} <span className="text-gray-400 font-normal">{a.unit ?? ''}</span></td>
                        <td className="px-3 py-3 text-gray-500">
                          {a.stocks.length === 0 ? (
                            <span className="text-gray-300">—</span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <MapPin size={11} className="text-gray-300 flex-shrink-0" /> {a.stocks[0].location}
                              {a.stocks.length > 1 && (
                                <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">+{a.stocks.length - 1}</span>
                              )}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {!loading && assets.length > 0 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 flex-shrink-0">
                <PageSizeSelect value={pageSize} onChange={(n) => { setPageSize(n); setPage(1); }} />
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-1 border border-gray-200 rounded-md disabled:opacity-30 hover:bg-gray-50">
                    <ChevronLeft size={13} />
                  </button>
                  <span className="tabular-nums">{t('inventory.pageOf', { page, total: Math.max(1, Math.ceil(total / pageSize)) })}</span>
                  <button disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)} className="p-1 border border-gray-200 rounded-md disabled:opacity-30 hover:bg-gray-50">
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedId && (
        <AssetDetailPanel
          assetId={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={load}
          categories={categories}
          canEdit={canEdit}
          canDelete={canDelete}
          refreshSignal={detailRefreshTick}
        />
      )}

      {showCreate && (
        <CreateAssetModal
          categories={categories}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
          onCategoryCreated={(c) => setCategories((prev) => [...prev, c])}
        />
      )}

      {showApprovals && (
        <ApprovalsModal onClose={() => setShowApprovals(false)} onDecided={() => { load(); setDetailRefreshTick((t) => t + 1); }} />
      )}
    </div>
  );
}

const STAT_TONE = {
  navy:    { bg: 'bg-navy/10',    icon: 'text-navy' },
  amber:   { bg: 'bg-amber-50',   icon: 'text-amber-600' },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600' },
} as const;

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: React.ElementType; tone: keyof typeof STAT_TONE }) {
  const c = STAT_TONE[tone];
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', c.bg)}>
        <Icon size={17} className={c.icon} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-gray-400 truncate">{label}</p>
        <p className="text-base font-semibold text-gray-900 leading-tight truncate">{value}</p>
      </div>
    </div>
  );
}

// ── Create asset modal ──────────────────────────────────────
function CreateAssetModal({
  categories, onClose, onCreated, onCategoryCreated,
}: {
  categories: AssetCategory[]; onClose: () => void; onCreated: () => void;
  onCategoryCreated: (c: AssetCategory) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [qty, setQty] = useState('0');
  const [unit, setUnit] = useState('');
  const [location, setLocation] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    try {
      const res = await api.post('/inventory/categories', { name: newCatName.trim() });
      onCategoryCreated(res.data.data);
      setCategoryId(res.data.data.id);
      setNewCatName('');
      setAddingCat(false);
    } catch (err) { toast.error(extractErr(err)); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !location.trim() || !categoryId) { toast.error(t('inventory.form.validationError')); return; }
    setSaving(true);
    try {
      await api.post('/inventory', {
        name: name.trim(), description: description.trim() || null,
        qty: Number(qty) || 0, unit: unit.trim() || null, location: location.trim(), categoryId,
      });
      toast.success(t('inventory.form.createSuccess'));
      onCreated();
    } catch (err) { toast.error(extractErr(err)); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{t('inventory.newAsset')}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 -m-1"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
          <Field label={t('inventory.form.name')}>
            <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLS} />
          </Field>
          <Field label={t('inventory.form.category')}>
            <div className="flex items-center gap-2">
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={cn(INPUT_CLS, 'flex-1')}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="button" onClick={() => setAddingCat((v) => !v)} className="px-2.5 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500">
                <Plus size={13} />
              </button>
            </div>
            {addingCat && (
              <div className="flex items-center gap-2 mt-2">
                <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder={t('inventory.form.newCategoryPlaceholder')}
                  className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none" />
                <button type="button" onClick={handleAddCategory} className="px-2.5 py-1.5 text-xs font-medium bg-navy text-white rounded-lg">{t('inventory.form.add')}</button>
              </div>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('inventory.form.qty')}>
              <input type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} className={INPUT_CLS} />
            </Field>
            <Field label={t('inventory.form.unit')}>
              <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pcs, unit, box..." className={INPUT_CLS} />
            </Field>
          </div>
          <Field label={t('inventory.form.location')}>
            <div className="mt-1"><WarehouseSelect value={location} onChange={setLocation} /></div>
            <p className="text-[11px] text-gray-400 mt-1">{t('inventory.form.locationHint')}</p>
          </Field>
          <Field label={t('inventory.form.description')}>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={cn(INPUT_CLS, 'resize-none')} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-3.5 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 rounded-lg">{t('inventory.form.cancel')}</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-navy text-white rounded-lg disabled:opacity-50 flex items-center gap-1.5 hover:bg-navy-light transition-colors">
            {saving && <Loader2 size={13} className="animate-spin" />} {t('inventory.form.save')}
          </button>
        </div>
      </form>
    </div>
  );
}

const INPUT_CLS = 'w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-navy focus:ring-2 focus:ring-navy/10 transition-shadow';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {children}
    </div>
  );
}

const LABEL_PRESETS = [
  { id: '30x20', w: 30, h: 20, label: '30×20 mm' },
  { id: '40x30', w: 40, h: 30, label: '40×30 mm' },
  { id: '50x40', w: 50, h: 40, label: '50×40 mm' },
  { id: '58x40', w: 58, h: 40, label: '58×40 mm (thermal)' },
  { id: '80x50', w: 80, h: 50, label: '80×50 mm' },
] as const;

// ── Print label modal (QR + code + name, sized for thermal label printers) ──
function PrintLabelModal({ asset, qrValue, onClose }: { asset: Asset; qrValue: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [presetId, setPresetId] = useState<typeof LABEL_PRESETS[number]['id']>('40x30');
  const [copies, setCopies] = useState('1');
  const preset = LABEL_PRESETS.find((p) => p.id === presetId)!;

  function handlePrint() {
    const n = Math.min(999, Math.max(1, Number(copies) || 1));
    const printRoot = document.createElement('div');
    printRoot.id = 'inventory-print-root';
    const style = document.createElement('style');
    style.textContent = `
      @media print {
        body > *:not(#inventory-print-root) { display: none !important; }
        #inventory-print-root { display: block !important; }
        @page { size: ${preset.w}mm ${preset.h}mm; margin: 0; }
        .label { width: ${preset.w}mm; height: ${preset.h}mm; page-break-after: always; }
      }
      #inventory-print-root { display: none; }
      .label { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1mm; box-sizing: border-box; padding: 1mm; }
      .label svg { width: auto; height: 60%; }
      .label .code { font-family: monospace; font-size: 2.2mm; }
      .label .name { font-size: 2.4mm; text-align: center; line-height: 1.1; max-width: 100%; overflow: hidden; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(printRoot);

    // Render N label blocks with a fresh QR SVG markup cloned from the modal's own preview.
    const sourceSvg = document.getElementById('inventory-label-qr-source')?.innerHTML ?? '';
    for (let i = 0; i < n; i++) {
      const div = document.createElement('div');
      div.className = 'label';
      div.innerHTML = `<div>${sourceSvg}</div><div class="code">${asset.code}</div><div class="name">${asset.name}</div>`;
      printRoot.appendChild(div);
    }

    window.print();
    document.body.removeChild(printRoot);
    document.head.removeChild(style);
  }

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{t('inventory.detail.printLabel.title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 -m-1"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex flex-col items-center gap-2 py-3 bg-gray-50 rounded-xl">
            <div id="inventory-label-qr-source"><QRCodeSVG value={qrValue} size={80} /></div>
            <p className="text-[10px] font-mono text-gray-400">{asset.code}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">{t('inventory.detail.printLabel.size')}</label>
            <div className="grid grid-cols-1 gap-1.5 mt-1.5">
              {LABEL_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPresetId(p.id)}
                  className={cn(
                    'text-left px-3 py-2 text-xs rounded-lg border transition-colors',
                    presetId === p.id ? 'border-navy bg-navy/5 text-navy font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <Field label={t('inventory.detail.printLabel.copies')}>
            <input type="number" min={1} max={999} value={copies} onChange={(e) => setCopies(e.target.value)} className={INPUT_CLS} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-3.5 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 rounded-lg">{t('inventory.form.cancel')}</button>
          <button type="button" onClick={handlePrint} className="px-4 py-2 text-sm font-medium bg-navy text-white rounded-lg hover:bg-navy-light transition-colors flex items-center gap-1.5">
            <Printer size={14} /> {t('inventory.detail.printLabel.printN', { count: Math.min(999, Math.max(1, Number(copies) || 1)) })}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Asset detail panel ──────────────────────────────────────
function AssetDetailPanel({
  assetId, onClose, onChanged, categories, canEdit, canDelete, refreshSignal,
}: {
  assetId: string; onClose: () => void; onChanged: () => void;
  categories: AssetCategory[]; canEdit: boolean; canDelete: boolean; refreshSignal: number;
}) {
  const { t } = useTranslation();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [txType, setTxType] = useState<TxType | null>(null);
  const [txLocation, setTxLocation] = useState('');
  const [txQty, setTxQty] = useState('1');
  const [txCost, setTxCost] = useState('');
  const [txNote, setTxNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPrintLabel, setShowPrintLabel] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  function startEdit() {
    if (!asset) return;
    setEditName(asset.name);
    setEditUnit(asset.unit ?? ''); setEditCategoryId(asset.category.id);
    setEditing(true);
  }

  function openTxForm(type: TxType) {
    setTxType(type);
    setTxLocation(asset?.stocks[0]?.location ?? '');
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/inventory/${assetId}`);
      setAsset(res.data.data);
    } catch (err) { toast.error(extractErr(err)); } finally { setLoading(false); }
  }, [assetId]);

  // Also refetch when a decision made elsewhere (the Approvals modal) touches
  // this asset's pending transactions, so the panel doesn't show a stale status.
  useEffect(() => { load(); }, [load, refreshSignal]);

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSavingEdit(true);
    try {
      await api.patch(`/inventory/${assetId}`, {
        name: editName.trim(), unit: editUnit.trim() || null, categoryId: editCategoryId,
      });
      toast.success(t('inventory.detail.editSuccess'));
      setEditing(false);
      load(); onChanged();
    } catch (err) { toast.error(extractErr(err)); } finally { setSavingEdit(false); }
  }

  async function handleDelete() {
    if (!confirm(t('inventory.detail.confirmDelete'))) return;
    try {
      await api.delete(`/inventory/${assetId}`);
      toast.success(t('inventory.detail.deleteSuccess'));
      onChanged();
      onClose();
    } catch (err) { toast.error(extractErr(err)); }
  }

  async function submitTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!txType) return;
    const location = txLocation.trim();
    if (!location) { toast.error(t('inventory.detail.locationRequired')); return; }
    setSubmitting(true);
    try {
      await api.post(`/inventory/${assetId}/transactions`, {
        type: txType, location, quantity: Number(txQty) || 0,
        cost: txType === 'PURCHASE' && txCost ? Number(txCost) : undefined,
        note: txNote.trim() || undefined,
      });
      toast.success(t('inventory.detail.requestSubmitted'));
      setTxType(null); setTxQty('1'); setTxCost(''); setTxNote('');
      load(); onChanged();
    } catch (err) { toast.error(extractErr(err)); } finally { setSubmitting(false); }
  }

  const qrValue = `${window.location.origin}/inventory/assets/${assetId}`;

  return (
    <div className="w-[26rem] flex-shrink-0 border-l border-gray-100 bg-white flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 text-sm">{t('inventory.detail.title')}</h2>
        <div className="flex items-center gap-0.5">
          {canEdit && !editing && (
            <button onClick={startEdit} title={t('inventory.detail.edit')} className="text-gray-400 hover:text-navy hover:bg-gray-50 p-1.5 rounded-md transition-colors">
              <Pencil size={15} />
            </button>
          )}
          {canDelete && (
            <button onClick={handleDelete} title={t('inventory.detail.delete')} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors">
              <XCircle size={16} />
            </button>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-50 p-1.5 rounded-md transition-colors"><X size={17} /></button>
        </div>
      </div>

      {loading || !asset ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-gray-300" size={24} /></div>
      ) : editing ? (
        <form onSubmit={saveEdit} className="flex-1 overflow-y-auto p-5 space-y-3.5">
          <Field label={t('inventory.form.name')}>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} className={INPUT_CLS} />
          </Field>
          <Field label={t('inventory.form.category')}>
            <select value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)} className={INPUT_CLS}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label={t('inventory.form.unit')}>
            <input value={editUnit} onChange={(e) => setEditUnit(e.target.value)} className={INPUT_CLS} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditing(false)} className="px-3.5 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 rounded-lg">{t('inventory.form.cancel')}</button>
            <button type="submit" disabled={savingEdit} className="px-4 py-2 text-sm font-medium bg-navy text-white rounded-lg disabled:opacity-50 flex items-center gap-1.5">
              {savingEdit && <Loader2 size={13} className="animate-spin" />} {t('inventory.form.save')}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <span className="font-mono text-[11px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{asset.code}</span>
            <h3 className="text-lg font-semibold text-gray-900 mt-1.5 leading-tight">{asset.name}</h3>
            {asset.description && <p className="text-xs text-gray-500 mt-1">{asset.description}</p>}
          </div>

          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ backgroundColor: tint(asset.category.color, '1A'), color: asset.category.color ?? '#475569' }}
          >
            <Tag size={11} /> {asset.category.name}
          </span>

          {/* Per-location stock breakdown */}
          <div className="rounded-xl border border-navy/10 bg-navy/[0.04] overflow-hidden">
            <div className="flex items-center gap-2.5 p-3">
              <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <Package size={16} className="text-navy" />
              </div>
              <div>
                <p className="text-[11px] text-gray-400">{t('inventory.detail.totalStock')}</p>
                <p className="text-base font-semibold text-gray-900 leading-tight">{asset.totalQty} <span className="text-xs font-normal text-gray-400">{asset.unit ?? ''}</span></p>
              </div>
            </div>
            {asset.stocks.length > 0 && (
              <div className="border-t border-navy/10 divide-y divide-navy/10">
                {asset.stocks.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                    <span className="flex items-center gap-1 text-gray-600"><MapPin size={11} className="text-gray-400" /> {s.location}</span>
                    <span className="font-medium text-gray-800 tabular-nums">{s.qty} {asset.unit ?? ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* QR code */}
          <div className="flex flex-col items-center gap-2 py-4 rounded-xl border border-gray-100 bg-gray-50/60">
            <div className="bg-white p-2.5 rounded-lg shadow-sm">
              <QRCodeSVG value={qrValue} size={116} />
            </div>
            <p className="text-[10px] text-gray-400 font-mono mt-1">{asset.code}</p>
            <p className="text-xs font-medium text-gray-700 text-center">{asset.name}</p>
          </div>
          <button onClick={() => setShowPrintLabel(true)} className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
            <Printer size={13} /> {t('inventory.detail.printQr')}
          </button>

          {/* Request buttons */}
          <div className="flex gap-2">
            <button onClick={() => openTxForm('PURCHASE')} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors">
              <ArrowDownCircle size={14} /> {t('inventory.detail.requestPurchase')}
            </button>
            <button onClick={() => openTxForm('DISPOSAL')} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium border border-orange-200 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors">
              <ArrowUpCircle size={14} /> {t('inventory.detail.requestDisposal')}
            </button>
          </div>

          {txType && (
            <form onSubmit={submitTransaction} className="space-y-2.5 p-3.5 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-xs font-semibold text-gray-700">
                {txType === 'PURCHASE' ? t('inventory.detail.requestPurchase') : t('inventory.detail.requestDisposal')}
              </p>
              {txType === 'PURCHASE' ? (
                <WarehouseSelect value={txLocation} onChange={setTxLocation} placeholder={t('inventory.detail.pickOrCreateLocation')} />
              ) : (
                <select value={txLocation} onChange={(e) => setTxLocation(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-lg outline-none bg-white">
                  {asset.stocks.length === 0 && <option value="">{t('inventory.detail.noLocationsYet')}</option>}
                  {asset.stocks.map((s) => <option key={s.id} value={s.location}>{s.location} ({s.qty} {asset.unit ?? ''})</option>)}
                </select>
              )}
              <input type="number" min={1} value={txQty} onChange={(e) => setTxQty(e.target.value)}
                placeholder={t('inventory.form.qty')} className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-lg outline-none bg-white" />
              {txType === 'PURCHASE' && (
                <input type="number" min={0} value={txCost} onChange={(e) => setTxCost(e.target.value)}
                  placeholder={t('inventory.detail.costPlaceholder')} className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-lg outline-none bg-white" />
              )}
              <textarea value={txNote} onChange={(e) => setTxNote(e.target.value)} rows={2}
                placeholder={t('inventory.detail.notePlaceholder')} className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-lg outline-none resize-none bg-white" />
              <div className="flex justify-end gap-2 pt-0.5">
                <button type="button" onClick={() => setTxType(null)} className="px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg">{t('inventory.form.cancel')}</button>
                <button type="submit" disabled={submitting} className="px-3 py-1.5 text-xs font-medium bg-navy text-white rounded-lg disabled:opacity-50">{t('inventory.form.submit')}</button>
              </div>
            </form>
          )}

          {/* History timeline */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">{t('inventory.detail.history')}</p>
            {(asset.history ?? []).length === 0 ? (
              <p className="text-xs text-gray-400">{t('inventory.detail.noHistory')}</p>
            ) : (
              <ul className="relative space-y-4 before:absolute before:left-[11px] before:top-1 before:bottom-1 before:w-px before:bg-gray-100">
                {(asset.history ?? []).map((h) => (
                  <li key={h.id} className="relative flex items-start gap-3 pl-0">
                    <HistoryIcon type={h.type} />
                    <div className="flex-1 min-w-0 pb-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-gray-700 font-medium">
                          {h.type === 'PURCHASE' && t('inventory.detail.purchaseOf', { count: h.quantity })}
                          {h.type === 'DISPOSAL' && t('inventory.detail.disposalOf', { count: h.quantity })}
                          {h.type === 'ADJUSTMENT' && t('inventory.detail.adjustmentOf', { count: h.quantity })}
                        </p>
                        <StatusPill status={h.status} />
                      </div>
                      <p className="text-[10px] text-gray-400 flex items-center gap-1"><MapPin size={9} /> {h.location}</p>
                      {h.cost && <p className="text-xs text-gray-500">{formatMoney(h.cost)}</p>}
                      <p className="text-[10px] text-gray-400 mt-0.5">{h.requestedBy.fullName} · {new Date(h.createdAt).toLocaleDateString()}</p>
                      {h.note && <p className="text-[10px] text-gray-500 italic mt-0.5">"{h.note}"</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {showPrintLabel && asset && (
        <PrintLabelModal asset={asset} qrValue={qrValue} onClose={() => setShowPrintLabel(false)} />
      )}
    </div>
  );
}

function HistoryIcon({ type }: { type: HistoryType }) {
  if (type === 'ADJUSTMENT') {
    return (
      <div className="relative z-10 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ring-4 ring-white bg-blue-100 text-blue-600">
        <Scale size={12} />
      </div>
    );
  }
  return (
    <div className={cn(
      'relative z-10 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ring-4 ring-white',
      type === 'PURCHASE' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600',
    )}>
      {type === 'PURCHASE' ? <ArrowDownCircle size={13} /> : <ArrowUpCircle size={13} />}
    </div>
  );
}

function StatusPill({ status }: { status: TxStatus }) {
  const { t } = useTranslation();
  const cfg = {
    PENDING:  { icon: Clock, cls: 'text-amber-600 bg-amber-50', label: t('inventory.status.pending') },
    APPROVED: { icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50', label: t('inventory.status.approved') },
    REJECTED: { icon: Ban, cls: 'text-red-500 bg-red-50', label: t('inventory.status.rejected') },
  }[status];
  const Icon = cfg.icon;
  return (
    <span className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0', cfg.cls)}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
}

// ── Approvals modal ──────────────────────────────────────────
function ApprovalsModal({ onClose, onDecided }: { onClose: () => void; onDecided: () => void }) {
  const { t } = useTranslation();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory', { params: { limit: 100 } });
      const list: Asset[] = res.data.data ?? [];
      const withHistory = await Promise.all(
        list.map(async (a) => {
          const detail = await api.get(`/inventory/${a.id}`);
          return detail.data.data as Asset;
        }),
      );
      setAssets(withHistory.filter((a) => (a.history ?? []).some((h) => h.status === 'PENDING')));
    } catch (err) { toast.error(extractErr(err)); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function decide(assetId: string, txId: string, decision: 'approve' | 'reject', note?: string) {
    try {
      await api.patch(`/inventory/${assetId}/transactions/${txId}/${decision}`, decision === 'reject' ? { note } : undefined);
      toast.success(decision === 'approve' ? t('inventory.approvals.approveSuccess') : t('inventory.approvals.rejectSuccess'));
      setRejectingId(null); setRejectNote('');
      load(); onDecided();
    } catch (err) { toast.error(extractErr(err)); }
  }

  const pending = assets.flatMap((a) => (a.history ?? []).filter((h) => h.status === 'PENDING').map((h) => ({ asset: a, tx: h })));

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{t('inventory.pendingApprovals')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 -m-1"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-300" size={22} /></div>
          ) : pending.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <CheckCircle2 size={28} className="text-emerald-300" />
              <p className="text-sm text-gray-400">{t('inventory.approvals.empty')}</p>
            </div>
          ) : (
            pending.map(({ asset, tx }) => (
              <div key={tx.id} className="p-3.5 border border-gray-100 rounded-xl space-y-2.5 hover:border-gray-200 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{asset.name}</p>
                    <p className="text-xs text-gray-500">
                      {tx.type === 'PURCHASE' ? t('inventory.detail.purchaseOf', { count: tx.quantity }) : t('inventory.detail.disposalOf', { count: tx.quantity })}
                      {tx.cost && ` — ${formatMoney(tx.cost)}`}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1"><MapPin size={9} /> {tx.location} · {tx.requestedBy.fullName}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => decide(asset.id, tx.id, 'approve')} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
                      <Check size={14} />
                    </button>
                    <button onClick={() => setRejectingId(tx.id)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                      <Ban size={14} />
                    </button>
                  </div>
                </div>
                {rejectingId === tx.id && (
                  <div className="flex items-center gap-2">
                    <input value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder={t('inventory.approvals.rejectReasonPlaceholder')}
                      className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none" />
                    <button onClick={() => decide(asset.id, tx.id, 'reject', rejectNote)} className="px-2.5 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                      {t('inventory.approvals.confirmReject')}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
