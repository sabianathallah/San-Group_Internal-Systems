import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2, Plus, Search, Loader2, Download,
  ChevronLeft, ChevronRight, Store, PieChart,
  LayoutList, Map as MapIcon,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toastStore';
import { usePermStore } from '@/stores/permStore';
import { PageSizeSelect } from '@/components/shared/PageSizeSelect';
import { TENANT_FLOOR_MAPS, type TenantLocationKey, type FloorMapDef } from '@/data/tenantFloorMaps';
import { ROUTES } from '@/lib/constants';
import {
  type Tenant, type TenantLocation, type TenantStatus,
  LOCATIONS, STATUSES, STATUS_CONFIG, extractErr, fmtDate,
} from '@/types/tenant';
import TenantDetailPanel from '@/components/tenant/TenantDetailPanel';

function csvCell(v: string) {
  const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

function exportTenantsCSV(tenants: Tenant[], locLabel: (l: TenantLocation) => string, statusLabel: (s: TenantStatus) => string) {
  const header = ['Lokasi', 'Block', 'Unit', 'Tenant', 'Status', 'Luas (m2)', 'Sewa Berakhir'];
  const rows = tenants.map((tn) => [
    locLabel(tn.location), tn.block, tn.unitNo, tn.name ?? '—', statusLabel(tn.status),
    tn.area ?? '', fmtDate(tn.leaseEnd),
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => csvCell(String(v))).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tenants-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const STAT_TONE = {
  navy:    { bg: 'bg-navy/10',    icon: 'text-navy',        bar: 'bg-navy' },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', bar: 'bg-emerald-400' },
  gray:    { bg: 'bg-gray-100',   icon: 'text-gray-500',    bar: 'bg-gray-300' },
} as const;

interface TenantStats {
  total: number; active: number; vacant: number; fitOut: number;
  occupancyRateByUnit: number; occupancyRateByArea: number;
}

function StatCard({ label, value, icon: Icon, tone, delay }: { label: string; value: string; icon: React.ElementType; tone: keyof typeof STAT_TONE; delay: number }) {
  const c = STAT_TONE[tone];
  return (
    <div
      className="group relative flex items-center gap-3.5 px-4 py-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={cn('absolute inset-x-0 top-0 h-0.5', c.bar)} />
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105', c.bg)}>
        <Icon size={18} className={c.icon} strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide truncate">{label}</p>
        <p className="text-lg font-semibold text-gray-900 leading-tight truncate mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// Shared by two separate nav destinations — Database Tenant (mode="view",
// pure information, zero CRUD affordances) and Kelola Tenant (mode="manage",
// same list/map/stats but with Tenant Baru + Edit/Delete). Splitting them by
// route rather than an in-page toggle means a viewer never sees an edit
// control appear on the same screen mid-session — the two experiences are
// genuinely different pages, not one page wearing two hats.
export default function TenantDatabaseView({ mode }: { mode: 'view' | 'manage' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { perms } = usePermStore();
  const isManage = mode === 'manage';
  const canCreate = isManage && (perms.tenant?.create ?? false);
  const canEdit   = isManage && perms.tenant?.edit !== 'none';
  const canDelete = isManage && perms.tenant?.delete !== 'none';

  const locLabel    = useCallback((l: TenantLocation) => t(`tenant.locations.${l}`), [t]);
  const statusLabel = useCallback((s: TenantStatus) => t(`tenant.status.${s}`), [t]);

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState<TenantLocation>(
    (searchParams.get('location') as TenantLocation) ?? 'GREEN_TERRACE',
  );
  const [statusFilter, setStatusFilter] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const floors = TENANT_FLOOR_MAPS[location as TenantLocationKey] ?? [];
  const [activeBlock, setActiveBlock] = useState(floors[0]?.block ?? '');
  const [mapTenants, setMapTenants] = useState<Tenant[]>([]);
  const [mapLoading, setMapLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/tenants', {
        params: { page, limit: pageSize, search: search || undefined, location, status: statusFilter || undefined },
      });
      setTenants(res.data.data ?? []);
      setTotal(res.data.meta?.total ?? 0);
    } catch (err) { toast.error(extractErr(err)); } finally { setLoading(false); }
  }, [page, pageSize, search, location, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/tenants/stats', { params: { location } }).then((r) => setStats(r.data.data)).catch(() => {});
  }, [location, tenants]);

  // Peta view needs every unit for the location at once (not the paginated
  // list), so hotspots can be colored by status regardless of page size.
  const loadMapTenants = useCallback(async () => {
    setMapLoading(true);
    try {
      const res = await api.get('/tenants', { params: { location, limit: 100 } });
      setMapTenants(res.data.data ?? []);
    } catch (err) { toast.error(extractErr(err)); } finally { setMapLoading(false); }
  }, [location]);

  useEffect(() => { if (viewMode === 'map') loadMapTenants(); }, [viewMode, loadMapTenants]);

  useEffect(() => {
    const nextFloors = TENANT_FLOOR_MAPS[location as TenantLocationKey] ?? [];
    setActiveBlock(nextFloors[0]?.block ?? '');
  }, [location]);

  return (
    <div className="flex h-full overflow-hidden -m-6 bg-gray-50">
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-5 flex-wrap">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-navy/10 flex items-center justify-center flex-shrink-0">
              <Building2 size={19} className="text-navy" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 leading-tight tracking-tight">
                {isManage ? t('tenant.manageTitle') : t('tenant.title')}
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">{t('tenant.unitCount', { count: total })}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportTenantsCSV(tenants, locLabel, statusLabel)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 transition-all duration-200"
            >
              <Download size={14} /> {t('tenant.exportCsv')}
            </button>
            {canCreate && (
              <button
                onClick={() => navigate(`${ROUTES.TENANTS_NEW}?location=${location}`)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg bg-navy text-white hover:bg-navy-light hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 transition-all duration-200 shadow-sm shadow-navy/20"
              >
                <Plus size={15} /> {t('tenant.newTenant')}
              </button>
            )}
          </div>
        </div>

        {/* Location tabs + List/Peta switcher */}
        <div className="flex items-center justify-between gap-2 px-6 pb-4 flex-wrap">
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {LOCATIONS.map((l) => (
              <button
                key={l}
                onClick={() => { setLocation(l); setPage(1); }}
                className={cn('px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors',
                  location === l ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700')}
              >
                {locLabel(l)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {([
              { v: 'list' as const, icon: LayoutList, label: t('tenant.viewList') },
              { v: 'map' as const, icon: MapIcon, label: t('tenant.viewMap') },
            ]).map(({ v, icon: Icon, label }) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
                  viewMode === v ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700')}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-3 px-6 pb-4">
            <StatCard label={t('tenant.stats.total')} value={String(stats.total)} icon={Store} tone="navy" delay={0} />
            <StatCard label={t('tenant.stats.occupancyByUnit')} value={`${stats.occupancyRateByUnit}%`} icon={PieChart} tone="emerald" delay={60} />
            <StatCard label={t('tenant.stats.occupancyByArea')} value={`${stats.occupancyRateByArea}%`} icon={PieChart} tone="emerald" delay={120} />
            <StatCard label={t('tenant.stats.vacant')} value={String(stats.vacant)} icon={Store} tone="gray" delay={180} />
          </div>
        )}

      {viewMode === 'list' ? (
        <>
        {/* Filter bar */}
        <div className="flex items-center gap-2 px-6 pb-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={t('tenant.searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:border-navy focus:ring-2 focus:ring-navy/10 transition-shadow"
            />
          </div>
          <select
            value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none text-gray-600 focus:border-navy transition-colors"
          >
            <option value="">{t('tenant.allStatuses')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
        </div>

        {/* Table card */}
        <div className="flex-1 min-h-0 px-6 pb-6 flex flex-col">
          <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full min-h-[240px]"><Loader2 className="animate-spin text-gray-300" size={26} /></div>
              ) : tenants.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[280px] gap-3 text-center px-6">
                  <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/60 flex items-center justify-center">
                    <Building2 size={24} className="text-gray-300" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">{t('tenant.empty')}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t('tenant.emptyHint')}</p>
                  </div>
                  {canCreate && (
                    <button
                      onClick={() => navigate(`${ROUTES.TENANTS_NEW}?location=${location}`)}
                      className="mt-1 flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg bg-navy text-white hover:bg-navy-light hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 transition-all duration-200"
                    >
                      <Plus size={14} /> {t('tenant.newTenant')}
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-white/95 backdrop-blur-sm z-10">
                    <tr className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                      <th className="px-5 py-3">{t('tenant.colUnit')}</th>
                      <th className="px-3 py-3">{t('tenant.colName')}</th>
                      <th className="px-3 py-3">{t('tenant.colStatus')}</th>
                      <th className="px-3 py-3 text-right">{t('tenant.colArea')}</th>
                      <th className="px-3 py-3">{t('tenant.colLeaseEnd')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((tn, i) => {
                      const cfg = STATUS_CONFIG[tn.status];
                      return (
                        <tr
                          key={tn.id}
                          onClick={() => setSelectedId(tn.id)}
                          className={cn(
                            'group cursor-pointer border-b border-gray-50 last:border-0 transition-colors duration-150 fade-in-up',
                            selectedId === tn.id ? 'bg-navy/[0.04]' : 'hover:bg-gray-50/80',
                          )}
                          style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
                        >
                          <td className={cn('px-5 py-3 border-l-[3px] transition-colors duration-150', selectedId === tn.id ? 'border-navy' : 'border-transparent')}>
                            <span className="font-mono text-[11px] text-gray-500 bg-gray-50 group-hover:bg-gray-100 px-1.5 py-0.5 rounded transition-colors">{tn.block} · {tn.unitNo}</span>
                          </td>
                          <td className="px-3 py-3 font-medium text-gray-800">
                            <div className="flex items-center gap-2">
                              {tn.logoPath ? (
                                <img src={tn.logoPath} alt="" className="w-6 h-6 rounded object-contain bg-gray-50 border border-gray-100 flex-shrink-0" />
                              ) : (
                                <div className="w-6 h-6 rounded bg-gray-50 border border-gray-100 flex-shrink-0" />
                              )}
                              {tn.name ?? <span className="text-gray-300 font-normal italic">{t('tenant.status.VACANT')}</span>}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium', cfg.bg, cfg.color)}>
                              <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', cfg.dot)} />
                              {statusLabel(tn.status)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right text-gray-700 font-semibold tabular-nums">{tn.area ? `${tn.area} m²` : '—'}</td>
                          <td className="px-3 py-3 text-gray-500">{fmtDate(tn.leaseEnd)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {!loading && tenants.length > 0 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 flex-shrink-0">
                <PageSizeSelect value={pageSize} onChange={(n) => { setPageSize(n); setPage(1); }} />
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-1 border border-gray-200 rounded-md disabled:opacity-30 hover:bg-gray-50">
                    <ChevronLeft size={13} />
                  </button>
                  <span className="tabular-nums">{t('tenant.pageOf', { page, total: Math.max(1, Math.ceil(total / pageSize)) })}</span>
                  <button disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)} className="p-1 border border-gray-200 rounded-md disabled:opacity-30 hover:bg-gray-50">
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        </>
      ) : (
        <TenantFloorMapView
          floors={floors}
          activeBlock={activeBlock}
          onBlockChange={setActiveBlock}
          tenants={mapTenants}
          loading={mapLoading}
          selectedId={selectedId}
          onSelect={setSelectedId}
          statusLabel={statusLabel}
        />
      )}
      </div>

      {selectedId && (
        <TenantDetailPanel
          tenantId={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={load}
          onEdit={(tn) => navigate(`${ROUTES.TENANTS_MANAGE}/${tn.id}/edit?location=${tn.location}`)}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}
    </div>
  );
}

// ── Interactive floor-plan map ───────────────────────────────
// Real floor-plan image (rasterized from the client's own PDF layouts) with
// clickable tenant-logo markers, positioned from client/src/data/tenantFloorMaps.ts.

const RING_BY_STATUS: Record<TenantStatus, string> = {
  ACTIVE: 'ring-emerald-400',
  FIT_OUT: 'ring-amber-400',
  VACANT: 'ring-gray-300',
  INACTIVE: 'ring-gray-200',
};
const DOT_BY_STATUS: Record<TenantStatus, string> = {
  ACTIVE: 'bg-emerald-500',
  FIT_OUT: 'bg-amber-500',
  VACANT: 'bg-gray-400',
  INACTIVE: 'bg-gray-300',
};

function TenantFloorMapView({
  floors, activeBlock, onBlockChange, tenants, loading, selectedId, onSelect, statusLabel,
}: {
  floors: FloorMapDef[]; activeBlock: string; onBlockChange: (b: string) => void;
  tenants: Tenant[]; loading: boolean; selectedId: string | null; onSelect: (id: string) => void;
  statusLabel: (s: TenantStatus) => string;
}) {
  const { t } = useTranslation();
  const floor = floors.find((f) => f.block === activeBlock) ?? floors[0];
  const byUnit = new Map(tenants.filter((tn) => tn.block === floor?.block).map((tn) => [tn.unitNo, tn]));

  if (!floor) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
        {t('tenant.mapNotAvailable')}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 px-6 pb-6 flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 flex-wrap">
          {floors.map((f) => (
            <button
              key={f.block}
              onClick={() => onBlockChange(f.block)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150',
                f.block === activeBlock
                  ? 'bg-navy text-white border-navy shadow-sm'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-navy/40 hover:text-navy')}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {(['ACTIVE', 'VACANT', 'FIT_OUT'] as TenantStatus[]).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <span className={cn('w-2 h-2 rounded-full flex-shrink-0', DOT_BY_STATUS[s])} />
              <span className="text-[11px] text-gray-500">{statusLabel(s)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-100 shadow-sm overflow-auto relative">
        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-20">
            <Loader2 className="animate-spin text-gray-300" size={26} />
          </div>
        )}
        <div className="relative inline-block min-w-full">
          <img src={floor.image} alt={floor.label} className="block w-full h-auto select-none" draggable={false} />
          {floor.pins.map((pin) => {
            const tn = byUnit.get(pin.unitNo);
            const status: TenantStatus = tn?.status ?? 'VACANT';
            const isSelected = tn && tn.id === selectedId;
            return (
              <button
                key={pin.unitNo}
                onClick={() => tn && onSelect(tn.id)}
                title={tn ? `${tn.unitNo} — ${tn.name ?? statusLabel('VACANT')}` : pin.unitNo}
                style={{ left: `${pin.xPct}%`, top: `${pin.yPct}%` }}
                className={cn(
                  'group absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-transform duration-200 hover:scale-110',
                  !tn && 'cursor-default',
                )}
              >
                <span className={cn(
                  'relative w-8 h-8 rounded-full bg-white shadow-md ring-2 flex items-center justify-center overflow-hidden transition-shadow duration-200',
                  isSelected ? 'ring-navy ring-[3px] shadow-lg' : RING_BY_STATUS[status],
                )}>
                  {tn?.logoPath ? (
                    <img src={tn.logoPath} alt="" className="w-full h-full object-contain p-0.5" />
                  ) : (
                    <Store size={13} className="text-gray-300" />
                  )}
                  {/* Status dot badge */}
                  <span className={cn('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white', DOT_BY_STATUS[status])} />
                </span>
                {/* Hover card */}
                {tn && (
                  <span className="pointer-events-none absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-lg z-10">
                    {tn.name ?? statusLabel('VACANT')}
                    <span className="block text-[10px] text-gray-300 font-normal">{tn.unitNo}{tn.area ? ` · ${tn.area} m²` : ''}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
