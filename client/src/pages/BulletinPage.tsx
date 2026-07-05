import { useCallback, useEffect, useState, FormEvent } from 'react';
import {
  Megaphone, Plus, Search, X,
  AlertTriangle, Info, Calendar, Eye, EyeOff,
  Loader2, Trash2, Edit2, CheckCircle2, Clock, ToggleLeft, ToggleRight,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { usePermStore } from '@/stores/permStore';
import { useToastStore } from '@/stores/toastStore';
import { cn } from '@/lib/cn';
import { PageSizeSelect } from '@/components/shared/PageSizeSelect';

// ── Types ──────────────────────────────────────────────────
type BulletinCategory = 'ANNOUNCEMENT' | 'HOLIDAY' | 'MAINTENANCE' | 'EVENT' | 'GENERAL';
type BulletinPriority = 'NORMAL' | 'IMPORTANT' | 'URGENT';
type AudienceType     = 'ALL' | 'DIVISION' | 'CUSTOM';

interface DivisionOption { id: string; name: string; color: string }

interface Bulletin {
  id: string;
  title: string;
  content: string;
  category: BulletinCategory;
  priority: BulletinPriority;
  isPublished: boolean;
  audienceType: AudienceType;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  isRead: boolean;
  author: { id: string; fullName: string; divisionId?: string };
  audiences: { division: { id: string; name: string; color: string } }[];
  _count: { readStatus: number };
}

interface Meta {
  total: number; page: number; limit: number; totalPages: number;
}

// ── Constants ──────────────────────────────────────────────
const CATEGORY_TABS: { value: BulletinCategory | 'ALL'; label: string }[] = [
  { value: 'ALL',          label: 'All'          },
  { value: 'ANNOUNCEMENT', label: 'Announcement' },
  { value: 'HOLIDAY',      label: 'Holiday'      },
  { value: 'MAINTENANCE',  label: 'Maintenance'  },
  { value: 'EVENT',        label: 'Event'        },
  { value: 'GENERAL',      label: 'General'      },
];

const CATEGORY_OPTS: { value: BulletinCategory; label: string }[] = CATEGORY_TABS.slice(1) as { value: BulletinCategory; label: string }[];

const PRIORITY_OPTS: { value: BulletinPriority; label: string }[] = [
  { value: 'URGENT',    label: 'Urgent'    },
  { value: 'IMPORTANT', label: 'Important' },
  { value: 'NORMAL',    label: 'Normal'    },
];

// ── Helpers ────────────────────────────────────────────────
function priorityConfig(p: BulletinPriority) {
  return {
    URGENT:    { cls: 'bg-danger-light text-danger border-l-danger',     icon: AlertTriangle, label: 'Urgent'    },
    IMPORTANT: { cls: 'bg-warning-light text-warning border-l-warning',  icon: Info,          label: 'Important' },
    NORMAL:    { cls: 'bg-gray-100 text-gray-500 border-l-gray-300',     icon: Info,          label: 'Normal'    },
  }[p];
}

function categoryLabel(c: BulletinCategory) {
  return {
    ANNOUNCEMENT: 'Announcement', HOLIDAY: 'Holiday',
    MAINTENANCE: 'Maintenance', EVENT: 'Event', GENERAL: 'General',
  }[c];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ── Scheduled Announcement Types ──────────────────────────
type RecurrenceType = 'DAILY' | 'WEEKDAYS' | 'WEEKLY';
const DAY_LABELS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  DAILY: 'Every day', WEEKDAYS: 'Weekdays (Mon–Fri)', WEEKLY: 'Every week on…',
};

interface ScheduledAnnouncement {
  id: string; title: string; content: string;
  audienceType: AudienceType; recurrence: RecurrenceType;
  dayOfWeek: number | null; sendHour: number; sendMinute: number;
  isActive: boolean; lastSentAt: string | null;
  createdAt: string;
  createdBy: { id: string; fullName: string };
  audiences: { division: DivisionOption }[];
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function scheduleLabel(sa: ScheduledAnnouncement) {
  const time = `${pad(sa.sendHour)}:${pad(sa.sendMinute)} WIB`;
  if (sa.recurrence === 'WEEKLY') return `${DAY_LABELS[sa.dayOfWeek ?? 0]}, ${time}`;
  return `${RECURRENCE_LABELS[sa.recurrence]}, ${time}`;
}

// ── Main Page ──────────────────────────────────────────────
export default function BulletinPage() {
  const user = useAuthStore((s) => s.user);
  const currentUserId = user?.id ?? '';
  const roleLevel = user?.role?.level ?? 99;
  const isAdmin = roleLevel <= 2;
  const canManageScheduled = roleLevel <= 3;
  const { perms } = usePermStore();
  const pushToast = useToastStore((s) => s.push);

  // edit/delete are Scope ('none'|'own'|'division'|'all'), not boolean
  const canEditBulletin = (b: Bulletin) =>
    perms.bulletin.edit !== 'none' && (isAdmin || b.author.id === currentUserId);
  const canDeleteBulletin = (b: Bulletin) =>
    perms.bulletin.delete !== 'none' && (isAdmin || b.author.id === currentUserId);

  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [meta,      setMeta]      = useState<Meta | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const [category,     setCategory]     = useState<BulletinCategory | 'ALL'>('ALL');
  const [searchInput,  setSearchInput]  = useState('');
  const [search,       setSearch]       = useState('');
  const [showDrafts,   setShowDrafts]   = useState(false);
  const [page,         setPage]         = useState(1);
  const [pageSize,     setPageSize]     = useState(20);

  const [selected, setSelected] = useState<Bulletin | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Bulletin | null>(null);

  const [activeTab, setActiveTab] = useState<'bulletins' | 'scheduled'>('bulletins');
  const [scheduled,         setScheduled]         = useState<ScheduledAnnouncement[]>([]);
  const [loadingScheduled,  setLoadingScheduled]  = useState(false);
  const [showScheduledForm, setShowScheduledForm] = useState(false);
  const [editScheduled,     setEditScheduled]     = useState<ScheduledAnnouncement | null>(null);

  const fetchBulletins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { limit: String(pageSize), page: String(page) };
      if (category !== 'ALL') params.category = category;
      if (search)             params.search   = search;
      if (isAdmin && showDrafts) params.isPublished = 'false';

      const res = await api.get('/bulletins', { params });
      setBulletins(res.data.data ?? []);
      setMeta(res.data.meta ?? null);
    } catch {
      setError('Failed to load bulletins.');
    } finally {
      setLoading(false);
    }
  }, [category, search, isAdmin, showDrafts, page, pageSize]);

  useEffect(() => { fetchBulletins(); }, [fetchBulletins]);

  function handlePageSizeChange(n: number) { setPageSize(n); setPage(1); }

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchScheduled = useCallback(async () => {
    if (!canManageScheduled) return;
    setLoadingScheduled(true);
    try {
      const res = await api.get('/scheduled-announcements');
      setScheduled(res.data.data ?? []);
    } catch { /* ignore */ } finally { setLoadingScheduled(false); }
  }, [canManageScheduled]);

  useEffect(() => { if (activeTab === 'scheduled') fetchScheduled(); }, [activeTab, fetchScheduled]);

  const handleToggleActive = async (sa: ScheduledAnnouncement) => {
    try {
      await api.patch(`/scheduled-announcements/${sa.id}`, { isActive: !sa.isActive });
      setScheduled((prev) => prev.map((s) => s.id === sa.id ? { ...s, isActive: !sa.isActive } : s));
    } catch {
      pushToast('error', 'Gagal mengubah status pengumuman terjadwal');
    }
  };

  const handleDeleteScheduled = async (id: string) => {
    if (!confirm('Delete this scheduled announcement?')) return;
    try {
      await api.delete(`/scheduled-announcements/${id}`);
      setScheduled((prev) => prev.filter((s) => s.id !== id));
    } catch {
      pushToast('error', 'Gagal menghapus pengumuman terjadwal');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this bulletin?')) return;
    try {
      await api.delete(`/bulletins/${id}`);
      if (selected?.id === id) setSelected(null);
      fetchBulletins();
    } catch {
      pushToast('error', 'Gagal menghapus bulletin');
    }
  };

  const handleTogglePublish = async (b: Bulletin) => {
    try {
      await api.patch(`/bulletins/${b.id}`, { isPublished: !b.isPublished });
      fetchBulletins();
    } catch {
      pushToast('error', 'Gagal mengubah status publikasi bulletin');
    }
  };

  const openDetail = async (b: Bulletin) => {
    setSelected(b);
    try {
      const res = await api.get(`/bulletins/${b.id}`);
      setSelected(res.data.data);
      setBulletins((prev) => prev.map((x) => x.id === b.id ? { ...x, isRead: true } : x));
    } catch { /* ignore */ }
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-56px-48px)]">
      {/* ── Left: list ── */}
      <div className="flex flex-col w-96 flex-shrink-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Bulletin</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {activeTab === 'bulletins'
                ? (meta ? `${meta.total} bulletins` : 'Announcements board')
                : `${scheduled.length} scheduled`}
            </p>
          </div>
          {activeTab === 'bulletins' && perms.bulletin.create && (
            <button
              onClick={() => { setEditItem(null); setShowForm(true); }}
              className="flex items-center gap-1.5 h-9 px-3 bg-navy text-white text-sm font-medium rounded hover:bg-navy-light transition-colors"
            >
              <Plus size={15} /> Create
            </button>
          )}
          {activeTab === 'scheduled' && canManageScheduled && (
            <button
              onClick={() => { setEditScheduled(null); setShowScheduledForm(true); }}
              className="flex items-center gap-1.5 h-9 px-3 bg-navy text-white text-sm font-medium rounded hover:bg-navy-light transition-colors"
            >
              <Plus size={15} /> Add
            </button>
          )}
        </div>

        {/* Tabs */}
        {canManageScheduled && (
          <div className="flex gap-1 mb-3 border-b border-gray-100">
            {(['bulletins', 'scheduled'] as const).map((t) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={cn('px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors capitalize',
                  activeTab === t ? 'border-navy text-navy' : 'border-transparent text-gray-500 hover:text-gray-700'
                )}>
                {t === 'scheduled' ? <span className="flex items-center gap-1"><Clock size={11} /> Scheduled</span> : 'Bulletins'}
              </button>
            ))}
          </div>
        )}

        {/* Search (bulletins only) */}
        {activeTab === 'bulletins' && (
          <div className="relative mb-3">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search bulletins..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-sm border border-gray-300 rounded bg-white placeholder:text-gray-400 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy-50"
            />
          </div>
        )}

        {/* Category tabs (bulletins only) */}
        {activeTab === 'bulletins' && <div className="flex gap-1 flex-wrap mb-3">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setCategory(tab.value); setPage(1); }}
              className={cn(
                'px-2.5 h-6 text-xs rounded transition-colors',
                category === tab.value
                  ? 'bg-navy text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>}

        {activeTab === 'bulletins' && <>
          {/* Admin: draft toggle */}
          {isAdmin && (
            <button
              onClick={() => { setShowDrafts((p) => !p); setPage(1); }}
              className={cn(
                'flex items-center gap-1.5 text-xs mb-3 self-start px-2.5 py-1 rounded transition-colors',
                showDrafts ? 'bg-warning-light text-warning' : 'text-gray-400 hover:text-gray-600',
              )}
            >
              {showDrafts ? <EyeOff size={12} /> : <Eye size={12} />}
              {showDrafts ? 'Hide drafts' : 'Show drafts'}
            </button>
          )}

          {/* List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <SkeletonList />
            ) : error ? (
              <ErrorState message={error} onRetry={fetchBulletins} />
            ) : bulletins.length === 0 ? (
              <EmptyState isAdmin={isAdmin} canCreate={perms.bulletin.create} onAdd={() => { setEditItem(null); setShowForm(true); }} />
            ) : (
              bulletins.map((b) => (
                <BulletinCard
                  key={b.id}
                  bulletin={b}
                  isSelected={selected?.id === b.id}
                  canEdit={canEditBulletin(b)}
                  canDelete={canDeleteBulletin(b)}
                  onClick={() => openDetail(b)}
                  onEdit={() => { setEditItem(b); setShowForm(true); }}
                  onDelete={() => handleDelete(b.id)}
                  onTogglePublish={() => handleTogglePublish(b)}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          {!loading && !error && meta && (
            <div className="flex items-center justify-between gap-2 pt-2 flex-shrink-0">
              <PageSizeSelect value={pageSize} onChange={handlePageSizeChange} />
              {meta.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-2 text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm text-gray-500">{page} / {meta.totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages}
                    className="p-2 text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}
        </>}

        {activeTab === 'scheduled' && (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loadingScheduled ? (
              <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-gray-300" /></div>
            ) : scheduled.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Clock size={32} className="text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-600">No scheduled announcements</p>
                <p className="text-xs text-gray-400 mt-1">Add recurring notifications for your team.</p>
              </div>
            ) : scheduled.map((sa) => (
              <div key={sa.id} className={cn(
                'border rounded-lg p-3 space-y-1.5 transition-colors',
                sa.isActive ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60',
              )}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-800 leading-snug">{sa.title}</p>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleToggleActive(sa)} title={sa.isActive ? 'Deactivate' : 'Activate'}
                      className="text-gray-400 hover:text-navy transition-colors">
                      {sa.isActive ? <ToggleRight size={18} className="text-navy" /> : <ToggleLeft size={18} />}
                    </button>
                    <button onClick={() => { setEditScheduled(sa); setShowScheduledForm(true); }}
                      className="p-1 text-gray-400 hover:text-navy rounded"><Edit2 size={13} /></button>
                    <button onClick={() => handleDeleteScheduled(sa.id)}
                      className="p-1 text-gray-400 hover:text-danger rounded"><Trash2 size={13} /></button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">{sa.content}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[10px] bg-navy/10 text-navy px-2 py-0.5 rounded-full font-medium">
                    <Clock size={9} /> {scheduleLabel(sa)}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {sa.audienceType === 'ALL' ? 'All staff' : sa.audienceType === 'DIVISION' ? "Creator's division" : sa.audiences.map(a => a.division.name).join(', ')}
                  </span>
                </div>
                {sa.lastSentAt && (
                  <p className="text-[10px] text-gray-400">Last sent: {new Date(sa.lastSentAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Right: detail pane ── */}
      <div className="flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
        {selected ? (
          <DetailPane bulletin={selected}
            canEdit={canEditBulletin(selected)}
            canDelete={canDeleteBulletin(selected)}
            onEdit={() => { setEditItem(selected); setShowForm(true); }}
            onDelete={() => handleDelete(selected.id)}
            onTogglePublish={() => handleTogglePublish(selected)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Megaphone size={40} className="text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-600">Select a bulletin to read</p>
            <p className="text-xs text-gray-400 mt-1">Click on any bulletin on the left</p>
          </div>
        )}
      </div>

      {/* ── Form Modal ── */}
      {showForm && (
        <BulletinFormModal
          bulletin={editItem}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            fetchBulletins();
            // Refresh detail pane if we just edited the open bulletin
            if (editItem && selected?.id === editItem.id) openDetail(editItem);
          }}
        />
      )}

      {/* ── Scheduled Form Modal ── */}
      {showScheduledForm && (
        <ScheduledAnnouncementFormModal
          item={editScheduled}
          onClose={() => setShowScheduledForm(false)}
          onSaved={() => { setShowScheduledForm(false); fetchScheduled(); }}
        />
      )}
    </div>
  );
}

