import {
  useEffect, useState, useRef, useCallback, FormEvent, KeyboardEvent, useMemo,
} from 'react';
import {
  LayoutList, Columns3, CalendarDays,
  Plus, Search, X, ChevronDown, ChevronRight,
  Circle, CheckCircle2, Clock, AlertCircle,
  Calendar, User, Tag,
  Loader2, Trash2, FileText, ChevronsRight,
  GripVertical, ChevronLeft,
} from 'lucide-react';
import api from '@/lib/api';
import { useTaskStore } from '@/stores/taskStore';
import { cn } from '@/lib/cn';

// ── Types (imported from store, local aliases for convenience) ─
import type { Task, TaskStatus, TaskPriority, TaskCategory } from '@/stores/taskStore';
type ViewMode = 'list' | 'board' | 'calendar';

interface SubTask {
  id:          string;
  title:       string;
  status:      TaskStatus;
  priority:    TaskPriority;
  dueDate:     string | null;
  completedAt: string | null;
  assignee:    { id: string; fullName: string; avatar: string | null } | null;
  _count:      { subTasks: number; attachments: number };
}

// ── Config ─────────────────────────────────────────────────
const STATUS_CONFIG: Record<TaskStatus, {
  label: string; icon: React.ElementType; color: string; bg: string; border: string;
}> = {
  TODO:        { label: 'Belum Mulai', icon: Circle,       color: 'text-gray-400',  bg: 'bg-gray-100',  border: 'border-gray-200' },
  IN_PROGRESS: { label: 'Berlangsung', icon: Clock,        color: 'text-blue-500',  bg: 'bg-blue-50',   border: 'border-blue-200' },
  DONE:        { label: 'Selesai',     icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50',  border: 'border-green-200' },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; dot: string }> = {
  URGENT: { label: 'Mendesak', color: 'text-red-500',    dot: 'bg-red-500'    },
  HIGH:   { label: 'Tinggi',   color: 'text-orange-500', dot: 'bg-orange-500' },
  MEDIUM: { label: 'Sedang',   color: 'text-blue-500',   dot: 'bg-blue-500'   },
  LOW:    { label: 'Rendah',   color: 'text-gray-400',   dot: 'bg-gray-300'   },
};

const CATEGORY_CONFIG: Record<TaskCategory, string> = {
  MY_DAY:    'Hari Ini',
  IMPORTANT: 'Penting',
  PLANNED:   'Terencana',
  CUSTOM:    'Lainnya',
};

const BOARD_COLUMNS: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];

// ── Helpers ────────────────────────────────────────────────
function fmtDue(iso: string | null): { text: string; overdue: boolean } {
  if (!iso) return { text: '', overdue: false };
  const d   = new Date(iso);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
  if (diff < 0)  return { text: `${Math.abs(diff)}h lalu`, overdue: true };
  if (diff === 0) return { text: 'Hari ini', overdue: false };
  if (diff === 1) return { text: 'Besok',    overdue: false };
  return { text: d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }), overdue: false };
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function toLocalISO(dateStr: string): string {
  return `${dateStr}T00:00:00+07:00`;
}

// ── Atom components ────────────────────────────────────────
function Avatar({ name, avatar, size = 24 }: { name: string; avatar?: string | null; size?: number }) {
  if (avatar) {
    return (
      <img src={avatar} alt={name} className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }} />
    );
  }
  return (
    <div className="rounded-full bg-navy flex items-center justify-center text-white font-semibold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials(name)}
    </div>
  );
}

function StatusIcon({ status, size = 15 }: { status: TaskStatus; size?: number }) {
  const { icon: Icon, color } = STATUS_CONFIG[status];
  return <Icon size={size} className={color} />;
}

function PriorityDot({ priority }: { priority: TaskPriority }) {
  return <span className={cn('inline-block w-2 h-2 rounded-full flex-shrink-0', PRIORITY_CONFIG[priority].dot)} />;
}

