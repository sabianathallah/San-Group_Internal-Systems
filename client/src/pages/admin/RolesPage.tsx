import { useEffect, useState, FormEvent } from 'react';
import {
  Shield, Plus, X, Edit2, Trash2, Loader2, AlertCircle,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';

// ── Types ──────────────────────────────────────────────────
interface DivisionOption {
  id: string; name: string; slug: string; color: string;
}

interface Role {
  id:         string;
  name:       string;
  slug:       string;
  color:      string;
  level:      number;
  division?:  DivisionOption | null;
  _count?:    { users: number };
}

// ── Level badge ────────────────────────────────────────────
const LEVEL_LABELS: Record<number, string> = {
  1: 'Management',
  2: 'Management',
  3: 'Director',
  4: 'Manager',
  5: 'Supervisor',
  6: 'Staff',
};

const LEVEL_COLORS: Record<number, string> = {
  1: 'bg-purple-100 text-purple-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-violet-100 text-violet-700',
  4: 'bg-cyan-100 text-cyan-700',
  5: 'bg-amber-100 text-amber-700',
  6: 'bg-gray-100 text-gray-600',
};

function LevelBadge({ level }: { level: number }) {
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', LEVEL_COLORS[level] ?? 'bg-gray-100 text-gray-600')}>
      L{level} · {LEVEL_LABELS[level] ?? 'Unknown'}
    </span>
  );
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
interface RoleForm {
  name:       string;
  slug:       string;
  color:      string;
  level:      number;
  divisionId: string;
}

const EMPTY_FORM: RoleForm = { name: '', slug: '', color: '#334155', level: 6, divisionId: '' };

function slugify(str: string) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
}

function RoleModal({
  open, role, divisions, onClose, onSaved,
}: {
  open:      boolean;
  role:      Role | null;
  divisions: DivisionOption[];
  onClose:   () => void;
  onSaved:   (r: Role) => void;
}) {
  const [form, setForm]     = useState<RoleForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (role) {
      setForm({
        name:       role.name,
        slug:       role.slug,
        color:      role.color,
        level:      role.level,
        divisionId: role.division?.id ?? '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, role]);

  function handleNameChange(name: string) {
    setForm((f) => ({ ...f, name, slug: role ? f.slug : slugify(name) }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Nama wajib diisi'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        name:       form.name.trim(),
        slug:       form.slug.trim() || slugify(form.name),
        color:      form.color,
        level:      form.level,
        divisionId: form.divisionId || undefined,
      };
      let res;
      if (role) {
        res = await api.patch(`/roles/${role.id}`, payload);
      } else {
        res = await api.post('/roles', payload);
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
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-sm font-semibold text-gray-800">
            {role ? 'Edit Role' : 'Tambah Role'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nama <span className="text-red-500">*</span></label>
            <input
              autoFocus type="text" value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Finance Manager"
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-navy"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Slug</label>
            <input
              type="text" value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="finance-manager"
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-navy"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Level</label>
              <select
                value={form.level}
                onChange={(e) => setForm((f) => ({ ...f, level: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-navy"
              >
                {[1, 2, 3, 4, 5, 6].map((l) => (
                  <option key={l} value={l}>L{l} · {LEVEL_LABELS[l]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Divisi</label>
              <select
                value={form.divisionId}
                onChange={(e) => setForm((f) => ({ ...f, divisionId: e.target.value }))}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-navy"
              >
                <option value="">— Tidak terkait —</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Warna</label>
            <ColorPicker value={form.color} onChange={(c) => setForm((f) => ({ ...f, color: c }))} />
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
              {role ? 'Simpan' : 'Buat Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirm ─────────────────────────────────────────
function DeleteConfirm({
  role, onCancel, onConfirm, loading,
}: {
  role: Role; onCancel: () => void; onConfirm: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-sm p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">Hapus Role</h3>
        <p className="text-sm text-gray-600">
          Hapus role <strong>{role.name}</strong>? Tindakan ini tidak dapat dibatalkan.
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
export default function RolesPage() {
  const [roles,     setRoles]     = useState<Role[]>([]);
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<Role | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const [deleteError,  setDeleteError]  = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const [rolesRes, divsRes] = await Promise.all([
        api.get('/roles'),
        api.get('/divisions'),
      ]);
      setRoles(rolesRes.data.data ?? []);
      setDivisions(divsRes.data.data ?? []);
    } catch {
      setError('Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() { setEditing(null); setModalOpen(true); }
  function openEdit(r: Role) { setEditing(r); setModalOpen(true); }

  function handleSaved(saved: Role) {
    setRoles((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [saved, ...prev];
    });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true); setDeleteError('');
    try {
      await api.delete(`/roles/${deleteTarget.id}`);
      setRoles((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setDeleteError(msg ?? 'Gagal menghapus role');
    } finally {
      setDeleting(false);
    }
  }

  // Sort roles by level then name
  const sorted = [...roles].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Manajemen Role</h1>
          <p className="text-sm text-gray-500 mt-0.5">Kelola role dan level jabatan organisasi</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-navy hover:bg-navy-light rounded transition-colors"
        >
          <Plus size={15} /> Tambah Role
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
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Shield size={40} className="text-gray-200 mb-3" />
            <p className="text-sm text-gray-500">Belum ada role</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-10">Warna</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Slug</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Divisi</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Users</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((r) => {
                const userCount = r._count?.users ?? 0;
                return (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span
                        className="inline-block w-5 h-5 rounded-md border border-gray-100"
                        style={{ backgroundColor: r.color }}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{r.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.slug}</td>
                    <td className="px-4 py-3"><LevelBadge level={r.level} /></td>
                    <td className="px-4 py-3">
                      {r.division ? (
                        <span
                          className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: r.division.color + '26',
                            color: r.division.color,
                          }}
                        >
                          {r.division.name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{userCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(r)}
                          title="Edit role"
                          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-navy hover:bg-navy-50 transition-colors"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => { setDeleteError(''); setDeleteTarget(r); }}
                          disabled={userCount > 0}
                          title={userCount > 0 ? 'Tidak dapat dihapus — masih ada user' : 'Hapus role'}
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

      <RoleModal
        open={modalOpen}
        role={editing}
        divisions={divisions}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />

      {deleteTarget && (
        <DeleteConfirm
          role={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}
    </div>
  );
}
