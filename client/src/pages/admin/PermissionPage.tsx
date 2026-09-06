import { useEffect, useState, useRef, FormEvent } from 'react';
import { Save, Loader2, ShieldCheck, AlertTriangle, Plus, Trash2, Edit2, Check, X, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  reviewLeave: Scope; editAttendance: Scope;
  manageShifts: boolean; manageLocations: boolean; viewReports: Scope;
}
interface WorkOrderPerms {
  view: Scope; create: boolean; edit: Scope; delete: Scope; canBeAssignee: boolean;
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
const LEVEL_META: Record<number, { label: string; descKey: string; bg: string; text: string }> = {
  1: { label: 'L1', descKey: 'l1', bg: 'bg-slate-100',   text: 'text-slate-700'   },
  2: { label: 'L2', descKey: 'l2', bg: 'bg-purple-100',  text: 'text-purple-700'  },
  3: { label: 'L3', descKey: 'l3', bg: 'bg-blue-100',    text: 'text-blue-700'    },
  4: { label: 'L4', descKey: 'l4', bg: 'bg-cyan-100',    text: 'text-cyan-700'    },
  5: { label: 'L5', descKey: 'l5', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  6: { label: 'L6', descKey: 'l6', bg: 'bg-gray-100',    text: 'text-gray-600'    },
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

function extractErr(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

// ── Scope options ─────────────────────────────────────────────
// Built from translation keys inside the component (labels are locale-dependent).
function useScopeOptions() {
  const { t } = useTranslation();
  const none     = t('admin.permissions.scope.none');
  const own      = t('admin.permissions.scope.own');
  const division = t('admin.permissions.scope.division');
  const all      = t('admin.permissions.scope.all');
  const ownDivision = t('admin.permissions.scope.ownDivision');

  const TASK_SCOPE_OPTS: { value: Scope; label: string }[] = [
    { value: 'none', label: none }, { value: 'own', label: own },
    { value: 'division', label: division }, { value: 'all', label: all },
  ];
  const EDIT_SCOPE_OPTS: { value: Scope; label: string }[] = [
    { value: 'none', label: none }, { value: 'own', label: own },
    { value: 'division', label: division }, { value: 'all', label: all },
  ];
  const AUDIENCE_SCOPE_OPTS: { value: AudienceScope; label: string }[] = [
    { value: 'none', label: none }, { value: 'division', label: ownDivision }, { value: 'all', label: all },
  ];
  const VIEW_DB_SCOPE_OPTS: { value: Scope; label: string }[] = [
    { value: 'none', label: none }, { value: 'division', label: division }, { value: 'all', label: all },
  ];
  const VIEW_SCOPE_OPTS: { value: Scope; label: string }[] = [
    { value: 'none', label: none }, { value: 'own', label: own },
    { value: 'division', label: division }, { value: 'all', label: all },
  ];

  return { TASK_SCOPE_OPTS, EDIT_SCOPE_OPTS, AUDIENCE_SCOPE_OPTS, VIEW_DB_SCOPE_OPTS, VIEW_SCOPE_OPTS };
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
  onClose: () => void; onCreated: (id: string) => void;
}) {
  const { t } = useTranslation();
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
    if (!name.trim()) { setError(t('admin.permissions.addRoleModal.errors.nameRequired')); return; }
    if (!slug)        { setError(t('admin.permissions.addRoleModal.errors.invalidName')); return; }
    setSaving(true); setError('');
    try {
      const res = await api.post('/roles', {
        name: name.trim(), slug, color, level,
        description: desc.trim() || undefined,
      });
      onCreated(res.data.data.id);
      onClose();
    } catch (err) {
      setError(extractErr(err, t('admin.permissions.errors.generic')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">{t('admin.permissions.addRoleModal.title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">{t('admin.permissions.addRoleModal.roleNameLabel')}</label>
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
                placeholder={t('admin.permissions.addRoleModal.namePlaceholder')}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-navy"
              />
            </div>
            {slug && (
              <p className="text-[11px] text-gray-400 mt-1 ml-10 font-mono">{t('admin.permissions.addRoleModal.slugPrefix', { slug })}</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1.5">{t('admin.permissions.addRoleModal.hierarchyLevelLabel')}</label>
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
                    <span className="text-[10px] text-gray-400 leading-tight">{t(`admin.permissions.levels.${m.descKey}`)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1.5">
              {t('admin.permissions.addRoleModal.descriptionLabel')} <span className="text-gray-400 font-normal">{t('admin.permissions.addRoleModal.optional')}</span>
            </label>
            <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
              placeholder={t('admin.permissions.addRoleModal.descriptionPlaceholder')}
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
              {t('admin.permissions.addRoleModal.cancel')}
            </button>
            <button type="submit" disabled={saving || !name.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-navy rounded-lg hover:bg-navy-light disabled:opacity-50">
              {saving && <Loader2 size={13} className="animate-spin" />}
              {t('admin.permissions.addRoleModal.create')}
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
  const { t } = useTranslation();
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
    if (!nameVal.trim()) { setEditErr(t('admin.permissions.roleList.nameEmptyError')); return; }
    setSaving(true); setEditErr('');
    try {
      await api.patch(`/roles/${role.id}`, { name: nameVal.trim(), color: colorVal });
      onUpdated(role.id, nameVal.trim(), colorVal);
      setEditing(false);
      setShowPicker(false);
    } catch (err) {
      setEditErr(extractErr(err, t('admin.permissions.errors.generic')));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (userCount > 0) {
      alert(t('admin.permissions.roleList.cannotDeleteAlert', { count: userCount }));
      return;
    }
    if (!confirm(t('admin.permissions.roleList.confirmDelete', { name: role.name }))) return;
    setDeleting(true);
    try {
      await api.delete(`/roles/${role.id}`);
      onDeleted(role.id);
    } catch (err) {
      alert(extractErr(err, t('admin.permissions.errors.generic')));
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
              {t('admin.permissions.roleList.save')}
            </button>
            <button type="button" onClick={cancelEdit}
              className="px-2 py-0.5 text-xs text-gray-500 border border-gray-200 rounded hover:bg-gray-50">
              {t('admin.permissions.roleList.cancel')}
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
            <span className="w-1.5 h-1.5 rounded-full bg-info flex-shrink-0" title={t('admin.permissions.roleList.customPermissionsBadge')} />
          )}
        </div>
      </div>
      {canEdit && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={startEdit}
            className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-navy hover:bg-navy/10"
            title={t('admin.permissions.roleList.editTitle')}
          >
            <Edit2 size={11} />
          </button>
          {isDeletable && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40"
              title={userCount > 0 ? t('admin.permissions.roleList.cannotDeleteTitle', { count: userCount }) : t('admin.permissions.roleList.deleteTitle')}
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
  const { t } = useTranslation();
  const { TASK_SCOPE_OPTS, EDIT_SCOPE_OPTS, AUDIENCE_SCOPE_OPTS, VIEW_DB_SCOPE_OPTS, VIEW_SCOPE_OPTS } = useScopeOptions();
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
      setError(t('admin.permissions.loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRoles(); }, []);

  function handleSelectRole(role: RoleWithPerms) {
    if (isDirty && !confirm(t('admin.permissions.unsavedChangesConfirm'))) return;
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
      setToast(t('admin.permissions.toast.saved'));
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast(t('admin.permissions.toast.saveFailed'));
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
            <h2 className="text-sm font-semibold text-gray-800">{t('admin.permissions.roleList.title')}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{t('admin.permissions.roleList.subtitle')}</p>
          </div>
          {canEdit && (
            <button
              onClick={() => setAddOpen(true)}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-navy/5 text-navy hover:bg-navy/10 transition-colors"
              title={t('admin.permissions.roleList.addTitle')}
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
            {t('admin.permissions.roleList.footerNote')}
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
                      ? t('admin.permissions.editor.fullAccessNote')
                      : selectedRole.hasCustomPermissions
                        ? t('admin.permissions.editor.customPermissions')
                        : t('admin.permissions.editor.defaultPermissions')}
                  </p>
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={!isDirty || saving || isSuperAdmin || isReadOnly}
                title={isReadOnly ? t('admin.permissions.editor.readOnlyTitle') : undefined}
                className={cn(
                  'flex items-center gap-1.5 h-8 px-4 text-sm font-medium rounded transition-colors',
                  isDirty && !isSuperAdmin && !isReadOnly
                    ? 'bg-navy text-white hover:bg-navy-light'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed',
                )}
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {t('admin.permissions.editor.save')}
              </button>
            </div>

            {isSuperAdmin && (
              <div className="mx-6 mt-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center gap-2">
                <ShieldCheck size={15} />
                {t('admin.permissions.editor.superAdminBanner')}
              </div>
            )}

            {isReadOnly && !isSuperAdmin && (
              <div className="mx-6 mt-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex items-center gap-2">
                <ShieldCheck size={15} />
                {t('admin.permissions.editor.readOnlyBanner')}
              </div>
            )}

            {/* Permission matrix */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <Section title={t('admin.permissions.sections.task.title')}>
                <PermRow label={t('admin.permissions.sections.task.view')}>
                  <ScopeSelector value={perms.task.view} options={TASK_SCOPE_OPTS}
                    onChange={(v) => update('task', 'view', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.task.create')}>
                  <Toggle checked={perms.task.create} onChange={(v) => update('task', 'create', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.task.edit')}>
                  <ScopeSelector value={perms.task.edit} options={TASK_SCOPE_OPTS}
                    onChange={(v) => update('task', 'edit', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.task.delete')}>
                  <ScopeSelector value={perms.task.delete} options={TASK_SCOPE_OPTS}
                    onChange={(v) => update('task', 'delete', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.task.viewPrivate')}>
                  <Toggle checked={perms.task.viewPrivate} onChange={(v) => update('task', 'viewPrivate', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
              </Section>

              <Section title={t('admin.permissions.sections.bulletin.title')}>
                <PermRow label={t('admin.permissions.sections.bulletin.view')}>
                  <Toggle checked={perms.bulletin.view} onChange={(v) => update('bulletin', 'view', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.bulletin.create')}>
                  <Toggle checked={perms.bulletin.create} onChange={(v) => update('bulletin', 'create', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.bulletin.audienceScope')}>
                  <ScopeSelector value={perms.bulletin.audienceScope} options={AUDIENCE_SCOPE_OPTS}
                    onChange={(v) => update('bulletin', 'audienceScope', v)}
                    disabled={isSuperAdmin || isReadOnly || !perms.bulletin.create} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.bulletin.edit')}>
                  <ScopeSelector value={perms.bulletin.edit} options={EDIT_SCOPE_OPTS}
                    onChange={(v) => update('bulletin', 'edit', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.bulletin.delete')}>
                  <ScopeSelector value={perms.bulletin.delete} options={EDIT_SCOPE_OPTS}
                    onChange={(v) => update('bulletin', 'delete', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
              </Section>

              <Section title={t('admin.permissions.sections.dbLinks.title')}>
                <PermRow label={t('admin.permissions.sections.dbLinks.view')}>
                  <ScopeSelector value={perms.db_link.view} options={VIEW_DB_SCOPE_OPTS}
                    onChange={(v) => update('db_link', 'view', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.dbLinks.addLink')}>
                  <Toggle checked={perms.db_link.addLink} onChange={(v) => update('db_link', 'addLink', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.dbLinks.manageFolder')}>
                  <Toggle checked={perms.db_link.manageFolder} onChange={(v) => update('db_link', 'manageFolder', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.dbLinks.shareFolder')}>
                  <Toggle checked={perms.db_link.shareFolder} onChange={(v) => update('db_link', 'shareFolder', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
              </Section>

              <Section title={t('admin.permissions.sections.notes.title')}>
                <PermRow label={t('admin.permissions.sections.notes.view')}>
                  <ScopeSelector value={perms.note?.view ?? 'own'} options={TASK_SCOPE_OPTS}
                    onChange={(v) => update('note', 'view', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.notes.create')}>
                  <Toggle checked={perms.note?.create ?? true} onChange={(v) => update('note', 'create', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.notes.edit')}>
                  <ScopeSelector value={perms.note?.edit ?? 'own'} options={EDIT_SCOPE_OPTS}
                    onChange={(v) => update('note', 'edit', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.notes.delete')}>
                  <ScopeSelector value={perms.note?.delete ?? 'own'} options={EDIT_SCOPE_OPTS}
                    onChange={(v) => update('note', 'delete', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
              </Section>

              <Section title={t('admin.permissions.sections.analytics.title')}>
                <PermRow label={t('admin.permissions.sections.analytics.view')}>
                  <ScopeSelector value={perms.analytics?.view ?? 'none'} options={VIEW_SCOPE_OPTS}
                    onChange={(v) => update('analytics', 'view', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
              </Section>

              <Section title={t('admin.permissions.sections.auditLog.title')}>
                <PermRow label={t('admin.permissions.sections.auditLog.view')}>
                  <ScopeSelector value={perms.audit_log?.view ?? 'none'} options={VIEW_SCOPE_OPTS}
                    onChange={(v) => update('audit_log', 'view', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
              </Section>

              <Section title={t('admin.permissions.sections.hris.title')}>
                <PermRow label={t('admin.permissions.sections.hris.reviewLeave')}>
                  <ScopeSelector value={perms.hris?.reviewLeave ?? 'none'} options={VIEW_DB_SCOPE_OPTS}
                    onChange={(v) => update('hris', 'reviewLeave', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.hris.editAttendance')}>
                  <ScopeSelector value={perms.hris?.editAttendance ?? 'none'} options={VIEW_DB_SCOPE_OPTS}
                    onChange={(v) => update('hris', 'editAttendance', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.hris.manageShifts')}>
                  <Toggle checked={perms.hris?.manageShifts ?? false} onChange={(v) => update('hris', 'manageShifts', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.hris.manageLocations')}>
                  <Toggle checked={perms.hris?.manageLocations ?? false} onChange={(v) => update('hris', 'manageLocations', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.hris.viewReports')}>
                  <ScopeSelector value={perms.hris?.viewReports ?? 'none'} options={VIEW_SCOPE_OPTS}
                    onChange={(v) => update('hris', 'viewReports', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
              </Section>

              <Section title={t('admin.permissions.sections.workOrder.title')}>
                <PermRow label={t('admin.permissions.sections.workOrder.view')}>
                  <ScopeSelector value={perms.work_order?.view ?? 'own'} options={TASK_SCOPE_OPTS}
                    onChange={(v) => update('work_order', 'view', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.workOrder.create')}>
                  <Toggle checked={perms.work_order?.create ?? true} onChange={(v) => update('work_order', 'create', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.workOrder.edit')}>
                  <ScopeSelector value={perms.work_order?.edit ?? 'own'} options={EDIT_SCOPE_OPTS}
                    onChange={(v) => update('work_order', 'edit', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.workOrder.delete')}>
                  <ScopeSelector value={perms.work_order?.delete ?? 'own'} options={EDIT_SCOPE_OPTS}
                    onChange={(v) => update('work_order', 'delete', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.workOrder.canBeAssignee')}>
                  <Toggle checked={perms.work_order?.canBeAssignee ?? true} onChange={(v) => update('work_order', 'canBeAssignee', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
              </Section>

              <Section title={t('admin.permissions.sections.userMgmt.title')}>
                <PermRow label={t('admin.permissions.sections.userMgmt.create')}>
                  <Toggle checked={perms.user_mgmt?.create ?? false} onChange={(v) => update('user_mgmt', 'create', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.userMgmt.edit')}>
                  <ScopeSelector value={perms.user_mgmt?.edit ?? 'none'} options={VIEW_DB_SCOPE_OPTS}
                    onChange={(v) => update('user_mgmt', 'edit', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.userMgmt.toggleStatus')}>
                  <ScopeSelector value={perms.user_mgmt?.toggleStatus ?? 'none'} options={VIEW_DB_SCOPE_OPTS}
                    onChange={(v) => update('user_mgmt', 'toggleStatus', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.userMgmt.delete')}>
                  <ScopeSelector value={perms.user_mgmt?.delete ?? 'none'} options={VIEW_DB_SCOPE_OPTS}
                    onChange={(v) => update('user_mgmt', 'delete', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
              </Section>

              <Section title={t('admin.permissions.sections.roleMgmt.title')}>
                <PermRow label={t('admin.permissions.sections.roleMgmt.create')}>
                  <Toggle checked={perms.role_mgmt?.create ?? false} onChange={(v) => update('role_mgmt', 'create', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.roleMgmt.edit')}>
                  <ScopeSelector value={perms.role_mgmt?.edit ?? 'none'} options={VIEW_DB_SCOPE_OPTS}
                    onChange={(v) => update('role_mgmt', 'edit', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.roleMgmt.delete')}>
                  <ScopeSelector value={perms.role_mgmt?.delete ?? 'none'} options={VIEW_DB_SCOPE_OPTS}
                    onChange={(v) => update('role_mgmt', 'delete', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
              </Section>

              <Section title={t('admin.permissions.sections.divisionMgmt.title')}>
                <PermRow label={t('admin.permissions.sections.divisionMgmt.create')}>
                  <Toggle checked={perms.division_mgmt?.create ?? false} onChange={(v) => update('division_mgmt', 'create', v)}
                    disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.divisionMgmt.edit')}>
                  <ScopeSelector value={perms.division_mgmt?.edit ?? 'none'} options={VIEW_DB_SCOPE_OPTS}
                    onChange={(v) => update('division_mgmt', 'edit', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
                <PermRow label={t('admin.permissions.sections.divisionMgmt.delete')}>
                  <ScopeSelector value={perms.division_mgmt?.delete ?? 'none'} options={VIEW_DB_SCOPE_OPTS}
                    onChange={(v) => update('division_mgmt', 'delete', v)} disabled={isSuperAdmin || isReadOnly} />
                </PermRow>
              </Section>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <ShieldCheck size={40} className="text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-600">{t('admin.permissions.editor.selectRolePrompt')}</p>
          </div>
        )}
      </div>

      {addOpen && (
        <AddRoleModal onClose={() => setAddOpen(false)} onCreated={handleRoleCreated} />
      )}
    </div>
  );
}
