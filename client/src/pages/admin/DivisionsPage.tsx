import { useEffect, useState, FormEvent } from 'react';
import {
  Layers, Plus, X, Edit2, Trash2, Loader2, AlertCircle,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';

// ── Types ──────────────────────────────────────────────────
interface Division {
  id:          string;
  name:        string;
  slug:        string;
  color:       string;
  description: string | null;
  _count?:     { users: number; roles: number };
}

// ── Color Picker ───────────────────────────────────────────
const PRESET_COLORS = [
  '#1e3a5f','#334155','#7c3aed','#b45309','#15803d',
  '#dc2626','#64748b','#0891b2','#16a34a','#ea580c',
  '#2563eb','#db2777','#4f46e5','#0d9488','#7c2d12',
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={cn(
              'w-6 h-6 rounded-full transition-all flex-shrink-0',
              value === c && 'ring-2 ring-offset-1 ring-gray-500 scale-110',
            )}
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span
          className="w-6 h-6 rounded-full border border-gray-200 flex-shrink-0"
          style={{ backgroundColor: value }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
          }}
          placeholder="#000000"
          className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:border-navy font-mono"
          maxLength={7}
        />
      </div>
    </div>
  );
}

// ── Form Modal ─────────────────────────────────────────────
interface DivForm {
  name: string; slug: string; color: string; description: string;
}

const EMPTY_FORM: DivForm = { name: '', slug: '', color: '#1e3a5f', description: '' };

function slugify(str: string) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
}

function DivisionModal({
  open, division, onClose, onSaved,
}: {
  open:     boolean;
  division: Division | null;
  onClose:  () => void;
  onSaved:  (d: Division) => void;
}) {
  const [form, setForm]   = useState<DivForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (division) {
      setForm({ name: division.name, slug: division.slug, color: division.color, description: division.description ?? '' });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, division]);

  function handleNameChange(name: string) {
    setForm((f) => ({ ...f, name, slug: division ? f.slug : slugify(name) }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Nama wajib diisi'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        name:        form.name.trim(),
        slug:        form.slug.trim() || slugify(form.name),
        color:       form.color,
        description: form.description.trim() || undefined,
      };
      let res;
      if (division) {
        res = await api.patch(`/divisions/${division.id}`, payload);
      } else {
        res = await api.post('/divisions', payload);
      }
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
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-800">
            {division ? 'Edit Divisi' : 'Tambah Divisi'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nama <span className="text-red-500">*</span></label>
            <input
              autoFocus type="text" value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Finance"
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-navy"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Slug</label>
            <input
              type="text" value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="finance"
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-navy"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Warna</label>
            <ColorPicker value={form.color} onChange={(c) => setForm((f) => ({ ...f, color: c }))} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Deskripsi</label>
            <textarea
              rows={2} value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Deskripsi singkat divisi…"
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-navy resize-none"
            />
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-500">
              <AlertCircle size={12} /> {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50">
              Batal
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-navy hover:bg-navy-light rounded disabled:opacity-50">
              {saving && <Loader2 size={13} className="animate-spin" />}
              {division ? 'Simpan' : 'Buat Divisi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirm ─────────────────────────────────────────
function DeleteConfirm({
  division, onCancel, onConfirm, loading,
}: {
  division: Division; onCancel: () => void; onConfirm: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-sm p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">Hapus Divisi</h3>
        <p className="text-sm text-gray-600">
          Hapus divisi <strong>{division.name}</strong>? Tindakan ini tidak dapat dibatalkan.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50">
            Batal
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded disabled:opacity-50">
            {loading && <Loader2 size={13} className="animate-spin" />}
            Hapus
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function DivisionsPage() {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<Division | null>(null);

  const [deleteTarget,  setDeleteTarget]  = useState<Division | null>(null);
  const [deleting,      setDeleting]      = useState(false);
  const [deleteError,   setDeleteError]   = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const res = await api.get('/divisions');
      setDivisions(res.data.data ?? []);
    } catch {
      setError('Gagal memuat divisi.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() { setEditing(null); setModalOpen(true); }
  function openEdit(d: Division) { setEditing(d); setModalOpen(true); }

  function handleSaved(saved: Division) {
    setDivisions((prev) => {
      const idx = prev.findIndex((d) => d.id === saved.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [saved, ...prev];
    });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true); setDeleteError('');
    try {
      await api.delete(`/divisions/${deleteTarget.id}`);
      setDivisions((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setDeleteError(msg ?? 'Gagal menghapus divisi');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Manajemen Divisi</h1>
          <p className="text-sm text-gray-500 mt-0.5">Kelola divisi organisasi SAN Group</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-navy hover:bg-navy-light rounded transition-colors"
        >
          <Plus size={15} /> Tambah Divisi
        </button>
      </div>

      {deleteError && (
        <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          <AlertCircle size={14} /> {deleteError}
          <button onClick={() => setDeleteError('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gray-300" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle size={32} className="text-red-400 mb-3" />
            <p className="text-sm text-gray-600">{error}</p>
            <button onClick={load} className="mt-3 px-4 py-1.5 text-sm text-navy border border-navy rounded">
              Coba lagi
            </button>
          </div>
        ) : divisions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Layers size={40} className="text-gray-200 mb-3" />
            <p className="text-sm text-gray-500">Belum ada divisi</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-10">Warna</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Slug</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Users</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Roles</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {divisions.map((d) => {
                const userCount = d._count?.users ?? 0;
                const roleCount = d._count?.roles ?? 0;
                return (
                  <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span
                        className="inline-block w-5 h-5 rounded-md border border-gray-100"
                        style={{ backgroundColor: d.color }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-800">{d.name}</p>
                        {d.description && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{d.description}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{d.slug}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-600">{userCount} user{userCount !== 1 ? 's' : ''}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-600">{roleCount} role{roleCount !== 1 ? 's' : ''}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(d)}
                          title="Edit divisi"
                          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-navy hover:bg-navy-50 transition-colors"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => { setDeleteError(''); setDeleteTarget(d); }}
                          disabled={userCount > 0}
                          title={userCount > 0 ? 'Tidak dapat dihapus — masih ada user' : 'Hapus divisi'}
                          className={cn(
                            'w-7 h-7 flex items-center justify-center rounded transition-colors',
                            userCount > 0
                              ? 'text-gray-200 cursor-not-allowed'
                              : 'text-gray-400 hover:text-red-500 hover:bg-red-50',
                          )}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <DivisionModal
        open={modalOpen}
        division={editing}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />

      {deleteTarget && (
        <DeleteConfirm
          division={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}
    </div>
  );
}
