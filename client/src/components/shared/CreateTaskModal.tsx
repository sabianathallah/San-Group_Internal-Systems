import { useEffect, useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import UserSearchInput from '@/components/shared/UserSearchInput';

// ── Shared task-related types ───────────────────────────────
export type TaskStatus     = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority   = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskVisibility = 'PRIVATE' | 'DIVISION' | 'DIVISION_SELECT' | 'PUBLIC';

export interface TaskUserOption { id: string; fullName: string; avatar: string | null }
export interface TaskListOption { id: string; name: string; color: string; icon: string | null }
export interface DivisionOption { id: string; name: string; color: string; description?: string | null }

/** Shape returned by POST /tasks — a superset of every page's local Task interface. */
export interface CreatedTask {
  id: string; title: string; description: string | null;
  status: TaskStatus; priority: TaskPriority;
  isImportant: boolean; myDayDate: string | null;
  startDate: string | null; dueDate: string | null;
  startedAt: string | null; completedAt: string | null;
  isPrivate: boolean; visibility: TaskVisibility; parentTaskId: string | null;
  assignmentStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED' | null;
  assignmentNote: string | null;
  position: number; createdAt: string; updatedAt: string;
  creator: TaskUserOption; assignee: TaskUserOption | null;
  taskList: { id: string; name: string; color: string } | null;
  links: { id: string; url: string; title: string | null; createdAt: string }[];
  _count: { subTasks: number; attachments: number; comments: number };
}

const STATUS_VALUES: TaskStatus[] = ['TODO', 'DONE'];
const PRIORITY_VALUES: TaskPriority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];

function toLocalISO(d: string) { return `${d}T00:00:00+07:00`; }

function extractErr(err: unknown, t: (key: string) => string): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('shared.createTaskModal.errors.generic');
}

/**
 * Reusable "New Task" modal — used by both the Tasks page and the Home
 * ("Create Task" in EmptyMyDay) so the create-task form only exists once.
 */