// ── Sub-task row (inside detail panel) ────────────────────
function SubTaskRow({ sub, onToggle, onDelete }: {
  sub: SubTask; onToggle: () => void; onDelete: () => void;
}) {
  const done = sub.status === 'DONE';
  const due  = fmtDue(sub.dueDate);
  return (
    <div className="group flex items-center gap-2 px-1 py-1.5 rounded hover:bg-gray-50 transition-colors">
      <button
        onClick={onToggle}
        className={cn(
          'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
          done ? 'border-green-500 bg-green-500' : 'border-gray-300 hover:border-navy',
        )}
      >
        {done && <CheckCircle2 size={9} className="text-white" strokeWidth={3} />}
      </button>
      <span className={cn('flex-1 text-sm min-w-0 truncate', done && 'line-through text-gray-400')}>
        {sub.title}
      </span>
      {due.text && (
        <span className={cn('text-[10px] flex-shrink-0', due.overdue ? 'text-red-500' : 'text-gray-400')}>
          {due.text}
        </span>
      )}
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all p-0.5 rounded"
      >
        <X size={11} />
      </button>
    </div>
  );
}

// ── Property row (inside detail panel) ────────────────────
function PropRow({ icon, label, children }: {
  icon: React.ReactNode; label: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-1 py-2 rounded hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-2 w-28 flex-shrink-0">
        {icon}
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ── Task Detail Panel ──────────────────────────────────────
function TaskDetailPanel({
  taskId, onClose, onUpdated, onDeleted,
}: {
  taskId: string; onClose: () => void;
  onUpdated: (t: Task) => void; onDeleted: (id: string) => void;
}) {
  const [task, setTask]         = useState<Task | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [editTitle, setEditTitle] = useState(false);
  const [titleVal,  setTitleVal]  = useState('');
  const [descVal,   setDescVal]   = useState('');
  const [descFocus, setDescFocus] = useState(false);
  const [newSub,    setNewSub]    = useState('');
  const [addingSub, setAddingSub] = useState(false);
  const [subInput,  setSubInput]  = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/tasks/${taskId}`);
      const t: Task = res.data.data;
      setTask(t);
      setTitleVal(t.title);
      setDescVal(t.description ?? '');
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [taskId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (editTitle) titleRef.current?.focus(); }, [editTitle]);

  async function patch(data: Record<string, unknown>) {
    if (!task) return;
    setSaving(true);
    try {
      const res = await api.patch(`/tasks/${task.id}`, data);
      const updated: Task = { ...res.data.data, subTasks: task.subTasks };
      setTask(updated);
      onUpdated(res.data.data);
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  async function saveTitle() {
    setEditTitle(false);
    if (!task || titleVal.trim() === task.title) return;
    if (!titleVal.trim()) { setTitleVal(task.title); return; }
    await patch({ title: titleVal.trim() });
  }

  async function saveDesc() {
    setDescFocus(false);
    if (!task) return;
    const val = descVal.trim() || null;
    if (val === (task.description ?? null)) return;
    await patch({ description: val });
  }

  async function addSubTask(e: FormEvent) {
    e.preventDefault();
    if (!task || !newSub.trim()) return;
    setAddingSub(true);
    try {
      const res = await api.post('/tasks', {
        title: newSub.trim(), status: 'TODO', priority: 'MEDIUM',
        parentTaskId: task.id,
      });
      const sub: SubTask = res.data.data;
      setTask((prev) => prev ? {
        ...prev,
        subTasks: [...(prev.subTasks ?? []), sub as unknown as Task],
        _count: { ...prev._count, subTasks: (prev._count.subTasks ?? 0) + 1 },
      } : prev);
      setNewSub('');
      setSubInput(false);
    } catch { /* silent */ }
    finally { setAddingSub(false); }
  }

  async function toggleSubTask(sub: SubTask) {
    if (!task) return;
    const next: TaskStatus = sub.status === 'DONE' ? 'TODO' : 'DONE';
    setTask((prev) => prev ? {
      ...prev,
      subTasks: prev.subTasks?.map((s) => s.id === sub.id ? { ...s, status: next } : s),
    } : prev);
    try {
      await api.patch(`/tasks/${sub.id}`, { status: next });
    } catch {
      setTask((prev) => prev ? {
        ...prev,
        subTasks: prev.subTasks?.map((s) => s.id === sub.id ? { ...s, status: sub.status } : s),
      } : prev);
    }
  }

  async function deleteSubTask(subId: string) {
    if (!task) return;
    setTask((prev) => prev ? {
      ...prev,
      subTasks: prev.subTasks?.filter((s) => s.id !== subId),
      _count: { ...prev._count, subTasks: Math.max(0, (prev._count.subTasks ?? 1) - 1) },
    } : prev);
    try { await api.delete(`/tasks/${subId}`); } catch { load(); }
  }

  async function handleDelete() {
    if (!task || !confirm('Hapus task ini? Semua subtask ikut terhapus.')) return;
    try {
      await api.delete(`/tasks/${task.id}`);
      onDeleted(task.id);
      onClose();
    } catch { /* silent */ }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-2">
        <Loader2 size={20} className="animate-spin text-gray-300" />
        <p className="text-xs text-gray-400">Memuat…</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-400">Task tidak ditemukan</p>
      </div>
    );
  }

  const doneSubCount = task.subTasks?.filter((s) => s.status === 'DONE').length ?? 0;
  const totalSub     = task.subTasks?.length ?? 0;
  const subProgress  = totalSub > 0 ? Math.round((doneSubCount / totalSub) * 100) : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          title="Tutup"
        >
          <ChevronsRight size={16} />
        </button>
        {saving && <Loader2 size={13} className="animate-spin text-gray-400 ml-1" />}
        <div className="flex-1" />
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50"
        >
          <Trash2 size={13} /> Hapus
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pt-5 pb-10">
          {/* Title */}
          <div className="mb-5">
            {editTitle ? (
              <input
                ref={titleRef}
                value={titleVal}
                onChange={(e) => setTitleVal(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter')  saveTitle();
                  if (e.key === 'Escape') { setEditTitle(false); setTitleVal(task.title); }
                }}
                className="w-full text-xl font-semibold text-gray-900 outline-none border-b-2 border-navy pb-1 bg-transparent"
              />
            ) : (
              <h1
                onClick={() => setEditTitle(true)}
                className="text-xl font-semibold text-gray-900 cursor-text hover:text-gray-700 transition-colors leading-snug"
              >
                {task.title}
              </h1>
            )}
          </div>

          {/* Properties */}
          <div className="mb-5 -mx-1">
            <PropRow icon={<StatusIcon status={task.status} size={14} />} label="Status">
              <select
                value={task.status}
                onChange={(e) => patch({ status: e.target.value })}
                className="text-xs bg-transparent outline-none cursor-pointer text-gray-700 hover:text-navy"
              >
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </PropRow>

            <PropRow icon={<PriorityDot priority={task.priority} />} label="Prioritas">
              <select
                value={task.priority}
                onChange={(e) => patch({ priority: e.target.value })}
                className="text-xs bg-transparent outline-none cursor-pointer text-gray-700 hover:text-navy"
              >
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </PropRow>

            <PropRow icon={<Calendar size={14} className="text-gray-400" />} label="Due date">
              <input
                type="date"
                value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                onChange={(e) => patch({ dueDate: e.target.value ? toLocalISO(e.target.value) : null })}
                className="text-xs bg-transparent outline-none cursor-pointer text-gray-700 hover:text-navy"
              />
            </PropRow>

            <PropRow icon={<User size={14} className="text-gray-400" />} label="Assignee">
              <span className="text-xs text-gray-500">
                {task.assignee
                  ? <span className="flex items-center gap-1.5">
                      <Avatar name={task.assignee.fullName} avatar={task.assignee.avatar} size={16} />
                      {task.assignee.fullName}
                    </span>
                  : '—'}
              </span>
            </PropRow>

            <PropRow icon={<Tag size={14} className="text-gray-400" />} label="Kategori">
              <select
                value={task.category}
                onChange={(e) => patch({ category: e.target.value })}
                className="text-xs bg-transparent outline-none cursor-pointer text-gray-700 hover:text-navy"
              >
                {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </PropRow>

            <PropRow icon={<User size={14} className="text-gray-400" />} label="Dibuat oleh">
              <div className="flex items-center gap-1.5">
                <Avatar name={task.creator.fullName} avatar={task.creator.avatar} size={16} />
                <span className="text-xs text-gray-500">{task.creator.fullName}</span>
              </div>
            </PropRow>
          </div>

          <div className="border-t border-gray-100 mb-4" />

          {/* Description */}
          <div className="mb-6">
            <div className="flex items-center gap-1.5 mb-2">
              <FileText size={13} className="text-gray-400" />
              <span className="text-xs font-medium text-gray-500">Deskripsi</span>
            </div>
            <textarea
              value={descVal}
              onChange={(e) => setDescVal(e.target.value)}
              onFocus={() => setDescFocus(true)}
              onBlur={saveDesc}
              rows={descFocus ? 5 : 3}
              placeholder="Tambah deskripsi…"
              className="w-full text-sm text-gray-700 placeholder:text-gray-300 outline-none resize-none leading-relaxed"
            />
          </div>

          <div className="border-t border-gray-100 mb-4" />

          {/* Subtasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-700">Subtask</span>
                {totalSub > 0 && (
                  <span className="text-[10px] text-gray-400">{doneSubCount}/{totalSub}</span>
                )}
              </div>
              {!subInput && (
                <button
                  onClick={() => setSubInput(true)}
                  className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-navy transition-colors"
                >
                  <Plus size={12} /> Tambah
                </button>
              )}
            </div>

            {/* Progress bar */}
            {totalSub > 0 && (
              <div className="h-1 bg-gray-100 rounded-full mb-3 overflow-hidden">
                <div
                  className="h-full bg-green-400 rounded-full transition-all"
                  style={{ width: `${subProgress}%` }}
                />
              </div>
            )}

            {/* Subtask list */}
            <div className="space-y-0.5">
              {(task.subTasks ?? []).map((sub) => (
                <SubTaskRow
                  key={sub.id}
                  sub={sub}
                  onToggle={() => toggleSubTask(sub)}
                  onDelete={() => deleteSubTask(sub.id)}
                />
              ))}
            </div>

            {/* Add subtask input */}
            {subInput && (
              <form onSubmit={addSubTask} className="flex items-center gap-2 mt-2 pl-1">
                <Circle size={14} className="text-gray-300 flex-shrink-0" />
                <input
                  autoFocus
                  value={newSub}
                  onChange={(e) => setNewSub(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setSubInput(false)}
                  placeholder="Nama subtask…"
                  className="flex-1 text-sm text-gray-800 outline-none placeholder:text-gray-300"
                />
                {addingSub
                  ? <Loader2 size={13} className="animate-spin text-gray-400" />
                  : (
                    <div className="flex gap-1">
                      <button type="submit" disabled={!newSub.trim()}
                        className="text-[11px] px-2 py-1 bg-navy text-white rounded disabled:opacity-40">
                        OK
                      </button>
                      <button type="button" onClick={() => setSubInput(false)}
                        className="text-[11px] px-2 py-1 text-gray-500 hover:bg-gray-100 rounded">
                        Batal
                      </button>
                    </div>
                  )
                }
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Create Task Modal ──────────────────────────────────────
function CreateTaskModal({ defaultStatus, onClose, onCreated }: {
  defaultStatus?: TaskStatus; onClose: () => void; onCreated: (t: Task) => void;
}) {
  const [title,    setTitle]    = useState('');
  const [status,   setStatus]   = useState<TaskStatus>(defaultStatus ?? 'TODO');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueDate,  setDueDate]  = useState('');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Judul wajib diisi'); return; }
    setSaving(true); setError('');
    try {
      const payload: Record<string, unknown> = { title: title.trim(), status, priority };
      if (dueDate) payload.dueDate = toLocalISO(dueDate);
      const res = await api.post('/tasks', payload);
      onCreated(res.data.data);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Terjadi kesalahan');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Task Baru</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <input
            autoFocus
            type="text"
            placeholder="Judul task…"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError(''); }}
            className="w-full text-base font-medium text-gray-900 outline-none placeholder:text-gray-300 border-b border-gray-200 pb-2 focus:border-navy transition-colors"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 outline-none focus:border-navy">
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Prioritas</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 outline-none focus:border-navy">
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Due date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="text-sm border border-gray-200 rounded px-2.5 py-1.5 outline-none focus:border-navy w-full" />
          </div>
          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle size={12} />{error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50">
              Batal
            </button>
            <button type="submit" disabled={saving || !title.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-navy rounded hover:bg-navy-light disabled:opacity-50">
              {saving && <Loader2 size={13} className="animate-spin" />}
              Buat Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── List View ──────────────────────────────────────────────
function ListView({ tasks, onSelect, selectedId, onToggleStatus, onDelete, onCreated }: {
  tasks: Task[]; onSelect: (id: string) => void; selectedId: string | null;
  onToggleStatus: (t: Task) => void; onDelete: (id: string) => void; onCreated: (t: Task) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ DONE: true });
  const [addingTo,  setAddingTo]  = useState<TaskStatus | null>(null);
  const [newTitle,  setNewTitle]  = useState('');
  const [adding,    setAdding]    = useState(false);

  const grouped = BOARD_COLUMNS.reduce<Record<TaskStatus, Task[]>>((acc, s) => {
    acc[s] = tasks.filter((t) => t.status === s);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  async function quickAdd(status: TaskStatus) {
    if (!newTitle.trim()) { setAddingTo(null); return; }
    setAdding(true);
    try {
      const res = await api.post('/tasks', { title: newTitle.trim(), status, priority: 'MEDIUM' });
      onCreated(res.data.data);
      setNewTitle(''); setAddingTo(null);
    } catch { /* silent */ } finally { setAdding(false); }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_120px_100px_110px_80px] gap-2 px-4 py-2 border-b border-gray-100 sticky top-0 bg-white z-10">
        {['Judul', 'Status', 'Prioritas', 'Due date', 'Assignee'].map((h) => (
          <div key={h} className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</div>
        ))}
      </div>

      {BOARD_COLUMNS.map((status) => {
        const group      = grouped[status];
        const cfg        = STATUS_CONFIG[status];
        const Icon       = cfg.icon;
        const isCollapsed = collapsed[status];

        return (
          <div key={status}>
            <button
              onClick={() => setCollapsed((c) => ({ ...c, [status]: !c[status] }))}
              className="flex items-center gap-2 w-full px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 text-left"
            >
              {isCollapsed ? <ChevronRight size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
              <Icon size={13} className={cfg.color} />
              <span className="text-xs font-semibold text-gray-700">{cfg.label}</span>
              <span className="text-[10px] font-medium text-gray-400 ml-1">{group.length}</span>
            </button>

            {!isCollapsed && (
              <>
                {group.map((task) => (
                  <ListTaskRow
                    key={task.id}
                    task={task}
                    selected={task.id === selectedId}
                    onSelect={() => onSelect(task.id)}
                    onToggle={() => onToggleStatus(task)}
                    onDelete={() => onDelete(task.id)}
                  />
                ))}

                {addingTo === status ? (
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-50 bg-blue-50/30">
                    <div className="w-4" />
                    <Circle size={14} className="text-gray-300" />
                    <input
                      autoFocus
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')  quickAdd(status);
                        if (e.key === 'Escape') { setAddingTo(null); setNewTitle(''); }
                      }}
                      onBlur={() => { if (!newTitle.trim()) setAddingTo(null); }}
                      placeholder="Judul task baru…"
                      className="flex-1 text-sm outline-none bg-transparent"
                    />
                    {adding
                      ? <Loader2 size={13} className="animate-spin text-gray-400" />
                      : <button onClick={() => quickAdd(status)} className="text-[11px] text-white bg-navy px-2 py-0.5 rounded">OK</button>
                    }
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingTo(status); setNewTitle(''); }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-xs text-gray-400 hover:text-navy hover:bg-gray-50 transition-colors border-b border-gray-50"
                  >
                    <Plus size={12} /> Tambah task
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ListTaskRow({ task, selected, onSelect, onToggle, onDelete }: {
  task: Task; selected: boolean; onSelect: () => void;
  onToggle: () => void; onDelete: () => void;
}) {
  const due = fmtDue(task.dueDate);
  return (
    <div
      onClick={onSelect}
      className={cn(
        'group grid grid-cols-[1fr_120px_100px_110px_80px] gap-2 items-center',
        'px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer',
        selected && 'bg-navy/5 border-l-2 border-l-navy',
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className={cn(
            'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
            task.status === 'DONE'        ? 'border-green-500 bg-green-500' :
            task.status === 'IN_PROGRESS' ? 'border-blue-400'               :
                                            'border-gray-300 hover:border-navy',
          )}
        >
          {task.status === 'DONE'        && <CheckCircle2 size={9} className="text-white" strokeWidth={3} />}
          {task.status === 'IN_PROGRESS' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
        </button>
        <span className={cn('text-sm truncate', task.status === 'DONE' && 'line-through text-gray-400')}>
          {task.title}
        </span>
        {task._count.subTasks > 0 && (
          <span className="text-[10px] text-gray-400 flex-shrink-0 flex items-center gap-0.5">
            <GripVertical size={10} />{task._count.subTasks}
          </span>
        )}
      </div>

      <div>
        <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', STATUS_CONFIG[task.status].bg, STATUS_CONFIG[task.status].color)}>
          {STATUS_CONFIG[task.status].label}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <PriorityDot priority={task.priority} />
        <span className={cn('text-[11px]', PRIORITY_CONFIG[task.priority].color)}>
          {PRIORITY_CONFIG[task.priority].label}
        </span>
      </div>

      <div>
        {due.text && (
          <span className={cn('text-[11px]', due.overdue ? 'text-red-500 font-medium' : 'text-gray-500')}>
            {due.overdue && '⚠ '}{due.text}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {task.assignee && (
          <Avatar name={task.assignee.fullName} avatar={task.assignee.avatar} size={18} />
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="ml-auto opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Board View ─────────────────────────────────────────────
function BoardView({ tasks, onSelect, selectedId, onToggleStatus, onDelete, onCreated }: {
  tasks: Task[]; onSelect: (id: string) => void; selectedId: string | null;
  onToggleStatus: (t: Task) => void; onDelete: (id: string) => void; onCreated: (t: Task) => void;
}) {
  const [addingTo, setAddingTo] = useState<TaskStatus | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [adding,   setAdding]   = useState(false);

  const grouped = BOARD_COLUMNS.reduce<Record<TaskStatus, Task[]>>((acc, s) => {
    acc[s] = tasks.filter((t) => t.status === s);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  async function quickAdd(status: TaskStatus) {
    if (!newTitle.trim()) { setAddingTo(null); return; }
    setAdding(true);
    try {
      const res = await api.post('/tasks', { title: newTitle.trim(), status, priority: 'MEDIUM' });
      onCreated(res.data.data);
      setNewTitle(''); setAddingTo(null);
    } catch { /* silent */ } finally { setAdding(false); }
  }

  return (
    <div className="flex-1 overflow-x-auto">
      <div className="flex gap-4 h-full px-4 py-4 min-w-max">
        {BOARD_COLUMNS.map((status) => {
          const cfg   = STATUS_CONFIG[status];
          const group = grouped[status];
          return (
            <div key={status} className="flex flex-col w-72 flex-shrink-0">
              <div className={cn('flex items-center gap-2 px-3 py-2 rounded-t-lg mb-2', cfg.bg)}>
                <StatusIcon status={status} size={13} />
                <span className={cn('text-xs font-semibold', cfg.color)}>{cfg.label}</span>
                <span className="text-[10px] text-gray-400 ml-auto">{group.length}</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pb-2">
                {group.map((task) => (
                  <BoardCard
                    key={task.id}
                    task={task}
                    selected={task.id === selectedId}
                    onSelect={() => onSelect(task.id)}
                    onToggle={() => onToggleStatus(task)}
                    onDelete={() => onDelete(task.id)}
                  />
                ))}

                {addingTo === status ? (
                  <div className="bg-white rounded-lg border border-navy/30 p-3 shadow-sm">
                    <input
                      autoFocus
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')  quickAdd(status);
                        if (e.key === 'Escape') { setAddingTo(null); setNewTitle(''); }
                      }}
                      placeholder="Judul task…"
                      className="w-full text-sm outline-none placeholder:text-gray-300 mb-2"
                    />
                    <div className="flex gap-1">
                      {adding
                        ? <Loader2 size={13} className="animate-spin text-gray-400" />
                        : <>
                            <button onClick={() => quickAdd(status)}
                              className="text-[11px] text-white bg-navy px-2 py-1 rounded">OK</button>
                            <button onClick={() => { setAddingTo(null); setNewTitle(''); }}
                              className="text-[11px] text-gray-500 px-2 py-1 rounded hover:bg-gray-100">Batal</button>
                          </>
                      }
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingTo(status); setNewTitle(''); }}
                    className="flex items-center gap-1.5 w-full px-3 py-2 text-xs text-gray-400 hover:text-navy rounded-lg hover:bg-white border border-dashed border-gray-200 hover:border-navy transition-colors"
                  >
                    <Plus size={12} /> Tambah task
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BoardCard({ task, selected, onSelect, onToggle, onDelete }: {
  task: Task; selected: boolean; onSelect: () => void;
  onToggle: () => void; onDelete: () => void;
}) {
  const due = fmtDue(task.dueDate);
  return (
    <div
      onClick={onSelect}
      className={cn(
        'group bg-white rounded-lg border p-3 shadow-sm cursor-pointer transition-all hover:shadow-md',
        selected ? 'border-navy ring-1 ring-navy/20' : 'border-gray-200',
      )}
    >
      <div className="flex items-start justify-between gap-1 mb-2">
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className={cn(
            'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
            task.status === 'DONE' ? 'border-green-500 bg-green-500' : 'border-gray-300 hover:border-navy',
          )}
        >
          {task.status === 'DONE' && <CheckCircle2 size={9} className="text-white" strokeWidth={3} />}
        </button>
        <p className={cn('flex-1 text-sm font-medium leading-snug', task.status === 'DONE' && 'line-through text-gray-400')}>
          {task.title}
        </p>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0"
        >
          <X size={12} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={cn('text-[10px] font-medium flex items-center gap-1', PRIORITY_CONFIG[task.priority].color)}>
          <PriorityDot priority={task.priority} />{PRIORITY_CONFIG[task.priority].label}
        </span>
        {due.text && (
          <span className={cn('text-[10px] flex items-center gap-0.5', due.overdue ? 'text-red-500' : 'text-gray-400')}>
            <Calendar size={9} />{due.text}
          </span>
        )}
        {task._count.subTasks > 0 && (
          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
            <GripVertical size={9} />{task._count.subTasks}
          </span>
        )}
        {task.assignee && (
          <div className="ml-auto">
            <Avatar name={task.assignee.fullName} avatar={task.assignee.avatar} size={18} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Calendar View ──────────────────────────────────────────
function CalendarView({ tasks, onSelect }: { tasks: Task[]; onSelect: (id: string) => void }) {
  const [month, setMonth] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });

  const year     = month.getFullYear();
  const monthIdx = month.getMonth();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const firstDay    = new Date(year, monthIdx, 1).getDay();
  const startOffset = (firstDay + 6) % 7; // Mon=0

  const tasksByDate = tasks.reduce<Record<string, Task[]>>((acc, t) => {
    if (!t.dueDate) return acc;
    const key = t.dueDate.slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  const noDateTasks = tasks.filter((t) => !t.dueDate);
  const today = new Date().toISOString().slice(0, 10);

  const cells = Array.from({ length: startOffset + daysInMonth }, (_, i) =>
    i < startOffset ? null : i - startOffset + 1,
  );

  return (
    <div className="flex-1 overflow-hidden flex">
      {/* Calendar grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Month nav */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <button onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="p-1.5 rounded hover:bg-gray-100"><ChevronLeft size={15} /></button>
          <span className="text-sm font-semibold text-gray-800">
            {month.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            className="p-1.5 rounded hover:bg-gray-100"><ChevronRight size={15} /></button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map((d) => (
            <div key={d} className="text-center text-[11px] font-semibold text-gray-400 py-2">{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (day === null) return (
                <div key={`e-${i}`} className="border-b border-r border-gray-50 bg-gray-50/30 min-h-[90px]" />
              );
              const dateStr = `${year}-${String(monthIdx+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const dayTasks = tasksByDate[dateStr] ?? [];
              const isToday  = dateStr === today;
              return (
                <div key={dateStr} className="border-b border-r border-gray-100 p-1.5 min-h-[90px]">
                  <div className={cn(
                    'w-6 h-6 flex items-center justify-center rounded-full text-xs mb-1 font-medium mx-auto',
                    isToday ? 'bg-navy text-white' : 'text-gray-600',
                  )}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => onSelect(t.id)}
                        className={cn(
                          'block w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate',
                          t.status === 'DONE'
                            ? 'line-through text-gray-400 bg-gray-50'
                            : cn('text-white font-medium', {
                                'bg-red-400':    t.priority === 'URGENT',
                                'bg-orange-400': t.priority === 'HIGH',
                                'bg-blue-400':   t.priority === 'MEDIUM',
                                'bg-gray-400':   t.priority === 'LOW',
                              }),
                        )}
                      >
                        {t.title}
                      </button>
                    ))}
                    {dayTasks.length > 3 && (
                      <p className="text-[10px] text-gray-400 pl-1">+{dayTasks.length - 3} lagi</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* No-date sidebar */}
      {noDateTasks.length > 0 && (
        <div className="w-52 border-l border-gray-100 flex flex-col flex-shrink-0">
          <div className="px-3 py-2.5 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500">Tanpa jadwal</p>
            <p className="text-[10px] text-gray-400">{noDateTasks.length} task</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {noDateTasks.map((t) => (
              <button
                key={t.id}
                onClick={() => onSelect(t.id)}
                className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded hover:bg-gray-50 transition-colors"
              >
                <StatusIcon status={t.status} size={12} />
                <span className={cn('text-xs flex-1 truncate', t.status === 'DONE' && 'line-through text-gray-400')}>
                  {t.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function TasksPage() {
  // ── Shared task store ──
  const allTasks   = useTaskStore((s) => s.tasks);
  const loading    = useTaskStore((s) => s.loading);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const addTask    = useTaskStore((s) => s.addTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const removeTask = useTaskStore((s) => s.removeTask);
  const toggleStatus = useTaskStore((s) => s.toggleStatus);

  const [view,          setView]          = useState<ViewMode>('list');
  const [search,        setSearch]        = useState('');
  const [debSearch,     setDebSearch]     = useState('');
  const [statusFilter,  setStatusFilter]  = useState<TaskStatus | ''>('');
  const [priorityFilter,setPriorityFilter]= useState<TaskPriority | ''>('');
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [showCreate,    setShowCreate]    = useState(false);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  useEffect(() => {
    const t = setTimeout(() => setDebSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Client-side filtering (no re-fetch needed when filters change)
  const tasks = useMemo(() => {
    let result = allTasks;
    if (debSearch) {
      const q = debSearch.toLowerCase();
      result = result.filter((t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q),
      );
    }
    if (statusFilter)   result = result.filter((t) => t.status   === statusFilter);
    if (priorityFilter) result = result.filter((t) => t.priority === priorityFilter);
    return result;
  }, [allTasks, debSearch, statusFilter, priorityFilter]);

  function handleTaskUpdated(updated: Task) {
    updateTask(updated.id, updated);
  }

  function handleTaskCreated(task: Task) {
    addTask(task);
    setSelectedId(task.id);
  }

  function handleTaskDeleted(id: string) {
    removeTask(id);
    if (selectedId === id) setSelectedId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus task ini?')) return;
    removeTask(id);
    if (selectedId === id) setSelectedId(null);
    try { await api.delete(`/tasks/${id}`); } catch { fetchTasks(); }
  }

  const hasFilter = !!debSearch || !!statusFilter || !!priorityFilter;
  const doneCount = tasks.filter((t) => t.status === 'DONE').length;

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-white flex-shrink-0 flex-wrap">
        {/* View switcher */}
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-1">
          {([
            { v: 'list'     as const, icon: LayoutList,   label: 'List'     },
            { v: 'board'    as const, icon: Columns3,     label: 'Board'    },
            { v: 'calendar' as const, icon: CalendarDays, label: 'Schedule' },
          ]).map(({ v, icon: Icon, label }) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                view === v ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              <Icon size={13} />{label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-gray-200" />

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari task…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-navy w-44"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filters */}
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TaskStatus | '')}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-navy text-gray-600">
          <option value="">Semua Status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | '')}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-navy text-gray-600">
          <option value="">Semua Prioritas</option>
          {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        {hasFilter && (
          <button onClick={() => { setSearch(''); setStatusFilter(''); setPriorityFilter(''); }}
            className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors">
            <X size={11} /> Reset
          </button>
        )}

        <div className="flex-1" />

        {!loading && (
          <span className="text-xs text-gray-400">{doneCount}/{tasks.length} selesai</span>
        )}

        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-navy hover:bg-navy-light rounded-lg transition-colors"
        >
          <Plus size={13} /> Task Baru
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-2">
              <Loader2 size={24} className="animate-spin text-gray-300" />
              <p className="text-sm text-gray-400">Memuat tasks…</p>
            </div>
          ) : view === 'list' ? (
            <ListView
              tasks={tasks} selectedId={selectedId} onSelect={setSelectedId}
              onToggleStatus={(t) => toggleStatus(t.id, t.status)} onDelete={handleDelete} onCreated={handleTaskCreated}
            />
          ) : view === 'board' ? (
            <BoardView
              tasks={tasks} selectedId={selectedId} onSelect={setSelectedId}
              onToggleStatus={(t) => toggleStatus(t.id, t.status)} onDelete={handleDelete} onCreated={handleTaskCreated}
            />
          ) : (
            <CalendarView tasks={tasks} onSelect={setSelectedId} />
          )}
        </div>

        {/* Detail panel */}
        {selectedId && (
          <div className="w-[420px] flex-shrink-0 border-l border-gray-200 flex flex-col min-h-0 bg-white">
            <TaskDetailPanel
              key={selectedId}
              taskId={selectedId}
              onClose={() => setSelectedId(null)}
              onUpdated={handleTaskUpdated}
              onDeleted={handleTaskDeleted}
            />
          </div>
        )}
      </div>

      {showCreate && (
        <CreateTaskModal
          onClose={() => setShowCreate(false)}
          onCreated={handleTaskCreated}
        />
      )}
    </div>
  );
}
