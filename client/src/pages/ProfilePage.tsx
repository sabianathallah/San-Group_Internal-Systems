import { useEffect, useState, useRef, FormEvent } from 'react';
import {
  Camera, Loader2, AlertCircle, CheckCircle2,
  Mail, Phone, Shield, Building2, Calendar, Clock, KeyRound, User,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
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


// ── Helpers ────────────────────────────────────────────────
/** Locale for date formatting — mirrors i18next's active language. */
function dateLocale(language: string): string {
  return language === 'id' ? 'id-ID' : 'en-US';
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function fmt(iso: string | null, language: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(dateLocale(language), {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

function fmtDatetime(iso: string | null, language: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(dateLocale(language), {
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
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError(t('profile.avatar.maxSize')); return; }
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
      setError(t('profile.avatar.uploadError'));
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
          title={t('profile.avatar.uploadTitle')}
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <p className="text-xs text-gray-400">{t('profile.avatar.hint')}</p>
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
  const { t } = useTranslation();
  const [form, setForm]     = useState({ fullName: profile.fullName, phone: profile.phone ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [saved, setSaved]   = useState(false);

  useEffect(() => {
    setForm({ fullName: profile.fullName, phone: profile.phone ?? '' });
  }, [profile]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) { setError(t('profile.form.nameRequired')); return; }
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
      setError(msg ?? t('profile.form.genericError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {t('profile.form.fullName')} <span className="text-danger">*</span>
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
          {t('profile.form.phone')} <span className="text-gray-400 font-normal">{t('profile.form.optional')}</span>
        </label>
        <input
          type="text"
          placeholder={t('profile.form.phonePlaceholder')}
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
          {t('profile.form.save')}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-success">
            <CheckCircle2 size={13} /> {t('profile.form.saved')}
          </span>
        )}
      </div>
    </form>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const updateStore = useAuthStore((s) => s.updateUser);

  const [profile, setProfile]   = useState<FullProfile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [changePwOpen, setChangePwOpen] = useState(false);

  useEffect(() => {
    api.get('/auth/me')
      .then((res) => setProfile(res.data.data))
      .catch(() => setError(t('profile.loadError')))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleProfileSaved(updated: FullProfile) {
    setProfile(updated);
    updateStore({ fullName: updated.fullName, avatar: updated.avatar });
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
        <p className="text-sm text-gray-600">{error || t('profile.loadError')}</p>
        <button onClick={() => window.location.reload()}
          className="mt-3 px-4 py-1.5 text-sm text-navy border border-navy rounded hover:bg-navy-50">
          {t('profile.tryAgain')}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-800">{t('profile.header.title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('profile.header.subtitle')}</p>
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
            <div className="flex flex-col items-center gap-1.5 w-full">
              <span
                className="text-xs font-medium px-2.5 py-1 rounded-full text-center text-white"
                style={{ backgroundColor: profile.role.color }}
              >
                {profile.role.name}
              </span>
              <span
                className="text-xs font-medium px-2.5 py-1 rounded-full text-center"
                style={{ backgroundColor: profile.division.color + '22', color: profile.division.color }}
              >
                {profile.division.name}
              </span>
            </div>
          </div>

          {/* Account info */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('profile.accountInfo.title')}</h3>
            <InfoRow icon={Calendar} label={t('profile.accountInfo.memberSince')}  value={fmt(profile.createdAt, i18n.language)} />
            <InfoRow icon={Clock}    label={t('profile.accountInfo.lastLogin')}    value={fmtDatetime(profile.lastLoginAt, i18n.language)} />
            <InfoRow
              icon={Shield}
              label={t('profile.accountInfo.status')}
              value={
                <span className={cn(
                  'inline-block text-xs px-2 py-0.5 rounded-full font-medium',
                  profile.isActive ? 'bg-success/10 text-success' : 'bg-gray-100 text-gray-500',
                )}>
                  {profile.isActive ? t('profile.accountInfo.active') : t('profile.accountInfo.inactive')}
                </span>
              }
            />
          </div>

          {/* Security */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('profile.security.title')}</h3>
            <button
              onClick={() => setChangePwOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 border border-gray-200 rounded hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <KeyRound size={15} className="text-gray-400" />
              {t('profile.security.changePassword')}
            </button>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="col-span-2 space-y-4">
          {/* Edit profile */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <User size={15} className="text-gray-400" />
              {t('profile.form.title')}
            </h2>
            <EditProfileForm profile={profile} onSaved={handleProfileSaved} />
          </div>

          {/* Read-only account details */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-2">
              <Shield size={15} className="text-gray-400" />
              {t('profile.details.title')}
            </h2>
            <p className="text-xs text-gray-400 mb-3">
              {t('profile.details.note')}
            </p>
            <div className="grid grid-cols-2 gap-x-6">
              <div>
                <InfoRow icon={Mail}      label={t('profile.details.email')}    value={profile.email} />
                <InfoRow icon={User}      label={t('profile.details.username')} value={<span className="font-mono">@{profile.username}</span>} />
              </div>
              <div>
                <InfoRow icon={Shield}    label={t('profile.details.role')}      value={profile.role.name} />
                <InfoRow icon={Building2} label={t('profile.details.division')}  value={profile.division.name} />
              </div>
            </div>
            {profile.phone && (
              <InfoRow icon={Phone} label={t('profile.details.phone')} value={profile.phone} />
            )}
          </div>
        </div>
      </div>

      <ChangePasswordModal open={changePwOpen} onClose={() => setChangePwOpen(false)} />
    </div>
  );
}
