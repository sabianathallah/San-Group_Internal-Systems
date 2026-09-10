import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import {
  Boxes, Plus, X, Search, Loader2, Package, MapPin, Tag,
  ArrowDownCircle, ArrowUpCircle, Check, Ban, Printer, Download,
  CheckCircle2, XCircle, Clock, Pencil,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toastStore';
import { usePermStore } from '@/stores/permStore';
import { PageSizeSelect } from '@/components/shared/PageSizeSelect';

// ── Types ──────────────────────────────────────────────────
interface MiniUser { id: string; fullName: string; username: string; avatar: string | null; divisionId: string }
interface AssetCategory { id: string; name: string; color: string | null }
type TxType = 'PURCHASE' | 'DISPOSAL';
type TxStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface AssetTransaction {
  id: string; type: TxType; quantity: number; cost: string | null; note: string | null;
  status: TxStatus; approvedAt: string | null; createdAt: string;
  requestedBy: MiniUser; approvedBy: MiniUser | null;
}

interface Asset {
  id: string; code: string; name: string; description: string | null;
  qty: number; unit: string | null; location: string;
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
  const rows = assets.map((a) => [a.code, a.name, a.category.name, String(a.qty), a.unit ?? '', a.location, a.createdBy.fullName]);
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
    <div className="flex h-full overflow-hidden -m-6">
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-white flex-wrap">
          <h1 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Boxes size={20} className="text-emerald-600" /> {t('inventory.title')}
          </h1>
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={t('inventory.searchPlaceholder')}
              className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-navy"
            />
          </div>
          <select
            value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none"
          >
            <option value="">{t('inventory.allCategories')}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex-1" />
          {canApprove && (
            <button
              onClick={() => setShowApprovals(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
            >
              <Clock size={14} /> {t('inventory.pendingApprovals')}
              {stats && stats.pendingApprovals > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-amber-600 text-white">{stats.pendingApprovals}</span>
              )}
            </button>
          )}
          <button
            onClick={() => exportAssetsCSV(assets, t)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <Download size={14} /> {t('inventory.exportCsv')}
          </button>
          {canCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-navy text-white hover:bg-navy/90"
            >
              <Plus size={14} /> {t('inventory.newAsset')}
            </button>
          )}
        </div>

        {/* Stats strip */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50/50">
            <StatCard label={t('inventory.stats.totalAssets')} value={String(stats.totalAssets)} icon={Package} />
            <StatCard label={t('inventory.stats.pendingApprovals')} value={String(stats.pendingApprovals)} icon={Clock} />
            <StatCard label={t('inventory.stats.monthlySpend')} value={formatMoney(stats.monthlySpend)} icon={ArrowUpCircle} />
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-gray-300" size={28} /></div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 text-gray-400 gap-2">
              <Boxes size={32} />
              <p className="text-sm">{t('inventory.empty')}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-medium text-gray-400 uppercase border-b border-gray-100">
                  <th className="px-6 py-2">{t('inventory.colCode')}</th>
                  <th className="px-2 py-2">{t('inventory.colName')}</th>
                  <th className="px-2 py-2">{t('inventory.colCategory')}</th>
                  <th className="px-2 py-2">{t('inventory.colQty')}</th>
                  <th className="px-2 py-2">{t('inventory.colLocation')}</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => setSelectedId(a.id)}
                    className={cn(
                      'border-b border-gray-50 cursor-pointer hover:bg-gray-50',
                      selectedId === a.id && 'bg-navy/5',
                    )}
                  >
                    <td className="px-6 py-2.5 text-gray-500 font-mono text-xs">{a.code}</td>
                    <td className="px-2 py-2.5 font-medium text-gray-800">{a.name}</td>
                    <td className="px-2 py-2.5">
                      <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: a.category.color ?? '#94a3b8' }} />
                        {a.category.name}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-gray-700">{a.qty} {a.unit ?? ''}</td>
                    <td className="px-2 py-2.5 text-gray-500 flex items-center gap-1">
                      <MapPin size={11} className="text-gray-300" /> {a.location}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
          <PageSizeSelect value={pageSize} onChange={(n) => { setPageSize(n); setPage(1); }} />
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-2 py-1 border rounded disabled:opacity-30">‹</button>
            {t('inventory.pageOf', { page, total: Math.max(1, Math.ceil(total / pageSize)) })}
            <button disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)} className="px-2 py-1 border rounded disabled:opacity-30">›</button>
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
        <ApprovalsModal onClose={() => setShowApprovals(false)} onDecided={() => { load(); }} />
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-white rounded-lg border border-gray-100">
      <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
        <Icon size={15} className="text-emerald-600" />
      </div>
      <div>
        <p className="text-[11px] text-gray-400">{label}</p>
        <p className="text-sm font-semibold text-gray-800">{value}</p>
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
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">{t('inventory.newAsset')}</h2>
          <button type="button" onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div>
            <label className="text-xs text-gray-500">{t('inventory.form.name')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-navy" />
          </div>
          <div>
            <label className="text-xs text-gray-500">{t('inventory.form.category')}</label>
            <div className="flex items-center gap-2 mt-1">
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none">
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="button" onClick={() => setAddingCat((v) => !v)} className="px-2 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">
                <Plus size={13} />
              </button>
            </div>
            {addingCat && (
              <div className="flex items-center gap-2 mt-2">
                <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder={t('inventory.form.newCategoryPlaceholder')}
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none" />
                <button type="button" onClick={handleAddCategory} className="px-2 py-1.5 text-xs bg-navy text-white rounded-lg">{t('inventory.form.add')}</button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">{t('inventory.form.qty')}</label>
              <input type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-navy" />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('inventory.form.unit')}</label>
              <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pcs, unit, box..." className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-navy" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">{t('inventory.form.location')}</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-navy" />
          </div>
          <div>
            <label className="text-xs text-gray-500">{t('inventory.form.description')}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-navy resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 rounded-lg">{t('inventory.form.cancel')}</button>
          <button type="submit" disabled={saving} className="px-4 py-1.5 text-sm bg-navy text-white rounded-lg disabled:opacity-50 flex items-center gap-1.5">
            {saving && <Loader2 size={13} className="animate-spin" />} {t('inventory.form.save')}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Asset detail panel ──────────────────────────────────────
function AssetDetailPanel({
  assetId, onClose, onChanged, categories, canEdit, canDelete,
}: {
  assetId: string; onClose: () => void; onChanged: () => void;
  categories: AssetCategory[]; canEdit: boolean; canDelete: boolean;
}) {
  const { t } = useTranslation();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [txType, setTxType] = useState<TxType | null>(null);
  const [txQty, setTxQty] = useState('1');
  const [txCost, setTxCost] = useState('');
  const [txNote, setTxNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  function startEdit() {
    if (!asset) return;
    setEditName(asset.name); setEditLocation(asset.location);
    setEditUnit(asset.unit ?? ''); setEditCategoryId(asset.category.id);
    setEditing(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSavingEdit(true);
    try {
      await api.patch(`/inventory/${assetId}`, {
        name: editName.trim(), location: editLocation.trim(),
        unit: editUnit.trim() || null, categoryId: editCategoryId,
      });
      toast.success(t('inventory.detail.editSuccess'));
      setEditing(false);
      load(); onChanged();
    } catch (err) { toast.error(extractErr(err)); } finally { setSavingEdit(false); }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/inventory/${assetId}`);
      setAsset(res.data.data);
    } catch (err) { toast.error(extractErr(err)); } finally { setLoading(false); }
  }, [assetId]);

  useEffect(() => { load(); }, [load]);

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
    setSubmitting(true);
    try {
      await api.post(`/inventory/${assetId}/transactions`, {
        type: txType, quantity: Number(txQty) || 0,
        cost: txType === 'PURCHASE' && txCost ? Number(txCost) : undefined,
        note: txNote.trim() || undefined,
      });
      toast.success(t('inventory.detail.requestSubmitted'));
      setTxType(null); setTxQty('1'); setTxCost(''); setTxNote('');
      load(); onChanged();
    } catch (err) { toast.error(extractErr(err)); } finally { setSubmitting(false); }
  }

  function handlePrint() {
    window.print();
  }

  const qrValue = `${window.location.origin}/inventory/assets/${assetId}`;

  return (
    <div className="w-96 flex-shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800 text-sm">{t('inventory.detail.title')}</h2>
        <div className="flex items-center gap-1">
          {canEdit && (
            <button onClick={startEdit} title={t('inventory.detail.edit')} className="text-gray-400 hover:text-navy p-1">
              <Pencil size={15} />
            </button>
          )}
          {canDelete && (
            <button onClick={handleDelete} title={t('inventory.detail.delete')} className="text-gray-400 hover:text-red-500 p-1">
              <XCircle size={16} />
            </button>
          )}
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
      </div>

      {loading || !asset ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-gray-300" size={24} /></div>
      ) : editing ? (
        <form onSubmit={saveEdit} className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500">{t('inventory.form.name')}</label>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-navy" />
          </div>
          <div>
            <label className="text-xs text-gray-500">{t('inventory.form.category')}</label>
            <select value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">{t('inventory.form.unit')}</label>
            <input value={editUnit} onChange={(e) => setEditUnit(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-navy" />
          </div>
          <div>
            <label className="text-xs text-gray-500">{t('inventory.form.location')}</label>
            <input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-navy" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 rounded-lg">{t('inventory.form.cancel')}</button>
            <button type="submit" disabled={savingEdit} className="px-4 py-1.5 text-sm bg-navy text-white rounded-lg disabled:opacity-50 flex items-center gap-1.5">
              {savingEdit && <Loader2 size={13} className="animate-spin" />} {t('inventory.form.save')}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <p className="text-[11px] text-gray-400 font-mono">{asset.code}</p>
            <h3 className="text-base font-semibold text-gray-800">{asset.name}</h3>
            {asset.description && <p className="text-xs text-gray-500 mt-1">{asset.description}</p>}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-gray-500"><Tag size={12} /> {asset.category.name}</div>
            <div className="flex items-center gap-1.5 text-gray-500"><MapPin size={12} /> {asset.location}</div>
            <div className="flex items-center gap-1.5 text-gray-700 font-medium col-span-2">
              <Package size={12} /> {t('inventory.detail.stock')}: {asset.qty} {asset.unit ?? ''}
            </div>
          </div>

          {/* QR code */}
          <div ref={printRef} className="flex flex-col items-center gap-2 py-3 border border-dashed border-gray-200 rounded-lg print:border-0">
            <QRCodeSVG value={qrValue} size={120} />
            <p className="text-[10px] text-gray-400 font-mono">{asset.code}</p>
            <p className="text-xs font-medium text-gray-700 text-center">{asset.name}</p>
          </div>
          <button onClick={handlePrint} className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">
            <Printer size={12} /> {t('inventory.detail.printQr')}
          </button>

          {/* Request buttons */}
          <div className="flex gap-2">
            <button onClick={() => setTxType('PURCHASE')} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100">
              <ArrowDownCircle size={13} /> {t('inventory.detail.requestPurchase')}
            </button>
            <button onClick={() => setTxType('DISPOSAL')} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs border border-orange-200 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100">
              <ArrowUpCircle size={13} /> {t('inventory.detail.requestDisposal')}
            </button>
          </div>

          {txType && (
            <form onSubmit={submitTransaction} className="space-y-2 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-medium text-gray-600">
                {txType === 'PURCHASE' ? t('inventory.detail.requestPurchase') : t('inventory.detail.requestDisposal')}
              </p>
              <input type="number" min={1} value={txQty} onChange={(e) => setTxQty(e.target.value)}
                placeholder={t('inventory.form.qty')} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none" />
              {txType === 'PURCHASE' && (
                <input type="number" min={0} value={txCost} onChange={(e) => setTxCost(e.target.value)}
                  placeholder={t('inventory.detail.costPlaceholder')} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none" />
              )}
              <textarea value={txNote} onChange={(e) => setTxNote(e.target.value)} rows={2}
                placeholder={t('inventory.detail.notePlaceholder')} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none resize-none" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setTxType(null)} className="px-2 py-1 text-xs text-gray-500">{t('inventory.form.cancel')}</button>
                <button type="submit" disabled={submitting} className="px-3 py-1 text-xs bg-navy text-white rounded-lg disabled:opacity-50">{t('inventory.form.submit')}</button>
              </div>
            </form>
          )}

          {/* History */}
          <div>
            <p className="text-[11px] font-medium text-gray-400 uppercase mb-2">{t('inventory.detail.history')}</p>
            <div className="space-y-2">
              {(asset.history ?? []).length === 0 && <p className="text-xs text-gray-400">{t('inventory.detail.noHistory')}</p>}
              {(asset.history ?? []).map((h) => (
                <div key={h.id} className="flex items-start gap-2 text-xs p-2 border border-gray-100 rounded-lg">
                  {h.type === 'PURCHASE' ? <ArrowDownCircle size={13} className="text-emerald-500 mt-0.5" /> : <ArrowUpCircle size={13} className="text-orange-500 mt-0.5" />}
                  <div className="flex-1">
                    <p className="text-gray-700">
                      {h.type === 'PURCHASE' ? t('inventory.detail.purchaseOf', { qty: h.quantity }) : t('inventory.detail.disposalOf', { qty: h.quantity })}
                      {h.cost && ` — ${formatMoney(h.cost)}`}
                    </p>
                    <p className="text-[10px] text-gray-400">{h.requestedBy.fullName} · {new Date(h.createdAt).toLocaleDateString()}</p>
                    {h.note && <p className="text-[10px] text-gray-500 italic mt-0.5">"{h.note}"</p>}
                  </div>
                  <StatusPill status={h.status} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">{t('inventory.pendingApprovals')}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-300" size={22} /></div>
          ) : pending.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t('inventory.approvals.empty')}</p>
          ) : (
            pending.map(({ asset, tx }) => (
              <div key={tx.id} className="p-3 border border-gray-100 rounded-lg space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{asset.name}</p>
                    <p className="text-xs text-gray-500">
                      {tx.type === 'PURCHASE' ? t('inventory.detail.purchaseOf', { qty: tx.quantity }) : t('inventory.detail.disposalOf', { qty: tx.quantity })}
                      {tx.cost && ` — ${formatMoney(tx.cost)}`}
                    </p>
                    <p className="text-[10px] text-gray-400">{tx.requestedBy.fullName}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => decide(asset.id, tx.id, 'approve')} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100">
                      <Check size={14} />
                    </button>
                    <button onClick={() => setRejectingId(tx.id)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100">
                      <Ban size={14} />
                    </button>
                  </div>
                </div>
                {rejectingId === tx.id && (
                  <div className="flex items-center gap-2">
                    <input value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder={t('inventory.approvals.rejectReasonPlaceholder')}
                      className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none" />
                    <button onClick={() => decide(asset.id, tx.id, 'reject', rejectNote)} className="px-2 py-1 text-xs bg-red-500 text-white rounded-lg">
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
