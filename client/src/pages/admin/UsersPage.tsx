import { useEffect, useState, useCallback, FormEvent } from 'react';
import {
  Users, Plus, Search, X, Edit2, Trash2, Loader2,
  AlertCircle, ChevronLeft, ChevronRight, PowerOff, Power,
  ShieldCheck, User as UserIcon,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/cn';

// ── Types ──────────────────────────────────────────────────
type Role =
  | 'SUPER_ADMIN' | 'ADMIN' | 'BUILDING_MANAGER' | 'TENANT_RELATIONS'
  | 'ENGINEER' | 'HRD' | 'OPS' | 'FINANCE' | 'LEGAL' | 'MARKOM'
  | 'GA' | 'PROJECT' | 'STAFF' | 'OWNER';

type Division =
  | 'HRD' | 'OPS' | 'FINANCE' | 'LEGAL' | 'MARKOM'
  | 'GA' | 'PROJECT' | 'MANAGEMENT' | 'ENGINEERING';

interface UserRow {
  id:          string;
  email:       string;
  username:    string;
  fullName:    string;
  phone:       string | null;
  avatar:      string | null;
  role:        Role;
  division:    Division;
  isActive:    boolean;
  lastLoginAt: string | null;
  createdAt:   string;
}

interface Meta { total: number; page: number; limit: number; totalPages: number; }

// ── Constants ──────────────────────────────────────────────
const ROLES: Role[] = [
  'SUPER_ADMIN','ADMIN','BUILDING_MANAGER','TENANT_RELATIONS',
  'ENGINEER','HRD','OPS','FINANCE','LEGAL','MARKOM','GA','PROJECT','STAFF','OWNER',
];

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin',
  BUILDING_MANAGER: 'Building Manager', TENANT_RELATIONS: 'Tenant Relations',
  ENGINEER: 'Engineer', HRD: 'HRD', OPS: 'Operasional', FINANCE: 'Keuangan',
  LEGAL: 'Legal', MARKOM: 'Marketing', GA: 'General Affairs',
  PROJECT: 'Project', STAFF: 'Staff', OWNER: 'Owner',
};

const ROLE_COLORS: Record<Role, string> = {
  SUPER_ADMIN:       'bg-navy text-white',
  ADMIN:             'bg-blue-100 text-blue-700',
  BUILDING_MANAGER:  'bg-cyan-100 text-cyan-700',
  TENANT_RELATIONS:  'bg-teal-100 text-teal-700',
  ENGINEER:          'bg-orange-100 text-orange-700',
  HRD:               'bg-pink-100 text-pink-700',
  OPS:               'bg-amber-100 text-amber-700',
  FINANCE:           'bg-green-100 text-green-700',
  LEGAL:             'bg-purple-100 text-purple-700',
  MARKOM:            'bg-rose-100 text-rose-700',
  GA:                'bg-yellow-100 text-yellow-700',
  PROJECT:           'bg-indigo-100 text-indigo-700',
  STAFF:             'bg-gray-100 text-gray-600',
  OWNER:             'bg-gold/20 text-yellow-800',
};

const DIVISIONS: Division[] = [
  'HRD','OPS','FINANCE','LEGAL','MARKOM','GA','PROJECT','MANAGEMENT','ENGINEERING',
];

const DIV_LABELS: Record<Division, string> = {
  HRD: 'HRD', OPS: 'Operasional', FINANCE: 'Keuangan', LEGAL: 'Legal',
  MARKOM: 'Marketing', GA: 'General Affairs', PROJECT: 'Project',
  MANAGEMENT: 'Manajemen', ENGINEERING: 'Engineering',
};

// ── Helpers ────────────────────────────────────────────────
function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Avatar Cell ────────────────────────────────────────────
function Avatar({ user }: { user: UserRow }) {
  return (
    <div className="w-8 h-8 rounded-full bg-navy-light flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
      {user.avatar
        ? <img src={user.avatar} alt={user.fullName} className="w-8 h-8 rounded-full object-cover" />
        : initials(user.fullName)
      }
    </div>
  );
}

// ── Create / Edit Modal ────────────────────────────────────
type ModalMode = 'create' | 'edit';

