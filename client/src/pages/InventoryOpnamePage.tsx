import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ClipboardCheck, Plus, X, Loader2, MapPin, Check, AlertTriangle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toastStore';
import { usePermStore } from '@/stores/permStore';
import { PageSizeSelect } from '@/components/shared/PageSizeSelect';

interface MiniUser { id: string; fullName: string; username: string; avatar: string | null; divisionId: string }
type SessionStatus = 'OPEN' | 'CLOSED';

interface OpnameItem {
  id: string; systemQty: number; countedQty: number | null; note: string | null;
  asset: { id: string; code: string; name: string; unit: string | null };
}

interface OpnameSession {
  id: string; location: string; status: SessionStatus; notes: string | null;
  startedAt: string; finishedAt: string | null;
  createdBy: MiniUser; _count: { items: number };
  items?: OpnameItem[];
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

export default function InventoryOpnamePage() {
  const { t } = useTranslation();
  const { perms } = usePermStore();
  const canEdit = perms.inventory?.edit !== 'none';

  const [sessions, setSessions] = useState<OpnameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/opname-sessions', { params: { page, limit: pageSize } });
      setSessions(res.data.data ?? []);
      setTotal(res.data.meta?.total ?? 0);
    } catch (err) { toast.error(extractErr(err)); } finally { setLoading(false); }
  }, [page, pageSize]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex h-full overflow-hidden -m-6 bg-gray-50">
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy/10 flex items-center justify-center flex-shrink-0">
              <ClipboardCheck size={19} className="text-navy" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 leading-tight">{t('inventory.opname.title')}</h1>
              <p className="text-xs text-gray-400">{t('inventory.opname.subtitle')}</p>
            </div>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg bg-navy text-white hover:bg-navy-light transition-colors shadow-sm shadow-navy/20"
            >
              <Plus size={15} /> {t('inventory.opname.newSession')}
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 px-6 pb-6 flex flex-col">
          <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full min-h-[240px]"><Loader2 className="animate-spin text-gray-300" size={26} /></div>
              ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[280px] gap-2 text-center px-6">
                  <ClipboardCheck size={28} className="text-gray-300" />
                  <p className="text-sm text-gray-400">{t('inventory.opname.empty')}</p>
                </div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                      <th className="px-5 py-3">{t('inventory.colLocation')}</th>
                      <th className="px-3 py-3">{t('inventory.opname.colStatus')}</th>
                      <th className="px-3 py-3 text-right">{t('inventory.opname.colItems')}</th>
                      <th className="px-3 py-3">{t('inventory.opname.colStarted')}</th>
                      <th className="px-3 py-3">{t('inventory.movements.colBy')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id} onClick={() => setSelectedId(s.id)}
                        className={cn('cursor-pointer border-b border-gray-50 last:border-0 transition-colors',
                          selectedId === s.id ? 'bg-navy/[0.04]' : 'hover:bg-gray-50/80')}>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-1 font-medium text-gray-800"><MapPin size={11} className="text-gray-300" /> {s.location}</span>
                        </td>
                        <td className="px-3 py-3">
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium',
                            s.status === 'OPEN' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600')}>
                            {s.status === 'OPEN' ? t('inventory.opname.statusOpen') : t('inventory.opname.statusClosed')}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-gray-700 tabular-nums">{s._count.items}</td>
                        <td className="px-3 py-3 text-gray-500 text-xs">{new Date(s.startedAt).toLocaleDateString()}</td>
                        <td className="px-3 py-3 text-gray-500 text-xs">{s.createdBy.fullName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {!loading && sessions.length > 0 && (
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
        <OpnameSessionPanel
          sessionId={selectedId}
          canEdit={canEdit}
          onClose={() => setSelectedId(null)}
          onChanged={load}
        />
      )}

      {showCreate && (
        <CreateSessionModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { setShowCreate(false); load(); setSelectedId(id); }}
        />
      )}
    </div>
  );
}

function CreateSessionModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation();
  const [locations, setLocations] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/inventory/stats').then((r) => setLocations((r.data.data?.byLocation ?? []).map((l: { location: string }) => l.location))).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!location.trim()) { toast.error(t('inventory.opname.locationRequired')); return; }
    setSaving(true);
    try {
      const res = await api.post('/inventory/opname-sessions', { location: location.trim() });
      toast.success(t('inventory.opname.createSuccess'));
      onCreated(res.data.data.id);
    } catch (err) { toast.error(extractErr(err)); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{t('inventory.opname.newSession')}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 -m-1"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <label className="text-xs font-medium text-gray-500">{t('inventory.colLocation')}</label>
          <select value={location} onChange={(e) => setLocation(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-navy">
            <option value="">{t('inventory.opname.selectLocation')}</option>
            {locations.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
          </select>
          <p className="text-[11px] text-gray-400">{t('inventory.opname.sessionHint')}</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-3.5 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 rounded-lg">{t('inventory.form.cancel')}</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-navy text-white rounded-lg disabled:opacity-50 flex items-center gap-1.5">
            {saving && <Loader2 size={13} className="animate-spin" />} {t('inventory.opname.startSession')}
          </button>
        </div>
      </form>
    </div>
  );
}

function OpnameSessionPanel({
  sessionId, canEdit, onClose, onChanged,
}: { sessionId: string; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const [session, setSession] = useState<OpnameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/inventory/opname-sessions/${sessionId}`);
      const s: OpnameSession = res.data.data;
      setSession(s);
      setCounts(Object.fromEntries((s.items ?? []).map((it) => [it.id, it.countedQty != null ? String(it.countedQty) : ''])));
    } catch (err) { toast.error(extractErr(err)); } finally { setLoading(false); }
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  async function saveCounts() {
    if (!session) return;
    const items = (session.items ?? [])
      .filter((it) => counts[it.id] !== '' && counts[it.id] !== undefined)
      .map((it) => ({ itemId: it.id, countedQty: Number(counts[it.id]) || 0 }));
    if (items.length === 0) return;
    setSaving(true);
    try {
      await api.patch(`/inventory/opname-sessions/${sessionId}/counts`, { items });
      toast.success(t('inventory.opname.countsSaved'));
      load();
    } catch (err) { toast.error(extractErr(err)); } finally { setSaving(false); }
  }

  async function finishSession() {
    if (!confirm(t('inventory.opname.confirmFinish'))) return;
    setFinishing(true);
    try {
      await api.post(`/inventory/opname-sessions/${sessionId}/finish`);
      toast.success(t('inventory.opname.finishSuccess'));
      load(); onChanged();
    } catch (err) { toast.error(extractErr(err)); } finally { setFinishing(false); }
  }

  const allCounted = session?.items?.every((it) => counts[it.id] !== '' && counts[it.id] !== undefined) ?? false;

  return (
    <div className="w-[30rem] flex-shrink-0 border-l border-gray-100 bg-white flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 text-sm">{t('inventory.opname.sessionTitle')}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-50 p-1.5 rounded-md transition-colors"><X size={17} /></button>
      </div>

      {loading || !session ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-gray-300" size={24} /></div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium',
              session.status === 'OPEN' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600')}>
              {session.status === 'OPEN' ? t('inventory.opname.statusOpen') : t('inventory.opname.statusClosed')}
            </span>
            <h3 className="text-lg font-semibold text-gray-900 mt-1.5 flex items-center gap-1.5"><MapPin size={15} className="text-gray-400" /> {session.location}</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">{t('inventory.opname.startedBy', { name: session.createdBy.fullName })}</p>
          </div>

          {session.status === 'OPEN' && !canEdit && (
            <p className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg"><AlertTriangle size={13} /> {t('inventory.opname.readOnlyHint')}</p>
          )}

          <div className="space-y-2">
            {(session.items ?? []).map((it) => {
              const counted = counts[it.id];
              const diff = counted !== '' && counted !== undefined ? Number(counted) - it.systemQty : null;
              return (
                <div key={it.id} className="p-3 border border-gray-100 rounded-xl">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{it.asset.name}</p>
                      <p className="text-[10px] font-mono text-gray-400">{it.asset.code}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400">{t('inventory.opname.systemQty')}</p>
                        <p className="text-xs font-medium text-gray-600 tabular-nums">{it.systemQty}</p>
                      </div>
                      <input
                        type="number" min={0}
                        value={counted ?? ''}
                        disabled={session.status !== 'OPEN' || !canEdit}
                        onChange={(e) => setCounts((prev) => ({ ...prev, [it.id]: e.target.value }))}
                        className="w-20 px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg outline-none focus:border-navy disabled:bg-gray-50 disabled:text-gray-400"
                      />
                    </div>
                  </div>
                  {diff !== null && diff !== 0 && (
                    <p className={cn('text-[11px] mt-1.5 font-medium', diff > 0 ? 'text-emerald-600' : 'text-red-500')}>
                      {diff > 0 ? '+' : ''}{diff} {t('inventory.opname.vsSystem')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {session.status === 'OPEN' && canEdit && (
            <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
              <button onClick={saveCounts} disabled={saving} className="w-full flex items-center justify-center gap-1.5 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-50">
                {saving && <Loader2 size={13} className="animate-spin" />} {t('inventory.opname.saveCounts')}
              </button>
              <button onClick={finishSession} disabled={finishing || !allCounted} title={!allCounted ? t('inventory.opname.mustCountAll') : undefined}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-sm font-medium bg-navy text-white rounded-lg hover:bg-navy-light disabled:opacity-40 transition-colors">
                {finishing ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />} {t('inventory.opname.finishSession')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
