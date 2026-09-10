import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Plus, Check, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import api from '@/lib/api';

export interface Warehouse { id: string; name: string; address: string | null }

let warehouseCache: Warehouse[] | null = null;
let warehousePromise: Promise<Warehouse[]> | null = null;

async function fetchWarehouses(): Promise<Warehouse[]> {
  if (warehouseCache) return warehouseCache;
  if (!warehousePromise) {
    warehousePromise = api.get('/inventory/warehouses').then((r) => {
      warehouseCache = r.data.data ?? [];
      return warehouseCache!;
    });
  }
  return warehousePromise;
}

/** Invalidate the shared warehouse cache — call after creating a new one elsewhere. */
export function invalidateWarehouseCache() {
  warehouseCache = null;
  warehousePromise = null;
}

/**
 * Searchable location/warehouse combobox: type to filter, pick an existing
 * warehouse, or create a new one inline when nothing matches. Backed by a
 * small in-memory cache shared across every instance on the page so opening
 * several pickers (asset form, transaction form, opname session) doesn't
 * re-fetch the list each time.
 */
export default function WarehouseSelect({
  value, onChange, placeholder, autoFocus,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [highlighted, setHighlighted] = useState(0);
  const [creating, setCreating] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchWarehouses().then(setWarehouses); }, []);
  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return warehouses;
    return warehouses.filter((w) => w.name.toLowerCase().includes(q));
  }, [warehouses, query]);

  const exactMatch = warehouses.some((w) => w.name.toLowerCase() === query.trim().toLowerCase());
  const canCreate = query.trim().length > 0 && !exactMatch;

  function selectWarehouse(name: string) {
    onChange(name);
    setQuery(name);
    setOpen(false);
  }

  async function createAndSelect() {
    const name = query.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const res = await api.post('/inventory/warehouses', { name });
      const created: Warehouse = res.data.data;
      invalidateWarehouseCache();
      setWarehouses((prev) => (prev.some((w) => w.id === created.id) ? prev : [...prev, created].sort((a, b) => a.name.localeCompare(b.name))));
      selectWarehouse(created.name);
    } catch {
      // Backend create is idempotent by name, so a race is harmless — just select what was typed.
      selectWarehouse(name);
    } finally {
      setCreating(false);
    }
  }

  const options = filtered;
  const totalRows = options.length + (canCreate ? 1 : 0);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) { if (e.key === 'ArrowDown' || e.key === 'Enter') setOpen(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, totalRows - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted < options.length) selectWarehouse(options[highlighted].name);
      else if (canCreate) createAndSelect();
    } else if (e.key === 'Escape') { setOpen(false); }
  }

  return (
    <div ref={rootRef} className="relative">
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 text-sm border rounded-lg bg-white transition-shadow',
        open ? 'border-navy ring-2 ring-navy/10' : 'border-gray-200',
      )}>
        <MapPin size={14} className="text-gray-400 flex-shrink-0" />
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setHighlighted(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? t('inventory.warehouse.searchPlaceholder')}
          className="flex-1 min-w-0 outline-none text-gray-700 placeholder:text-gray-400"
        />
        {!open && <Search size={13} className="text-gray-300 flex-shrink-0" />}
      </div>

      {open && (
        <div className="absolute z-20 mt-1.5 w-full bg-white rounded-xl border border-gray-100 shadow-lg shadow-gray-900/5 max-h-64 overflow-y-auto py-1.5">
          {options.length === 0 && !canCreate && (
            <p className="px-3 py-3 text-xs text-gray-400 text-center">{t('inventory.warehouse.noMatches')}</p>
          )}
          {options.map((w, i) => (
            <button
              key={w.id}
              type="button"
              onMouseEnter={() => setHighlighted(i)}
              onClick={() => selectWarehouse(w.name)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                highlighted === i ? 'bg-navy/[0.06]' : 'hover:bg-gray-50',
              )}
            >
              <div className="w-7 h-7 rounded-lg bg-navy/10 flex items-center justify-center flex-shrink-0">
                <MapPin size={13} className="text-navy" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-gray-800 font-medium truncate">{w.name}</p>
                {w.address && <p className="text-[11px] text-gray-400 truncate">{w.address}</p>}
              </div>
              {value === w.name && <Check size={14} className="text-navy flex-shrink-0" />}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onMouseEnter={() => setHighlighted(options.length)}
              onClick={createAndSelect}
              disabled={creating}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm border-t border-gray-50 mt-1 pt-2.5 transition-colors',
                highlighted === options.length ? 'bg-emerald-50' : 'hover:bg-emerald-50/60',
              )}
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Plus size={13} className="text-emerald-600" />
              </div>
              <span className="text-emerald-700 font-medium">{t('inventory.warehouse.createNew', { name: query.trim() })}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
