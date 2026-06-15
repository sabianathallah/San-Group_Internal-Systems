import { useEffect, useState, useCallback, FormEvent } from 'react';
import {
  Users, Plus, Search, X, Edit2, Trash2, Loader2,
  AlertCircle, ChevronLeft, ChevronRight, PowerOff, Power,
  ShieldCheck, Layers, Shield,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/cn';

// ── Types ──────────────────────────────────────────────────
type Tab = 'users' | 'divisions' | 'roles';

interface DivisionOption {
  id: string; name: string; slug: string; color: string;
  description?: string | null;
  _count?: { users: number; roles: number };
}

interface RoleOption {
  id: string; name: string; slug: string; color: string; level: number;
  division?: DivisionOption | null;
  _count?: { users: number };
}

interface UserRow {
  id:          string;
  email:       string;
  username:    string;
  fullName:    string;
  phone:       string | null;
  avatar:      string | null;
  role:        RoleOption;
  division:    DivisionOption;
  isActive:    boolean;
  lastLoginAt: string | null;
  createdAt:   string;
}

interface Meta { total: number; page: number; limit: number; totalPages: number; }

// ── Constants ──────────────────────────────────────────────
const PRESET_COLORS = [
  '#1e3a5f','#334155','#7c3aed','#b45309','#15803d',
  '#dc2626','#64748b','#0891b2','#16a34a','#ea580c',
  '#2563eb','#db2777','#4f46e5','#0d9488','#7c2d12',
];

const LEVEL_COLORS: Record<number, string> = {
  1: 'bg-purple-100 text-purple-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-violet-100 text-violet-700',
  4: 'bg-cyan-100 text-cyan-700',
  5: 'bg-amber-100 text-amber-700',
  6: 'bg-gray-100 text-gray-600',
};

// ── Helpers ────────────────────────────────────────────────
function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}
function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}
function hexToRgba(hex: string, alpha: number) {
  const safe = hex?.startsWith('#') ? hex : '#64748b';
  const r = parseInt(safe.slice(1, 3), 16);
  const g = parseInt(safe.slice(3, 5), 16);
  const b = parseInt(safe.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
function slugify(str: string) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
}

// ── Shared UI ──────────────────────────────────────────────
function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((c) => (
          <button key={c} type="button" onClick={() => onChange(c)}
            className={cn('w-6 h-6 rounded-full transition-all flex-shrink-0', value === c && 'ring-2 ring-offset-1 ring-gray-500 scale-110')}
            style={{ backgroundColor: c }} title={c} />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full border border-gray-200 flex-shrink-0" style={{ backgroundColor: value }} />
        <input type="text" value={value}
          onChange={(e) => { const v = e.target.value; if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v); }}
          placeholder="#000000"
          className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:border-navy font-mono" maxLength={7} />
      </div>
    </div>
  );
}

const inputCls  = 'w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy';
const selectCls = 'w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-navy';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
    </div>
  );
}

