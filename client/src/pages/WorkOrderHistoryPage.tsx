import { useState, useEffect, useCallback } from 'react';
import { Archive, Filter, RefreshCw, Loader2, AlertTriangle, Search } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { usePermStore } from '@/stores/permStore';
import { PageSizeSelect } from '@/components/shared/PageSizeSelect';
import {
  extractErr, WOTable, WODetail, PRIORITY_CONFIG, CATEGORY_CONFIG,
  type WorkOrder, type WOPriority, type WOCategory,
} from '@/pages/WorkOrderPage';

// Read-only-ish archive of closed work orders (DONE/CANCELLED). WODetail already
// hides Edit/Change Status/Review for terminal statuses on its own, so it's safe
// to reuse directly here — this page just never shows the "in flight" board.
export default function WorkOrderHistoryPage() {
  const user  = useAuthStore((s) => s.user);
  const perms = usePermStore((s) => s.perms);
  const woPerms = perms.work_order;

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [outcomeFilter, setOutcomeFilter] = useState<'' | 'DONE' | 'CANCELLED'>('');
  const [priorityFilter, setPriorityFilter] = useState<WOPriority | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<WOCategory | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);

  const fetchWOs = useCallback(async (pageArg = 1, append = false) => {
    (append ? setLoadingMore : setLoading)(true);
    try {
      const params: Record<string, string> = { scope: 'history', limit: String(pageSize), page: String(pageArg) };
      if (outcomeFilter)  params.status   = outcomeFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (dateFrom) params.dateFrom = new Date(dateFrom).toISOString();
      if (dateTo)   params.dateTo   = new Date(dateTo).toISOString();
      if (search.trim()) params.search = search.trim();

      const res = await api.get('/work-orders', { params });
      setWorkOrders((prev) => (append ? [...prev, ...res.data.data] : res.data.data));
      setTotalCount(res.data.meta?.total ?? res.data.data.length);
      setPage(pageArg);
    } catch (err) { toast.error(extractErr(err)); }
    finally { (append ? setLoadingMore : setLoading)(false); }
  }, [outcomeFilter, priorityFilter, categoryFilter, dateFrom, dateTo, search, pageSize]);

  useEffect(() => { fetchWOs(); }, [fetchWOs]);

  const fetchDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await api.get(`/work-orders/${id}`);
      setSelectedWO(res.data.data);
    } catch (err) { toast.error(extractErr(err)); }
    finally { setLoadingDetail(false); }
  }, []);

  function handleSelect(id: string) {
    setSelectedId(id);
    fetchDetail(id);
  }

  function handleDeleted() {
    setWorkOrders((prev) => prev.filter((w) => w.id !== selectedId));
    setSelectedId(null);
    setSelectedWO(null);
  }

  return (
    <div className="flex h-full overflow-hidden -m-6">
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
          <Archive size={18} className="text-navy" />
          <div>
            <h1 className="font-semibold text-gray-900 text-sm">Work Order History</h1>
            <p className="text-[11px] text-gray-400">Completed and cancelled work orders</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 flex-shrink-0 bg-white flex-wrap">
          <div className="relative flex-1 min-w-[140px] max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchWOs()}
              placeholder="Search code / title..."
              className="w-full text-sm border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>
          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value as '' | 'DONE' | 'CANCELLED')}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
          >
            <option value="">Done + Cancelled</option>
            <option value="DONE">Done only</option>
            <option value="CANCELLED">Cancelled only</option>
          </select>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn('p-1.5 rounded-lg border transition-colors', showFilters ? 'border-navy bg-navy/5 text-navy' : 'border-gray-200 text-gray-500 hover:bg-gray-50')}
          >
            <Filter size={14} />
          </button>
          <button onClick={() => fetchWOs()} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
            <RefreshCw size={14} />
          </button>
          <PageSizeSelect value={pageSize} onChange={(n) => setPageSize(n)} options={[25, 50, 100]} />

          {showFilters && (
            <div className="flex items-center gap-2 flex-wrap w-full">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as WOPriority | '')}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
              >
                <option value="">All Priorities</option>
                {(Object.keys(PRIORITY_CONFIG) as WOPriority[]).map((p) => (
                  <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                ))}
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as WOCategory | '')}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
              >
                <option value="">All Categories</option>
                {(Object.keys(CATEGORY_CONFIG) as WOCategory[]).map((c) => (
                  <option key={c} value={c}>{CATEGORY_CONFIG[c].icon} {CATEGORY_CONFIG[c].label}</option>
                ))}
              </select>
              <input
                type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
              />
            </div>
          )}
        </div>

        {totalCount > workOrders.length && (
          <div className="flex items-center gap-2 px-4 py-1.5 text-[11px] text-amber-700 bg-amber-50 border-b border-amber-100 flex-shrink-0">
            <AlertTriangle size={11} />
            <span>Showing {workOrders.length} of {totalCount} work orders.</span>
            <button
              onClick={() => fetchWOs(page + 1, true)}
              disabled={loadingMore}
              className="ml-auto flex items-center gap-1 font-medium text-amber-800 hover:underline disabled:opacity-60"
            >
              {loadingMore ? <Loader2 size={11} className="animate-spin" /> : null}
              Load more
            </button>
          </div>
        )}

        {loading && workOrders.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-gray-300" />
          </div>
        ) : (
          <WOTable workOrders={workOrders} selectedId={selectedId} onSelect={handleSelect} showClosed />
        )}
      </div>

      {selectedWO && (
        <div
          className="fixed inset-0 z-40 flex justify-end"
          onClick={() => { setSelectedId(null); setSelectedWO(null); }}
        >
          <div className="absolute inset-0 bg-black/20 hidden lg:block" />
          <div className="relative w-full lg:max-w-md h-full" onClick={(e) => e.stopPropagation()}>
            {loadingDetail ? (
              <div className="flex items-center justify-center h-full bg-white">
                <Loader2 size={20} className="animate-spin text-gray-300" />
              </div>
            ) : (
              <WODetail
                wo={selectedWO}
                onClose={() => { setSelectedId(null); setSelectedWO(null); }}
                onEdit={() => {}}
                onStatusChange={() => {}}
                onReview={() => {}}
                onDeleted={handleDeleted}
                onUpdated={setSelectedWO}
                currentUserId={user?.id ?? ''}
                currentDivisionId={user?.division?.id ?? ''}
                editScope={woPerms.edit}
                deleteScope={woPerms.delete}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
