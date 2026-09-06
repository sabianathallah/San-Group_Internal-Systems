import { useEffect, useState, useRef, FormEvent } from 'react';
import {
  Shield, Edit2, Check, Loader2, AlertCircle, Users, ChevronRight, Plus, Trash2, X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
const LEVEL_META_STYLE: Record<number, { bg: string; text: string }> = {
  1: { bg: 'bg-slate-100',   text: 'text-slate-700'   },
  2: { bg: 'bg-purple-100',  text: 'text-purple-700'  },
  3: { bg: 'bg-blue-100',    text: 'text-blue-700'    },
  4: { bg: 'bg-cyan-100',    text: 'text-cyan-700'    },
  5: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  6: { bg: 'bg-gray-100',    text: 'text-gray-600'    },
};

function levelMeta(t: TFunction, level: number): { label: string; desc: string; bg: string; text: string } {
  const style = LEVEL_META_STYLE[level] ?? LEVEL_META_STYLE[6];
  return {
    label: t(`admin.roles.levels.l${level}.label`),
    desc: t(`admin.roles.levels.l${level}.desc`),
    ...style,
  };
}

const CUSTOM_LEVELS = [3, 4, 5, 6] as const;

const PRESET_COLORS = [
  '#1e293b','#7c3aed','#0369a1','#0891b2',
  '#059669','#6366f1','#dc2626','#ea580c',
  '#b45309','#15803d','#db2777','#0d9488',
];

function toSlug(name: string) {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function extractErr(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

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
    <div ref={ref} className="absolute z-50 top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-3 w-52">
      <div className="grid grid-cols-6 gap-1.5 mb-2">
        {PRESET_COLORS.map((c) => (
          <button key={c} type="button" onClick={() => { onChange(c); onClose(); }}
            className={cn('w-6 h-6 rounded-full transition-all', value === c && 'ring-2 ring-offset-1 ring-gray-500 scale-110')}
            style={{ backgroundColor: c }} />
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

// ── Add Role Modal ─────────────────────────────────────────────
function AddRoleModal({ onClose, onCreated }: {
  onClose: () => void; onCreated: (r: Role) => void;
}) {
  const { t } = useTranslation();
  const [name,    setName]    = useState('');
  const [level,   setLevel]   = useState<number>(6);
  const [color,   setColor]   = useState('#6366f1');
  const [desc,    setDesc]    = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const slug = toSlug(name);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError(t('admin.roles.addModal.errors.nameRequired')); return; }
    if (!slug)        { setError(t('admin.roles.addModal.errors.invalidName')); return; }
    setSaving(true); setError('');
    try {
      const res = await api.post('/roles', {
        name:        name.trim(),
        slug,
        color,
        level,
        description: desc.trim() || undefined,
      });
      onCreated(res.data.data);
      onClose();
    } catch (err) {
      setError(extractErr(err, t('admin.roles.addModal.errors.generic')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">{t('admin.roles.addModal.title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Name + Color */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">{t('admin.roles.addModal.roleNameLabel')}</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-shrink-0">
                <button type="button" onClick={() => setShowPicker((v) => !v)}
                  className="w-8 h-8 rounded-full border-2 border-white shadow-sm ring-1 ring-gray-200 transition-transform hover:scale-110"
                  style={{ backgroundColor: color }} />
                {showPicker && (
                  <ColorPicker value={color} onChange={setColor} onClose={() => setShowPicker(false)} />
                )}
              </div>
              <input
                autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder={t('admin.roles.addModal.namePlaceholder')}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-navy"
              />
            </div>
            {slug && (
              <p className="text-[11px] text-gray-400 mt-1 ml-10 font-mono">{t('admin.roles.addModal.slugPrefix', { slug })}</p>
            )}
          </div>

          {/* Level */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">{t('admin.roles.addModal.hierarchyLevelLabel')}</label>
            <div className="grid grid-cols-4 gap-2">
              {CUSTOM_LEVELS.map((l) => {
                const m = levelMeta(t, l);
                return (
                  <button
                    key={l} type="button"
                    onClick={() => setLevel(l)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2.5 rounded-lg border text-center transition-all',
                      level === l
                        ? 'border-navy bg-navy/5 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300',
                    )}
                  >
                    <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded-full', m.bg, m.text)}>
                      {m.label}
                    </span>
                    <span className="text-[10px] text-gray-400 leading-tight">{m.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">
              {t('admin.roles.addModal.descriptionLabel')} <span className="text-gray-400 font-normal">{t('admin.roles.addModal.optional')}</span>
            </label>
            <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
              placeholder={t('admin.roles.addModal.descriptionPlaceholder')}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-navy"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle size={12} />{error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              {t('admin.roles.addModal.cancel')}
            </button>
            <button type="submit" disabled={saving || !name.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-navy rounded-lg hover:bg-navy-light disabled:opacity-50">
              {saving && <Loader2 size={13} className="animate-spin" />}
              {t('admin.roles.addModal.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Role Card ─────────────────────────────────────────────────
function RoleCard({ role, onUpdated, onDeleted }: {
  role: Role; onUpdated: (r: Role) => void; onDeleted: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [editing,    setEditing]    = useState(false);
  const [nameVal,    setNameVal]    = useState(role.name);
  const [colorVal,   setColorVal]   = useState(role.color);
  const [showPicker, setShowPicker] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [error,      setError]      = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const meta = levelMeta(t, role.level);
  const userCount = role._count?.users ?? 0;

  // L1 (SuperAdmin) is protected — cannot be deleted
  const isDeletable = role.level > 1;

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
    if (!nameVal.trim()) { setError(t('admin.roles.nameEmptyError')); return; }
    setSaving(true); setError('');
    try {
      const res = await api.patch(`/roles/${role.id}`, { name: nameVal.trim(), color: colorVal });
      onUpdated(res.data.data);
      setEditing(false);
      setShowPicker(false);
    } catch (err) {
      setError(extractErr(err, t('admin.roles.addModal.errors.generic')));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(t('admin.roles.confirmDelete', { name: role.name }))) return;
    setDeleting(true);
    try {
      await api.delete(`/roles/${role.id}`);
      onDeleted(role.id);
    } catch (err) {
      alert(extractErr(err, t('admin.roles.addModal.errors.generic')));
      setDeleting(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow">
      <div className="h-1.5 w-full" style={{ backgroundColor: role.color }} />

      <div className="p-5">
        {/* Level badge + user count */}
        <div className="flex items-center justify-between mb-3">
          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', meta.bg, meta.text)}>
            {meta.label}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Users size={11} />
            {t('admin.roles.userCount', { count: userCount })}
          </span>
        </div>

        {/* Name row */}
        {editing ? (
          <form onSubmit={save} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-shrink-0">
                <button type="button" onClick={() => setShowPicker((v) => !v)}
                  className="w-6 h-6 rounded-full border-2 border-white shadow-sm ring-1 ring-gray-200 transition-transform hover:scale-110"
                  style={{ backgroundColor: colorVal }} />
                {showPicker && (
                  <ColorPicker value={colorVal} onChange={setColorVal} onClose={() => setShowPicker(false)} />
                )}
              </div>
              <input
                ref={inputRef} type="text" value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                className="flex-1 text-sm font-semibold border-b border-navy outline-none bg-transparent"
              />
            </div>
            {error && (
              <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={10} />{error}</p>
            )}
            <div className="flex items-center gap-1 pt-1">
              <button type="submit" disabled={saving}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-white bg-navy hover:bg-navy-light rounded disabled:opacity-50">
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                {t('admin.roles.save')}
              </button>
              <button type="button" onClick={cancelEdit}
                className="px-2.5 py-1 text-xs text-gray-500 border border-gray-200 rounded hover:bg-gray-50">
                {t('admin.roles.cancel')}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: role.color }} />
              <p className="text-sm font-semibold text-gray-800 truncate">{role.name}</p>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button onClick={startEdit}
                className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-navy hover:bg-navy/5 transition-colors"
                title={t('admin.roles.editTitle')}>
                <Edit2 size={12} />
              </button>
              {isDeletable && (
                <button onClick={handleDelete} disabled={deleting}
                  className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                  title={userCount > 0 ? t('admin.roles.cannotDeleteTitle', { count: userCount }) : t('admin.roles.deleteTitle')}>
                  {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
              )}
            </div>
          </div>
        )}

        {!editing && (
          <p className="text-xs text-gray-400 mt-1.5 ml-5">
            {role.description ?? meta.desc}
          </p>
        )}

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
          <span className="text-xs px-2.5 py-0.5 rounded-full font-medium text-white" style={{ backgroundColor: r.color }}>
            {r.name}
          </span>
          {i < sorted.length - 1 && <ChevronRight size={12} className="text-gray-300" />}
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function RolesPage() {
  const { t } = useTranslation();
  const [roles,    setRoles]    = useState<Role[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [addOpen,  setAddOpen]  = useState(false);

  async function load() {
    setLoading(true); setError('');
    try {
      const res = await api.get('/roles');
      setRoles(res.data.data ?? []);
    } catch {
      setError(t('admin.roles.loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function handleUpdated(updated: Role) {
    setRoles((prev) => prev.map((r) => r.id === updated.id ? { ...r, ...updated } : r));
  }

  function handleCreated(role: Role) {
    setRoles((prev) => [...prev, role].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)));
  }

  function handleDeleted(id: string) {
    setRoles((prev) => prev.filter((r) => r.id !== id));
  }

  const sorted = [...roles].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">{t('admin.roles.pageTitle')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {t('admin.roles.pageSubtitle')}
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-navy hover:bg-navy-light rounded-lg transition-colors"
        >
          <Plus size={15} /> {t('admin.roles.addRole')}
        </button>
      </div>

      {/* Hierarchy strip */}
      {!loading && roles.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-6">
          <p className="text-xs text-gray-400 font-medium mb-2 uppercase tracking-wider">{t('admin.roles.hierarchyTitle')}</p>
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
            {t('admin.roles.tryAgain')}
          </button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Shield size={40} className="text-gray-200 mb-3" />
          <p className="text-sm text-gray-500">{t('admin.roles.noRolesYet')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((r) => (
            <RoleCard key={r.id} role={r} onUpdated={handleUpdated} onDeleted={handleDeleted} />
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-gray-400">
        {t('admin.roles.footerNote')}
      </p>

      {addOpen && (
        <AddRoleModal onClose={() => setAddOpen(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