export default function CreateTaskModal({
  onClose, onCreated, defaultListId, extraPayload, taskLists,
}: {
  onClose: () => void;
  onCreated: (t: CreatedTask) => void;
  defaultListId?: string | null;
  extraPayload?: Record<string, unknown>;
  taskLists: TaskListOption[];
}) {
  const { t } = useTranslation();
  const STATUS_LABELS: Record<TaskStatus, string> = {
    TODO: t('shared.createTaskModal.statusOptions.todo'),
    IN_PROGRESS: t('shared.createTaskModal.statusOptions.todo'),
    DONE: t('shared.createTaskModal.statusOptions.done'),
  };
  const PRIORITY_LABELS: Record<TaskPriority, string> = {
    URGENT: t('shared.createTaskModal.priorityOptions.urgent'),
    HIGH:   t('shared.createTaskModal.priorityOptions.high'),
    MEDIUM: t('shared.createTaskModal.priorityOptions.medium'),
    LOW:    t('shared.createTaskModal.priorityOptions.low'),
  };
  const [title,      setTitle]      = useState('');
  const [desc,       setDesc]       = useState('');
  const [status,     setStatus]     = useState<TaskStatus>('TODO');
  const [priority,   setPriority]   = useState<TaskPriority>('MEDIUM');
  const [startDate,  setStartDate]  = useState('');
  const [dueDate,    setDueDate]    = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [listId,     setListId]     = useState(defaultListId ?? '');
  const [visibility,  setVisibility]  = useState<TaskVisibility>('PRIVATE');
  const [divisionIds, setDivisionIds] = useState<string[]>([]);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [users,       setUsers]       = useState<TaskUserOption[]>([]);
  const [divisions,   setDivisions]   = useState<DivisionOption[]>([]);

  useEffect(() => {
    api.get('/users', { params: { limit: 100 } })
      .then((r) => setUsers(r.data.data?.items ?? r.data.data ?? []))
      .catch(() => {});
    api.get('/divisions')
      .then((r) => setDivisions(r.data.data ?? []))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError(t('shared.createTaskModal.errors.titleRequired')); return; }
    if (startDate && dueDate && startDate > dueDate) {
      setError(t('shared.createTaskModal.errors.dateOrder'));
      return;
    }
    setSaving(true); setError('');
    try {
      const payload: Record<string, unknown> = { title: title.trim(), status, priority, visibility, ...extraPayload };
      if (desc.trim())   payload.description = desc.trim();
      if (startDate)     payload.startDate    = toLocalISO(startDate);
      if (dueDate)       payload.dueDate      = toLocalISO(dueDate);
      if (assignedTo)    payload.assignedToId = assignedTo;
      if (listId)        payload.listId       = listId;
      if (visibility === 'DIVISION_SELECT') payload.divisionIds = divisionIds;
      const res = await api.post('/tasks', payload);
      onCreated(res.data.data);
      onClose();
    } catch (err) { setError(extractErr(err, t)); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">{t('shared.createTaskModal.title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <input autoFocus type="text" placeholder={t('shared.createTaskModal.titlePlaceholder')} value={title}
            onChange={(e) => { setTitle(e.target.value); setError(''); }}
            className="w-full text-base font-medium text-gray-900 outline-none placeholder:text-gray-300 border-b border-gray-200 pb-2 focus:border-navy transition-colors" />

          <textarea placeholder={t('shared.createTaskModal.descriptionPlaceholder')} value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
            className="w-full text-sm text-gray-700 placeholder:text-gray-300 outline-none resize-none border-b border-gray-100 pb-2" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('shared.createTaskModal.status')}</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 outline-none focus:border-navy">
                {STATUS_VALUES.map((v) => <option key={v} value={v}>{STATUS_LABELS[v]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('shared.createTaskModal.priority')}</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 outline-none focus:border-navy">
                {PRIORITY_VALUES.map((v) => <option key={v} value={v}>{PRIORITY_LABELS[v]}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('shared.createTaskModal.startDate')}</label>
              <input type="date" value={startDate} max={dueDate || undefined}
                onChange={(e) => { setStartDate(e.target.value); setError(''); }}
                className="text-sm border border-gray-200 rounded px-2.5 py-1.5 outline-none focus:border-navy w-full" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('shared.createTaskModal.dueDate')}</label>
              <input type="date" value={dueDate} min={startDate || undefined}
                onChange={(e) => { setDueDate(e.target.value); setError(''); }}
                className="text-sm border border-gray-200 rounded px-2.5 py-1.5 outline-none focus:border-navy w-full" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('shared.createTaskModal.assignTo')}</label>
            <UserSearchInput
              users={users}
              value={assignedTo}
              onChange={setAssignedTo}
              placeholder={t('shared.createTaskModal.searchPeoplePlaceholder')}
              clearLabel={t('shared.createTaskModal.noneOption')}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('shared.createTaskModal.list')}</label>
            <select value={listId} onChange={(e) => setListId(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 outline-none focus:border-navy">
              <option value="">{t('shared.createTaskModal.noListOption')}</option>
              {taskLists.map((l) => (
                <option key={l.id} value={l.id}>{l.icon ? `${l.icon} ` : ''}{l.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('shared.createTaskModal.shareWith')}</label>
              <select value={visibility}
                onChange={(e) => {
                  const v = e.target.value as TaskVisibility;
                  setVisibility(v);
                  if (v !== 'DIVISION_SELECT') setDivisionIds([]);
                }}
                className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 outline-none focus:border-navy disabled:opacity-50 disabled:bg-gray-50">
                <option value="PRIVATE">{t('shared.createTaskModal.visibilityOptions.onlyMe')}</option>
                <option value="DIVISION">{t('shared.createTaskModal.visibilityOptions.myDivision')}</option>
                <option value="DIVISION_SELECT">{t('shared.createTaskModal.visibilityOptions.selectDivisions')}</option>
                <option value="PUBLIC">{t('shared.createTaskModal.visibilityOptions.allStaff')}</option>
              </select>
            </div>

            {visibility === 'DIVISION_SELECT' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">{t('shared.createTaskModal.selectDivisionsLabel')}</label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {divisions.map((div) => (
                    <label key={div.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={divisionIds.includes(div.id)}
                        onChange={(e) => setDivisionIds((prev) =>
                          e.target.checked ? [...prev, div.id] : prev.filter((id) => id !== div.id)
                        )}
                        className="w-3.5 h-3.5 rounded border-gray-300 accent-navy"
                      />
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: div.color }} />
                      <span className="text-xs text-gray-700">{div.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50">{t('shared.createTaskModal.cancel')}</button>
            <button type="submit" disabled={saving || !title.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-navy rounded hover:bg-navy-light disabled:opacity-50">
              {saving && <Loader2 size={13} className="animate-spin" />} {t('shared.createTaskModal.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
