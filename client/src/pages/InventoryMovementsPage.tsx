import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeftRight, ArrowDownCircle, ArrowUpCircle, Scale, MapPin, Loader2, ChevronLeft, ChevronRight, TrendingUp, UserPlus,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toastStore';
import { PageSizeSelect } from '@/components/shared/PageSizeSelect';
import type { Warehouse } from '@/components/shared/WarehouseSelect';

interface MiniUser { id: string; fullName: string; username: string; avatar: string | null; divisionId: string }
type MoveType = 'PURCHASE' | 'DISPOSAL' | 'ADJUSTMENT' | 'TRANSFER' | 'ASSIGN';
type MoveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface Movement {
  id: string; type: MoveType; location: string; toLocation: string | null; quantity: number; cost: string | null; note: string | null;
  status: MoveStatus; approvedAt: string | null; createdAt: string;
  requestedBy: MiniUser; approvedBy: MiniUser | null; assignedTo: MiniUser | null;
  asset: { id: string; code: string; name: string };
}

interface TrendDay { date: string; PURCHASE: number; DISPOSAL: number; ADJUSTMENT: number; TRANSFER: number; ASSIGN: number }

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

function formatMoney(n: number | string) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n));
}

const TYPE_CFG = {
  PURCHASE:   { icon: ArrowDownCircle, cls: 'bg-emerald-100 text-emerald-600', bar: '#10b981' },
  DISPOSAL:   { icon: ArrowUpCircle,   cls: 'bg-orange-100 text-orange-600', bar: '#f97316' },
  ADJUSTMENT: { icon: Scale,           cls: 'bg-blue-100 text-blue-600', bar: '#3b82f6' },
  TRANSFER:   { icon: ArrowLeftRight,  cls: 'bg-purple-100 text-purple-600', bar: '#a855f7' },
  ASSIGN:     { icon: UserPlus,        cls: 'bg-indigo-100 text-indigo-600', bar: '#6366f1' },
} as const;

function typeLabel(type: MoveType, t: (k: string) => string) {
  switch (type) {
    case 'PURCHASE': return t('inventory.detail.requestPurchase');
    case 'DISPOSAL': return t('inventory.detail.requestDisposal');
    case 'ADJUSTMENT': return t('inventory.movements.adjustment');
    case 'TRANSFER': return t('inventory.movements.transfer');
    case 'ASSIGN': return t('inventory.movements.assign');
  }
}