interface CreateForm {
  fullName: string; email: string; username: string;
  password: string; phone: string; role: Role | ''; division: Division | '';
}
interface EditForm {
  fullName: string; phone: string; role: Role | ''; division: Division | '';
}

const EMPTY_CREATE: CreateForm = {
  fullName: '', email: '', username: '', password: '', phone: '', role: '', division: '',
};

function UserFormModal({
  open, mode, user, onClose, onSaved,
}: {
  open:    boolean;
  mode:    ModalMode;
  user:    UserRow | null;
  onClose: () => void;
  onSaved: (u: UserRow) => void;
}) {
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [editForm,   setEditForm]   = useState<EditForm>({ fullName: '', phone: '', role: '', division: '' });
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (mode === 'edit' && user) {
      setEditForm({ fullName: user.fullName, phone: user.phone ?? '', role: user.role, division: user.division });
    } else {
      setCreateForm(EMPTY_CREATE);
    }
  }, [open, mode, user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (mode === 'create') {
        if (!createForm.role)     { setError('Pilih role'); setSaving(false); return; }
        if (!createForm.division) { setError('Pilih divisi'); setSaving(false); return; }
        const payload = {
          fullName: createForm.fullName.trim(),
          email:    createForm.email.trim(),
          username: createForm.username.trim(),
          password: createForm.password,
          phone:    createForm.phone.trim() || undefined,
          role:     createForm.role,
          division: createForm.division,
        };
        const res = await api.post('/users', payload);
        onSaved(res.data.data);
      } else {
        const payload = {
          fullName: editForm.fullName.trim(),
          phone:    editForm.phone.trim() || null,
          role:     editForm.role || undefined,
          division: editForm.division || undefined,
        };
        const res = await api.patch(`/users/${user!.id}`, payload);
        onSaved(res.data.data);
      }
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
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-sm font-semibold text-gray-800">
            {mode === 'create' ? 'Tambah User Baru' : 'Edit User'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-4">
          {mode === 'create' ? (
            <>
              <Field label="Nama Lengkap" required>
                <input
                  type="text" maxLength={100} placeholder="Budi Santoso"
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm((f) => ({ ...f, fullName: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email" required>
                  <input
                    type="email" placeholder="budi@sangroup.id"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
                <Field label="Username" required>
                  <input
                    type="text" maxLength={30} placeholder="budi.s"
                    value={createForm.username}
                    onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Password" required>
                  <input
                    type="password" placeholder="Min. 8 karakter, 1 kapital, 1 angka"
                    value={createForm.password}
                    onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
                <Field label="No. Telepon">
                  <input
                    type="text" placeholder="08xxxxxxxx"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Role" required>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value as Role }))}
                    className={selectCls}
                  >
                    <option value="">-- Pilih role --</option>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </Field>
                <Field label="Divisi" required>
                  <select
                    value={createForm.division}
                    onChange={(e) => setCreateForm((f) => ({ ...f, division: e.target.value as Division }))}
                    className={selectCls}
                  >
                    <option value="">-- Pilih divisi --</option>
                    {DIVISIONS.map((d) => <option key={d} value={d}>{DIV_LABELS[d]}</option>)}
                  </select>
                </Field>
              </div>
            </>
          ) : (
            <>
              <Field label="Nama Lengkap" required>
                <input
                  type="text" maxLength={100}
                  value={editForm.fullName}
                  onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="No. Telepon">
                <input
                  type="text" placeholder="08xxxxxxxx"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Role" required>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as Role }))}
                    className={selectCls}
                  >
                    <option value="">-- Pilih role --</option>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </Field>
                <Field label="Divisi" required>
                  <select
                    value={editForm.division}
                    onChange={(e) => setEditForm((f) => ({ ...f, division: e.target.value as Division }))}
                    className={selectCls}
                  >
                    <option value="">-- Pilih divisi --</option>
                    {DIVISIONS.map((d) => <option key={d} value={d}>{DIV_LABELS[d]}</option>)}
                  </select>
                </Field>
              </div>
            </>
          )}

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-danger">
              <AlertCircle size={12} /> {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50">
              Batal
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-navy hover:bg-navy-light rounded disabled:opacity-50">
              {saving && <Loader2 size={13} className="animate-spin" />}
              {mode === 'create' ? 'Buat User' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// small helpers for the form
const inputCls = 'w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy';
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

// ── Main Page ──────────────────────────────────────────────
const PAGE_SIZE = 15;

export default function UsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const [users, setUsers]   = useState<UserRow[]>([]);
  const [meta, setMeta]     = useState<Meta>({ total: 0, page: 1, limit: PAGE_SIZE, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  // filters
  const [search, setSearch]       = useState('');
  const [debSearch, setDebSearch] = useState('');
  const [roleFilter, setRoleFilter]     = useState('');
  const [divFilter, setDivFilter]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]                 = useState(1);

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editing, setEditing]     = useState<UserRow | null>(null);

  // inline action states
  const [toggling, setToggling]   = useState<string | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (debSearch)    params.search   = debSearch;
      if (roleFilter)   params.role     = roleFilter;
      if (divFilter)    params.division = divFilter;
      if (statusFilter) params.isActive = statusFilter;
      const res = await api.get('/users', { params });
      setUsers(res.data.data);
      setMeta(res.data.meta);
    } catch {
      setError('Gagal memuat data. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [debSearch, roleFilter, divFilter, statusFilter, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function openCreate() { setModalMode('create'); setEditing(null); setModalOpen(true); }
  function openEdit(u: UserRow) { setModalMode('edit'); setEditing(u); setModalOpen(true); }

  function handleSaved(saved: UserRow) {
    setUsers((prev) => {
      const idx = prev.findIndex((u) => u.id === saved.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [saved, ...prev];
    });
    setMeta((m) => ({ ...m, total: m.total + (users.find((u) => u.id === saved.id) ? 0 : 1) }));
  }

  async function handleToggle(u: UserRow) {
    if (!confirm(`${u.isActive ? 'Nonaktifkan' : 'Aktifkan'} user "${u.fullName}"?`)) return;
    setToggling(u.id);
    try {
      const res = await api.patch(`/users/${u.id}/toggle`);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? res.data.data : x)));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? 'Gagal mengubah status');
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(u: UserRow) {
    if (!confirm(`Nonaktifkan user "${u.fullName}" secara permanen?`)) return;
    setDeleting(u.id);
    try {
      const res = await api.delete(`/users/${u.id}`);
      // Soft delete — backend returns updated user with isActive: false; reflect in list
      setUsers((prev) => prev.map((x) => (x.id === u.id ? res.data.data : x)));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? 'Gagal menonaktifkan user');
    } finally {
      setDeleting(null);
    }
  }

  function resetFilters() {
    setSearch(''); setRoleFilter(''); setDivFilter(''); setStatusFilter(''); setPage(1);
  }

  const hasFilter = search || roleFilter || divFilter || statusFilter;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Manajemen User</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Kelola akun pengguna sistem internal SAN Group
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-navy hover:bg-navy-light rounded transition-colors"
        >
          <Plus size={15} />
          Tambah User
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" placeholder="Cari nama, email, username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-8 py-2 text-sm border border-gray-200 rounded w-full focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Role filter */}
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="py-2 px-3 text-sm border border-gray-200 rounded focus:outline-none focus:border-navy"
        >
          <option value="">Semua Role</option>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>

        {/* Division filter */}
        <select
          value={divFilter}
          onChange={(e) => { setDivFilter(e.target.value); setPage(1); }}
          className="py-2 px-3 text-sm border border-gray-200 rounded focus:outline-none focus:border-navy"
        >
          <option value="">Semua Divisi</option>
          {DIVISIONS.map((d) => <option key={d} value={d}>{DIV_LABELS[d]}</option>)}
        </select>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="py-2 px-3 text-sm border border-gray-200 rounded focus:outline-none focus:border-navy"
        >
          <option value="">Semua Status</option>
          <option value="true">Aktif</option>
          <option value="false">Nonaktif</option>
        </select>

        {hasFilter && (
          <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-gray-500 hover:text-danger px-2 py-1">
            <X size={12} /> Reset filter
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400">{meta.total} user</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle size={32} className="text-danger mb-3" />
            <p className="text-sm text-gray-600">{error}</p>
            <button onClick={fetchUsers} className="mt-3 px-4 py-1.5 text-sm text-navy border border-navy rounded hover:bg-navy-50">
              Coba lagi
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users size={40} className="text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-600">
              {hasFilter ? 'Tidak ada user yang cocok' : 'Belum ada user'}
            </p>
            {hasFilter && (
              <button onClick={resetFilters} className="mt-2 text-xs text-navy hover:underline">
                Reset filter
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Divisi</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Login Terakhir</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => {
                  const isCurrentUser = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className={cn('hover:bg-gray-50/50 transition-colors', !u.isActive && 'opacity-60')}>
                      {/* User */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar user={u} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium text-gray-800 truncate">{u.fullName}</p>
                              {isCurrentUser && (
                                <span className="text-xs bg-navy-50 text-navy px-1.5 py-0.5 rounded">Anda</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Username */}
                      <td className="px-4 py-3 text-sm text-gray-600 font-mono">{u.username}</td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', ROLE_COLORS[u.role])}>
                          {u.role === 'SUPER_ADMIN' && <ShieldCheck size={10} />}
                          {u.role === 'ADMIN' && <UserIcon size={10} />}
                          {ROLE_LABELS[u.role]}
                        </span>
                      </td>

                      {/* Division */}
                      <td className="px-4 py-3 text-sm text-gray-600">{DIV_LABELS[u.division]}</td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-block text-xs px-2 py-0.5 rounded-full font-medium',
                          u.isActive ? 'bg-success/10 text-success' : 'bg-gray-100 text-gray-500',
                        )}>
                          {u.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>

                      {/* Last login */}
                      <td className="px-4 py-3 text-xs text-gray-400">{formatDate(u.lastLoginAt)}</td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit — admin & super_admin */}
                          <button
                            onClick={() => openEdit(u)}
                            title="Edit user"
                            className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-navy hover:bg-navy-50 transition-colors"
                          >
                            <Edit2 size={13} />
                          </button>

                          {/* Toggle — super_admin, not self, not SUPER_ADMIN */}
                          {isSuperAdmin && !isCurrentUser && u.role !== 'SUPER_ADMIN' && (
                            <button
                              onClick={() => handleToggle(u)}
                              disabled={toggling === u.id}
                              title={u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                              className={cn(
                                'w-7 h-7 flex items-center justify-center rounded transition-colors',
                                u.isActive
                                  ? 'text-gray-400 hover:text-warning hover:bg-warning/10'
                                  : 'text-gray-400 hover:text-success hover:bg-success/10',
                              )}
                            >
                              {toggling === u.id
                                ? <Loader2 size={13} className="animate-spin" />
                                : u.isActive ? <PowerOff size={13} /> : <Power size={13} />
                              }
                            </button>
                          )}

                          {/* Delete — super_admin, not self, not SUPER_ADMIN */}
                          {isSuperAdmin && !isCurrentUser && u.role !== 'SUPER_ADMIN' && (
                            <button
                              onClick={() => handleDelete(u)}
                              disabled={deleting === u.id}
                              title="Hapus user"
                              className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-danger hover:bg-danger/10 transition-colors"
                            >
                              {deleting === u.id
                                ? <Loader2 size={13} className="animate-spin" />
                                : <Trash2 size={13} />
                              }
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

        {/* Pagination */}
        {!loading && !error && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <p className="text-xs text-gray-500">
              Menampilkan {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} dari {meta.total} user
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={meta.page <= 1}
                className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === meta.totalPages || Math.abs(p - meta.page) <= 1)
                .reduce<(number | '...')[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === '...' ? (
                    <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-gray-400">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={cn(
                        'w-7 h-7 flex items-center justify-center rounded border text-xs transition-colors',
                        meta.page === p
                          ? 'bg-navy text-white border-navy'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-100',
                      )}
                    >
                      {p}
                    </button>
                  ),
                )}
              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={meta.page >= meta.totalPages}
                className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      <UserFormModal
        open={modalOpen}
        mode={modalMode}
        user={editing}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
