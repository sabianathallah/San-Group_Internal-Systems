import { useEffect, useState, useRef, FormEvent } from 'react';
import {
  Camera, Loader2, AlertCircle, CheckCircle2,
  Mail, Phone, Shield, Building2, Calendar, Clock, KeyRound, User,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/cn';
import ChangePasswordModal from '@/components/shared/ChangePasswordModal';

// ── Types ──────────────────────────────────────────────────
interface FullProfile {
  id:          string;
  email:       string;
  username:    string;
  fullName:    string;
  phone:       string | null;
  avatar:      string | null;
  role:        { id: string; name: string; slug: string; color: string; level: number };
  division:    { id: string; name: string; slug: string; color: string };
  isActive:    boolean;
  lastLoginAt: string | null;
  createdAt:   string;
}

// ── Constants ──────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN:          'Super Admin',
  ADMIN:                'Admin',
  OWNER:                'Owner',
  DIRECTOR:             'Director',
  PROPERTY_MANAGER:     'Property Manager',
  LEASING_MANAGER:      'Leasing Manager',
  LEASING_ASSISTANT:    'Leasing Assistant',
  LEASING_STAFF:        'Leasing Staff',
  TENANT_RELATIONS:     'Tenant Relations',
  FACILITY_MANAGER:     'Facility Manager',
  CHIEF_ENGINEER:       'Chief Engineer',
  ENGINEER:             'Engineer',
  FINANCE_MANAGER:      'Finance Manager',
  ASST_FINANCE_MANAGER: 'Asst. Finance Manager',
  ACCOUNTANT:           'Accountant',
  LEGAL_HEAD:           'Legal Head',
  LEGAL_SPV:            'Legal SPV',
  LEGAL_STAFF:          'Legal Staff',
  TAX_STAFF:            'Tax Staff',
  HR_MANAGER:           'HR Manager',
  HR_SPV:               'HR SPV',
  HR_STAFF:             'HR Staff',
  FNB_MANAGER:          'F&B Manager',
  GA_MANAGER:           'GA Manager',
  STAFF:                'Staff',
};

const DIV_LABELS: Record<string, string> = {
  MANAGEMENT:  'Manajemen',
  RETAIL:      'Retail',
  HOTEL:       'Hotel & Ballroom',
  HOUSING:     'Housing',
  FNB:         'F&B',
  GENERAL:     'General',
  LEASING:     'Leasing',
  PROPERTY:    'Property',
  ENGINEERING: 'Engineering',
  FINANCE:     'Finance',
  LEGAL:       'Legal',
  TAX:         'Tax',
  HR:          'HR',
  GA:          'General Affairs',
};

// ── Helpers ────────────────────────────────────────────────
function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

function fmtDatetime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Avatar Upload ──────────────────────────────────────────
function AvatarUpload({
  profile,
  onUpdated,
}: {
  profile:   FullProfile;
  onUpdated: (avatar: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('Ukuran file maksimal 2MB'); return; }
    setError('');
    setUploading(true);
    const form = new FormData();
    form.append('avatar', file);
    try {
      const res = await api.patch('/users/me/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUpdated(res.data.data.avatar);
    } catch {
      setError('Gagal mengupload avatar');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div className="w-24 h-24 rounded-full bg-navy-light flex items-center justify-center text-white text-2xl font-semibold overflow-hidden ring-4 ring-white shadow-md">
          {profile.avatar
            ? <img src={profile.avatar} alt={profile.fullName} className="w-full h-full object-cover" />
            : initials(profile.fullName)
          }
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-navy border-2 border-white flex items-center justify-center text-white hover:bg-navy-light transition-colors disabled:opacity-60"
          title="Upload foto"
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <p className="text-xs text-gray-400">JPG, PNG, WebP — maks. 2MB</p>
    </div>
  );
}

// ── Info Row ───────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value }: {
  icon:  React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <Icon size={15} className="text-gray-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <div className="text-sm text-gray-800">{value}</div>
      </div>
    </div>
  );
}

