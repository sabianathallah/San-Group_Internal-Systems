import { useEffect, useState } from 'react';
import { Save, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';

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
interface PermissionConfig {
  task: TaskPerms; bulletin: BulletinPerms; db_link: DbLinkPerms;
}

interface RoleWithPerms {
  id: string; name: string; slug: string; color: string; level: number;
  description: string | null;
  division: { id: string; name: string; color: string } | null;
  _count: { users: number };
  permissions: PermissionConfig;
  hasCustomPermissions: boolean;
}

// ── Scope options ─────────────────────────────────────────────
const TASK_SCOPE_OPTS: { value: Scope; label: string }[] = [
  { value: 'none',     label: 'Tidak Bisa' },
  { value: 'own',      label: 'Sendiri'    },
  { value: 'division', label: 'Divisi'     },
  { value: 'all',      label: 'Semua'      },
];
const EDIT_SCOPE_OPTS: { value: Scope; label: string }[] = [
  { value: 'none', label: 'Tidak Bisa' },
  { value: 'own',  label: 'Milik Sendiri' },
  { value: 'all',  label: 'Semua' },
];
const AUDIENCE_SCOPE_OPTS: { value: AudienceScope; label: string }[] = [
  { value: 'none',     label: 'Tidak Bisa'     },
  { value: 'division', label: 'Divisi Sendiri'  },
  { value: 'all',      label: 'Semua'           },
];
const VIEW_DB_SCOPE_OPTS: { value: Scope; label: string }[] = [
  { value: 'none',     label: 'Tidak Bisa' },
  { value: 'division', label: 'Divisi'     },
  { value: 'all',      label: 'Semua'      },
];

// ── Sub-components ────────────────────────────────────────────
function ScopeSelector<T extends string>({
  value, options, onChange, disabled,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex rounded-md overflow-hidden border border-gray-200">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1 text-xs font-medium transition-colors border-r border-gray-200 last:border-r-0',
            value === opt.value
              ? 'bg-navy text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  checked, onChange, disabled,
}: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
        checked ? 'bg-navy' : 'bg-gray-300',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span
        className={cn(
          'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4.5' : 'translate-x-0.5',
        )}
      />
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
  const [roles,        setRoles]        = useState<RoleWithPerms[]>([]);
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [perms,        setPerms]        = useState<PermissionConfig | null>(null);
  const [isDirty,      setIsDirty]      = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [toast,        setToast]        = useState<string | null>(null);
  const [error,        setError]        = useState<string | null>(null);

  // Fetch all roles + permissions
  useEffect(() => {
    setLoading(true);
    api.get('/permissions/roles')
      .then((res) => {
        const data: RoleWithPerms[] = res.data.data ?? [];
        setRoles(data);
        if (data.length > 0 && !selectedId) {
          setSelectedId(data[0].id);
          setPerms(JSON.parse(JSON.stringify(data[0].permissions)));
        }
      })
      .catch(() => setError('Gagal memuat data permission'))
      .finally(() => setLoading(false));
  }, []);

  function handleSelectRole(role: RoleWithPerms) {
    if (isDirty && !confirm('Ada perubahan yang belum disimpan. Lanjutkan?')) return;
    setSelectedId(role.id);
    setPerms(JSON.parse(JSON.stringify(role.permissions)));
    setIsDirty(false);
  }

  function update<K extends keyof PermissionConfig>(
    feature: K,
    field: keyof PermissionConfig[K],
    value: unknown,
  ) {
    if (!perms) return;
    setPerms((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [feature]: { ...prev[feature], [field]: value },
      };
    });
    setIsDirty(true);
  }

  async function handleSave() {
    if (!selectedId || !perms) return;
    setSaving(true);
    try {
      await api.put(`/permissions/roles/${selectedId}`, perms);
      // Update cached role
      setRoles((prev) => prev.map((r) =>
        r.id === selectedId
          ? { ...r, permissions: JSON.parse(JSON.stringify(perms)), hasCustomPermissions: true }
          : r,
      ));
      setIsDirty(false);
      setToast('Permission berhasil disimpan');
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast('Gagal menyimpan permission');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  const selectedRole = roles.find((r) => r.id === selectedId);
  const isSuperAdmin = (selectedRole?.level ?? 99) <= 1;

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
      <div className="w-56 flex-shrink-0 flex flex-col bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Roles</h2>
          <p className="text-xs text-gray-400 mt-0.5">Pilih role untuk diedit</p>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => handleSelectRole(role)}
              className={cn(
                'w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors',
                selectedId === role.id
                  ? 'bg-navy/5 text-navy'
                  : 'text-gray-700 hover:bg-gray-50',
              )}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: role.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{role.name}</p>
                <p className="text-xs text-gray-400">Level {role.level}</p>
              </div>
              {role.hasCustomPermissions && (
                <span className="w-1.5 h-1.5 rounded-full bg-info flex-shrink-0" title="Kustom" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Right: permission editor ── */}
      <div className="flex-1 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
        {selectedRole && perms ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <span
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: selectedRole.color }}
                />
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">{selectedRole.name}</h2>
                  <p className="text-xs text-gray-400">
                    Level {selectedRole.level}
                    {isSuperAdmin && ' — SuperAdmin tidak dapat dikonfigurasi'}
                    {!isSuperAdmin && selectedRole.hasCustomPermissions && ' — Permission kustom'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={!isDirty || saving || isSuperAdmin}
                className={cn(
                  'flex items-center gap-1.5 h-8 px-4 text-sm font-medium rounded transition-colors',
                  isDirty && !isSuperAdmin
                    ? 'bg-navy text-white hover:bg-navy-light'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed',
                )}
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Simpan
              </button>
            </div>

            {isSuperAdmin && (
              <div className="mx-6 mt-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center gap-2">
                <ShieldCheck size={15} />
                SuperAdmin selalu memiliki semua izin penuh dan tidak dapat dikonfigurasi.
              </div>
            )}

            {/* Permission matrix */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Task */}
              <Section title="Task">
                <PermRow label="Lihat task">
                  <ScopeSelector
                    value={perms.task.view}
                    options={TASK_SCOPE_OPTS}
                    onChange={(v) => update('task', 'view', v)}
                    disabled={isSuperAdmin}
                  />
                </PermRow>
                <PermRow label="Buat task">
                  <Toggle
                    checked={perms.task.create}
                    onChange={(v) => update('task', 'create', v)}
                    disabled={isSuperAdmin}
                  />
                </PermRow>
                <PermRow label="Edit task">
                  <ScopeSelector
                    value={perms.task.edit}
                    options={TASK_SCOPE_OPTS}
                    onChange={(v) => update('task', 'edit', v)}
                    disabled={isSuperAdmin}
                  />
                </PermRow>
                <PermRow label="Hapus task">
                  <ScopeSelector
                    value={perms.task.delete}
                    options={TASK_SCOPE_OPTS}
                    onChange={(v) => update('task', 'delete', v)}
                    disabled={isSuperAdmin}
                  />
                </PermRow>
                <PermRow label="Lihat task private orang lain">
                  <Toggle
                    checked={perms.task.viewPrivate}
                    onChange={(v) => update('task', 'viewPrivate', v)}
                    disabled={isSuperAdmin}
                  />
                </PermRow>
              </Section>

              {/* Bulletin */}
              <Section title="Bulletin">
                <PermRow label="Lihat bulletin">
                  <Toggle
                    checked={perms.bulletin.view}
                    onChange={(v) => update('bulletin', 'view', v)}
                    disabled={isSuperAdmin}
                  />
                </PermRow>
                <PermRow label="Buat & publish bulletin">
                  <Toggle
                    checked={perms.bulletin.create}
                    onChange={(v) => update('bulletin', 'create', v)}
                    disabled={isSuperAdmin}
                  />
                </PermRow>
                <PermRow label="Target audience">
                  <ScopeSelector
                    value={perms.bulletin.audienceScope}
                    options={AUDIENCE_SCOPE_OPTS}
                    onChange={(v) => update('bulletin', 'audienceScope', v)}
                    disabled={isSuperAdmin || !perms.bulletin.create}
                  />
                </PermRow>
                <PermRow label="Edit bulletin">
                  <ScopeSelector
                    value={perms.bulletin.edit}
                    options={EDIT_SCOPE_OPTS}
                    onChange={(v) => update('bulletin', 'edit', v)}
                    disabled={isSuperAdmin}
                  />
                </PermRow>
                <PermRow label="Hapus bulletin">
                  <ScopeSelector
                    value={perms.bulletin.delete}
                    options={EDIT_SCOPE_OPTS}
                    onChange={(v) => update('bulletin', 'delete', v)}
                    disabled={isSuperAdmin}
                  />
                </PermRow>
              </Section>

              {/* DB Links */}
              <Section title="DB Links">
                <PermRow label="Lihat folder">
                  <ScopeSelector
                    value={perms.db_link.view}
                    options={VIEW_DB_SCOPE_OPTS}
                    onChange={(v) => update('db_link', 'view', v)}
                    disabled={isSuperAdmin}
                  />
                </PermRow>
                <PermRow label="Tambah link ke folder">
                  <Toggle
                    checked={perms.db_link.addLink}
                    onChange={(v) => update('db_link', 'addLink', v)}
                    disabled={isSuperAdmin}
                  />
                </PermRow>
                <PermRow label="Kelola folder (buat/edit/hapus)">
                  <Toggle
                    checked={perms.db_link.manageFolder}
                    onChange={(v) => update('db_link', 'manageFolder', v)}
                    disabled={isSuperAdmin}
                  />
                </PermRow>
                <PermRow label="Bagikan folder ke divisi lain">
                  <Toggle
                    checked={perms.db_link.shareFolder}
                    onChange={(v) => update('db_link', 'shareFolder', v)}
                    disabled={isSuperAdmin}
                  />
                </PermRow>
              </Section>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <ShieldCheck size={40} className="text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-600">Pilih role untuk mengonfigurasi permission</p>
          </div>
        )}
      </div>
    </div>
  );
}
