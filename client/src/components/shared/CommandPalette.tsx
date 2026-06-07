import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, Loader2, CheckSquare, Megaphone, StickyNote,
  Folder, Link2, ArrowRight,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';

// ── Types ─────────────────────────────────────────────────────
interface TaskResult    { id: string; type: 'task';    title: string; status: string; priority: string }
interface BulletinResult{ id: string; type: 'bulletin'; title: string; createdAt: string }
interface NoteResult   { id: string; type: 'note';    title: string; updatedAt: string }
interface FileResult   { id: string; type: 'folder' | 'link'; name: string; url?: string; folder?: { id: string; name: string } }

type AnyResult = TaskResult | BulletinResult | NoteResult | FileResult;

interface SearchResults {
  tasks:    TaskResult[];
  bulletins: BulletinResult[];
  notes:    NoteResult[];
  files:    FileResult[];
}

const STATUS_COLORS: Record<string, string> = {
  TODO:        'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  DONE:        'bg-green-100 text-green-700',
  CANCELLED:   'bg-red-100 text-red-600',
};
const STATUS_LABELS: Record<string, string> = {
  TODO: 'Todo', IN_PROGRESS: 'Sedang berjalan', DONE: 'Selesai', CANCELLED: 'Dibatalkan',
};

// ── Single Result Item ────────────────────────────────────────
function ResultItem({
  result, active, onClick,
}: {
  result: AnyResult; active: boolean; onClick: () => void;
}) {
  const base = 'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors rounded-md mx-1';

  if (result.type === 'task') {
    return (
      <div className={cn(base, active ? 'bg-navy-50' : 'hover:bg-gray-50')} onClick={onClick}>
        <CheckSquare size={14} className="text-blue-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 truncate">{result.title}</p>
        </div>
        <span className={cn('text-xs px-1.5 py-0.5 rounded flex-shrink-0', STATUS_COLORS[result.status] ?? 'bg-gray-100 text-gray-600')}>
          {STATUS_LABELS[result.status] ?? result.status}
        </span>
      </div>
    );
  }

  if (result.type === 'bulletin') {
    return (
      <div className={cn(base, active ? 'bg-navy-50' : 'hover:bg-gray-50')} onClick={onClick}>
        <Megaphone size={14} className="text-amber-500 flex-shrink-0" />
        <p className="flex-1 text-sm text-gray-800 truncate">{result.title}</p>
        <span className="text-xs text-gray-400 flex-shrink-0">
          {new Date(result.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
        </span>
      </div>
    );
  }

  if (result.type === 'note') {
    return (
      <div className={cn(base, active ? 'bg-navy-50' : 'hover:bg-gray-50')} onClick={onClick}>
        <StickyNote size={14} className="text-yellow-500 flex-shrink-0" />
        <p className="flex-1 text-sm text-gray-800 truncate">{result.title}</p>
      </div>
    );
  }

  // folder or link
  return (
    <div className={cn(base, active ? 'bg-navy-50' : 'hover:bg-gray-50')} onClick={onClick}>
      {result.type === 'folder'
        ? <Folder size={14} className="text-cyan-500 flex-shrink-0" />
        : <Link2 size={14} className="text-purple-500 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 truncate">{result.name}</p>
        {result.type === 'link' && result.folder && (
          <p className="text-xs text-gray-400 truncate">dalam {result.folder.name}</p>
        )}
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────
function SectionHeader({ label }: { label: string }) {
  return (
    <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
  );
}

// ── Main Component ────────────────────────────────────────────
interface Props { open: boolean; onClose: () => void; }

export default function CommandPalette({ open, onClose }: Props) {
  const navigate  = useNavigate();
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);

  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState<SearchResults | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [activeIdx,setActiveIdx]= useState(0);

  // Flatten results for keyboard nav
  const flat: { result: AnyResult; href: string }[] = [];
  if (results) {
    results.tasks.forEach((t)     => flat.push({ result: t, href: `/tasks` }));
    results.bulletins.forEach((b) => flat.push({ result: b, href: `/bulletin` }));
    results.notes.forEach((n)     => flat.push({ result: n, href: `/notes` }));
    results.files.forEach((f)     => flat.push({ result: f, href: f.type === 'link' && f.url ? f.url : '/database' }));
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await api.get('/search', { params: { q } });
      setResults(res.data.data);
      setActiveIdx(0);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults(null);
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  function handleNavigate(href: string, result: AnyResult) {
    if (result.type === 'link' && 'url' in result && result.url) {
      window.open(result.url, '_blank');
    } else {
      navigate(href);
    }
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, flat.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && flat[activeIdx]) {
      handleNavigate(flat[activeIdx].href, flat[activeIdx].result);
    }
    if (e.key === 'Escape') onClose();
  }

  if (!open) return null;

  const hasResults = results && (results.tasks.length + results.bulletins.length + results.notes.length + results.files.length) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          {loading
            ? <Loader2 size={16} className="text-gray-400 animate-spin flex-shrink-0" />
            : <Search size={16} className="text-gray-400 flex-shrink-0" />}
          <input
            ref={inputRef}
            type="text"
            placeholder="Cari task, bulletin, catatan, file..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none"
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults(null); inputRef.current?.focus(); }}
              className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
          <kbd className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-96 overflow-y-auto py-1">
          {!query && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Search size={24} className="text-gray-200" />
              <p className="text-sm text-gray-400">Ketik untuk mencari di seluruh sistem</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-300">
                <span className="flex items-center gap-1"><kbd className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">↑↓</kbd> navigasi</span>
                <span className="flex items-center gap-1"><kbd className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">↵</kbd> buka</span>
              </div>
            </div>
          )}

          {query && !loading && !hasResults && query.length >= 2 && (
            <p className="text-center text-sm text-gray-400 py-10">
              Tidak ada hasil untuk &ldquo;<strong>{query}</strong>&rdquo;
            </p>
          )}

          {hasResults && (() => {
            let cursor = 0;
            return (
              <>
                {results!.tasks.length > 0 && (
                  <>
                    <SectionHeader label="Task" />
                    {results!.tasks.map((t) => {
                      const idx = cursor++;
                      return <ResultItem key={t.id} result={t} active={activeIdx === idx}
                        onClick={() => handleNavigate('/tasks', t)} />;
                    })}
                  </>
                )}
                {results!.bulletins.length > 0 && (
                  <>
                    <SectionHeader label="Bulletin" />
                    {results!.bulletins.map((b) => {
                      const idx = cursor++;
                      return <ResultItem key={b.id} result={b} active={activeIdx === idx}
                        onClick={() => handleNavigate('/bulletin', b)} />;
                    })}
                  </>
                )}
                {results!.notes.length > 0 && (
                  <>
                    <SectionHeader label="Catatan" />
                    {results!.notes.map((n) => {
                      const idx = cursor++;
                      return <ResultItem key={n.id} result={n} active={activeIdx === idx}
                        onClick={() => handleNavigate('/notes', n)} />;
                    })}
                  </>
                )}
                {results!.files.length > 0 && (
                  <>
                    <SectionHeader label="Database & File" />
                    {results!.files.map((f) => {
                      const idx = cursor++;
                      return <ResultItem key={f.id} result={f} active={activeIdx === idx}
                        onClick={() => handleNavigate(f.url ?? '/database', f)} />;
                    })}
                  </>
                )}
              </>
            );
          })()}
        </div>

        {/* Footer hint */}
        {hasResults && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-400">{flat.length} hasil</span>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <ArrowRight size={11} /> Tekan Enter untuk membuka
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