// ── Edit Profile Form ──────────────────────────────────────
function EditProfileForm({
  profile,
  onSaved,
}: {
  profile:  FullProfile;
  onSaved:  (updated: FullProfile) => void;
}) {
  const [form, setForm]     = useState({ fullName: profile.fullName, phone: profile.phone ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [saved, setSaved]   = useState(false);

  useEffect(() => {
    setForm({ fullName: profile.fullName, phone: profile.phone ?? '' });
  }, [profile]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) { setError('Nama lengkap tidak boleh kosong'); return; }
    setSaving(true); setError(''); setSaved(false);
    try {
      const res = await api.patch('/users/me', {
        fullName: form.fullName.trim(),
        phone:    form.phone.trim() || null,
      });
      onSaved(res.data.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Nama Lengkap <span className="text-danger">*</span>
        </label>
        <input
          type="text" maxLength={100}
          value={form.fullName}
          onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
          className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          No. Telepon <span className="text-gray-400 font-normal">(opsional)</span>
        </label>
        <input
          type="text"
          placeholder="08xxxxxxxxxx"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy"
        />
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-danger">
          <AlertCircle size={12} /> {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-navy hover:bg-navy-light rounded disabled:opacity-50 transition-colors">
          {saving && <Loader2 size={13} className="animate-spin" />}
          Simpan Perubahan
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-success">
            <CheckCircle2 size={13} /> Tersimpan
          </span>
        )}
      </div>
    </form>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function ProfilePage() {
  const updateStore = useAuthStore((s) => s.updateUser);

  const [profile, setProfile]   = useState<FullProfile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [changePwOpen, setChangePwOpen] = useState(false);

  useEffect(() => {
    api.get('/auth/me')
      .then((res) => setProfile(res.data.data))
      .catch(() => setError('Gagal memuat profil'))
      .finally(() => setLoading(false));
  }, []);

  function handleProfileSaved(updated: FullProfile) {
    setProfile(updated);
    // Sync name and avatar into authStore so header updates immediately
    updateStore({ name: updated.fullName, avatar: updated.avatar });
  }

  function handleAvatarUpdated(avatar: string) {
    setProfile((p) => p ? { ...p, avatar } : p);
    updateStore({ avatar });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle size={32} className="text-danger mb-3" />
        <p className="text-sm text-gray-600">{error || 'Gagal memuat profil'}</p>
        <button onClick={() => window.location.reload()}
          className="mt-3 px-4 py-1.5 text-sm text-navy border border-navy rounded hover:bg-navy-50">
          Coba lagi
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Profil Saya</h1>
        <p className="text-sm text-gray-500 mt-0.5">Kelola informasi dan keamanan akun Anda</p>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* ── Left column ── */}
        <div className="col-span-1 space-y-4">
          {/* Avatar card */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col items-center gap-4">
            <AvatarUpload profile={profile} onUpdated={handleAvatarUpdated} />
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-800">{profile.fullName}</p>
              <p className="text-xs text-gray-400 mt-0.5">@{profile.username}</p>
            </div>
            <div className="flex flex-col gap-1.5 w-full">
              <span
                className="text-xs font-medium px-2.5 py-1 rounded-full text-center text-white"
                style={{ backgroundColor: profile.role.color }}
              >
                {profile.role.name}
              </span>
              <span
                className="text-xs font-medium px-2.5 py-1 rounded-full text-center text-white"
                style={{ backgroundColor: profile.division.color }}
              >
                {profile.division.name}
              </span>
            </div>
          </div>

          {/* Account info */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Info Akun</h3>
            <InfoRow icon={Calendar} label="Bergabung sejak" value={fmt(profile.createdAt)} />
            <InfoRow icon={Clock}    label="Login terakhir"  value={fmtDatetime(profile.lastLoginAt)} />
            <InfoRow
              icon={Shield}
              label="Status akun"
              value={
                <span className={cn(
                  'inline-block text-xs px-2 py-0.5 rounded-full font-medium',
                  profile.isActive ? 'bg-success/10 text-success' : 'bg-gray-100 text-gray-500',
                )}>
                  {profile.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
              }
            />
          </div>

          {/* Security */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Keamanan</h3>
            <button
              onClick={() => setChangePwOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 border border-gray-200 rounded hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <KeyRound size={15} className="text-gray-400" />
              Ganti Password
            </button>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="col-span-2 space-y-4">
          {/* Edit profile */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <User size={15} className="text-gray-400" />
              Informasi Pribadi
            </h2>
            <EditProfileForm profile={profile} onSaved={handleProfileSaved} />
          </div>

          {/* Read-only account details */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-2">
              <Shield size={15} className="text-gray-400" />
              Detail Akun
            </h2>
            <p className="text-xs text-gray-400 mb-3">
              Informasi berikut dikelola oleh administrator dan tidak dapat diubah sendiri.
            </p>
            <div className="grid grid-cols-2 gap-x-6">
              <div>
                <InfoRow icon={Mail}      label="Email"    value={profile.email} />
                <InfoRow icon={User}      label="Username" value={<span className="font-mono">@{profile.username}</span>} />
              </div>
              <div>
                <InfoRow icon={Shield}    label="Role"     value={profile.role.name} />
                <InfoRow icon={Building2} label="Divisi"   value={profile.division.name} />
              </div>
            </div>
            {profile.phone && (
              <InfoRow icon={Phone} label="No. Telepon" value={profile.phone} />
            )}
          </div>
        </div>
      </div>

      <ChangePasswordModal open={changePwOpen} onClose={() => setChangePwOpen(false)} />
    </div>
  );
}
