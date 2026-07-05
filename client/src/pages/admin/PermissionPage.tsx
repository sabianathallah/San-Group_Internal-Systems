import { useEffect, useState, useRef, FormEvent } from 'react';
import { Save, Loader2, ShieldCheck, AlertTriangle, Plus, Trash2, Edit2, Check, X, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/authStore';

// ── Types ─────────────────────────────────────────────────────
type Scope = 'none' | 'own' | 'division' | 'all';
type AudienceScope = 'none' | 'division' | 'all';

interface TaskPerms {
  view: Scope; create: boolean; edit: Scope; delete: Scope; viewPrivate: boolean;
}
interface BulletinPerms {
  view: boolean; create: boolean; audienceScope: AudienceScope; edit: Scope; delete: Scope;
}
interface DbLinkPerms {
  view: Scope; addLink: boolean; manageFolder: boolean; shareFolder: boolean;
}
interface NotePerms {
  view: Scope; create: boolean; edit: Scope; delete: Scope;
}
interface AnalyticsPerms { view: Scope; }
interface AuditLogPerms  { view: Scope; }
interface HrisPerms {
  reviewLeave: Scope; reviewOvertime: Scope; editAttendance: Scope;
  manageShifts: boolean; manageLocations: boolean; viewReports: Scope;
}
interface WorkOrderPerms {
  view: Scope; create: boolean; edit: Scope; delete: Scope;
}
interface UserMgmtPerms {
  create: boolean; edit: Scope; delete: Scope; toggleStatus: Scope;
}
interface RoleMgmtPerms {
  create: boolean; edit: Scope; delete: Scope;
}
interface DivisionMgmtPerms {
  create: boolean; edit: Scope; delete: Scope;
}
interface PermissionConfig {
  task: TaskPerms; bulletin: BulletinPerms; db_link: DbLinkPerms;
  note: NotePerms; analytics: AnalyticsPerms; audit_log: AuditLogPerms;
  hris: HrisPerms; work_order: WorkOrderPerms;
  user_mgmt: UserMgmtPerms; role_mgmt: RoleMgmtPerms; division_mgmt: DivisionMgmtPerms;
}

interface RoleWithPerms {
  id: string; name: string; slug: string; color: string; level: number;
  description: string | null;
  division: { id: string; name: string; color: string } | null;
  _count: { users: number };
  permissions: PermissionConfig;
  hasCustomPermissions: boolean;
}

// ── Role utilities ─────────────────────────────────────────────
const LEVEL_META: Record<number, { label: string; desc: string; bg: string; text: string }> = {
  1: { label: 'L1', desc: 'Full system access',          bg: 'bg-slate-100',   text: 'text-slate-700'   },
  2: { label: 'L2', desc: 'Organization leadership',    bg: 'bg-purple-100',  text: 'text-purple-700'  },
  3: { label: 'L3', desc: 'Operational management',     bg: 'bg-blue-100',    text: 'text-blue-700'    },
  4: { label: 'L4', desc: 'Division / department head', bg: 'bg-cyan-100',    text: 'text-cyan-700'    },
  5: { label: 'L5', desc: 'Unit / sub-division head',   bg: 'bg-emerald-100', text: 'text-emerald-700' },
  6: { label: 'L6', desc: 'Team member / staff',        bg: 'bg-gray-100',    text: 'text-gray-600'    },
};

const CUSTOM_LEVELS = [3, 4, 5, 6] as const;

const PRESET_COLORS = [
  '#1e293b','#7c3aed','#0369a1','#0891b2',
  '#059669','#6366f1','#dc2626','#ea580c',
  '#b45309','#15803d','#db2777','#0d9488',
];

function toSlug(name: string) {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function extractErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'An error occurred';
}

// ── Scope options ─────────────────────────────────────────────
const TASK_SCOPE_OPTS: { value: Scope; label: string }[] = [
  { value: 'none', label: 'None' }, { value: 'own', label: 'Own' },
  { value: 'division', label: 'Division' }, { value: 'all', label: 'All' },
];
const EDIT_SCOPE_OPTS: { value: Scope; label: string }[] = [
  { value: 'none', label: 'None' }, { value: 'own', label: 'Own' },
  { value: 'division', label: 'Division' }, { value: 'all', label: 'All' },
];
const AUDIENCE_SCOPE_OPTS: { value: AudienceScope; label: string }[] = [
  { value: 'none', label: 'None' }, { value: 'division', label: 'Own Division' }, { value: 'all', label: 'All' },
];
const VIEW_DB_SCOPE_OPTS: { value: Scope; label: string }[] = [
  { value: 'none', label: 'None' }, { value: 'division', label: 'Division' }, { value: 'all', label: 'All' },
];
const VIEW_SCOPE_OPTS: { value: Scope; label: string }[] = [
  { value: 'none', label: 'None' }, { value: 'own', label: 'Own' },
  { value: 'division', label: 'Division' }, { value: 'all', label: 'All' },
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
  onClose: () => void; onCreated: (id: string) => void;
}) {
  const [name,       setName]       = useState('');
  const [level,      setLevel]      = useState<number>(6);
  const [color,      setColor]      = useState('#6366f1');
  const [desc,       setDesc]       = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  const slug = toSlug(name);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Role name is required'); return; }
    if (!slug)        { setError('Name must contain at least one letter or number'); return; }
    setSaving(true); setError('');
    try {
      const res = await api.post('/roles', {
        name: name.trim(), slug, color, level,
        description: desc.trim() || undefined,
      });
      onCreated(res.data.data.id);
      onClose();
    } catch (err) {
      setError(extractErr(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Add Custom Role</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Role name</label>
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
                placeholder="e.g. Senior Engineer"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-navy"
              />
            </div>
            {slug && (
              <p className="text-[11px] text-gray-400 mt-1 ml-10 font-mono">slug: {slug}</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Hierarchy level</label>
            <div className="grid grid-cols-4 gap-2">
              {CUSTOM_LEVELS.map((l) => {
                const m = LEVEL_META[l];
                return (
                  <button key={l} type="button" onClick={() => setLevel(l)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2.5 rounded-lg border text-center transition-all',
                      level === l ? 'border-navy bg-navy/5 shadow-sm' : 'border-gray-200 hover:border-gray-300',
                    )}>
                    <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded-full', m.bg, m.text)}>
                      {m.label}
                    </span>
                    <span className="text-[10px] text-gray-400 leading-tight">{m.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1.5">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
              placeholder="Brief description of this role…"
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
              Cancel
            </button>
            <button type="submit" disabled={saving || !name.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-navy rounded-lg hover:bg-navy-light disabled:opacity-50">
              {saving && <Loader2 size={13} className="animate-spin" />}
              Create Role
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Role List Item (with inline edit) ─────────────────────────
function RoleListItem({ role, isSelected, canEdit, onClick, onUpdated, onDeleted }: {
  role: RoleWithPerms;
  isSelected: boolean;
  canEdit: boolean;
  onClick: () => void;
  onUpdated: (id: string, name: string, color: string) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing,    setEditing]    = useState(false);
  const [nameVal,    setNameVal]    = useState(role.name);
  const [colorVal,   setColorVal]   = useState(role.color);
  const [showPicker, setShowPicker] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [editErr,    setEditErr]    = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const meta = LEVEL_META[role.level] ?? LEVEL_META[6];
  const isDeletable = role.level > 1;
  const userCount   = role._count?.users ?? 0;

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setNameVal(role.name);
    setColorVal(role.color);
    setEditing(true);
    setEditErr('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function cancelEdit(e?: React.MouseEvent) {
    e?.stopPropagation();
    setEditing(false);
    setShowPicker(false);
    setEditErr('');
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!nameVal.trim()) { setEditErr('Name cannot be empty'); return; }
    setSaving(true); setEditErr('');
    try {
      await api.patch(`/roles/${role.id}`, { name: nameVal.trim(), color: colorVal });
      onUpdated(role.id, nameVal.trim(), colorVal);
      setEditing(false);
      setShowPicker(false);
    } catch (err) {
      setEditErr(extractErr(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (userCount > 0) {
      alert(`Cannot delete — ${userCount} user(s) are assigned to this role.`);
      return;
    }
    if (!confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/roles/${role.id}`);
      onDeleted(role.id);
    } catch (err) {
      alert(extractErr(err));
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <div className="px-3 py-2.5 bg-navy/5 border-l-2 border-navy">
        <form onSubmit={handleSave} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="relative flex-shrink-0">
              <button type="button" onClick={(e) => { e.stopPropagation(); setShowPicker((v) => !v); }}
                className="w-5 h-5 rounded-full ring-1 ring-gray-300 flex-shrink-0"
                style={{ backgroundColor: colorVal }} />
              {showPicker && (
                <ColorPicker value={colorVal} onChange={setColorVal} onClose={() => setShowPicker(false)} />
              )}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              className="flex-1 text-sm font-medium border-b border-navy outline-none bg-transparent min-w-0"
            />
          </div>
          {editErr && (
            <p className="text-[11px] text-red-500 mb-1">{editErr}</p>
          )}
          <div className="flex items-center gap-1">
            <button type="submit" disabled={saving}
              className="flex items-center gap-1 px-2 py-0.5 text-xs text-white bg-navy hover:bg-navy-light rounded disabled:opacity-50">
              {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
              Save
            </button>
            <button type="button" onClick={cancelEdit}
              className="px-2 py-0.5 text-xs text-gray-500 border border-gray-200 rounded hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'group w-full flex items-center gap-2 px-3 py-2.5 text-left cursor-pointer transition-colors',
        isSelected ? 'bg-navy/5 border-l-2 border-navy' : 'border-l-2 border-transparent hover:bg-gray-50',
      )}
    >
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: role.color }} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium truncate', isSelected ? 'text-navy' : 'text-gray-700')}>
          {role.name}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={cn('text-[10px] font-semibold px-1.5 py-0 rounded-full', meta.bg, meta.text)}>
            {meta.label}
          </span>
          {role.hasCustomPermissions && (
            <span className="w-1.5 h-1.5 rounded-full bg-info flex-shrink-0" title="Custom permissions" />
          )}
        </div>
      </div>
      {canEdit && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={startEdit}
            className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-navy hover:bg-navy/10"
            title="Edit name & color"
          >
            <Edit2 size={11} />
          </button>
          {isDeletable && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40"
              title={userCount > 0 ? `Cannot delete — ${userCount} user(s) assigned` : 'Delete role'}
            >
              {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Permission sub-components ─────────────────────────────────
function ScopeSelector<T extends string>({
  value, options, onChange, disabled,
}: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean;
}) {
  return (
    <div className="flex rounded-md overflow-hidden border border-gray-200">
      {options.map((opt) => (
        <button
          key={opt.value} type="button" disabled={disabled} onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1 text-xs font-medium transition-colors border-r border-gray-200 last:border-r-0',
            value === opt.value ? 'bg-navy text-white' : 'bg-white text-gray-600 hover:bg-gray-50',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
        checked ? 'bg-navy' : 'bg-gray-300',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span className={cn(
        'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
        checked ? 'translate-x-4.5' : 'translate-x-0.5',
      )} />
    </button>
  );
}

function PermRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-b-0">
      <span className="text-sm text-gray-700">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</h3>
      <div className="bg-gray-50 rounded-lg px-4 py-1">{children}</div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function PermissionPage() {
  const currentUser = useAuthStore((s) => s.user);
  const canEdit     = (currentUser?.role?.level ?? 99) <= 1;

  const [roles,      setRoles]      = useState<RoleWithPerms[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [perms,      setPerms]      = useState<PermissionConfig | null>(null);
  const [isDirty,    setIsDirty]    = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [toast,      setToast]      = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [addOpen,    setAddOpen]    = useState(false);

  async function loadRoles(selectId?: string) {
    setLoading(true);
    try {
      const res = await api.get('/permissions/roles');
      const data: RoleWithPerms[] = res.data.data ?? [];
      setRoles(data);
      const target = selectId
        ? data.find((r) => r.id === selectId)
        : data[0];
      if (target) {
        setSelectedId(target.id);
        setPerms(JSON.parse(JSON.stringify(target.permissions)));
        setIsDirty(false);
      }
    } catch {
      setError('Failed to load roles and permissions');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRoles(); }, []);

  function handleSelectRole(role: RoleWithPerms) {
    if (isDirty && !confirm('You have unsaved changes. Continue?')) return;
    setSelectedId(role.id);
    setPerms(JSON.parse(JSON.stringify(role.permissions)));
    setIsDirty(false);
  }

  function handleRoleUpdated(id: string, name: string, color: string) {
    setRoles((prev) => prev.map((r) => r.id === id ? { ...r, name, color } : r));
  }

  function handleRoleDeleted(id: string) {
    setRoles((prev) => {
      const next = prev.filter((r) => r.id !== id);
      if (selectedId === id) {
        const first = next[0];
        if (first) {
          setSelectedId(first.id);
          setPerms(JSON.parse(JSON.stringify(first.permissions)));
        } else {
          setSelectedId(null);
          setPerms(null);
        }
        setIsDirty(false);
      }
      return next;
    });
  }

  async function handleRoleCreated(newId: string) {
    await loadRoles(newId);
  }

  function update<K extends keyof PermissionConfig>(
    feature: K, field: keyof PermissionConfig[K], value: unknown,
  ) {
    if (!perms) return;
    setPerms((prev) => {
      if (!prev) return prev;
      return { ...prev, [feature]: { ...prev[feature], [field]: value } };
    });
    setIsDirty(true);
  }

  async function handleSave() {
    if (!selectedId || !perms) return;
    setSaving(true);
    try {
      await api.put(`/permissions/roles/${selectedId}`, perms);
      setRoles((prev) => prev.map((r) =>
        r.id === selectedId
          ? { ...r, permissions: JSON.parse(JSON.stringify(perms)), hasCustomPermissions: true }
          : r,
      ));
      setIsDirty(false);
      setToast('Permissions saved');
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast('Failed to save permissions');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  const selectedRole = roles.find((r) => r.id === selectedId);
  const isSuperAdmin = (selectedRole?.level ?? 99) <= 1;
  const isReadOnly   = !canEdit;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 flex-col gap-3">
        <AlertTriangle size={28} className="text-danger" />
        <p className="text-sm text-gray-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-56px-48px)] relative">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50 flex items-center gap-2">
          <ShieldCheck size={15} /> {toast}
        </div>
      )}

      {/* ── Left: role list ── */}
      <div className="w-60 flex-shrink-0 flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Roles</h2>
            <p className="text-xs text-gray-400 mt-0.5">Select to view permissions</p>
          </div>
          {canEdit && (
            <button
              onClick={() => setAddOpen(true)}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-navy/5 text-navy hover:bg-navy/10 transition-colors"
              title="Add custom role"
            >
              <Plus size={15} />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {roles.map((role) => (
            <RoleListItem
              key={role.id}
              role={role}
              isSelected={selectedId === role.id}
              canEdit={canEdit}
              onClick={() => handleSelectRole(role)}
              onUpdated={handleRoleUpdated}
              onDeleted={handleRoleDeleted}
            />
          ))}
        </div>
        <div className="px-3 py-2 border-t border-gray-100">
          <p className="text-[10px] text-gray-400 leading-relaxed">
            L1–L2 roles cannot be deleted. Custom roles can be deleted if no users are assigned.
          </p>
        </div>
      </div>

      {/* ── Right: permission editor ── */}
      <div className="flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
        {selectedRole && perms ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <span className="w-4 h-4 rounded-full" style={{ backgroundColor: selectedRole.color }} />
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">{selectedRole.name}</h2>
                  <p className="text-xs text-gray-400">
                    {LEVEL_META[selectedRole.level]?.label ?? `L${selectedRole.level}`} ·{' '}
                    {isSuperAdmin
                      ? 'Full access — cannot be configured'
                      : selectedRole.hasCustomPermissions
                        ? 'Custom permissions'
                        : 'Default permissions'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={!isDirty || saving || isSuperAdmin || isReadOnly}
                title={isReadOnly ? 'Only SuperAdmin can edit permissions' : undefined}
                className={cn(
                  'flex items-center gap-1.5 h-8 px-4 text-sm font-medium rounded transition-colors',
                  isDirty && !isSuperAdmin && !isReadOnly
                    ? 'bg-navy text-white hover:bg-navy-light'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed',
                )}
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save
              </button>
            </div>

            {isSuperAdmin && (
              <div className="mx-6 mt-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center gap-2">
                <ShieldCheck size={15} />
                SuperAdmin always has full permissions and cannot be configured.
              </div>
            )}

            {isReadOnly && !isSuperAdmin && (
              <div className="mx-6 mt-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex items-center gap-2">
                <ShieldCheck size={15} />
                Only SuperAdmin can modify permissions. You have view-only access.
              </div>
            )}

            {/* Permission matrix */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <Section title="Task">
                <PermRow label="View tasks">
                  <ScopeSelector value={perms.task.view} options={TASK_SCOPE_OPTS}
                    onChange={(v) => update('task', 'view', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Create tasks">
                  <Toggle checked={perms.task.create} onChange={(v) => update('task', 'create', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Edit tasks">
                  <ScopeSelector value={perms.task.edit} options={TASK_SCOPE_OPTS}
                    onChange={(v) => update('task', 'edit', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Delete tasks">
                  <ScopeSelector value={perms.task.delete} options={TASK_SCOPE_OPTS}
                    onChange={(v) => update('task', 'delete', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="View others' private tasks">
                  <Toggle checked={perms.task.viewPrivate} onChange={(v) => update('task', 'viewPrivate', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
              </Section>

              <Section title="Bulletin">
                <PermRow label="View bulletins">
                  <Toggle checked={perms.bulletin.view} onChange={(v) => update('bulletin', 'view', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Create & publish bulletins">
                  <Toggle checked={perms.bulletin.create} onChange={(v) => update('bulletin', 'create', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Target audience">
                  <ScopeSelector value={perms.bulletin.audienceScope} options={AUDIENCE_SCOPE_OPTS}
                    onChange={(v) => update('bulletin', 'audienceScope', v)}
                    disabled={isSuperAdmin || isReadOnly || !perms.bulletin.create} />
                </PermRow>
                <PermRow label="Edit bulletins">
                  <ScopeSelector value={perms.bulletin.edit} options={EDIT_SCOPE_OPTS}
                    onChange={(v) => update('bulletin', 'edit', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Delete bulletins">
                  <ScopeSelector value={perms.bulletin.delete} options={EDIT_SCOPE_OPTS}
                    onChange={(v) => update('bulletin', 'delete', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
              </Section>

              <Section title="DB Links">
                <PermRow label="View folders">
                  <ScopeSelector value={perms.db_link.view} options={VIEW_DB_SCOPE_OPTS}
                    onChange={(v) => update('db_link', 'view', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Add links to folders">
                  <Toggle checked={perms.db_link.addLink} onChange={(v) => update('db_link', 'addLink', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Manage folders (create/edit/delete)">
                  <Toggle checked={perms.db_link.manageFolder} onChange={(v) => update('db_link', 'manageFolder', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Share folders with other divisions">
                  <Toggle checked={perms.db_link.shareFolder} onChange={(v) => update('db_link', 'shareFolder', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
              </Section>

              <Section title="Notes">
                <PermRow label="View notes">
                  <ScopeSelector value={perms.note?.view ?? 'own'} options={TASK_SCOPE_OPTS}
                    onChange={(v) => update('note', 'view', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Create notes">
                  <Toggle checked={perms.note?.create ?? true} onChange={(v) => update('note', 'create', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Edit notes">
                  <ScopeSelector value={perms.note?.edit ?? 'own'} options={EDIT_SCOPE_OPTS}
                    onChange={(v) => update('note', 'edit', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Delete notes">
                  <ScopeSelector value={perms.note?.delete ?? 'own'} options={EDIT_SCOPE_OPTS}
                    onChange={(v) => update('note', 'delete', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
              </Section>

              <Section title="Analytics">
                <PermRow label="View analytics">
                  <ScopeSelector value={perms.analytics?.view ?? 'none'} options={VIEW_SCOPE_OPTS}
                    onChange={(v) => update('analytics', 'view', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
              </Section>

              <Section title="Audit Log">
                <PermRow label="View audit log">
                  <ScopeSelector value={perms.audit_log?.view ?? 'none'} options={VIEW_SCOPE_OPTS}
                    onChange={(v) => update('audit_log', 'view', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
              </Section>

              <Section title="HRIS">
                <PermRow label="Review leave requests">
                  <ScopeSelector value={perms.hris?.reviewLeave ?? 'none'} options={VIEW_DB_SCOPE_OPTS}
                    onChange={(v) => update('hris', 'reviewLeave', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Review overtime requests">
                  <ScopeSelector value={perms.hris?.reviewOvertime ?? 'none'} options={VIEW_DB_SCOPE_OPTS}
                    onChange={(v) => update('hris', 'reviewOvertime', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Edit attendance records">
                  <ScopeSelector value={perms.hris?.editAttendance ?? 'none'} options={VIEW_DB_SCOPE_OPTS}
                    onChange={(v) => update('hris', 'editAttendance', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Manage shifts">
                  <Toggle checked={perms.hris?.manageShifts ?? false} onChange={(v) => update('hris', 'manageShifts', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Manage office locations">
                  <Toggle checked={perms.hris?.manageLocations ?? false} onChange={(v) => update('hris', 'manageLocations', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="View attendance reports">
                  <ScopeSelector value={perms.hris?.viewReports ?? 'none'} options={VIEW_SCOPE_OPTS}
                    onChange={(v) => update('hris', 'viewReports', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
              </Section>

              <Section title="Work Orders">
                <PermRow label="View work orders">
                  <ScopeSelector value={perms.work_order?.view ?? 'own'} options={TASK_SCOPE_OPTS}
                    onChange={(v) => update('work_order', 'view', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Create work orders">
                  <Toggle checked={perms.work_order?.create ?? true} onChange={(v) => update('work_order', 'create', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Edit work orders">
                  <ScopeSelector value={perms.work_order?.edit ?? 'own'} options={EDIT_SCOPE_OPTS}
                    onChange={(v) => update('work_order', 'edit', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Delete work orders">
                  <ScopeSelector value={perms.work_order?.delete ?? 'own'} options={EDIT_SCOPE_OPTS}
                    onChange={(v) => update('work_order', 'delete', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
              </Section>

              <Section title="User Management">
                <PermRow label="Create users">
                  <Toggle checked={perms.user_mgmt?.create ?? false} onChange={(v) => update('user_mgmt', 'create', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Edit users">
                  <ScopeSelector value={perms.user_mgmt?.edit ?? 'none'} options={VIEW_DB_SCOPE_OPTS}
                    onChange={(v) => update('user_mgmt', 'edit', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Activate / deactivate users">
                  <ScopeSelector value={perms.user_mgmt?.toggleStatus ?? 'none'} options={VIEW_DB_SCOPE_OPTS}
                    onChange={(v) => update('user_mgmt', 'toggleStatus', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Delete users">
                  <ScopeSelector value={perms.user_mgmt?.delete ?? 'none'} options={VIEW_DB_SCOPE_OPTS}
                    onChange={(v) => update('user_mgmt', 'delete', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
              </Section>

              <Section title="Role Management">
                <PermRow label="Create roles">
                  <Toggle checked={perms.role_mgmt?.create ?? false} onChange={(v) => update('role_mgmt', 'create', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Edit roles">
                  <ScopeSelector value={perms.role_mgmt?.edit ?? 'none'} options={VIEW_DB_SCOPE_OPTS}
                    onChange={(v) => update('role_mgmt', 'edit', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Delete roles">
                  <ScopeSelector value={perms.role_mgmt?.delete ?? 'none'} options={VIEW_DB_SCOPE_OPTS}
                    onChange={(v) => update('role_mgmt', 'delete', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
              </Section>

              <Section title="Division Management">
                <PermRow label="Create divisions">
                  <Toggle checked={perms.division_mgmt?.create ?? false} onChange={(v) => update('division_mgmt', 'create', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Edit divisions">
                  <ScopeSelector value={perms.division_mgmt?.edit ?? 'none'} options={VIEW_DB_SCOPE_OPTS}
                    onChange={(v) => update('division_mgmt', 'edit', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label="Delete divisions">
                  <ScopeSelector value={perms.division_mgmt?.delete ?? 'none'} options={VIEW_DB_SCOPE_OPTS}
                    onChange={(v) => update('division_mgmt', 'delete', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
              </Section>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <ShieldCheck size={40} className="text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-600">Select a role to configure permissions</p>
          </div>
        )}
      </div>

      {addOpen && (
        <AddRoleModal onClose={() => setAddOpen(false)} onCreated={handleRoleCreated} />
      )}
    </div>
  );
}
