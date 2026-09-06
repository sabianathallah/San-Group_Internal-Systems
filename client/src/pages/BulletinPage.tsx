import { useCallback, useEffect, useState, FormEvent } from 'react';
import {
  Megaphone, Plus, Search, X,
  AlertTriangle, Info, Calendar, Eye, EyeOff,
  Loader2, Trash2, Edit2, Clock, ToggleLeft, ToggleRight,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { usePermStore } from '@/stores/permStore';
import { useToastStore } from '@/stores/toastStore';
import { cn } from '@/lib/cn';
import { PageSizeSelect } from '@/components/shared/PageSizeSelect';

/** Locale for date formatting — mirrors i18next's active language. */
function dateLocale(language: string): string {
  return language === 'id' ? 'id-ID' : 'en-US';
}

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
type TFn = (key: string, opts?: Record<string, unknown>) => string;

function categoryTabs(t: TFn): { value: BulletinCategory | 'ALL'; label: string }[] {
  return [
    { value: 'ALL',          label: t('bulletin.category.all') },
    { value: 'ANNOUNCEMENT', label: t('bulletin.category.announcement') },
    { value: 'HOLIDAY',      label: t('bulletin.category.holiday') },
    { value: 'MAINTENANCE',  label: t('bulletin.category.maintenance') },
    { value: 'EVENT',        label: t('bulletin.category.event') },
    { value: 'GENERAL',      label: t('bulletin.category.general') },
  ];
}

function categoryOpts(t: TFn): { value: BulletinCategory; label: string }[] {
  return categoryTabs(t).slice(1) as { value: BulletinCategory; label: string }[];
}

function priorityOpts(t: TFn): { value: BulletinPriority; label: string }[] {
  return [
    { value: 'URGENT',    label: t('bulletin.priority.urgent') },
    { value: 'IMPORTANT', label: t('bulletin.priority.important') },
    { value: 'NORMAL',    label: t('bulletin.priority.normal') },
  ];
}

// ── Helpers ────────────────────────────────────────────────
function priorityConfig(p: BulletinPriority, t: TFn) {
  return {
    URGENT:    { cls: 'bg-danger-light text-danger border-l-danger',     icon: AlertTriangle, label: t('bulletin.priority.urgent') },
    IMPORTANT: { cls: 'bg-warning-light text-warning border-l-warning',  icon: Info,          label: t('bulletin.priority.important') },
    NORMAL:    { cls: 'bg-gray-100 text-gray-500 border-l-gray-300',     icon: Info,          label: t('bulletin.priority.normal') },
  }[p];
}

function categoryLabel(c: BulletinCategory, t: TFn) {
  return {
    ANNOUNCEMENT: t('bulletin.category.announcement'), HOLIDAY: t('bulletin.category.holiday'),
    MAINTENANCE: t('bulletin.category.maintenance'), EVENT: t('bulletin.category.event'), GENERAL: t('bulletin.category.general'),
  }[c];
}

function formatDate(iso: string, language: string) {
  return new Date(iso).toLocaleDateString(dateLocale(language), {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ── Scheduled Announcement Types ──────────────────────────
type RecurrenceType = 'DAILY' | 'WEEKDAYS' | 'WEEKLY';
const DAY_LABEL_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
function dayLabels(t: TFn) {
  return DAY_LABEL_KEYS.map((k) => t(`bulletin.days.${k}`));
}
function recurrenceLabels(t: TFn): Record<RecurrenceType, string> {
  return {
    DAILY: t('bulletin.recurrence.daily'),
    WEEKDAYS: t('bulletin.recurrence.weekdays'),
    WEEKLY: t('bulletin.recurrence.weekly'),
  };
}

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
function scheduleLabel(sa: ScheduledAnnouncement, t: TFn) {
  const time = `${pad(sa.sendHour)}:${pad(sa.sendMinute)} WIB`;
  if (sa.recurrence === 'WEEKLY') return `${dayLabels(t)[sa.dayOfWeek ?? 0]}, ${time}`;
  return `${recurrenceLabels(t)[sa.recurrence]}, ${time}`;
}

// ── Main Page ──────────────────────────────────────────────
export default function BulletinPage() {
  const { t, i18n } = useTranslation();
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
      setError(t('bulletin.errorState.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [category, search, isAdmin, showDrafts, page, pageSize]);

  useEffect(() => { fetchBulletins(); }, [fetchBulletins]);

  // Full content now renders directly in the feed (no click-to-open pane),
  // so being on this page already counts as "read" — mark each unread,
  // published item as read as soon as it's fetched instead of waiting for
  // a click that no longer exists.
  useEffect(() => {
    const unread = bulletins.filter((b) => b.isPublished && !b.isRead);
    if (unread.length === 0) return;
    unread.forEach((b) => {
      api.get(`/bulletins/${b.id}`)
        .then(() => setBulletins((prev) => prev.map((x) => x.id === b.id ? { ...x, isRead: true } : x)))
        .catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulletins.map((b) => b.id).join(',')]);

  // Notification arrives on its own poll cycle (see Header.tsx) — if this
  // page is already mounted when a new bulletin is published, the list
  // above was fetched before that write and won't include it until we
  // refetch. Without this, the notification fires correctly but the
  // bulletin looks "missing" to whoever is already looking at this page.
  useEffect(() => {
    window.addEventListener('bulletin:new', fetchBulletins);
    return () => window.removeEventListener('bulletin:new', fetchBulletins);
  }, [fetchBulletins]);

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
      pushToast('error', t('bulletin.toast.toggleScheduledError'));
    }
  };

  const handleDeleteScheduled = async (id: string) => {
    if (!confirm(t('bulletin.confirm.deleteScheduled'))) return;
    try {
      await api.delete(`/scheduled-announcements/${id}`);
      setScheduled((prev) => prev.filter((s) => s.id !== id));
    } catch {
      pushToast('error', t('bulletin.toast.deleteScheduledError'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('bulletin.confirm.deleteBulletin'))) return;
    try {
      await api.delete(`/bulletins/${id}`);
      fetchBulletins();
    } catch {
      pushToast('error', t('bulletin.toast.deleteBulletinError'));
    }
  };

  const handleTogglePublish = async (b: Bulletin) => {
    try {
      await api.patch(`/bulletins/${b.id}`, { isPublished: !b.isPublished });
      fetchBulletins();
    } catch {
      pushToast('error', t('bulletin.toast.togglePublishError'));
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">{t('bulletin.header.title')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {activeTab === 'bulletins'
              ? (meta ? t('bulletin.header.subtitleCount', { count: meta.total }) : t('bulletin.header.subtitleDefault'))
              : t('bulletin.header.subtitleScheduledCount', { count: scheduled.length })}
          </p>
        </div>
        {activeTab === 'bulletins' && perms.bulletin.create && (
          <button
            onClick={() => { setEditItem(null); setShowForm(true); }}
            className="flex items-center gap-1.5 h-9 px-3 bg-navy text-white text-sm font-medium rounded hover:bg-navy-light transition-colors"
          >
            <Plus size={15} /> {t('bulletin.header.create')}
          </button>
        )}
        {activeTab === 'scheduled' && canManageScheduled && (
          <button
            onClick={() => { setEditScheduled(null); setShowScheduledForm(true); }}
            className="flex items-center gap-1.5 h-9 px-3 bg-navy text-white text-sm font-medium rounded hover:bg-navy-light transition-colors"
          >
            <Plus size={15} /> {t('bulletin.header.add')}
          </button>
        )}
      </div>

      {/* Tabs */}
      {canManageScheduled && (
        <div className="flex gap-1 mb-4 border-b border-gray-100">
          {(['bulletins', 'scheduled'] as const).map((tabKey) => (
            <button key={tabKey} onClick={() => setActiveTab(tabKey)}
              className={cn('px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors capitalize',
                activeTab === tabKey ? 'border-navy text-navy' : 'border-transparent text-gray-500 hover:text-gray-700'
              )}>
              {tabKey === 'scheduled' ? <span className="flex items-center gap-1"><Clock size={11} /> {t('bulletin.tabs.scheduled')}</span> : t('bulletin.tabs.bulletins')}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'bulletins' && <>
        {/* Search */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('bulletin.search.placeholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full h-9 pl-8 pr-3 text-sm border border-gray-300 rounded bg-white placeholder:text-gray-400 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy-50"
          />
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1 flex-wrap mb-4">
          {categoryTabs(t).map((tab) => (
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
          {isAdmin && (
            <button
              onClick={() => { setShowDrafts((p) => !p); setPage(1); }}
              className={cn(
                'flex items-center gap-1.5 h-6 px-2.5 text-xs rounded transition-colors ml-auto',
                showDrafts ? 'bg-warning-light text-warning' : 'text-gray-400 hover:text-gray-600',
              )}
            >
              {showDrafts ? <EyeOff size={12} /> : <Eye size={12} />}
              {showDrafts ? t('bulletin.drafts.hide') : t('bulletin.drafts.show')}
            </button>
          )}
        </div>

        {/* Feed — full content shown directly, just scroll, no click-to-open */}
        <div className="space-y-3">
          {loading ? (
            <SkeletonList />
          ) : error ? (
            <ErrorState message={error} onRetry={fetchBulletins} />
          ) : bulletins.length === 0 ? (
            <EmptyState isAdmin={isAdmin} canCreate={perms.bulletin.create} onAdd={() => { setEditItem(null); setShowForm(true); }} />
          ) : (
            bulletins.map((b) => (
              <BulletinFeedCard
                key={b.id}
                bulletin={b}
                canEdit={canEditBulletin(b)}
                canDelete={canDeleteBulletin(b)}
                onEdit={() => { setEditItem(b); setShowForm(true); }}
                onDelete={() => handleDelete(b.id)}
                onTogglePublish={() => handleTogglePublish(b)}
              />
            ))
          )}
        </div>

        {/* Pagination */}
        {!loading && !error && meta && (
          <div className="flex items-center justify-between gap-2 py-4">
            <PageSizeSelect value={pageSize} onChange={handlePageSizeChange} />
            {meta.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-2 text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm text-gray-500">{t('bulletin.pagination.pageOf', { page, totalPages: meta.totalPages })}</span>
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
        <div className="space-y-2">
          {loadingScheduled ? (
            <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-gray-300" /></div>
          ) : scheduled.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Clock size={32} className="text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-600">{t('bulletin.scheduledTab.emptyTitle')}</p>
              <p className="text-xs text-gray-400 mt-1">{t('bulletin.scheduledTab.emptySubtitle')}</p>
            </div>
          ) : scheduled.map((sa) => (
            <div key={sa.id} className={cn(
              'border rounded-lg p-3 space-y-1.5 transition-colors',
              sa.isActive ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60',
            )}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-gray-800 leading-snug">{sa.title}</p>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => handleToggleActive(sa)} title={sa.isActive ? t('bulletin.scheduledTab.deactivate') : t('bulletin.scheduledTab.activate')}
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
                  <Clock size={9} /> {scheduleLabel(sa, t)}
                </span>
                <span className="text-[10px] text-gray-400">
                  {sa.audienceType === 'ALL' ? t('bulletin.scheduledTab.audienceAll') : sa.audienceType === 'DIVISION' ? t('bulletin.scheduledTab.audienceDivision') : sa.audiences.map(a => a.division.name).join(', ')}
                </span>
              </div>
              {sa.lastSentAt && (
                <p className="text-[10px] text-gray-400">{t('bulletin.scheduledTab.lastSent', { date: new Date(sa.lastSentAt).toLocaleString(dateLocale(i18n.language), { dateStyle: 'medium', timeStyle: 'short' }) })}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Form Modal ── */}
      {showForm && (
        <BulletinFormModal
          bulletin={editItem}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            fetchBulletins();
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

// ── BulletinFeedCard ─────────────────────────────────────────
// Full content shown directly — no separate detail pane to click into,
// per feedback that the two-pane layout hid content behind an extra click.
function BulletinFeedCard({ bulletin: b, canEdit, canDelete, onEdit, onDelete, onTogglePublish }: {
  bulletin: Bulletin; canEdit: boolean; canDelete: boolean;
  onEdit: () => void; onDelete: () => void; onTogglePublish: () => void;
}) {
  const { t, i18n } = useTranslation();
  const cfg = priorityConfig(b.priority, t);
  const Icon = cfg.icon;

  return (
    <div className={cn(
      'group relative border-l-4 rounded-xl bg-white overflow-hidden transition-colors',
      cfg.cls,
      !b.isRead ? 'border border-gray-200 shadow-sm' : 'border border-gray-100',
    )}>
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded', cfg.cls)}>
                <Icon size={11} /> {cfg.label}
              </span>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                {categoryLabel(b.category, t)}
              </span>
              {!b.isPublished && (
                <span className="text-xs font-medium text-warning bg-warning-light px-2 py-0.5 rounded">{t('bulletin.feed.draft')}</span>
              )}
              {b.audienceType === 'DIVISION' && (
                <span className="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">{t('bulletin.feed.division')}</span>
              )}
              {b.audienceType === 'CUSTOM' && (
                <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{t('bulletin.feed.limited')}</span>
              )}
              {!b.isRead && <span className="w-1.5 h-1.5 rounded-full bg-info flex-shrink-0" />}
            </div>
            <h2 className={cn('text-base leading-snug text-gray-800', !b.isRead ? 'font-semibold' : 'font-medium')}>
              {b.title}
            </h2>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
              <span>{t('bulletin.feed.by', { name: b.author.fullName })}</span>
              {b.publishedAt && (
                <span className="flex items-center gap-1"><Calendar size={11} /> {formatDate(b.publishedAt, i18n.language)}</span>
              )}
              <span>{t('bulletin.feed.readers', { count: b._count.readStatus })}</span>
            </div>
          </div>

          {(canEdit || canDelete) && (
            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              {canEdit && (
                <button onClick={onTogglePublish}
                  className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                  title={b.isPublished ? t('bulletin.feed.unpublish') : t('bulletin.feed.publish')}
                >
                  {b.isPublished ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              )}
              {canEdit && (
                <button onClick={onEdit} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                  <Edit2 size={13} />
                </button>
              )}
              {canDelete && (
                <button onClick={onDelete} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-danger transition-colors">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed whitespace-pre-wrap mt-3">
          {b.content}
        </div>

        {b.expiresAt && (
          <p className="mt-3 text-xs text-gray-400 border-t border-gray-100 pt-2.5">
            {t('bulletin.feed.validUntil', { date: formatDate(b.expiresAt, i18n.language) })}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Form Modal ─────────────────────────────────────────────
function BulletinFormModal({ bulletin, onClose, onSaved }: {
  bulletin: Bulletin | null; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useTranslation();
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
    if (!title.trim())   { setError(t('bulletin.form.errors.titleRequired')); return; }
    if (!content.trim()) { setError(t('bulletin.form.errors.contentRequired')); return; }
    if (audienceType === 'CUSTOM' && selectedDivIds.length === 0) {
      setError(t('bulletin.form.errors.divisionRequired')); return;
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
        ?? t('bulletin.form.errors.generic');
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
            {isEdit ? t('bulletin.form.editTitle') : t('bulletin.form.createTitle')}
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
            <label className="block text-sm font-medium text-gray-700">{t('bulletin.form.titleLabel')}</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={t('bulletin.form.titlePlaceholder')}
              className="w-full h-9 px-3 text-sm border border-gray-300 rounded bg-white placeholder:text-gray-400 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy-50"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">{t('bulletin.form.contentLabel')}</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)}
              placeholder={t('bulletin.form.contentPlaceholder')}
              rows={8}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-white placeholder:text-gray-400 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy-50 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">{t('bulletin.form.categoryLabel')}</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as BulletinCategory)}
                className="w-full h-9 px-3 text-sm border border-gray-300 rounded bg-white focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy-50"
              >
                {categoryOpts(t).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">{t('bulletin.form.priorityLabel')}</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as BulletinPriority)}
                className="w-full h-9 px-3 text-sm border border-gray-300 rounded bg-white focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy-50"
              >
                {priorityOpts(t).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">{t('bulletin.form.audienceLabel')}</label>
            <div className="flex gap-2">
              {([
                { value: 'ALL'      as AudienceType, label: t('bulletin.form.audienceEveryone')       },
                { value: 'DIVISION' as AudienceType, label: t('bulletin.form.audienceMyDivision')    },
                { value: 'CUSTOM'   as AudienceType, label: t('bulletin.form.audienceSelectDivisions') },
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
              <label className="block text-sm font-medium text-gray-700">{t('bulletin.form.selectDivisionsLabel')}</label>
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
                  <span className="text-xs text-gray-400 p-1">{t('bulletin.loadingDivisions')}</span>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">{t('bulletin.form.validUntilLabel')}</label>
              <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full h-9 px-3 text-sm border border-gray-300 rounded bg-white focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy-50"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)}
                  className="w-4 h-4 accent-navy rounded"
                />
                <span className="text-sm text-gray-700">{t('bulletin.form.publishNow')}</span>
              </label>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="h-9 px-4 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            {t('bulletin.form.cancel')}
          </button>
          <button onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={loading}
            className="h-9 px-5 text-sm font-medium bg-navy text-white rounded hover:bg-navy-light disabled:opacity-60 transition-colors flex items-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? t('bulletin.form.save') : t('bulletin.form.create')}
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
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Megaphone size={36} className="text-gray-300 mb-3" />
      <p className="text-sm font-medium text-gray-600">{t('bulletin.emptyState.title')}</p>
      <p className="text-xs text-gray-400 mt-1">{t('bulletin.emptyState.subtitle')}</p>
      {(canCreate ?? isAdmin) && (
        <button onClick={onAdd}
          className="mt-4 flex items-center gap-1.5 h-8 px-4 text-sm font-medium text-white bg-navy rounded hover:bg-navy-light transition-colors"
        >
          <Plus size={14} /> {t('bulletin.emptyState.cta')}
        </button>
      )}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle size={28} className="text-danger mb-3" />
      <p className="text-sm text-gray-600">{message}</p>
      <button onClick={onRetry} className="mt-3 text-sm text-info hover:underline">
        {t('bulletin.errorState.tryAgain')}
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
  const { t } = useTranslation();
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
    if (!title.trim() || !content.trim()) { setError(t('bulletin.scheduledForm.errors.required')); return; }
    if (audienceType === 'CUSTOM' && divisionIds.length === 0) { setError(t('bulletin.scheduledForm.errors.divisionRequired')); return; }
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
    } catch { setError(t('bulletin.scheduledForm.errors.saveFailed')); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">
            {item ? t('bulletin.scheduledForm.editTitle') : t('bulletin.scheduledForm.createTitle')}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && <p className="text-xs text-danger bg-danger-light p-2 rounded">{error}</p>}

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">{t('bulletin.scheduledForm.titleLabel')}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required
              placeholder={t('bulletin.scheduledForm.titlePlaceholder')}
              className="w-full h-9 px-3 text-sm border border-gray-300 rounded focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy-50" />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">{t('bulletin.scheduledForm.messageLabel')}</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} required rows={3}
              placeholder={t('bulletin.scheduledForm.messagePlaceholder')}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded resize-none focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy-50" />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">{t('bulletin.scheduledForm.recurrenceLabel')}</label>
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
              className="w-full h-9 px-3 text-sm border border-gray-300 rounded focus:border-navy focus:outline-none">
              <option value="DAILY">{t('bulletin.recurrence.daily')}</option>
              <option value="WEEKDAYS">{t('bulletin.recurrence.weekdays')}</option>
              <option value="WEEKLY">{t('bulletin.recurrence.weeklySpecific')}</option>
            </select>
          </div>

          {recurrence === 'WEEKLY' && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">{t('bulletin.scheduledForm.dayOfWeekLabel')}</label>
              <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full h-9 px-3 text-sm border border-gray-300 rounded focus:border-navy focus:outline-none">
                {dayLabels(t).map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">{t('bulletin.scheduledForm.hourLabel')}</label>
              <input type="number" min={0} max={23} value={sendHour} onChange={(e) => setSendHour(Number(e.target.value))}
                className="w-full h-9 px-3 text-sm border border-gray-300 rounded focus:border-navy focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">{t('bulletin.scheduledForm.minuteLabel')}</label>
              <input type="number" min={0} max={59} value={sendMinute} onChange={(e) => setSendMinute(Number(e.target.value))}
                className="w-full h-9 px-3 text-sm border border-gray-300 rounded focus:border-navy focus:outline-none" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">{t('bulletin.scheduledForm.audienceLabel')}</label>
            <select value={audienceType} onChange={(e) => setAudienceType(e.target.value as AudienceType)}
              className="w-full h-9 px-3 text-sm border border-gray-300 rounded focus:border-navy focus:outline-none">
              <option value="ALL">{t('bulletin.scheduledForm.audienceAll')}</option>
              <option value="DIVISION">{t('bulletin.scheduledForm.audienceDivision')}</option>
              <option value="CUSTOM">{t('bulletin.scheduledForm.audienceCustom')}</option>
            </select>
          </div>

          {audienceType === 'CUSTOM' && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">{t('bulletin.scheduledForm.divisionsLabel')}</label>
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
            {t('bulletin.scheduledForm.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="h-9 px-4 text-sm font-medium text-white bg-navy rounded hover:bg-navy-light disabled:opacity-50 flex items-center gap-1.5">
            {saving && <Loader2 size={13} className="animate-spin" />}
            {item ? t('bulletin.scheduledForm.save') : t('bulletin.scheduledForm.create')}
          </button>
        </div>
      </div>
    </div>
  );
}
