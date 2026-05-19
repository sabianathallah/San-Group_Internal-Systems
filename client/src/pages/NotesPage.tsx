import { useEffect, useState, useRef, FormEvent, useMemo } from 'react';
import {
  StickyNote, Plus, Search, X, Pin, PinOff,
  Trash2, Edit2, Loader2, AlertCircle,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { useNoteStore, Note, NoteColor } from '@/stores/noteStore';

// ── Color Config ───────────────────────────────────────────
const COLOR_MAP: Record<NoteColor, { bg: string; border: string; dot: string }> = {
  yellow: { bg: 'bg-yellow-50',  border: 'border-yellow-200', dot: 'bg-yellow-400'  },
  blue:   { bg: 'bg-blue-50',    border: 'border-blue-200',   dot: 'bg-blue-400'    },
  green:  { bg: 'bg-green-50',   border: 'border-green-200',  dot: 'bg-green-400'   },
  pink:   { bg: 'bg-pink-50',    border: 'border-pink-200',   dot: 'bg-pink-400'    },
  purple: { bg: 'bg-purple-50',  border: 'border-purple-200', dot: 'bg-purple-400'  },
  gray:   { bg: 'bg-gray-50',    border: 'border-gray-300',   dot: 'bg-gray-400'    },
  orange: { bg: 'bg-orange-50',  border: 'border-orange-200', dot: 'bg-orange-400'  },
};

const COLOR_OPTS: NoteColor[] = ['yellow', 'blue', 'green', 'pink', 'purple', 'gray', 'orange'];

// ── Note Form Modal ────────────────────────────────────────
interface FormState {
  title:    string;
  content:  string;
  color:    NoteColor;
  isPinned: boolean;
}

const EMPTY_FORM: FormState = { title: '', content: '', color: 'yellow', isPinned: false };

function NoteFormModal({
  open,
  note,
  onClose,
  onSaved,
}: {
  open:    boolean;
  note:    Note | null;
  onClose: () => void;
  onSaved: (n: Note) => void;
}) {
  const [form, setForm]     = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm(
      note
        ? { title: note.title ?? '', content: note.content, color: note.color, isPinned: note.isPinned }
        : EMPTY_FORM,
    );
    setError('');
    setTimeout(() => textRef.current?.focus(), 80);
  }, [open, note]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.content.trim()) { setError('Konten tidak boleh kosong'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        title:    form.title.trim() || undefined,
        content:  form.content.trim(),
        color:    form.color,
        isPinned: form.isPinned,
      };
      const res = note
        ? await api.patch(`/notes/${note.id}`, payload)
        : await api.post('/notes', payload);
      onSaved(res.data.data);
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
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-800">
            {note ? 'Edit Note' : 'Note Baru'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Judul <span className="font-normal text-gray-400">(opsional)</span>
            </label>
            <input
              type="text"
              maxLength={100}
              placeholder="Tambah judul..."
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Konten <span className="text-danger">*</span>
            </label>
            <textarea
              ref={textRef}
              rows={6}
              maxLength={2000}
              placeholder="Tulis catatan..."
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy"
            />
            <p className="text-right text-xs text-gray-400 -mt-1">{form.content.length}/2000</p>
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Warna</label>
            <div className="flex gap-2">
              {COLOR_OPTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className={cn(
                    'w-6 h-6 rounded-full border-2 transition-transform',
                    COLOR_MAP[c].dot,
                    form.color === c ? 'border-navy scale-125' : 'border-transparent hover:scale-110',
                  )}
                />
              ))}
            </div>
          </div>

          {/* Pin toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.isPinned}
              onChange={(e) => setForm((f) => ({ ...f, isPinned: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-navy focus:ring-navy"
            />
            <span className="text-sm text-gray-700">Pin catatan ini</span>
          </label>

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-danger">
              <AlertCircle size={12} /> {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-navy hover:bg-navy-light rounded disabled:opacity-50"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {note ? 'Simpan' : 'Buat Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Note Card ──────────────────────────────────────────────
function NoteCard({
  note,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  note:        Note;
  onEdit:      (n: Note) => void;
  onDelete:    (id: string) => void;
  onTogglePin: (note: Note) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const { bg, border } = COLOR_MAP[note.color];

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Hapus note ini?')) return;
    setDeleting(true);
    try {
      await api.delete(`/notes/${note.id}`);
      onDelete(note.id);
    } catch {
      setDeleting(false);
    }
  }

  function handlePin(e: React.MouseEvent) {
    e.stopPropagation();
    onTogglePin(note);
  }

  const date = new Date(note.updatedAt).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <div
      onClick={() => onEdit(note)}
      className={cn(
        'group relative rounded-lg border p-4 cursor-pointer break-inside-avoid mb-4',
        'transition-shadow hover:shadow-md',
        bg, border,
      )}
    >
      {/* Action buttons — visible on hover */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handlePin}
          title={note.isPinned ? 'Lepas pin' : 'Pin note'}
          className={cn(
            'w-6 h-6 flex items-center justify-center rounded',
            'bg-white/70 hover:bg-white text-gray-500 hover:text-navy transition-colors',
          )}
        >
          {note.isPinned ? <PinOff size={12} /> : <Pin size={12} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(note); }}
          title="Edit"
          className="w-6 h-6 flex items-center justify-center rounded bg-white/70 hover:bg-white text-gray-500 hover:text-navy transition-colors"
        >
          <Edit2 size={12} />
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          title="Hapus"
          className="w-6 h-6 flex items-center justify-center rounded bg-white/70 hover:bg-white text-gray-500 hover:text-danger transition-colors"
        >
          {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        </button>
      </div>

      {/* Pin badge */}
      {note.isPinned && (
        <div className="flex items-center gap-1 mb-2">
          <Pin size={10} className="text-gray-500" />
          <span className="text-xs text-gray-500">Disematkan</span>
        </div>
      )}

      {note.title && (
        <p className="text-sm font-semibold text-gray-800 mb-1.5 pr-16">{note.title}</p>
      )}
      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed line-clamp-8">
        {note.content}
      </p>
      <p className="text-xs text-gray-400 mt-3">{date}</p>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function NotesPage() {
  const { notes: allNotes, loading, error, fetchNotes, addNote, updateNote, removeNote } = useNoteStore();
  const [search, setSearch]               = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [colorFilter, setColorFilter]     = useState<NoteColor | ''>('');
  const [modalOpen, setModalOpen]         = useState(false);
  const [editing, setEditing]             = useState<Note | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch all notes once on mount
  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  // Client-side filtering
  const notes = useMemo(() => {
    let result = allNotes;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((n) =>
        (n.title ?? '').toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q),
      );
    }
    if (colorFilter) result = result.filter((n) => n.color === colorFilter);
    return result;
  }, [allNotes, debouncedSearch, colorFilter]);

  function openCreate() { setEditing(null); setModalOpen(true); }
  function openEdit(note: Note) { setEditing(note); setModalOpen(true); }

  function handleSaved(saved: Note) {
    const exists = allNotes.some((n) => n.id === saved.id);
    if (exists) updateNote(saved.id, saved);
    else        addNote(saved);
  }

  function handleDeleted(id: string) {
    removeNote(id);
  }

  async function handleTogglePin(note: Note) {
    updateNote(note.id, { isPinned: !note.isPinned });
    try {
      const res = await api.patch(`/notes/${note.id}`, { isPinned: !note.isPinned });
      updateNote(note.id, res.data.data);
    } catch {
      updateNote(note.id, { isPinned: note.isPinned });
    }
  }

  const pinned   = notes.filter((n) => n.isPinned);
  const unpinned = notes.filter((n) => !n.isPinned);

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Notes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Catatan pribadi & referensi cepat</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-navy hover:bg-navy-light rounded transition-colors"
        >
          <Plus size={15} />
          Note Baru
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari catatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-8 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:border-navy focus:ring-1 focus:ring-navy w-56"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Color filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Warna:</span>
          <button
            onClick={() => setColorFilter('')}
            className={cn(
              'px-2.5 py-1 text-xs rounded border transition-colors',
              colorFilter === ''
                ? 'bg-navy text-white border-navy'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
            )}
          >
            Semua
          </button>
          {COLOR_OPTS.map((c) => (
            <button
              key={c}
              onClick={() => setColorFilter(colorFilter === c ? '' : c)}
              title={c}
              className={cn(
                'w-5 h-5 rounded-full border-2 transition-transform',
                COLOR_MAP[c].dot,
                colorFilter === c ? 'border-navy scale-125' : 'border-transparent hover:scale-110',
              )}
            />
          ))}
        </div>

        {allNotes.length > 0 && (
          <span className="ml-auto text-xs text-gray-400">
            {notes.length} catatan{notes.length !== allNotes.length ? ` dari ${allNotes.length}` : ''}
          </span>
        )}
      </div>

      {/* States */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle size={32} className="text-danger mb-3" />
          <p className="text-sm text-gray-600">{error}</p>
          <button
            onClick={fetchNotes}
            className="mt-3 px-4 py-1.5 text-sm text-navy border border-navy rounded hover:bg-navy-50"
          >
            Coba lagi
          </button>
        </div>
      )}

      {!loading && !error && allNotes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <StickyNote size={40} className="text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-600">Belum ada catatan</p>
          <p className="text-xs text-gray-400 mt-1">
            Klik "Note Baru" untuk membuat catatan pertama
          </p>
        </div>
      )}

      {!loading && !error && allNotes.length > 0 && notes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <StickyNote size={40} className="text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-600">Tidak ada catatan yang cocok</p>
          <p className="text-xs text-gray-400 mt-1">Coba ubah filter pencarian</p>
        </div>
      )}

      {!loading && !error && notes.length > 0 && (
        <div>
          {/* Pinned section */}
          {pinned.length > 0 && (
            <div className="mb-6">
              <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                <Pin size={11} />
                Disematkan
              </p>
              <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
                {pinned.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onEdit={openEdit}
                    onDelete={handleDeleted}
                    onTogglePin={handleTogglePin}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Unpinned section */}
          {unpinned.length > 0 && (
            <div>
              {pinned.length > 0 && (
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                  Lainnya
                </p>
              )}
              <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
                {unpinned.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onEdit={openEdit}
                    onDelete={handleDeleted}
                    onTogglePin={handleTogglePin}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <NoteFormModal
        open={modalOpen}
        note={editing}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
