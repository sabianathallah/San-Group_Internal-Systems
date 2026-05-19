import { create } from 'zustand';
import api from '@/lib/api';

export type NoteColor = 'yellow' | 'blue' | 'green' | 'pink' | 'purple' | 'gray' | 'orange';

export interface Note {
  id:        string;
  title:     string | null;
  content:   string;
  color:     NoteColor;
  isPinned:  boolean;
  position:  number;
  createdAt: string;
  updatedAt: string;
}

interface NoteState {
  notes:      Note[];
  loading:    boolean;
  error:      string;
  fetchNotes: () => Promise<void>;
  addNote:    (note: Note) => void;
  updateNote: (id: string, patch: Partial<Note>) => void;
  removeNote: (id: string) => void;
}

export const useNoteStore = create<NoteState>((set) => ({
  notes:   [],
  loading: false,
  error:   '',

  fetchNotes: async () => {
    set({ loading: true, error: '' });
    try {
      const res = await api.get('/notes');
      set({ notes: res.data.data ?? [] });
    } catch {
      set({ error: 'Gagal memuat catatan. Coba lagi.' });
    } finally {
      set({ loading: false });
    }
  },

  addNote: (note) =>
    set((s) => ({
      notes: note.isPinned
        ? [note, ...s.notes]
        : [...s.notes.filter((n) => n.isPinned), note, ...s.notes.filter((n) => !n.isPinned)],
    })),

  updateNote: (id, patch) =>
    set((s) => {
      const updated = s.notes.map((n) => n.id === id ? { ...n, ...patch } : n);
      // Re-sort: pinned first
      return {
        notes: [
          ...updated.filter((n) => n.isPinned),
          ...updated.filter((n) => !n.isPinned),
        ],
      };
    }),

  removeNote: (id) =>
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
}));
