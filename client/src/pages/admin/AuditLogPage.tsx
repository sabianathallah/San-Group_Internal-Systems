import { useEffect, useState, useCallback } from 'react';
import {
  ClipboardList, Loader2, AlertCircle, ChevronLeft, ChevronRight,
  CheckSquare, User, Shield, Lock,
} from 'lucide-react';
import api from '@/lib/api';
import { usePermStore } from '@/stores/permStore';
import { cn } from '@/lib/cn';

// ── Types ─────────────────────────────────────────────────────
interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
  user: {
    id: string; fullName: string; username: string;
    division: { name: string } | null;
  };
}

interface Meta { total: number; page: number; limit: number; totalPages: number; }

// ── Constants ─────────────────────────────────────────────────
const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
};

const ENTITY_ICONS: Record<string, React.ElementType> = {
  task:       CheckSquare,
  user:       User,
  permission: Shield,
};

function EntityIcon({ entity }: { entity: string }) {
  const Icon = ENTITY_ICONS[entity] ?? ClipboardList;
  return <Icon size={13} className="text-gray-400" />;
}

function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const ENTITY_LABELS: Record<string, string> = {
  task: 'Task', user: 'User', permission: 'Permission',
};
const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Created', UPDATE: 'Updated', DELETE: 'Deleted',
};

// ── Main Page ─────────────────────────────────────────────────
const PAGE_SIZE = 20;

export default function AuditLogPage() {
  const perms   = usePermStore((s) => s.perms);
  const loaded  = usePermStore((s) => s.loaded);
  const canView = perms.audit_log?.view !== 'none';

  const [logs,    setLogs]    = useState<AuditEntry[]>([]);
  const [meta,    setMeta]    = useState<Meta>({ total: 0, page: 1, limit: PAGE_SIZE, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [page,    setPage]    = useState(1);
  const [entity,  setEntity]  = useState('');

  const fetchLogs = useCallback(async () => {
    if (!canView) return;
    setLoading(true); setError('');
    try {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (entity) params.entity = entity;
      const res = await api.get('/audit-logs', { params });
      setLogs(res.data.data.logs ?? []);
      setMeta(res.data.data);
    } catch {
      setError('Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [page, entity, canView]);

  useEffect(() => { if (loaded) fetchLogs(); }, [loaded, fetchLogs]);

  if (!loaded) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-gray-300" /></div>;
  }

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Lock size={28} className="text-gray-400" />
        </div>
        <h2 className="text-base font-semibold text-gray-700 mb-1">Access Restricted</h2>
        <p className="text-sm text-gray-400">You don't have permission to view the audit log.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">System activity history</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={entity}
            onChange={(e) => { setEntity(e.target.value); setPage(1); }}
            className="py-1.5 px-3 text-sm border border-gray-200 rounded focus:outline-none focus:border-navy"
          >
            <option value="">All types</option>
            <option value="task">Task</option>
            <option value="user">User</option>
            <option value="permission">Permission</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gray-300" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16">
            <AlertCircle size={28} className="text-red-400 mb-2" />
            <p className="text-sm text-gray-600">{error}</p>
            <button onClick={fetchLogs} className="mt-3 px-3 py-1.5 text-sm text-navy border border-navy rounded">
              Try again
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <ClipboardList size={36} className="text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">No activity recorded yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {fmtDatetime(log.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-800">{log.user.fullName}</p>
                    {log.user.division && (
                      <p className="text-xs text-gray-400">{log.user.division.name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-600')}>
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <EntityIcon entity={log.entity} />
                      <span className="text-sm text-gray-700">{ENTITY_LABELS[log.entity] ?? log.entity}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                    {log.detail && Object.keys(log.detail).length > 0
                      ? Object.entries(log.detail).map(([k, v]) => `${k}: ${v}`).join(', ')
                      : log.entityId ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {!loading && !error && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <p className="text-xs text-gray-500">
              {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total} entries
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={meta.page <= 1}
                className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-gray-500 px-2">{meta.page} / {meta.totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={meta.page >= meta.totalPages}
                className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
