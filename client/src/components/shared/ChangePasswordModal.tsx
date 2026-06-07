import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { ROUTES } from '@/lib/constants';

export default function ChangePasswordModal({
  open,
  onClose,
}: {
  open:    boolean;
  onClose: () => void;
}) {
  const logout   = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const [form, setForm]       = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setError('');
      setSuccess(false);
    }
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setError('Password confirmation does not match');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.patch('/auth/change-password', form);
      setSuccess(true);
      // All refresh tokens invalidated → force re-login after 2s
      setTimeout(() => { logout(); navigate(ROUTES.LOGIN, { replace: true }); }, 2000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'An error occurred');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-800">Change Password</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        {success ? (
          <div className="px-5 py-10 flex flex-col items-center text-center gap-3">
            <CheckCircle2 size={36} className="text-success" />
            <p className="text-sm font-medium text-gray-800">Password changed successfully</p>
            <p className="text-xs text-gray-500">You will be redirected to the login page...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-4">
            {[
              { key: 'oldPassword',     label: 'Current Password',        placeholder: 'Your current password' },
              { key: 'newPassword',     label: 'New Password',             placeholder: 'Min. 8 chars, 1 uppercase, 1 number' },
              { key: 'confirmPassword', label: 'Confirm New Password',     placeholder: 'Repeat new password' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {label} <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  placeholder={placeholder}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy"
                />
              </div>
            ))}

            {error && (
              <p className="flex items-center gap-1.5 text-xs text-danger">
                <AlertCircle size={12} /> {error}
              </p>
            )}

            <p className="text-xs text-gray-400">
              After changing your password, you will be automatically logged out from all devices.
            </p>

            <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-navy hover:bg-navy-light rounded disabled:opacity-50">
                {saving && <Loader2 size={13} className="animate-spin" />}
                Save
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
