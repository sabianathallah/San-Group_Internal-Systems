import { useEffect, useState, useCallback, FormEvent } from 'react';
import {
  Database, Plus, Search, X, ExternalLink,
  Trash2, Edit2, Loader2, AlertCircle, Link2,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/cn';

// ── Types ──────────────────────────────────────────────────
type Division =
  | 'MANAGEMENT' | 'RETAIL' | 'HOTEL' | 'HOUSING' | 'FNB' | 'GENERAL'
  | 'LEASING' | 'PROPERTY' | 'ENGINEERING'
  | 'FINANCE' | 'LEGAL' | 'TAX' | 'HR' | 'GA';

interface DbLink {
  id:          string;
  title:       string;
  description: string | null;
  url:         string;
  category:    string;
  division:    Division;
  icon:        string | null;
  position:    number;
  createdAt:   string;
  createdBy:   { id: string; fullName: string };
}

// ── Constants ──────────────────────────────────────────────
const DIVISIONS: Division[] = [
  'MANAGEMENT','RETAIL','HOTEL','HOUSING','FNB','GENERAL',
  'LEASING','PROPERTY','ENGINEERING',
  'FINANCE','LEGAL','TAX','HR','GA',
];

const DIVISION_LABELS: Record<Division, string> = {
  MANAGEMENT:  'Manajemen',
  RETAIL:      'Retail',
  HOTEL:       'Hotel & Ballroom',
  HOUSING:     'Housing',
  FNB:         'F&B',
  GENERAL:     'General',
  LEASING:     'Leasing',
  PROPERTY:    'Property',
  ENGINEERING: 'Engineering',
  FINANCE:     'Finance',
  LEGAL:       'Legal',
  TAX:         'Tax',
  HR:          'HR',
  GA:          'General Affairs',
};

const DIVISION_COLORS: Record<Division, string> = {
  MANAGEMENT:  'bg-navy/10 text-navy',
  RETAIL:      'bg-teal-100 text-teal-700',
  HOTEL:       'bg-violet-100 text-violet-700',
  HOUSING:     'bg-sky-100 text-sky-700',
  FNB:         'bg-rose-100 text-rose-700',
  GENERAL:     'bg-gray-100 text-gray-600',
  LEASING:     'bg-emerald-100 text-emerald-700',
  PROPERTY:    'bg-cyan-100 text-cyan-700',
  ENGINEERING: 'bg-orange-100 text-orange-700',
  FINANCE:     'bg-green-100 text-green-700',
  LEGAL:       'bg-purple-100 text-purple-700',
  TAX:         'bg-indigo-100 text-indigo-700',
  HR:          'bg-pink-100 text-pink-700',
  GA:          'bg-yellow-100 text-yellow-700',
};

const SUGGESTED_CATEGORIES = [
  'Database', 'System', 'Dashboard', 'Tool', 'Report', 'Documentation', 'API', 'Monitoring',
];

const ICON_OPTIONS = [
  '🗄️','📊','📋','🔧','📁','🌐','📈','💼','🔗','📝','⚙️','🏢','📌','🔍','💡','🖥️',
];

// ── Helpers ────────────────────────────────────────────────
function hostname(url: string) {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
}

function groupByCategory(links: DbLink[]): Map<string, DbLink[]> {
  const map = new Map<string, DbLink[]>();
  for (const link of links) {
    const arr = map.get(link.category) ?? [];
    arr.push(link);
    map.set(link.category, arr);
  }
  return map;
}

// ── Form Modal ─────────────────────────────────────────────
interface FormState {
  title:       string;
  description: string;
  url:         string;
  category:    string;
  customCat:   string;
  division:    Division | '';
  icon:        string;
}

const EMPTY_FORM: FormState = {
  title: '', description: '', url: '', category: '', customCat: '', division: '', icon: '',
};

function LinkFormModal({
  open, link, onClose, onSaved,
}: {
  open:    boolean;
  link:    DbLink | null;
  onClose: () => void;
  onSaved: (l: DbLink) => void;
}) {
  const [form, setForm]     = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (!open) return;
    if (link) {
      const isCustom = !SUGGESTED_CATEGORIES.includes(link.category);
      setForm({
        title:       link.title,
        description: link.description ?? '',
        url:         link.url,
        category:    isCustom ? '__custom__' : link.category,
        customCat:   isCustom ? link.category : '',
        division:    link.division,
        icon:        link.icon ?? '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError('');
  }, [open, link]);

  function resolvedCategory() {
    return form.category === '__custom__' ? form.customCat.trim() : form.category;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const cat = resolvedCategory();
    if (!form.title.trim())   { setError('Judul tidak boleh kosong'); return; }
    if (!form.url.trim())     { setError('URL tidak boleh kosong'); return; }
    if (!cat)                 { setError('Pilih atau masukkan kategori'); return; }
    if (!form.division)       { setError('Pilih divisi'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        title:       form.title.trim(),
        description: form.description.trim() || undefined,
        url:         form.url.trim(),
        category:    cat,
        division:    form.division,
        icon:        form.icon || undefined,
      };
      const res = link
        ? await api.patch(`/db-links/${link.id}`, payload)
        : await api.post('/db-links', payload);
      onSaved(res.data.data);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-lg flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-sm font-semibold text-gray-800">
            {link ? 'Edit Link' : 'Tambah DB Link'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-4">
          {/* Icon picker */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Ikon <span className="font-normal text-gray-400">(opsional)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, icon: '' }))}
                className={cn(
                  'w-8 h-8 text-xs flex items-center justify-center rounded border',
                  !form.icon ? 'border-navy bg-navy-50 text-navy' : 'border-gray-200 text-gray-400 hover:border-gray-300',
                )}
              >
                —
              </button>
              {ICON_OPTIONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, icon: ic }))}
                  className={cn(
                    'w-8 h-8 text-base flex items-center justify-center rounded border transition-colors',
                    form.icon === ic ? 'border-navy bg-navy-50' : 'border-gray-200 hover:border-gray-300',
                  )}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Judul <span className="text-danger">*</span>
            </label>
            <input
              type="text" maxLength={100} placeholder="Nama sistem / database..."
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy"
            />
          </div>

          {/* URL */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              URL <span className="text-danger">*</span>
            </label>
            <input
              type="url" placeholder="https://..."
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Deskripsi <span className="font-normal text-gray-400">(opsional)</span>
            </label>
            <textarea
              rows={2} maxLength={300} placeholder="Keterangan singkat..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Kategori <span className="text-danger">*</span>
            </label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value, customCat: '' }))}
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-navy"
            >
              <option value="">-- Pilih kategori --</option>
              {SUGGESTED_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="__custom__">Lainnya (isi manual)</option>
            </select>
            {form.category === '__custom__' && (
              <input
                type="text" maxLength={50} placeholder="Tulis kategori..."
                value={form.customCat}
                onChange={(e) => setForm((f) => ({ ...f, customCat: e.target.value }))}
                className="mt-2 w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy"
              />
            )}
          </div>

          {/* Division */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Divisi <span className="text-danger">*</span>
            </label>
            <select
              value={form.division}
              onChange={(e) => setForm((f) => ({ ...f, division: e.target.value as Division }))}
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-navy"
            >
              <option value="">-- Pilih divisi --</option>
              {DIVISIONS.map((d) => (
                <option key={d} value={d}>{DIVISION_LABELS[d]}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-danger">
              <AlertCircle size={12} /> {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
            <button
              type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-navy hover:bg-navy-light rounded disabled:opacity-50"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {link ? 'Simpan' : 'Tambah Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Link Card ──────────────────────────────────────────────
function LinkCard({
  link, userId, isAdmin, onEdit, onDelete,
}: {
  link:    DbLink;
  userId:  string;
  isAdmin: boolean;
  onEdit:  (l: DbLink) => void;
  onDelete:(id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const canEdit = isAdmin || link.createdBy.id === userId;

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation(); e.preventDefault();
    if (!confirm(`Hapus link "${link.title}"?`)) return;
    setDeleting(true);
    try {
      await api.delete(`/db-links/${link.id}`);
      onDelete(link.id);
    } catch { setDeleting(false); }
  }

  return (
    <div className="group relative bg-white border border-gray-200 rounded-lg p-4 hover:border-navy/30 hover:shadow-sm transition-all flex flex-col gap-2">
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-lg">
          {link.icon ?? <Link2 size={16} className="text-gray-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{link.title}</p>
          {link.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{link.description}</p>
          )}
        </div>
      </div>

      {/* URL chip */}
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-1.5 text-xs text-navy hover:text-navy-light group/link w-fit max-w-full"
      >
        <ExternalLink size={11} className="flex-shrink-0" />
        <span className="truncate">{hostname(link.url)}</span>
      </a>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 mt-auto">
        <span className={cn(
          'inline-block text-xs px-2 py-0.5 rounded-full font-medium',
          DIVISION_COLORS[link.division],
        )}>
          {link.division}
        </span>

        {/* Actions — admin or creator */}
        {canEdit && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(link); }}
              className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-navy hover:bg-navy-50 transition-colors"
            >
              <Edit2 size={12} />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-danger hover:bg-danger/10 transition-colors"
            >
              {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function DatabasePage() {
  const user    = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const [links, setLinks]     = useState<DbLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [divFilter, setDivFilter] = useState<Division | ''>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<DbLink | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchLinks = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params: Record<string, string> = {};
      if (debouncedSearch) params.search   = debouncedSearch;
      if (divFilter)       params.division = divFilter;
      const res = await api.get('/db-links', { params });
      setLinks(res.data.data);
    } catch {
      setError('Gagal memuat data. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, divFilter]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  function handleSaved(saved: DbLink) {
    setLinks((prev) => {
      const idx = prev.findIndex((l) => l.id === saved.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [...prev, saved];
    });
  }

  function handleDeleted(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  // Group by category for display
  const grouped = groupByCategory(links);
  const categories = Array.from(grouped.keys()).sort();

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">DB Links</h1>
          <p className="text-sm text-gray-500 mt-0.5">Direktori akses cepat ke sistem & database internal</p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-navy hover:bg-navy-light rounded transition-colors"
        >
          <Plus size={15} />
          Tambah Link
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" placeholder="Cari link..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-8 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy w-56"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Division filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setDivFilter('')}
            className={cn(
              'px-2.5 py-1 text-xs rounded border transition-colors',
              divFilter === ''
                ? 'bg-navy text-white border-navy'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
            )}
          >
            Semua Divisi
          </button>
          {DIVISIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDivFilter(divFilter === d ? '' : d)}
              className={cn(
                'px-2.5 py-1 text-xs rounded border transition-colors',
                divFilter === d
                  ? 'bg-navy text-white border-navy'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
              )}
            >
              {d}
            </button>
          ))}
        </div>

        {links.length > 0 && (
          <span className="ml-auto text-xs text-gray-400">{links.length} link</span>
        )}
      </div>

      {/* States */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle size={32} className="text-danger mb-3" />
          <p className="text-sm text-gray-600">{error}</p>
          <button
            onClick={fetchLinks}
            className="mt-3 px-4 py-1.5 text-sm text-navy border border-navy rounded hover:bg-navy-50"
          >
            Coba lagi
          </button>
        </div>
      )}

      {!loading && !error && links.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Database size={40} className="text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-600">
            {debouncedSearch || divFilter ? 'Tidak ada link yang cocok' : 'Belum ada link'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {debouncedSearch || divFilter
              ? 'Coba ubah filter pencarian'
              : 'Klik "Tambah Link" untuk menambahkan link pertama'}
          </p>
        </div>
      )}

      {/* Grouped by category */}
      {!loading && !error && links.length > 0 && (
        <div className="space-y-8">
          {categories.map((cat) => {
            const catLinks = grouped.get(cat) ?? [];
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{cat}</h2>
                  <div className="flex-1 border-t border-gray-100" />
                  <span className="text-xs text-gray-400">{catLinks.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {catLinks.map((link) => (
                    <LinkCard
                      key={link.id}
                      link={link}
                      userId={user?.id ?? ''}
                      isAdmin={isAdmin}
                      onEdit={(l) => { setEditing(l); setModalOpen(true); }}
                      onDelete={handleDeleted}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <LinkFormModal
        open={modalOpen}
        link={editing}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
