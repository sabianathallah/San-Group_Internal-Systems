import { create } from 'zustand';
import api from '@/lib/api';

// ── Shared types (re-exported for use in pages) ────────────
export type TaskStatus   = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskCategory = 'MY_DAY' | 'IMPORTANT' | 'PLANNED' | 'CUSTOM';

export interface TaskUser {
  id: string; fullName: string; avatar: string | null;
}

export interface Task {
  id:               string;
  title:            string;
  description:      string | null;
  status:           TaskStatus;
  priority:         TaskPriority;
  category:         TaskCategory;
  dueDate:          string | null;
  completedAt:      string | null;
  isPrivate:        boolean;
  assignmentStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED' | null;
  assignmentNote:   string | null;
  createdAt:        string;
  creator:          TaskUser;
  assignee:         TaskUser | null;
  taskList:         { id: string; name: string; color: string } | null;
  _count:           { subTasks: number; attachments: number; comments: number };
  subTasks?:        Task[];
}

interface TaskState {
  tasks:   Task[];
  loading: boolean;

  /** Fetch all top-level tasks and replace store */
  fetchTasks: () => Promise<void>;

  /** Optimistically add a task (after POST) */
  addTask: (task: Task) => void;

  /** Optimistically update fields on a task */
  updateTask: (id: string, patch: Partial<Task>) => void;

  /** Optimistically remove a task */
  removeTask: (id: string) => void;

  /** Toggle done/todo — optimistic + API call + revert on error */
  toggleStatus: (id: string, current: TaskStatus) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks:   [],
  loading: false,

  fetchTasks: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/tasks', { params: { limit: '100' } });
      set({ tasks: res.data.data ?? [] });
    } catch { /* silent */ }
    finally { set({ loading: false }); }
  },

  addTask: (task) =>
    set((s) => ({ tasks: [task, ...s.tasks] })),

  updateTask: (id, patch) =>
    set((s) => ({ tasks: s.tasks.map((t) => t.id === id ? { ...t, ...patch } : t) })),

  removeTask: (id) =>
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

  toggleStatus: async (id, current) => {
    const next: TaskStatus = current === 'DONE' ? 'TODO' : 'DONE';
    get().updateTask(id, { status: next, completedAt: next === 'DONE' ? new Date().toISOString() : null });
    try {
      const res = await api.patch(`/tasks/${id}`, { status: next });
      get().updateTask(id, res.data.data);
    } catch {
      get().updateTask(id, { status: current });
    }
  },
}));