// ── Delete Confirm (generic) ───────────────────────────────
function DeleteConfirm({ title, name, onCancel, onConfirm, loading }: {
  title: string; name: string; onCancel: () => void; onConfirm: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        <p className="text-sm text-gray-600">Delete <strong>{name}</strong>? This action cannot be undone.</p>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded disabled:opacity-50">
            {loading && <Loader2 size={13} className="animate-spin" />} Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Division Modal ─────────────────────────────────────────
interface DivForm { name: string; slug: string; color: string; description: string; }
const EMPTY_DIV: DivForm = { name: '', slug: '', color: '#1e3a5f', description: '' };

function DivisionModal({ open, division, onClose, onSaved }: {
  open: boolean; division: DivisionOption | null; onClose: () => void; onSaved: (d: DivisionOption) => void;
}) {
  const [form, setForm]     = useState<DivForm>(EMPTY_DIV);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(division
      ? { name: division.name, slug: division.slug, color: division.color, description: division.description ?? '' }
      : EMPTY_DIV);
  }, [open, division]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = { name: form.name.trim(), slug: form.slug.trim() || slugify(form.name), color: form.color, description: form.description.trim() || undefined };
      const res = division ? await api.patch(`/divisions/${division.id}`, payload) : await api.post('/divisions', payload);
      onSaved(res.data.data); onClose();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'An error occurred');
    } finally { setSaving(false); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">{division ? 'Edit Division' : 'Add Division'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Field label="Name" required>
            <input autoFocus type="text" value={form.name} placeholder="Finance"
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: division ? f.slug : slugify(e.target.value) }))}
              className={inputCls} />
          </Field>
          <Field label="Slug">
            <input type="text" value={form.slug} placeholder="finance"
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              className={cn(inputCls, 'font-mono text-xs')} />
          </Field>
          <Field label="Color">
            <ColorPicker value={form.color} onChange={(c) => setForm((f) => ({ ...f, color: c }))} />
          </Field>
          <Field label="Description">
            <textarea rows={2} value={form.description} placeholder="Brief description…"
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className={cn(inputCls, 'resize-none')} />
          </Field>
          {error && <p className="flex items-center gap-1.5 text-xs text-red-500"><AlertCircle size={12} /> {error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-navy hover:bg-navy-light rounded disabled:opacity-50">
              {saving && <Loader2 size={13} className="animate-spin" />}
              {division ? 'Save' : 'Create Division'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Role Modal (edit name & color only) ────────────────────
interface RoleForm { name: string; color: string; }

function RoleModal({ open, role, onClose, onSaved }: {
  open: boolean; role: RoleOption | null;
  onClose: () => void; onSaved: (r: RoleOption) => void;
}) {
  const [form, setForm]     = useState<RoleForm>({ name: '', color: '#334155' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (!open || !role) return;
    setError('');
    setForm({ name: role.name, color: role.color });
  }, [open, role]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      const res = await api.patch(`/roles/${role!.id}`, { name: form.name.trim(), color: form.color });
      onSaved(res.data.data); onClose();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'An error occurred');
    } finally { setSaving(false); }
  }

  if (!open || !role) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Edit Role · L{role.level}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Field label="Name" required>
            <input autoFocus type="text" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputCls} />
          </Field>
          <Field label="Color">
            <ColorPicker value={form.color} onChange={(c) => setForm((f) => ({ ...f, color: c }))} />
          </Field>
          {error && <p className="flex items-center gap-1.5 text-xs text-red-500"><AlertCircle size={12} /> {error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-navy hover:bg-navy-light rounded disabled:opacity-50">
              {saving && <Loader2 size={13} className="animate-spin" />} Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── User Avatar ────────────────────────────────────────────
function Avatar({ user }: { user: UserRow }) {
  return (
    <div className="w-8 h-8 rounded-full bg-navy-light flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
      {user.avatar
        ? <img src={user.avatar} alt={user.fullName} className="w-8 h-8 rounded-full object-cover" />
        : initials(user.fullName)}
    </div>
  );
}

// ── User Form Modal ────────────────────────────────────────
type ModalMode = 'create' | 'edit';
interface CreateForm { fullName: string; email: string; username: string; password: string; phone: string; roleId: string; divisionId: string; }
interface EditForm   { fullName: string; phone: string; roleId: string; divisionId: string; }
const EMPTY_CREATE: CreateForm = { fullName: '', email: '', username: '', password: '', phone: '', roleId: '', divisionId: '' };

function UserFormModal({ open, mode, user, roles, divisions, onClose, onSaved }: {
  open: boolean; mode: ModalMode; user: UserRow | null;
  roles: RoleOption[]; divisions: DivisionOption[];
  onClose: () => void; onSaved: (u: UserRow) => void;
}) {
  const [createForm, setCreate] = useState<CreateForm>(EMPTY_CREATE);
  const [editForm,   setEdit]   = useState<EditForm>({ fullName: '', phone: '', roleId: '', divisionId: '' });
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (mode === 'edit' && user) {
      setEdit({ fullName: user.fullName, phone: user.phone ?? '', roleId: user.role?.id ?? '', divisionId: user.division?.id ?? '' });
    } else {
      setCreate(EMPTY_CREATE);
    }
  }, [open, mode, user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (mode === 'create') {
        if (!createForm.roleId)     { setError('Please select a role'); setSaving(false); return; }
        if (!createForm.divisionId) { setError('Please select a division'); setSaving(false); return; }
        const res = await api.post('/users', {
          fullName: createForm.fullName.trim(), email: createForm.email.trim(),
          username: createForm.username.trim(), password: createForm.password,
          phone: createForm.phone.trim() || undefined, roleId: createForm.roleId, divisionId: createForm.divisionId,
        });
        onSaved(res.data.data);
      } else {
        const res = await api.patch(`/users/${user!.id}`, {
          fullName: editForm.fullName.trim(), phone: editForm.phone.trim() || null,
          roleId: editForm.roleId || undefined, divisionId: editForm.divisionId || undefined,
        });
        onSaved(res.data.data);
      }
      onClose();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'An error occurred');
    } finally { setSaving(false); }
  }

  const RolePill = ({ roleId }: { roleId: string }) => {
    const sel = roles.find((r) => r.id === roleId);
    return sel ? (
      <div className="flex items-center gap-1.5 px-1 mt-1">
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: sel.color }} />
        <span className="text-xs text-gray-500">{sel.name}</span>
      </div>
    ) : null;
  };
  const DivPill = ({ divisionId }: { divisionId: string }) => {
    const sel = divisions.find((d) => d.id === divisionId);
    return sel ? (
      <div className="flex items-center gap-1.5 px-1 mt-1">
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: sel.color }} />
        <span className="text-xs text-gray-500">{sel.name}</span>
      </div>
    ) : null;
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-sm font-semibold text-gray-800">{mode === 'create' ? 'Add New User' : 'Edit User'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-4">
          {mode === 'create' ? (
            <>
              <Field label="Full Name" required>
                <input type="text" maxLength={100} placeholder="Budi Santoso" value={createForm.fullName}
                  onChange={(e) => setCreate((f) => ({ ...f, fullName: e.target.value }))} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email" required>
                  <input type="email" placeholder="budi@sangroup.id" value={createForm.email}
                    onChange={(e) => setCreate((f) => ({ ...f, email: e.target.value }))} className={inputCls} />
                </Field>
                <Field label="Username" required>
                  <input type="text" maxLength={30} placeholder="budi.s" value={createForm.username}
                    onChange={(e) => setCreate((f) => ({ ...f, username: e.target.value }))} className={inputCls} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Password" required>
                  <input type="password" placeholder="Min. 8 characters" value={createForm.password}
                    onChange={(e) => setCreate((f) => ({ ...f, password: e.target.value }))} className={inputCls} />
                </Field>
                <Field label="Phone Number">
                  <input type="text" placeholder="08xxxxxxxx" value={createForm.phone}
                    onChange={(e) => setCreate((f) => ({ ...f, phone: e.target.value }))} className={inputCls} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Role" required>
                  <select value={createForm.roleId} onChange={(e) => setCreate((f) => ({ ...f, roleId: e.target.value }))} className={selectCls}>
                    <option value="">-- Select role --</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  {createForm.roleId && <RolePill roleId={createForm.roleId} />}
                </Field>
                <Field label="Division" required>
                  <select value={createForm.divisionId} onChange={(e) => setCreate((f) => ({ ...f, divisionId: e.target.value }))} className={selectCls}>
                    <option value="">-- Select division --</option>
                    {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {createForm.divisionId && <DivPill divisionId={createForm.divisionId} />}
                </Field>
              </div>
            </>
          ) : (
            <>
              <Field label="Full Name" required>
                <input type="text" maxLength={100} value={editForm.fullName}
                  onChange={(e) => setEdit((f) => ({ ...f, fullName: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="No. Telepon">
                <input type="text" placeholder="08xxxxxxxx" value={editForm.phone}
                  onChange={(e) => setEdit((f) => ({ ...f, phone: e.target.value }))} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Role" required>
                  <select value={editForm.roleId} onChange={(e) => setEdit((f) => ({ ...f, roleId: e.target.value }))} className={selectCls}>
                    <option value="">-- Select role --</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  {editForm.roleId && <RolePill roleId={editForm.roleId} />}
                </Field>
                <Field label="Division" required>
                  <select value={editForm.divisionId} onChange={(e) => setEdit((f) => ({ ...f, divisionId: e.target.value }))} className={selectCls}>
                    <option value="">-- Select division --</option>
                    {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {editForm.divisionId && <DivPill divisionId={editForm.divisionId} />}
                </Field>
              </div>
            </>
          )}
          {error && <p className="flex items-center gap-1.5 text-xs text-danger"><AlertCircle size={12} /> {error}</p>}
          <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-navy hover:bg-navy-light rounded disabled:opacity-50">
              {saving && <Loader2 size={13} className="animate-spin" />}
              {mode === 'create' ? 'Create User' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
const PAGE_SIZE = 15;

export default function UsersPage() {
  const currentUser  = useAuthStore((s) => s.user);
  const isSuperAdmin = (currentUser?.role?.level ?? 99) <= 1;

  const [activeTab, setActiveTab] = useState<Tab>('users');

  // shared data
  const [roles,     setRoles]     = useState<RoleOption[]>([]);
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);

  useEffect(() => {
    Promise.all([api.get('/roles'), api.get('/divisions')])
      .then(([rr, dr]) => { setRoles(rr.data.data ?? []); setDivisions(dr.data.data ?? []); })
      .catch(() => {});
  }, []);

  // ── users tab ──
  const [users,        setUsers]        = useState<UserRow[]>([]);
  const [meta,         setMeta]         = useState<Meta>({ total: 0, page: 1, limit: PAGE_SIZE, totalPages: 1 });
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError,   setUsersError]   = useState('');
  const [search,       setSearch]       = useState('');
  const [debSearch,    setDebSearch]    = useState('');
  const [roleFilter,   setRoleFilter]   = useState('');
  const [divFilter,    setDivFilter]    = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page,         setPage]         = useState(1);
  const [userModal,    setUserModal]    = useState(false);
  const [userMode,     setUserMode]     = useState<ModalMode>('create');
  const [editingUser,  setEditingUser]  = useState<UserRow | null>(null);
  const [toggling,     setToggling]     = useState<string | null>(null);
  const [deletingUsr,  setDeletingUsr]  = useState<string | null>(null);

  // ── divisions tab ──
  const [divModal,      setDivModal]      = useState(false);
  const [editingDiv,    setEditingDiv]    = useState<DivisionOption | null>(null);
  const [divDelTarget,  setDivDelTarget]  = useState<DivisionOption | null>(null);
  const [deletingDiv,   setDeletingDiv]   = useState(false);
  const [divDelError,   setDivDelError]   = useState('');

  // ── roles tab ──
  const [roleModal,     setRoleModal]     = useState(false);
  const [editingRole,   setEditingRole]   = useState<RoleOption | null>(null);

  // users fetch
  useEffect(() => {
    const t = setTimeout(() => { setDebSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true); setUsersError('');
    try {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (debSearch)    params.search   = debSearch;
      if (roleFilter)   params.role     = roleFilter;
      if (divFilter)    params.division = divFilter;
      if (statusFilter) params.isActive = statusFilter;
      const res = await api.get('/users', { params });
      setUsers(res.data.data); setMeta(res.data.meta);
    } catch { setUsersError('Failed to load data. Try again.'); }
    finally  { setUsersLoading(false); }
  }, [debSearch, roleFilter, divFilter, statusFilter, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // user handlers
  function openCreateUser() { setUserMode('create'); setEditingUser(null); setUserModal(true); }
  function openEditUser(u: UserRow) { setUserMode('edit'); setEditingUser(u); setUserModal(true); }
  function handleUserSaved(saved: UserRow) {
    setUsers((prev) => { const i = prev.findIndex((u) => u.id === saved.id); if (i >= 0) { const n = [...prev]; n[i] = saved; return n; } return [saved, ...prev]; });
    setMeta((m) => ({ ...m, total: m.total + (users.find((u) => u.id === saved.id) ? 0 : 1) }));
  }
  async function handleToggle(u: UserRow) {
    if (!confirm(`${u.isActive ? 'Deactivate' : 'Activate'} user "${u.fullName}"?`)) return;
    setToggling(u.id);
    try { const res = await api.patch(`/users/${u.id}/toggle`); setUsers((p) => p.map((x) => x.id === u.id ? res.data.data : x)); }
    catch (err: unknown) { alert((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed'); }
    finally { setToggling(null); }
  }
  async function handleDeleteUser(u: UserRow) {
    if (!confirm(`Permanently deactivate user "${u.fullName}"?`)) return;
    setDeletingUsr(u.id);
    try { const res = await api.delete(`/users/${u.id}`); setUsers((p) => p.map((x) => x.id === u.id ? res.data.data : x)); }
    catch (err: unknown) { alert((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed'); }
    finally { setDeletingUsr(null); }
  }
  function resetFilters() { setSearch(''); setRoleFilter(''); setDivFilter(''); setStatusFilter(''); setPage(1); }
  const hasFilter = search || roleFilter || divFilter || statusFilter;

  // division handlers
  function handleDivSaved(saved: DivisionOption) {
    setDivisions((prev) => { const i = prev.findIndex((d) => d.id === saved.id); if (i >= 0) { const n = [...prev]; n[i] = saved; return n; } return [saved, ...prev]; });
  }
  async function handleDeleteDiv() {
    if (!divDelTarget) return;
    setDeletingDiv(true); setDivDelError('');
    try { await api.delete(`/divisions/${divDelTarget.id}`); setDivisions((p) => p.filter((d) => d.id !== divDelTarget.id)); setDivDelTarget(null); }
    catch (err: unknown) { setDivDelError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed'); }
    finally { setDeletingDiv(false); }
  }

  // role handlers
  function handleRoleSaved(saved: RoleOption) {
    setRoles((prev) => { const i = prev.findIndex((r) => r.id === saved.id); if (i >= 0) { const n = [...prev]; n[i] = saved; return n; } return [saved, ...prev]; });
  }
  const sortedRoles = [...roles].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  const TABS = [
    { key: 'users' as Tab,     label: 'Users',     Icon: Users,  count: meta.total },
    { key: 'divisions' as Tab, label: 'Divisions', Icon: Layers, count: divisions.length },
    { key: 'roles' as Tab,     label: 'Roles',     Icon: Shield, count: roles.length },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage users, divisions, and roles for SAN Group</p>
        </div>
        {activeTab === 'users' && (
          <button onClick={openCreateUser} className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-navy hover:bg-navy-light rounded transition-colors">
            <Plus size={15} /> Add User
          </button>
        )}
        {activeTab === 'divisions' && (
          <button onClick={() => { setEditingDiv(null); setDivModal(true); }} className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-navy hover:bg-navy-light rounded transition-colors">
            <Plus size={15} /> Add Division
          </button>
        )}
        {activeTab === 'roles' && (
          <span className="text-xs text-gray-400 italic">6 system roles · edit name & color via the pencil icon</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-gray-200 mb-5">
        {TABS.map(({ key, label, Icon, count }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === key ? 'border-navy text-navy' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            )}>
            <Icon size={15} />
            {label}
            <span className={cn('text-xs px-1.5 py-0.5 rounded-full', activeTab === key ? 'bg-navy/10 text-navy' : 'bg-gray-100 text-gray-500')}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Users Tab ── */}
      {activeTab === 'users' && (
        <>
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search name, email, username..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-8 py-2 text-sm border border-gray-200 rounded w-full focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy" />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={13} /></button>
              )}
            </div>
            <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              className="py-2 px-3 text-sm border border-gray-200 rounded focus:outline-none focus:border-navy">
              <option value="">All Roles</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <select value={divFilter} onChange={(e) => { setDivFilter(e.target.value); setPage(1); }}
              className="py-2 px-3 text-sm border border-gray-200 rounded focus:outline-none focus:border-navy">
              <option value="">All Divisions</option>
              {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="py-2 px-3 text-sm border border-gray-200 rounded focus:outline-none focus:border-navy">
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            {hasFilter && (
              <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-gray-500 hover:text-danger px-2 py-1">
                <X size={12} /> Reset
              </button>
            )}
            <span className="ml-auto text-xs text-gray-400">{meta.total} user</span>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {usersLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
            ) : usersError ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <AlertCircle size={32} className="text-danger mb-3" />
                <p className="text-sm text-gray-600">{usersError}</p>
                <button onClick={fetchUsers} className="mt-3 px-4 py-1.5 text-sm text-navy border border-navy rounded hover:bg-navy-50">Try again</button>
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users size={40} className="text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-600">{hasFilter ? 'No matching users' : 'No users yet'}</p>
                {hasFilter && <button onClick={resetFilters} className="mt-2 text-xs text-navy hover:underline">Reset filters</button>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Division</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {users.map((u) => {
                      const isMe      = u.id === currentUser?.id;
                      const isTopRole = (u.role?.level ?? 99) <= 1;
                      return (
                        <tr key={u.id} className={cn('hover:bg-gray-50/50 transition-colors', !u.isActive && 'opacity-60')}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar user={u} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-medium text-gray-800 truncate">{u.fullName}</p>
                                  {isMe && <span className="text-xs bg-navy-50 text-navy px-1.5 py-0.5 rounded">You</span>}
                                </div>
                                <p className="text-xs text-gray-400 truncate">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 font-mono">{u.username}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium text-white w-fit"
                                style={{ backgroundColor: u.role?.color ?? '#64748b' }}>
                                {(u.role?.level ?? 99) <= 1 && <ShieldCheck size={10} />}
                                {u.role?.name ?? '—'}
                              </span>
                              {u.division && (
                                <span className="text-xs text-gray-400 pl-1">· {u.division.name}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {u.division ? (
                              <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: hexToRgba(u.division.color, 0.15), color: u.division.color }}>
                                {u.division.name}
                              </span>
                            ) : <span className="text-xs text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn('inline-block text-xs px-2 py-0.5 rounded-full font-medium',
                              u.isActive ? 'bg-success/10 text-success' : 'bg-gray-100 text-gray-500')}>
                              {u.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">{formatDate(u.lastLoginAt)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openEditUser(u)} title="Edit"
                                className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-navy hover:bg-navy-50 transition-colors">
                                <Edit2 size={13} />
                              </button>
                              {isSuperAdmin && !isMe && !isTopRole && (
                                <button onClick={() => handleToggle(u)} disabled={toggling === u.id}
                                  title={u.isActive ? 'Deactivate' : 'Activate'}
                                  className={cn('w-7 h-7 flex items-center justify-center rounded transition-colors',
                                    u.isActive ? 'text-gray-400 hover:text-warning hover:bg-warning/10' : 'text-gray-400 hover:text-success hover:bg-success/10')}>
                                  {toggling === u.id ? <Loader2 size={13} className="animate-spin" /> : u.isActive ? <PowerOff size={13} /> : <Power size={13} />}
                                </button>
                              )}
                              {isSuperAdmin && !isMe && !isTopRole && (
                                <button onClick={() => handleDeleteUser(u)} disabled={deletingUsr === u.id} title="Delete"
                                  className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-danger hover:bg-danger/10 transition-colors">
                                  {deletingUsr === u.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {!usersLoading && !usersError && meta.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                <p className="text-xs text-gray-500">
                  {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total} users
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={meta.page <= 1}
                    className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: meta.totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === meta.totalPages || Math.abs(p - meta.page) <= 1)
                    .reduce<(number | '...')[]>((acc, p, i, arr) => { if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...'); acc.push(p); return acc; }, [])
                    .map((p, i) => p === '...'
                      ? <span key={`e-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-gray-400">…</span>
                      : <button key={p} onClick={() => setPage(p as number)}
                          className={cn('w-7 h-7 flex items-center justify-center rounded border text-xs transition-colors',
                            meta.page === p ? 'bg-navy text-white border-navy' : 'border-gray-200 text-gray-600 hover:bg-gray-100')}>{p}</button>
                    )}
                  <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={meta.page >= meta.totalPages}
                    className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Divisions Tab ── */}
      {activeTab === 'divisions' && (
        <>
          {divDelError && (
            <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              <AlertCircle size={14} /> {divDelError}
              <button onClick={() => setDivDelError('')} className="ml-auto"><X size={13} /></button>
            </div>
          )}
          {divisions.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center py-20 text-center">
              <Layers size={40} className="text-gray-200 mb-3" />
              <p className="text-sm text-gray-500 mb-3">No divisions yet</p>
              <button onClick={() => { setEditingDiv(null); setDivModal(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-navy border border-navy rounded hover:bg-navy-50">
                <Plus size={14} /> Add your first division
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {divisions.map((d) => {
                const userCount = d._count?.users ?? 0;
                const roleCount = d._count?.roles ?? 0;
                return (
                  <div key={d.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                    <div className="h-1" style={{ backgroundColor: d.color }} />
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-sm font-bold"
                            style={{ backgroundColor: d.color }}>
                            {d.name[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-800 text-sm truncate">{d.name}</p>
                            <p className="text-xs font-mono text-gray-400 truncate">{d.slug}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button onClick={() => { setEditingDiv(d); setDivModal(true); }}
                            className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-navy hover:bg-navy-50 transition-colors">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => { setDivDelError(''); setDivDelTarget(d); }} disabled={userCount > 0}
                            title={userCount > 0 ? 'Cannot delete — division still has users' : 'Delete'}
                            className={cn('w-7 h-7 flex items-center justify-center rounded transition-colors',
                              userCount > 0 ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-red-500 hover:bg-red-50')}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      {d.description && <p className="text-xs text-gray-500 mt-2.5 line-clamp-2">{d.description}</p>}
                      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                        <span className="text-xs text-gray-500 flex items-center gap-1"><Users size={11} className="text-gray-400" /> {userCount} user</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-gray-500 flex items-center gap-1"><Shield size={11} className="text-gray-400" /> {roleCount} role</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Roles Tab ── */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedRoles.map((r) => {
            const userCount = r._count?.users ?? 0;
            return (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow">
                <div className="h-1" style={{ backgroundColor: r.color }} />
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', LEVEL_COLORS[r.level] ?? 'bg-gray-100 text-gray-600')}>
                      L{r.level}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Users size={11} /> {userCount}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                    <p className="text-sm font-semibold text-gray-800 truncate">{r.name}</p>
                    <button onClick={() => { setEditingRole(r); setRoleModal(true); }}
                      className="ml-auto w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-navy hover:bg-navy-50 transition-colors flex-shrink-0">
                      <Edit2 size={11} />
                    </button>
                  </div>
                  <p className="text-xs font-mono text-gray-400 mt-1">{r.slug}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <UserFormModal open={userModal} mode={userMode} user={editingUser} roles={roles} divisions={divisions}
        onClose={() => setUserModal(false)} onSaved={handleUserSaved} />
      <DivisionModal open={divModal} division={editingDiv}
        onClose={() => setDivModal(false)} onSaved={handleDivSaved} />
      <RoleModal open={roleModal} role={editingRole}
        onClose={() => setRoleModal(false)} onSaved={handleRoleSaved} />
      {divDelTarget && (
        <DeleteConfirm title="Delete Division" name={divDelTarget.name}
          onCancel={() => setDivDelTarget(null)} onConfirm={handleDeleteDiv} loading={deletingDiv} />
      )}
    </div>
  );
}