// ── Trend chart — stacked bars per day, hand-rolled to match the existing
// AnalyticsPage chart style (no charting library in this codebase). ──
function TrendChart({ data, t }: { data: TrendDay[]; t: (k: string) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = data.map((d) => d.PURCHASE + d.DISPOSAL + d.ADJUSTMENT + d.TRANSFER + d.ASSIGN);
  const maxValue = Math.max(...totals, 1);
  const hasData = totals.some((v) => v > 0);
  const labelStride = Math.max(1, Math.ceil(data.length / 7));

  if (!hasData) {
    return <p className="text-sm text-gray-400 text-center py-10">{t('inventory.movements.chartEmpty')}</p>;
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-[3px] h-32">
        {data.map((d, i) => {
          const total = totals[i];
          const pct = (total / maxValue) * 100;
          return (
            <div
              key={d.date}
              className="relative flex-1 min-w-0 h-full flex flex-col justify-end items-center"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {hover === i && total > 0 && (
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[11px] px-2.5 py-1.5 rounded-md whitespace-nowrap z-10 pointer-events-none shadow-lg space-y-0.5">
                  {d.PURCHASE > 0 && <p><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1" />{t('inventory.detail.requestPurchase')}: {d.PURCHASE}</p>}
                  {d.DISPOSAL > 0 && <p><span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 mr-1" />{t('inventory.detail.requestDisposal')}: {d.DISPOSAL}</p>}
                  {d.ADJUSTMENT > 0 && <p><span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 mr-1" />{t('inventory.movements.adjustment')}: {d.ADJUSTMENT}</p>}
                  {d.TRANSFER > 0 && <p><span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 mr-1" />{t('inventory.movements.transfer')}: {d.TRANSFER}</p>}
                  {d.ASSIGN > 0 && <p><span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 mr-1" />{t('inventory.movements.assign')}: {d.ASSIGN}</p>}
                </div>
              )}
              <div className="w-full flex flex-col justify-end rounded-t overflow-hidden cursor-default transition-opacity" style={{ height: `${Math.max(pct, total > 0 ? 4 : 0)}%`, minHeight: total > 0 ? 3 : 0 }}>
                {d.ASSIGN > 0 && <div style={{ height: `${(d.ASSIGN / total) * 100}%`, backgroundColor: TYPE_CFG.ASSIGN.bar }} className={cn(hover === i ? 'opacity-100' : 'opacity-80')} />}
                {d.TRANSFER > 0 && <div style={{ height: `${(d.TRANSFER / total) * 100}%`, backgroundColor: TYPE_CFG.TRANSFER.bar }} className={cn(hover === i ? 'opacity-100' : 'opacity-80')} />}
                {d.ADJUSTMENT > 0 && <div style={{ height: `${(d.ADJUSTMENT / total) * 100}%`, backgroundColor: TYPE_CFG.ADJUSTMENT.bar }} className={cn(hover === i ? 'opacity-100' : 'opacity-80')} />}
                {d.DISPOSAL > 0 && <div style={{ height: `${(d.DISPOSAL / total) * 100}%`, backgroundColor: TYPE_CFG.DISPOSAL.bar }} className={cn(hover === i ? 'opacity-100' : 'opacity-80')} />}
                {d.PURCHASE > 0 && <div style={{ height: `${(d.PURCHASE / total) * 100}%`, backgroundColor: TYPE_CFG.PURCHASE.bar }} className={cn(hover === i ? 'opacity-100' : 'opacity-80')} />}
              </div>
            </div>
          );
        })}
      </div>
      <div className="relative h-4 mt-1.5">
        {data.map((d, i) => (i % labelStride === 0 || i === data.length - 1) && (
          <span
            key={d.date}
            className="absolute text-[10px] text-gray-400 -translate-x-1/2"
            style={{ left: `${((i + 0.5) / data.length) * 100}%` }}
          >
            {new Date(d.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function InventoryMovementsPage() {
  const { t } = useTranslation();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [trend, setTrend] = useState<{ daily: TrendDay[]; todayCount: number } | null>(null);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/movements', {
        params: { page, limit: pageSize, type: typeFilter || undefined, location: locationFilter || undefined },
      });
      setMovements(res.data.data ?? []);
      setTotal(res.data.meta?.total ?? 0);
    } catch (err) { toast.error(extractErr(err)); } finally { setLoading(false); }
  }, [page, pageSize, typeFilter, locationFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/inventory/warehouses').then((r) => setWarehouses(r.data.data ?? [])).catch(() => {});
    api.get('/inventory/movements/trend').then((r) => setTrend(r.data.data)).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden -m-6 bg-gray-50">
      <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-navy/10 flex items-center justify-center flex-shrink-0">
            <ArrowLeftRight size={19} className="text-navy" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 leading-tight">{t('inventory.movements.title')}</h1>
            <p className="text-xs text-gray-400">{t('inventory.movements.subtitle')}</p>
          </div>
        </div>
        {trend && trend.todayCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-navy/10 text-navy">
            <TrendingUp size={13} /> {t('inventory.movements.todayCount', { count: trend.todayCount })}
          </span>
        )}
      </div>

      {/* Trend chart card */}
      {trend && (
        <div className="mx-6 mb-4 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">{t('inventory.movements.chartTitle')}</p>
          <TrendChart data={trend.daily} t={t} />
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-50">
            {(['PURCHASE', 'DISPOSAL', 'ADJUSTMENT', 'TRANSFER', 'ASSIGN'] as const).map((type) => (
              <span key={type} className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TYPE_CFG[type].bar }} />
                {typeLabel(type, t)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 px-6 pb-3">
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none text-gray-600 focus:border-navy">
          <option value="">{t('inventory.movements.allTypes')}</option>
          <option value="PURCHASE">{t('inventory.detail.requestPurchase')}</option>
          <option value="DISPOSAL">{t('inventory.detail.requestDisposal')}</option>
          <option value="ADJUSTMENT">{t('inventory.movements.adjustment')}</option>
          <option value="TRANSFER">{t('inventory.movements.transfer')}</option>
          <option value="ASSIGN">{t('inventory.movements.assign')}</option>
        </select>
        <div className="relative">
          <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select value={locationFilter} onChange={(e) => { setLocationFilter(e.target.value); setPage(1); }}
            className="text-sm bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-2 outline-none text-gray-600 focus:border-navy min-w-[10rem]">
            <option value="">{t('inventory.movements.allLocations')}</option>
            {warehouses.map((w) => <option key={w.id} value={w.name}>{w.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 min-h-0 px-6 pb-6 flex flex-col">
        <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full min-h-[240px]"><Loader2 className="animate-spin text-gray-300" size={26} /></div>
            ) : movements.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[280px] gap-2 text-center px-6">
                <ArrowLeftRight size={28} className="text-gray-300" />
                <p className="text-sm text-gray-400">{t('inventory.movements.empty')}</p>
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="px-5 py-3">{t('inventory.movements.colType')}</th>
                    <th className="px-3 py-3">{t('inventory.movements.colAsset')}</th>
                    <th className="px-3 py-3">{t('inventory.colLocation')}</th>
                    <th className="px-3 py-3 text-right">{t('inventory.colQty')}</th>
                    <th className="px-3 py-3">{t('inventory.movements.colBy')}</th>
                    <th className="px-3 py-3">{t('inventory.movements.colDate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => {
                    const cfg = TYPE_CFG[m.type];
                    const Icon = cfg.icon;
                    return (
                      <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/80 transition-colors">
                        <td className="px-5 py-3">
                          <span className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium', cfg.cls)}>
                            <Icon size={12} />
                            {typeLabel(m.type, t)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-medium text-gray-800">{m.asset.name}</p>
                          <p className="text-[10px] font-mono text-gray-400">{m.asset.code}</p>
                        </td>
                        <td className="px-3 py-3 text-gray-500">
                          {m.type === 'TRANSFER' && m.toLocation ? (
                            <span className="inline-flex items-center gap-1"><MapPin size={11} className="text-gray-300" /> {m.location} <ArrowLeftRight size={10} className="text-gray-300" /> {m.toLocation}</span>
                          ) : m.type === 'ASSIGN' && m.assignedTo ? (
                            <span className="inline-flex items-center gap-1"><UserPlus size={11} className="text-gray-300" /> {m.assignedTo.fullName}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1"><MapPin size={11} className="text-gray-300" /> {m.location}</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-medium text-gray-700 tabular-nums">
                          {m.type === 'DISPOSAL' || m.type === 'ASSIGN' ? '-' : '+'}{m.quantity}
                          {m.cost && <p className="text-[10px] text-gray-400 font-normal">{formatMoney(m.cost)}</p>}
                        </td>
                        <td className="px-3 py-3 text-gray-500 text-xs">{m.requestedBy.fullName}</td>
                        <td className="px-3 py-3 text-gray-400 text-xs">{new Date(m.createdAt).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {!loading && movements.length > 0 && (
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
  );
}
