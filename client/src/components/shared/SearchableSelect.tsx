import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Check } from 'lucide-react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { cn } from '@/lib/cn';

export interface SearchableSelectOption {
  id: string;
  label: string;
  color?: string;
}

/**
 * Text-input based single-select — filters `options` client-side as you type,
 * instead of a plain <select> that forces scrolling through a long list
 * (e.g. 24 roles, 13 divisions). Same interaction pattern as UserSearchInput,
 * generalized to any {id, label} option.
 */
export default function SearchableSelect({
  options, value, onChange, placeholder, clearLabel, className, disabled,
}: {
  options: SearchableSelectOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  clearLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('shared.searchableSelect.placeholder');
  const resolvedClearLabel  = clearLabel ?? t('shared.searchableSelect.clearLabel');
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  useClickOutside(wrapRef, () => { setOpen(false); setQuery(''); });

  const selected = options.find((o) => o.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

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
          value={open ? query : (selected?.label ?? '')}
          disabled={disabled}
          onFocus={() => { if (!disabled) { setOpen(true); setQuery(''); } }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          placeholder={selected ? selected.label : resolvedPlaceholder}
          className="w-full text-sm border border-gray-200 rounded pl-7 pr-6 py-1.5 outline-none focus:border-navy disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
        />
        {selected && !open && !disabled && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
            title={t('shared.searchableSelect.clear')}
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
            <p className="px-3 py-2 text-xs text-gray-400">{t('shared.searchableSelect.noMatches')}</p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => select(o.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 transition-colors',
                  value === o.id ? 'text-navy font-medium' : 'text-gray-700',
                )}
              >
                {o.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: o.color }} />}
                <span className="truncate flex-1">{o.label}</span>
                {value === o.id && <Check size={12} className="text-navy flex-shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
