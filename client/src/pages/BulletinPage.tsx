import { useEffect, useState, FormEvent } from 'react';
import {
  Megaphone, Plus, Search, X,
  AlertTriangle, Info, Calendar, Eye, EyeOff,
  Loader2, Trash2, Edit2, CheckCircle2,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/cn';

// ── Types ──────────────────────────────────────────────────
type BulletinCategory = 'ANNOUNCEMENT' | 'HOLIDAY' | 'MAINTENANCE' | 'EVENT' | 'GENERAL';
type BulletinPriority = 'NORMAL' | 'IMPORTANT' | 'URGENT';

interface Bulletin {
  id: string;
  title: string;
  content: string;
  category: BulletinCategory;
  priority: BulletinPriority;
  isPublished: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  isRead: boolean;
  author: { id: string; fullName: string };
  _count: { readStatus: number };
}

interface Meta {
  total: number; page: number; limit: number; totalPages: number;
}

// ── Constants ──────────────────────────────────────────────
const CATEGORY_TABS: { value: BulletinCategory | 'ALL'; label: string }[] = [
  { value: 'ALL',          label: 'Semua'        },
  { value: 'ANNOUNCEMENT', label: 'Pengumuman'   },
  { value: 'HOLIDAY',      label: 'Hari Libur'   },
  { value: 'MAINTENANCE',  label: 'Pemeliharaan' },
  { value: 'EVENT',        label: 'Event'        },
  { value: 'GENERAL',      label: 'Umum'         },
];

const CATEGORY_OPTS: { value: BulletinCategory; label: string }[] = CATEGORY_TABS.slice(1) as { value: BulletinCategory; label: string }[];

const PRIORITY_OPTS: { value: BulletinPriority; label: string }[] = [
  { value: 'URGENT',    label: 'Urgent'   },
  { value: 'IMPORTANT', label: 'Penting'  },
  { value: 'NORMAL',    label: 'Normal'   },
];

// ── Helpers ────────────────────────────────────────────────
function priorityConfig(p: BulletinPriority) {
  return {
    URGENT:    { cls: 'bg-danger-light text-danger border-l-danger',     icon: AlertTriangle, label: 'Urgent'  },
    IMPORTANT: { cls: 'bg-warning-light text-warning border-l-warning',  icon: Info,          label: 'Penting' },
    NORMAL:    { cls: 'bg-gray-100 text-gray-500 border-l-gray-300',     icon: Info,          label: 'Normal'  },
  }[p];
}

function categoryLabel(c: BulletinCategory) {
  return {
    ANNOUNCEMENT: 'Pengumuman', HOLIDAY: 'Hari Libur',
    MAINTENANCE: 'Pemeliharaan', EVENT: 'Event', GENERAL: 'Umum',
  }[c];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ── Main Page ──────────────────────────────────────────────
export default function BulletinPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = (user?.role?.level ?? 99) <= 2;

  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [meta,      setMeta]      = useState<Meta | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const [category,     setCategory]     = useState<BulletinCategory | 'ALL'>('ALL');
  const [searchInput,  setSearchInput]  = useState('');
  const [search,       setSearch]       = useState('');
  const [showDrafts,   setShowDrafts]   = useState(false);

  const [selected, setSelected] = useState<Bulletin | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Bulletin | null>(null);

  const fetchBulletins = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { limit: '50' };
      if (category !== 'ALL') params.category = category;
      if (search)             params.search   = search;
      if (isAdmin && showDrafts) params.isPublished = 'false';

      const res = await api.get('/bulletins', { params });
      setBulletins(res.data.data ?? []);
      setMeta(res.data.meta ?? null);
    } catch {
      setError('Gagal memuat bulletin.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBulletins(); }, [category, search, showDrafts]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus bulletin ini?')) return;
    try {
      await api.delete(`/bulletins/${id}`);
      if (selected?.id === id) setSelected(null);
      fetchBulletins();
    } catch { /* ignore */ }
  };

  const handleTogglePublish = async (b: Bulletin) => {
    try {
      await api.patch(`/bulletins/${b.id}`, { isPublished: !b.isPublished });
      fetchBulletins();
    } catch { /* ignore */ }
  };

  const openDetail = async (b: Bulletin) => {
    setSelected(b);
    // Refresh from API so isRead is accurate (auto mark-as-read happens server-side)
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Bulletin</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {meta ? `${meta.total} bulletin` : 'Papan pengumuman'}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => { setEditItem(null); setShowForm(true); }}
              className="flex items-center gap-1.5 h-9 px-3 bg-navy text-white text-sm font-medium rounded hover:bg-navy-light transition-colors"
            >
              <Plus size={15} /> Buat
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari bulletin..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-sm border border-gray-300 rounded bg-white placeholder:text-gray-400 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy-50"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 flex-wrap mb-3">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setCategory(tab.value)}
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
        </div>

        {/* Admin: draft toggle */}
        {isAdmin && (
          <button
            onClick={() => setShowDrafts((p) => !p)}
            className={cn(
              'flex items-center gap-1.5 text-xs mb-3 self-start px-2.5 py-1 rounded transition-colors',
              showDrafts ? 'bg-warning-light text-warning' : 'text-gray-400 hover:text-gray-600',
            )}
          >
            {showDrafts ? <EyeOff size={12} /> : <Eye size={12} />}
            {showDrafts ? 'Tampilkan draft' : 'Tampilkan draft'}
          </button>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <SkeletonList />
          ) : error ? (
            <ErrorState message={error} onRetry={fetchBulletins} />
          ) : bulletins.length === 0 ? (
            <EmptyState isAdmin={isAdmin} onAdd={() => { setEditItem(null); setShowForm(true); }} />
          ) : (
            bulletins.map((b) => (
              <BulletinCard
                key={b.id}
                bulletin={b}
                isSelected={selected?.id === b.id}
                isAdmin={isAdmin}
                onClick={() => openDetail(b)}
                onEdit={() => { setEditItem(b); setShowForm(true); }}
                onDelete={() => handleDelete(b.id)}
                onTogglePublish={() => handleTogglePublish(b)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right: detail pane ── */}
      <div className="flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
        {selected ? (
          <DetailPane bulletin={selected} isAdmin={isAdmin}
            onEdit={() => { setEditItem(selected); setShowForm(true); }}
            onDelete={() => handleDelete(selected.id)}
            onTogglePublish={() => handleTogglePublish(selected)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Megaphone size={40} className="text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-600">Pilih bulletin untuk dibaca</p>
            <p className="text-xs text-gray-400 mt-1">Klik salah satu bulletin di sebelah kiri</p>
          </div>
        )}
      </div>

      {/* ── Form Modal ── */}
      {showForm && (
        <BulletinFormModal
          bulletin={editItem}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchBulletins(); }}
        />
      )}
    </div>
  );
}

// ── BulletinCard ───────────────────────────────────────────
function BulletinCard({ bulletin: b, isSelected, isAdmin, onClick, onEdit, onDelete, onTogglePublish }: {
  bulletin: Bulletin; isSelected: boolean; isAdmin: boolean;
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
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-400">{categoryLabel(b.category)}</span>
            {b.publishedAt && (
              <span className="text-xs text-gray-400">{formatDate(b.publishedAt)}</span>
            )}
            {!b.isPublished && (
              <span className="text-xs font-medium text-warning bg-warning-light px-1.5 py-0.5 rounded">
                Draft
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Admin actions */}
      {isAdmin && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); onTogglePublish(); }}
            className="p-1 rounded hover:bg-white/80 text-gray-400 hover:text-gray-700 transition-colors"
            title={b.isPublished ? 'Jadikan draft' : 'Publish'}
          >
            {b.isPublished ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1 rounded hover:bg-white/80 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <Edit2 size={13} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded hover:bg-white/80 text-gray-400 hover:text-danger transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── DetailPane ─────────────────────────────────────────────
function DetailPane({ bulletin: b, isAdmin, onEdit, onDelete, onTogglePublish }: {
  bulletin: Bulletin; isAdmin: boolean;
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
              <span>Oleh {b.author.fullName}</span>
              {b.publishedAt && (
                <span className="flex items-center gap-1">
                  <Calendar size={11} /> {formatDate(b.publishedAt)}
                </span>
              )}
              {b.isRead && (
                <span className="flex items-center gap-1 text-success">
                  <CheckCircle2 size={11} /> Sudah dibaca
                </span>
              )}
              <span>{b._count.readStatus} pembaca</span>
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={onTogglePublish}
                className="flex items-center gap-1.5 h-8 px-3 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors text-gray-600"
              >
                {b.isPublished ? <><EyeOff size={12} /> Unpublish</> : <><Eye size={12} /> Publish</>}
              </button>
              <button onClick={onEdit}
                className="h-8 px-3 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors text-gray-600"
              >
                <Edit2 size={12} />
              </button>
              <button onClick={onDelete}
                className="h-8 px-3 text-xs border border-danger/30 rounded hover:bg-danger-light transition-colors text-danger"
              >
                <Trash2 size={12} />
              </button>
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
            Berlaku hingga: {formatDate(b.expiresAt)}
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
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [title,     setTitle]     = useState(bulletin?.title      ?? '');
  const [content,   setContent]   = useState(bulletin?.content    ?? '');
  const [category,  setCategory]  = useState<BulletinCategory>(bulletin?.category ?? 'GENERAL');
  const [priority,  setPriority]  = useState<BulletinPriority>(bulletin?.priority ?? 'NORMAL');
  const [published, setPublished] = useState(bulletin?.isPublished ?? false);
  const [expiresAt, setExpiresAt] = useState(
    bulletin?.expiresAt ? bulletin.expiresAt.slice(0, 10) : '',
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim())   { setError('Judul wajib diisi'); return; }
    if (!content.trim()) { setError('Konten wajib diisi'); return; }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        category,
        priority,
        isPublished: published,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
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
        ?? 'Terjadi kesalahan';
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
            {isEdit ? 'Edit Bulletin' : 'Buat Bulletin'}
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
            <label className="block text-sm font-medium text-gray-700">Judul *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Judul bulletin..."
              className="w-full h-9 px-3 text-sm border border-gray-300 rounded bg-white placeholder:text-gray-400 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy-50"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Konten *</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)}
              placeholder="Isi pengumuman..."
              rows={8}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded bg-white placeholder:text-gray-400 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy-50 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Kategori</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as BulletinCategory)}
                className="w-full h-9 px-3 text-sm border border-gray-300 rounded bg-white focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy-50"
              >
                {CATEGORY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Prioritas</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as BulletinPriority)}
                className="w-full h-9 px-3 text-sm border border-gray-300 rounded bg-white focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy-50"
              >
                {PRIORITY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Berlaku hingga</label>
              <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full h-9 px-3 text-sm border border-gray-300 rounded bg-white focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy-50"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)}
                  className="w-4 h-4 accent-navy rounded"
                />
                <span className="text-sm text-gray-700">Publish sekarang</span>
              </label>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="h-9 px-4 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Batal
          </button>
          <button onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={loading}
            className="h-9 px-5 text-sm font-medium bg-navy text-white rounded hover:bg-navy-light disabled:opacity-60 transition-colors flex items-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Simpan' : 'Buat Bulletin'}
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

function EmptyState({ isAdmin, onAdd }: { isAdmin: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Megaphone size={36} className="text-gray-300 mb-3" />
      <p className="text-sm font-medium text-gray-600">Belum ada bulletin</p>
      <p className="text-xs text-gray-400 mt-1">Pengumuman dari manajemen akan tampil di sini.</p>
      {isAdmin && (
        <button onClick={onAdd}
          className="mt-4 flex items-center gap-1.5 h-8 px-4 text-sm font-medium text-white bg-navy rounded hover:bg-navy-light transition-colors"
        >
          <Plus size={14} /> Buat Bulletin
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
        Coba lagi
      </button>
    </div>
  );
}