// ── BulletinCard ───────────────────────────────────────────
function BulletinCard({ bulletin: b, isSelected, canEdit, canDelete, onClick, onEdit, onDelete, onTogglePublish }: {
  bulletin: Bulletin; isSelected: boolean; canEdit: boolean; canDelete: boolean;
  onClick: () => void; onEdit: () => void;
  onDelete: () => void; onTogglePublish: () => void;
}) {
  const cfg = priorityConfig(b.priority);

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative border-l-2 rounded-lg p-3 cursor-pointer transition-colors',
        cfg.cls,
        isSelected ? 'ring-1 ring-navy' : 'border border-gray-200 bg-white hover:bg-gray-50',
        !b.isRead && !isSelected && 'border-l-4',
      )}
    >
      <div className="flex items-start gap-2">
        {/* Unread dot */}
        {!b.isRead && (
          <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-info" />
        )}
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-medium text-gray-800 leading-snug truncate', !b.isRead && 'font-semibold')}>
            {b.title}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-gray-400">{categoryLabel(b.category)}</span>
            {b.publishedAt && (
              <span className="text-xs text-gray-400">{formatDate(b.publishedAt)}</span>
            )}
            {!b.isPublished && (
              <span className="text-xs font-medium text-warning bg-warning-light px-1.5 py-0.5 rounded">
                Draft
              </span>
            )}
            {b.audienceType === 'DIVISION' && (
              <span className="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">Division</span>
            )}
            {b.audienceType === 'CUSTOM' && (
              <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Limited</span>
            )}
          </div>
        </div>
      </div>

      {/* Author / admin actions */}
      {(canEdit || canDelete) && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
          {canEdit && (
            <button onClick={(e) => { e.stopPropagation(); onTogglePublish(); }}
              className="p-1 rounded hover:bg-white/80 text-gray-400 hover:text-gray-700 transition-colors"
              title={b.isPublished ? 'Unpublish' : 'Publish'}
            >
              {b.isPublished ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          )}
          {canEdit && (
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1 rounded hover:bg-white/80 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <Edit2 size={13} />
            </button>
          )}
          {canDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1 rounded hover:bg-white/80 text-gray-400 hover:text-danger transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── DetailPane ─────────────────────────────────────────────
function DetailPane({ bulletin: b, canEdit, canDelete, onEdit, onDelete, onTogglePublish }: {
  bulletin: Bulletin; canEdit: boolean; canDelete: boolean;
  onEdit: () => void; onDelete: () => void; onTogglePublish: () => void;
}) {
  const cfg = priorityConfig(b.priority);
  const Icon = cfg.icon;

  return (
    <>
      {/* Detail header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded', cfg.cls)}>
                <Icon size={11} /> {cfg.label}
              </span>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                {categoryLabel(b.category)}
              </span>
              {!b.isPublished && (
                <span className="text-xs font-medium text-warning bg-warning-light px-2 py-0.5 rounded">
                  Draft
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-gray-800 leading-snug">{b.title}</h2>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
              <span>By {b.author.fullName}</span>
              {b.publishedAt && (
                <span className="flex items-center gap-1">
                  <Calendar size={11} /> {formatDate(b.publishedAt)}
                </span>
              )}
              {b.isRead && (
                <span className="flex items-center gap-1 text-success">
                  <CheckCircle2 size={11} /> Read
                </span>
              )}
              <span>{b._count.readStatus} readers</span>
            </div>
          </div>

          {(canEdit || canDelete) && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {canEdit && (
                <button onClick={onTogglePublish}
                  className="flex items-center gap-1.5 h-8 px-3 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors text-gray-600"
                >
                  {b.isPublished ? <><EyeOff size={12} /> Unpublish</> : <><Eye size={12} /> Publish</>}
                </button>
              )}
              {canEdit && (
                <button onClick={onEdit}
                  className="h-8 px-3 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors text-gray-600"
                >
                  <Edit2 size={12} />
                </button>
              )}
              {canDelete && (
                <button onClick={onDelete}
                  className="h-8 px-3 text-xs border border-danger/30 rounded hover:bg-danger-light transition-colors text-danger"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
          {b.content}
        </div>

        {b.expiresAt && (
          <p className="mt-6 text-xs text-gray-400 border-t border-gray-100 pt-3">
            Valid until: {formatDate(b.expiresAt)}
          </p>
        )}
      </div>
    </>
  );
}

// ── Form Modal ─────────────────────────────────────────────
function BulletinFormModal({ bulletin, onClose, onSaved }: {
  bulletin: Bulletin | null; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!bulletin;
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState<string | null>(null);
  const [title,            setTitle]            = useState(bulletin?.title      ?? '');
  const [content,          setContent]          = useState(bulletin?.content    ?? '');
  const [category,         setCategory]         = useState<BulletinCategory>(bulletin?.category ?? 'GENERAL');
  const [priority,         setPriority]         = useState<BulletinPriority>(bulletin?.priority ?? 'NORMAL');
  const [published,        setPublished]        = useState(bulletin?.isPublished ?? false);
  const [expiresAt,        setExpiresAt]        = useState(
    bulletin?.expiresAt ? bulletin.expiresAt.slice(0, 10) : '',
  );
  const [audienceType,     setAudienceType]     = useState<AudienceType>(bulletin?.audienceType ?? 'ALL');
  const [divisions,        setDivisions]        = useState<DivisionOption[]>([]);
  const [selectedDivIds,   setSelectedDivIds]   = useState<string[]>(
    bulletin?.audiences?.map((a) => a.division.id) ?? [],
  );

  useEffect(() => {
    api.get('/divisions').then((res) => setDivisions(res.data.data ?? [])).catch(() => {});
  }, []);

  function toggleDivision(divId: string) {
    setSelectedDivIds((prev) =>
      prev.includes(divId) ? prev.filter((d) => d !== divId) : [...prev, divId],
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim())   { setError('Title is required'); return; }
    if (!content.trim()) { setError('Content is required'); return; }
    if (audienceType === 'CUSTOM' && selectedDivIds.length === 0) {
      setError('Select at least one division for custom audience'); return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        content: content.trim(),
        category,
        priority,
        isPublished: published,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        audienceType,
        audienceDivisionIds: audienceType === 'CUSTOM' ? selectedDivIds : [],
      };
      if (isEdit) {
        await api.patch(`/bulletins/${bulletin.id}`, payload);
      } else {
        await api.post('/bulletins', payload);
      }
      onSaved();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'An error occurred';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-md font-semibold text-gray-800">
            {isEdit ? 'Edit Bulletin' : 'Create Bulletin'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <p className="text-xs text-danger bg-danger-light px-3 py-2 rounded border-l-2 border-danger">
              {error}
            </p>
          )}

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Bulletin title..."
              className="w-full h-9 px-3 text-sm border border-gray-300 rounded bg-white placeholder:text-gray-400 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy-50"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Content *</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)}
              placeholder="Announcement content..."
              rows={8}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-white placeholder:text-gray-400 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy-50 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as BulletinCategory)}
                className="w-full h-9 px-3 text-sm border border-gray-300 rounded bg-white focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy-50"
              >
                {CATEGORY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as BulletinPriority)}
                className="w-full h-9 px-3 text-sm border border-gray-300 rounded bg-white focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy-50"
              >
                {PRIORITY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Audience</label>
            <div className="flex gap-2">
              {([
                { value: 'ALL'      as AudienceType, label: 'Everyone'       },
                { value: 'DIVISION' as AudienceType, label: 'My Division'    },
                { value: 'CUSTOM'   as AudienceType, label: 'Select Divisions' },
              ] as { value: AudienceType; label: string }[]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAudienceType(opt.value)}
                  className={cn(
                    'flex-1 h-9 text-sm rounded border transition-colors',
                    audienceType === opt.value
                      ? 'bg-navy text-white border-navy'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-navy hover:text-navy',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {audienceType === 'CUSTOM' && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Select Divisions</label>
              <div className="flex flex-wrap gap-1.5 p-2 border border-gray-300 rounded bg-white max-h-28 overflow-y-auto">
                {divisions.map((div) => (
                  <button
                    key={div.id}
                    type="button"
                    onClick={() => toggleDivision(div.id)}
                    className={cn(
                      'px-2.5 py-1 text-xs rounded-full border transition-colors',
                      selectedDivIds.includes(div.id)
                        ? 'text-white border-transparent'
                        : 'text-gray-600 border-gray-200 bg-gray-50 hover:bg-gray-100',
                    )}
                    style={selectedDivIds.includes(div.id) ? { backgroundColor: div.color, borderColor: div.color } : {}}
                  >
                    {div.name}
                  </button>
                ))}
                {divisions.length === 0 && (
                  <span className="text-xs text-gray-400 p-1">Loading divisions...</span>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Valid until</label>
              <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full h-9 px-3 text-sm border border-gray-300 rounded bg-white focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy-50"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)}
                  className="w-4 h-4 accent-navy rounded"
                />
                <span className="text-sm text-gray-700">Publish now</span>
              </label>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="h-9 px-4 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={loading}
            className="h-9 px-5 text-sm font-medium bg-navy text-white rounded hover:bg-navy-light disabled:opacity-60 transition-colors flex items-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Save' : 'Create Bulletin'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton / Empty / Error ───────────────────────────────
function SkeletonList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-lg p-3 border border-gray-100">
          <div className="skeleton h-4 rounded w-3/4 mb-2" />
          <div className="skeleton h-3 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ isAdmin, canCreate, onAdd }: { isAdmin: boolean; canCreate?: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Megaphone size={36} className="text-gray-300 mb-3" />
      <p className="text-sm font-medium text-gray-600">No bulletins yet</p>
      <p className="text-xs text-gray-400 mt-1">Announcements from management will appear here.</p>
      {(canCreate ?? isAdmin) && (
        <button onClick={onAdd}
          className="mt-4 flex items-center gap-1.5 h-8 px-4 text-sm font-medium text-white bg-navy rounded hover:bg-navy-light transition-colors"
        >
          <Plus size={14} /> Create Bulletin
        </button>
      )}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle size={28} className="text-danger mb-3" />
      <p className="text-sm text-gray-600">{message}</p>
      <button onClick={onRetry} className="mt-3 text-sm text-info hover:underline">
        Try again
      </button>
    </div>
  );
}

// ── ScheduledAnnouncementFormModal ────────────────────────
function ScheduledAnnouncementFormModal({ item, onClose, onSaved }: {
  item: ScheduledAnnouncement | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title,        setTitle]        = useState(item?.title ?? '');
  const [content,      setContent]      = useState(item?.content ?? '');
  const [audienceType, setAudienceType] = useState<AudienceType>(item?.audienceType ?? 'ALL');
  const [recurrence,   setRecurrence]   = useState<RecurrenceType>(item?.recurrence ?? 'DAILY');
  const [dayOfWeek,    setDayOfWeek]    = useState<number>(item?.dayOfWeek ?? 1);
  const [sendHour,     setSendHour]     = useState(item?.sendHour ?? 8);
  const [sendMinute,   setSendMinute]   = useState(item?.sendMinute ?? 0);
  const [divisionIds,  setDivisionIds]  = useState<string[]>(item?.audiences.map((a) => a.division.id) ?? []);
  const [divisions,    setDivisions]    = useState<DivisionOption[]>([]);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');

  useEffect(() => {
    api.get('/divisions').then((r) => setDivisions(r.data.data ?? [])).catch(() => {});
  }, []);

  const toggleDiv = (id: string) =>
    setDivisionIds((prev) => prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) { setError('Title and content are required.'); return; }
    if (audienceType === 'CUSTOM' && divisionIds.length === 0) { setError('Select at least one division.'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        title: title.trim(), content: content.trim(),
        audienceType, recurrence,
        dayOfWeek: recurrence === 'WEEKLY' ? dayOfWeek : undefined,
        sendHour, sendMinute,
        divisionIds: audienceType === 'CUSTOM' ? divisionIds : [],
      };
      if (item) {
        await api.patch(`/scheduled-announcements/${item.id}`, payload);
      } else {
        await api.post('/scheduled-announcements', payload);
      }
      onSaved();
    } catch { setError('Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">
            {item ? 'Edit Scheduled Announcement' : 'New Scheduled Announcement'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && <p className="text-xs text-danger bg-danger-light p-2 rounded">{error}</p>}

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required
              placeholder="e.g. Daily Attendance Reminder"
              className="w-full h-9 px-3 text-sm border border-gray-300 rounded focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy-50" />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Message</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} required rows={3}
              placeholder="e.g. Don't forget to submit your attendance today!"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded resize-none focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy-50" />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Recurrence</label>
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
              className="w-full h-9 px-3 text-sm border border-gray-300 rounded focus:border-navy focus:outline-none">
              <option value="DAILY">Every day</option>
              <option value="WEEKDAYS">Weekdays (Mon–Fri)</option>
              <option value="WEEKLY">Every week on a specific day</option>
            </select>
          </div>

          {recurrence === 'WEEKLY' && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Day of week</label>
              <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full h-9 px-3 text-sm border border-gray-300 rounded focus:border-navy focus:outline-none">
                {DAY_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Hour (WIB)</label>
              <input type="number" min={0} max={23} value={sendHour} onChange={(e) => setSendHour(Number(e.target.value))}
                className="w-full h-9 px-3 text-sm border border-gray-300 rounded focus:border-navy focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Minute</label>
              <input type="number" min={0} max={59} value={sendMinute} onChange={(e) => setSendMinute(Number(e.target.value))}
                className="w-full h-9 px-3 text-sm border border-gray-300 rounded focus:border-navy focus:outline-none" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Audience</label>
            <select value={audienceType} onChange={(e) => setAudienceType(e.target.value as AudienceType)}
              className="w-full h-9 px-3 text-sm border border-gray-300 rounded focus:border-navy focus:outline-none">
              <option value="ALL">All staff</option>
              <option value="DIVISION">Creator's division only</option>
              <option value="CUSTOM">Specific divisions</option>
            </select>
          </div>

          {audienceType === 'CUSTOM' && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Divisions</label>
              <div className="flex flex-wrap gap-1.5 border border-gray-200 rounded p-2">
                {divisions.map((d) => (
                  <button type="button" key={d.id} onClick={() => toggleDiv(d.id)}
                    className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors',
                      divisionIds.includes(d.id)
                        ? 'bg-navy/10 text-navy border-navy/30 font-medium'
                        : 'text-gray-400 border-gray-200 hover:border-navy/30 hover:text-navy',
                    )}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="h-9 px-4 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="h-9 px-4 text-sm font-medium text-white bg-navy rounded hover:bg-navy-light disabled:opacity-50 flex items-center gap-1.5">
            {saving && <Loader2 size={13} className="animate-spin" />}
            {item ? 'Save changes' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
