import { useEffect, useState, useRef, FormEvent } from 'react';
import {
  Shield, Edit2, Check, X, Loader2, AlertCircle, Users, ChevronRight,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';

// ── Types ─────────────────────────────────────────────────────
interface Role {
  id:          string;
  name:        string;
  slug:        string;
  color:       string;
  level:       number;
  description: string | null;
  _count?:     { users: number };
}

// ── Constants ─────────────────────────────────────────────────
const LEVEL_META: Record<number, { label: string; desc: string; bg: string; text: string }> = {
  1: { label: 'L1', desc: 'Akses penuh sistem',          bg: 'bg-slate-100',  text: 'text-slate-700' },
  2: { label: 'L2', desc: 'Pimpinan organisasi',         bg: 'bg-purple-100', text: 'text-purple-700' },
  3: { label: 'L3', desc: 'Manajemen operasional',       bg: 'bg-blue-100',   text: 'text-blue-700' },
  4: { label: 'L4', desc: 'Kepala divisi/departemen',    bg: 'bg-cyan-100',   text: 'text-cyan-700' },
  5: { label: 'L5', desc: 'Kepala unit/sub-divisi',      bg: 'bg-emerald-100',text: 'text-emerald-700' },
  6: { label: 'L6', desc: 'Anggota tim / staf',          bg: 'bg-gray-100',   text: 'text-gray-600' },
};

const PRESET_COLORS = [
  '#1e293b','#7c3aed','#0369a1','#0891b2',
  '#059669','#6366f1','#dc2626','#ea580c',
  '#b45309','#15803d','#db2777','#0d9488',
];

// ── Color Picker ──────────────────────────────────────────────
function ColorPicker({ value, onChange, onClose }: {
  value: string; onChange: (c: string) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-3 w-52"
    >
      <div className="grid grid-cols-6 gap-1.5 mb-2">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => { onChange(c); onClose(); }}
            className={cn(
              'w-6 h-6 rounded-full transition-all',
              value === c && 'ring-2 ring-offset-1 ring-gray-500 scale-110',
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
        <span className="w-5 h-5 rounded-full border border-gray-200 flex-shrink-0" style={{ backgroundColor: value }} />
        <input
          type="text" value={value}
          onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) onChange(e.target.value); }}
          className="flex-1 text-xs border border-gray-200 rounded px-1.5 py-0.5 font-mono focus:outline-none focus:border-navy"
          maxLength={7}
        />
      </div>
    </div>
  );
}

// ── Role Card ─────────────────────────────────────────────────
function RoleCard({ role, onUpdated }: { role: Role; onUpdated: (r: Role) => void }) {
  const [editing,       setEditing]       = useState(false);
  const [nameVal,       setNameVal]       = useState(role.name);
  const [colorVal,      setColorVal]      = useState(role.color);
  const [showPicker,    setShowPicker]    = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const meta = LEVEL_META[role.level] ?? LEVEL_META[6];
  const userCount = role._count?.users ?? 0;

  function startEdit() {
    setNameVal(role.name);
    setColorVal(role.color);
    setEditing(true);
    setError('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function cancelEdit() {
    setEditing(false);
    setError('');
    setShowPicker(false);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!nameVal.trim()) { setError('Nama tidak boleh kosong'); return; }
    setSaving(true); setError('');
    try {
      const res = await api.patch(`/roles/${role.id}`, {
        name:  nameVal.trim(),
        color: colorVal,
      });
      onUpdated(res.data.data);
      setEditing(false);
      setShowPicker(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow">
      {/* Top color bar */}
      <div className="h-1.5 w-full" style={{ backgroundColor: role.color }} />

      <div className="p-5">
        {/* Level badge + user count */}
        <div className="flex items-center justify-between mb-3">
          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', meta.bg, meta.text)}>
            {meta.label}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Users size={11} />
            {userCount} user
          </span>
        </div>

        {/* Name row */}
        {editing ? (
          <form onSubmit={save} className="space-y-2">
            <div className="flex items-center gap-2">
              {/* Color dot (clickable) */}
              <div className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPicker((v) => !v)}
                  className="w-6 h-6 rounded-full border-2 border-white shadow-sm ring-1 ring-gray-200 transition-transform hover:scale-110"
                  style={{ backgroundColor: colorVal }}
                />
                {showPicker && (
                  <ColorPicker
                    value={colorVal}
                    onChange={setColorVal}
                    onClose={() => setShowPicker(false)}
                  />
                )}
              </div>
              <input
                ref={inputRef}
                type="text"
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                className="flex-1 text-sm font-semibold border-b border-navy outline-none bg-transparent"
              />
            </div>
            {error && (
              <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={10} />{error}</p>
            )}
            <div className="flex items-center gap-1 pt-1">
              <button
                type="submit" disabled={saving}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-white bg-navy hover:bg-navy-light rounded disabled:opacity-50"
              >
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                Simpan
              </button>
              <button
                type="button" onClick={cancelEdit}
                className="px-2.5 py-1 text-xs text-gray-500 border border-gray-200 rounded hover:bg-gray-50"
              >
                Batal
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: role.color }}
              />
              <p className="text-sm font-semibold text-gray-800 truncate">{role.name}</p>
            </div>
            <button
              onClick={startEdit}
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-navy hover:bg-navy-50 transition-colors"
              title="Edit nama & warna"
            >
              <Edit2 size={12} />
            </button>
          </div>
        )}

        {/* Description */}
        {!editing && (
          <p className="text-xs text-gray-400 mt-1.5 ml-5">
            {role.description ?? meta.desc}
          </p>
        )}

        {/* Slug */}
        {!editing && (
          <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
            <code className="text-xs text-gray-400 font-mono">{role.slug}</code>
            <ChevronRight size={12} className="text-gray-300" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Hierarchy Visualization ───────────────────────────────────
function HierarchyLine({ roles }: { roles: Role[] }) {
  const sorted = [...roles].sort((a, b) => a.level - b.level);
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {sorted.map((r, i) => (
        <div key={r.id} className="flex items-center gap-1">
          <span
            className="text-xs px-2.5 py-0.5 rounded-full font-medium text-white"
            style={{ backgroundColor: r.color }}
          >
            {r.name}
          </span>
          {i < sorted.length - 1 && (
            <ChevronRight size={12} className="text-gray-300" />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function RolesPage() {
  const [roles,   setRoles]   = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const res = await api.get('/roles');
      setRoles(res.data.data ?? []);
    } catch {
      setError('Gagal memuat data role.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function handleUpdated(updated: Role) {
    setRoles((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
  }

  const sorted = [...roles].sort((a, b) => a.level - b.level);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Manajemen Role</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          6 role hierarkis organisasi — klik ikon edit untuk mengubah nama atau warna
        </p>
      </div>

      {/* Hierarchy strip */}
      {!loading && roles.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-6">
          <p className="text-xs text-gray-400 font-medium mb-2 uppercase tracking-wider">Hierarki</p>
          <HierarchyLine roles={roles} />
        </div>
      )}

      {/* Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-gray-300" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle size={32} className="text-red-400 mb-3" />
          <p className="text-sm text-gray-600">{error}</p>
          <button onClick={load} className="mt-3 px-4 py-1.5 text-sm text-navy border border-navy rounded">
            Coba lagi
          </button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Shield size={40} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-500">Belum ada role</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((r) => (
            <RoleCard key={r.id} role={r} onUpdated={handleUpdated} />
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-gray-400">
        Role bersifat sistem dan tidak dapat ditambah atau dihapus. Anda hanya dapat mengubah nama dan warna.
      </p>
    </div>
  );
}
