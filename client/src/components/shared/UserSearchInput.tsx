import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Check } from 'lucide-react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { cn } from '@/lib/cn';

export interface UserSearchOption {
  id: string;
  fullName: string;
  avatar?: string | null;
}

/**
 * Text-input based assignee picker — filters the already-fetched `users` array
 * client-side as you type, instead of a plain <select>. Not a generic combobox:
 * just enough for the task assignee use-case (single select + clear).
 */
export default function UserSearchInput({
  users, value, onChange, placeholder, clearLabel, className,
}: {
  users: UserSearchOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  clearLabel?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('shared.userSearchInput.placeholder');
  const resolvedClearLabel  = clearLabel ?? t('shared.userSearchInput.clearLabel');
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  useClickOutside(wrapRef, () => { setOpen(false); setQuery(''); });

  const selected = users.find((u) => u.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.fullName.toLowerCase().includes(q));
  }, [users, query]);

  function select(id: string) {
    onChange(id);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={open ? query : (selected?.fullName ?? '')}
          onFocus={() => { setOpen(true); setQuery(''); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          placeholder={selected ? selected.fullName : resolvedPlaceholder}
          className="w-full text-sm border border-gray-200 rounded pl-7 pr-6 py-1.5 outline-none focus:border-navy"
        />
        {selected && !open && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
            title={t('shared.userSearchInput.clear')}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          <button
            type="button"
            onClick={() => select('')}
            className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-50"
          >
            {resolvedClearLabel}
            {!value && <Check size={12} className="text-navy" />}
          </button>
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400">{t('shared.userSearchInput.noMatches')}</p>
          ) : (
            filtered.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => select(u.id)}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 transition-colors',
                  value === u.id ? 'text-navy font-medium' : 'text-gray-700',
                )}
              >
                <span className="truncate">{u.fullName}</span>
                {value === u.id && <Check size={12} className="text-navy flex-shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
