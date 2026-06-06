import { useEffect, useState, useCallback, FormEvent } from 'react';
import {
  Folder, FolderOpen, Plus, ChevronRight, Loader2,
  X, Edit2, Trash2, ExternalLink, Search, FileText,
  AlertCircle, Share2, ShieldCheck,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/cn';

// ── Types ──────────────────────────────────────────────────
interface DbFolder {
  id:          string;
  name:        string;
  icon:        string | null;
  color:       string;
  description: string | null;
  position:    number;
  divisionId:  string | null;
  createdAt:   string;
  createdBy:   { id: string; fullName: string };
  division:    { id: string; name: string; color: string } | null;
  _count:      { links: number };
}

interface ShareEntry {
  id: string; resourceType: string; resourceId: string;
  targetType: string; targetId: string;
  grantedBy: { id: string; fullName: string };
  createdAt: string;
}

interface DivisionOption { id: string; name: string; color: string }

interface DbLink {
  id:          string;
  title:       string;
  url:         string;
  description: string | null;
  position:    number;
  createdAt:   string;
  createdBy:   { id: string; fullName: string };
}

// ── Helpers ────────────────────────────────────────────────
const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#64748b'];

function extractErr(err: unknown): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Terjadi kesalahan';
}

// ── Folder Modal ───────────────────────────────────────────
function FolderModal({ folder, onClose, onSaved }: {
  folder?: DbFolder; onClose: () => void; onSaved: (f: DbFolder) => void;
}) {
  const [name,  setName]  = useState(folder?.name  ?? '');
  const [color, setColor] = useState(folder?.color ?? '#6366f1');
  const [desc,  setDesc]  = useState(folder?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Nama folder wajib diisi'); return; }
    setSaving(true); setError('');
    try {
      const payload = { name: name.trim(), icon: null, color, description: desc.trim() || null };
      const res = folder
        ? await api.patch(`/db-folders/${folder.id}`, payload)
        : await api.post('/db-folders', payload);
      onSaved(res.data.data);
      onClose();
    } catch (err) { setError(extractErr(err)); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">{folder ? 'Edit Folder' : 'Folder Baru'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nama folder</label>
            <input autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="contoh: Dokumen HRD"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-navy" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Deskripsi (opsional)</label>
            <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
              placeholder="Keterangan singkat…"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-navy" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-2">Warna</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={cn('w-6 h-6 rounded-full transition-all', color === c && 'ring-2 ring-offset-1 ring-gray-500')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Batal</button>
            <button type="submit" disabled={saving || !name.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-navy rounded-lg hover:bg-navy-light disabled:opacity-50">
              {saving && <Loader2 size={13} className="animate-spin" />}{folder ? 'Simpan' : 'Buat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Link Modal ─────────────────────────────────────────────
function LinkModal({ link, folderId, onClose, onSaved }: {
  link?: DbLink; folderId: string; onClose: () => void; onSaved: (l: DbLink) => void;
}) {
  const [title, setTitle] = useState(link?.title ?? '');
  const [url,   setUrl]   = useState(link?.url   ?? '');
  const [desc,  setDesc]  = useState(link?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Nama wajib diisi'); return; }
    if (!url.trim())   { setError('Link/URL wajib diisi'); return; }
    setSaving(true); setError('');
    try {
      const payload = { title: title.trim(), url: url.trim(), description: desc.trim() || undefined, folderId };
      const res = link
        ? await api.patch(`/db-links/${link.id}`, { title: title.trim(), url: url.trim(), description: desc.trim() || null })
        : await api.post('/db-links', payload);
      onSaved(res.data.data);
      onClose();
    } catch (err) { setError(extractErr(err)); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">{link ? 'Edit Link' : 'Tambah Link'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nama tampilan</label>
            <input autoFocus type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="contoh: Rekap Absensi Juni"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-navy" />
            <p className="text-[10px] text-gray-400 mt-1">Nama inilah yang ditampilkan, bukan URL-nya</p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Link / URL</label>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://drive.google.com/…"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-navy" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Keterangan (opsional)</label>
            <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
              placeholder="Deskripsi singkat…"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-navy" />
          </div>
          {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Batal</button>
            <button type="submit" disabled={saving || !title.trim() || !url.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-navy rounded-lg hover:bg-navy-light disabled:opacity-50">
              {saving && <Loader2 size={13} className="animate-spin" />}{link ? 'Simpan' : 'Tambah'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Share Modal ────────────────────────────────────────────
function ShareModal({ folder, onClose }: { folder: DbFolder; onClose: () => void }) {
  const [shares,    setShares]    = useState<ShareEntry[]>([]);
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [selDiv,    setSelDiv]    = useState('');
  const [loading,   setLoading]   = useState(true);
  const [adding,    setAdding]    = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => {
    Promise.all([
      api.get(`/shares/db_folder/${folder.id}`),
      api.get('/divisions'),
    ]).then(([s, d]) => {
      setShares(s.data.data ?? []);
      setDivisions(d.data.data ?? []);
    }).catch(() => setError('Gagal memuat data'))
      .finally(() => setLoading(false));
  }, [folder.id]);

  async function handleAdd() {
    if (!selDiv) return;
    setAdding(true); setError('');
    try {
      const res = await api.post(`/shares/db_folder/${folder.id}`, {
        targetType: 'division', targetId: selDiv,
      });
      setShares((prev) => [...prev, res.data.data]);
      setSelDiv('');
    } catch (err) {
      setError(extractErr(err));
    } finally { setAdding(false); }
  }

  async function handleRevoke(share: ShareEntry) {
    try {
      await api.delete(`/shares/db_folder/${folder.id}`, {
        data: { targetType: share.targetType, targetId: share.targetId },
      });
      setShares((prev) => prev.filter((s) => s.id !== share.id));
    } catch { /* silent */ }
  }

  const availableDivisions = divisions.filter(
    (d) => !shares.some((s) => s.targetType === 'division' && s.targetId === d.id),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Bagikan Folder</h2>
            <p className="text-xs text-gray-400 mt-0.5">{folder.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Add share */}
          <div className="flex gap-2">
            <select value={selDiv} onChange={(e) => setSelDiv(e.target.value)}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-navy">
              <option value="">Pilih divisi…</option>
              {availableDivisions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <button onClick={handleAdd} disabled={!selDiv || adding}
              className="px-3 py-2 text-sm text-white bg-navy rounded-lg hover:bg-navy-light disabled:opacity-50 flex items-center gap-1.5">
              {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Bagikan
            </button>
          </div>

          {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{error}</p>}

          {/* Current shares */}
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-gray-300" /></div>
          ) : shares.length === 0 ? (
            <div className="text-center py-6">
              <ShieldCheck size={28} className="text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Folder belum dibagikan ke divisi lain</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-xs text-gray-500 font-medium mb-2">Dibagikan ke:</p>
              {shares.map((s) => {
                const div = divisions.find((d) => d.id === s.targetId);
                return (
                  <div key={s.id} className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      {div && (
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: div.color }} />
                      )}
                      <span className="text-sm text-gray-700">{div?.name ?? s.targetId}</span>
                    </div>
                    <button onClick={() => handleRevoke(s)}
                      className="text-gray-300 hover:text-red-500 p-1 rounded transition-colors">
                      <X size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function DatabasePage() {
  const { user } = useAuthStore();
  const isAdmin = (user?.role?.level ?? 99) <= 2;

  const [folders,        setFolders]        = useState<DbFolder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [activeFolder,   setActiveFolder]   = useState<DbFolder | null>(null);
  const [links,          setLinks]          = useState<DbLink[]>([]);
  const [loadingLinks,   setLoadingLinks]   = useState(false);
  const [search,         setSearch]         = useState('');
  const [folderModal,    setFolderModal]    = useState<{ open: boolean; folder?: DbFolder }>({ open: false });
  const [linkModal,      setLinkModal]      = useState<{ open: boolean; link?: DbLink }>({ open: false });
  const [shareFolder,    setShareFolder]    = useState<DbFolder | null>(null);

  const loadFolders = useCallback(async () => {
    setLoadingFolders(true);
    try {
      const res = await api.get('/db-folders');
      setFolders(res.data.data ?? []);
    } catch { /* silent */ } finally { setLoadingFolders(false); }
  }, []);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  const loadLinks = useCallback(async (folderId: string) => {
    setLoadingLinks(true);
    try {
      const res = await api.get(`/db-folders/${folderId}/links`);
      setLinks(res.data.data ?? []);
    } catch { /* silent */ } finally { setLoadingLinks(false); }
  }, []);

  useEffect(() => { if (activeFolder) loadLinks(activeFolder.id); }, [activeFolder, loadLinks]);

  const filteredLinks = search
    ? links.filter((l) =>
        l.title.toLowerCase().includes(search.toLowerCase()) ||
        (l.description ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : links;

  function handleFolderSaved(f: DbFolder) {
    setFolders((prev) => {
      const idx = prev.findIndex((x) => x.id === f.id);
      return idx >= 0 ? prev.map((x) => x.id === f.id ? f : x) : [...prev, f];
    });
    if (activeFolder?.id === f.id) setActiveFolder(f);
  }

  async function handleDeleteFolder(folder: DbFolder) {
    if (!confirm(`Hapus folder "${folder.name}"? Semua link di dalamnya ikut terhapus.`)) return;
    try {
      await api.delete(`/db-folders/${folder.id}`);
      setFolders((prev) => prev.filter((f) => f.id !== folder.id));
      if (activeFolder?.id === folder.id) setActiveFolder(null);
    } catch { /* silent */ }
  }

  function handleLinkSaved(l: DbLink) {
    const isNew = !links.find((x) => x.id === l.id);
    setLinks((prev) => {
      const idx = prev.findIndex((x) => x.id === l.id);
      return idx >= 0 ? prev.map((x) => x.id === l.id ? l : x) : [...prev, l];
    });
    if (isNew) {
      setFolders((pf) => pf.map((f) =>
        f.id === activeFolder?.id ? { ...f, _count: { links: f._count.links + 1 } } : f
      ));
    }
  }

  async function handleDeleteLink(link: DbLink) {
    if (!confirm(`Hapus "${link.title}"?`)) return;
    try {
      await api.delete(`/db-links/${link.id}`);
      setLinks((prev) => prev.filter((l) => l.id !== link.id));
      setFolders((prev) => prev.map((f) =>
        f.id === activeFolder?.id ? { ...f, _count: { links: Math.max(0, f._count.links - 1) } } : f
      ));
    } catch { /* silent */ }
  }

  // ── Folder grid view ──────────────────────────────────────
  if (!activeFolder) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Database Links</h1>
            <p className="text-sm text-gray-500 mt-0.5">Direktori akses cepat — klik folder untuk membuka</p>
          </div>
          {isAdmin && (
            <button onClick={() => setFolderModal({ open: true })}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-navy hover:bg-navy-light rounded-lg transition-colors">
              <Plus size={15} /> Folder Baru
            </button>
          )}
        </div>

        {loadingFolders ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-gray-300" />
          </div>
        ) : folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
            <Folder size={40} className="text-gray-200" />
            <p className="text-sm">Belum ada folder</p>
            {isAdmin && (
              <button onClick={() => setFolderModal({ open: true })}
                className="text-xs text-navy hover:underline flex items-center gap-1">
                <Plus size={12} /> Buat folder pertama
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {folders.map((folder) => (
              <div key={folder.id} className="group relative">
                <button
                  onClick={() => setActiveFolder(folder)}
                  className="w-full flex flex-col items-center gap-3 p-5 bg-white border border-gray-100 rounded-xl hover:border-gray-300 hover:shadow-md transition-all"
                >
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${folder.color}18` }}>
                    <Folder size={30} style={{ color: folder.color }} />
                  </div>
                  <div className="w-full text-center space-y-0.5">
                    <p className="text-sm font-medium text-gray-800 truncate">{folder.name}</p>
                    <p className="text-[11px] text-gray-400">{folder._count.links} item</p>
                  </div>
                </button>
                {isAdmin && (
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); setShareFolder(folder); }}
                      className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-info shadow-sm"
                      title="Bagikan folder">
                      <Share2 size={11} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setFolderModal({ open: true, folder }); }}
                      className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-navy shadow-sm">
                      <Edit2 size={11} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }}
                      className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-red-500 shadow-sm">
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}
                {/* Division badge */}
                {folder.division && (
                  <div className="absolute bottom-2 left-2">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium"
                      style={{ backgroundColor: folder.division.color }}
                    >
                      {folder.division.name}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {folderModal.open && (
          <FolderModal folder={folderModal.folder}
            onClose={() => setFolderModal({ open: false })} onSaved={handleFolderSaved} />
        )}
        {shareFolder && (
          <ShareModal folder={shareFolder} onClose={() => setShareFolder(null)} />
        )}
      </div>
    );
  }

  // ── Folder contents view ──────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <button onClick={() => { setActiveFolder(null); setSearch(''); setLinks([]); }}
            className="text-sm text-gray-500 hover:text-navy transition-colors">
            Database Links
          </button>
          <ChevronRight size={13} className="text-gray-300 flex-shrink-0" />
          <div className="flex items-center gap-2">
            <FolderOpen size={16} style={{ color: activeFolder.color }} />
            <span className="text-sm font-semibold text-gray-900">{activeFolder.name}</span>
          </div>
          {activeFolder.description && (
            <span className="text-xs text-gray-400 hidden sm:block">— {activeFolder.description}</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Cari…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-7 pr-6 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-navy w-32" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X size={11} /></button>}
          </div>
          <button onClick={() => setLinkModal({ open: true })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-navy hover:bg-navy-light rounded-lg transition-colors">
            <Plus size={13} /> Tambah Link
          </button>
        </div>
      </div>

      {/* Link list */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        {loadingLinks ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-gray-300" />
          </div>
        ) : filteredLinks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
            <FileText size={32} className="text-gray-200" />
            <p className="text-sm">{search ? 'Tidak ada hasil' : 'Folder ini masih kosong'}</p>
            {!search && (
              <button onClick={() => setLinkModal({ open: true })}
                className="text-xs text-navy hover:underline flex items-center gap-1 mt-1">
                <Plus size={12} /> Tambah link pertama
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filteredLinks.map((link, idx) => (
              <div key={link.id} className="group flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/70 transition-colors">
                <span className="text-xs text-gray-300 w-5 text-right flex-shrink-0 tabular-nums">{idx + 1}</span>

                {/* Clickable name — hides the URL */}
                <a href={link.url} target="_blank" rel="noopener noreferrer"
                  className="flex-1 min-w-0 group/link" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-800 group-hover/link:text-navy transition-colors truncate">
                      {link.title}
                    </span>
                    <ExternalLink size={11}
                      className="text-gray-300 group-hover/link:text-navy flex-shrink-0 opacity-0 group-hover/link:opacity-100 transition-all" />
                  </div>
                  {link.description && (
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{link.description}</p>
                  )}
                </a>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] text-gray-300 hidden sm:block">{link.createdBy.fullName}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setLinkModal({ open: true, link })}
                      className="p-1.5 text-gray-400 hover:text-navy hover:bg-navy/5 rounded-lg">
                      <Edit2 size={12} />
                    </button>
                    {(isAdmin || link.createdBy.id === user?.id) && (
                      <button onClick={() => handleDeleteLink(link)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!loadingLinks && filteredLinks.length > 0 && (
        <p className="text-xs text-gray-400 text-right">{filteredLinks.length} item</p>
      )}

      {linkModal.open && (
        <LinkModal link={linkModal.link} folderId={activeFolder.id}
          onClose={() => setLinkModal({ open: false })} onSaved={handleLinkSaved} />
      )}
    </div>
  );
}
