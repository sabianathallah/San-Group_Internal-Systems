import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore, User } from '@/stores/authStore';
import { ROUTES } from '@/lib/constants';
import api from '@/lib/api';
import { cn } from '@/lib/cn';

interface LoginResponse {
  success: boolean;
  data: {
    accessToken: string;
    user: User;
  };
  message: string;
}

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!identifier.trim()) return t('login.errors.identifierRequired');
    if (!password) return t('login.errors.passwordRequired');
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const { data: res } = await api.post<LoginResponse>('/auth/login', {
        identifier: identifier.trim(),
        password,
      });

      const { accessToken, user } = res.data;
      login(user, accessToken);

      navigate(ROUTES.DASHBOARD, { replace: true });
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, t('login.errors.generic'));
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      {/* Card */}
      <div className="bg-white border border-gray-200 rounded-lg px-8 py-9">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img
            src="/logo-san.png"
            alt="SAN Group"
            className="h-16 w-auto object-contain mb-2"
          />
          <p className="text-xs text-gray-400 mt-0.5">{t('login.tagline')}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <h2 className="text-base font-semibold text-gray-800 mb-5">{t('login.signIn')}</h2>

          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded bg-danger-light border-l-2 border-danger">
              <p className="text-xs text-danger leading-relaxed">{error}</p>
            </div>
          )}

          {/* Identifier */}
          <div className="space-y-1">
            <label htmlFor="identifier" className="block text-sm font-medium text-gray-700">
              {t('login.identifierLabel')}
            </label>
            <input
              id="identifier"
              type="text"
              autoComplete="username"
              autoFocus
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (error) setError(null);
              }}
              placeholder={t('login.identifierPlaceholder')}
              disabled={loading}
              className={cn(
                'w-full h-9 px-3 text-sm rounded border bg-white placeholder:text-gray-400 text-gray-800',
                'border-gray-300 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy-50',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors duration-150',
              )}
            />
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              {t('login.passwordLabel')}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="••••••••"
                disabled={loading}
                className={cn(
                  'w-full h-9 pl-3 pr-10 text-sm rounded border bg-white placeholder:text-gray-400 text-gray-800',
                  'border-gray-300 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy-50',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors duration-150',
                )}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={cn(
              'w-full h-10 flex items-center justify-center gap-2 rounded',
              'bg-navy text-white text-sm font-medium',
              'hover:bg-navy-light active:bg-navy-lighter',
              'disabled:opacity-60 disabled:cursor-not-allowed',
              'transition-colors duration-150 mt-6',
            )}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t('login.signingIn')}
              </>
            ) : (
              t('login.signIn')
            )}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-gray-400 mt-5">
        {t('login.footer', { year: new Date().getFullYear() })}
      </p>
    </div>
  );
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    err.response &&
    typeof err.response === 'object' &&
    'data' in err.response &&
    err.response.data &&
    typeof err.response.data === 'object' &&
    'message' in err.response.data &&
    typeof (err.response.data as { message: unknown }).message === 'string'
  ) {
    return (err.response.data as { message: string }).message;
  }
  return fallback;
}
