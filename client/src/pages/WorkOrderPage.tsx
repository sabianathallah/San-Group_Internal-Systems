import { useState, useEffect, useCallback } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import {
  Wrench, Plus, ChevronDown, X, Check, Clock, AlertTriangle,
  MapPin, User, Calendar, List, Filter, RefreshCw, Loader2,
  CheckCircle2, Circle, ArrowRight, Paperclip, History, ChevronUp,
  Zap, AlertCircle, Ban,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { usePermStore } from '@/stores/permStore';
import type { Scope } from '@/types/permissions';
import { PageSizeSelect } from '@/components/shared/PageSizeSelect';

// ── Permission helper ──────────────────────────────────────
// Mirrors the server-side scope check in work-order.service.ts: 'all' always
// passes, 'division' passes if the WO's reporter/assignee shares the user's
// division, 'own' passes the caller-supplied ownership check, 'none' never passes.
function hasScope(scope: Scope, isOwner: boolean, sameDivision: boolean): boolean {
  if (scope === 'all')      return true;
  if (scope === 'division') return sameDivision;
  if (scope === 'own')      return isOwner;
  return false;
}

// ── Types ──────────────────────────────────────────────────
type WOStatus   = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'PENDING_PARTS' | 'DONE' | 'CANCELLED';
type WOPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type WOCategory = 'ELECTRICAL' | 'PLUMBING' | 'HVAC' | 'CIVIL' | 'CLEANING' | 'SECURITY' | 'OTHER';
type ViewFilter = 'all' | 'mine' | 'reported' | 'unassigned';

interface WOUser {
  id: string; fullName: string; username: string; avatar: string | null; divisionId: string;
}

interface WOHistory {
  id: string; fromStatus: WOStatus | null; toStatus: WOStatus;
  note: string | null; createdAt: string; changedBy: WOUser;
}

interface WOAttachment {
  id: string; fileName: string; filePath: string;
  fileSize: number; mimeType: string; createdAt: string; uploadedBy: WOUser;
}

interface WorkOrder {
  id: string; title: string; description: string | null;
  status: WOStatus; priority: WOPriority; category: WOCategory;
  location: string | null; dueDate: string | null; completedAt: string | null;
  notes: string | null; createdAt: string; updatedAt: string;
  reportedBy: WOUser; assignee: WOUser | null;
  _count: { history: number; attachments: number };
  history?: WOHistory[]; attachments?: WOAttachment[];
}

// ── Config ─────────────────────────────────────────────────
const BOARD_COLUMNS: WOStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_PARTS', 'DONE', 'CANCELLED'];

const STATUS_CONFIG: Record<WOStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  OPEN:          { label: 'Open',           color: 'text-slate-600',  bg: 'bg-slate-100',   icon: Circle       },
  ASSIGNED:      { label: 'Assigned',       color: 'text-blue-600',   bg: 'bg-blue-50',     icon: User         },
  IN_PROGRESS:   { label: 'In Progress',    color: 'text-amber-600',  bg: 'bg-amber-50',    icon: Clock        },
  PENDING_PARTS: { label: 'Pending Parts',  color: 'text-orange-600', bg: 'bg-orange-50',   icon: AlertTriangle },
  DONE:          { label: 'Done',           color: 'text-green-600',  bg: 'bg-green-50',    icon: CheckCircle2 },
  CANCELLED:     { label: 'Cancelled',      color: 'text-red-500',    bg: 'bg-red-50',      icon: Ban          },
};

const PRIORITY_CONFIG: Record<WOPriority, { label: string; dot: string; badge: string }> = {
  LOW:    { label: 'Low',    dot: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-600'   },
  MEDIUM: { label: 'Medium', dot: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-600'   },
  HIGH:   { label: 'High',   dot: 'bg-orange-400', badge: 'bg-orange-50 text-orange-600' },
  URGENT: { label: 'Urgent', dot: 'bg-red-500',    badge: 'bg-red-50 text-red-600'     },
};

const CATEGORY_CONFIG: Record<WOCategory, { label: string; icon: string }> = {
  ELECTRICAL:  { label: 'Electrical',  icon: '⚡' },
  PLUMBING:    { label: 'Plumbing',    icon: '🔧' },
  HVAC:        { label: 'HVAC',        icon: '❄️' },
  CIVIL:       { label: 'Civil',       icon: '🏗️' },
  CLEANING:    { label: 'Cleaning',    icon: '🧹' },
  SECURITY:    { label: 'Security',    icon: '🔒' },
  OTHER:       { label: 'Other',       icon: '📋' },
};

const STATUS_TRANSITIONS: Record<WOStatus, WOStatus[]> = {
  OPEN:          ['ASSIGNED', 'CANCELLED'],
  ASSIGNED:      ['IN_PROGRESS', 'OPEN', 'CANCELLED'],
  IN_PROGRESS:   ['PENDING_PARTS', 'DONE', 'CANCELLED'],
  PENDING_PARTS: ['IN_PROGRESS', 'DONE', 'CANCELLED'],
  DONE:          [],
  CANCELLED:     [],
};

// ── Helpers ────────────────────────────────────────────────
function extractErr(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    if (e.response && typeof e.response === 'object') {
      const r = e.response as Record<string, unknown>;
      if (r.data && typeof r.data === 'object') {
        const d = r.data as Record<string, unknown>;
        if (typeof d.message === 'string') return d.message;
      }
    }
    if (typeof e.message === 'string') return e.message;
  }
  return 'Terjadi kesalahan';
}

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatRelative(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'baru saja';
  if (mins < 60)  return `${mins} menit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs} jam lalu`;
  const days = Math.floor(hrs / 24);
  return `${days} hari lalu`;
}

function isOverdue(wo: WorkOrder) {
  return wo.dueDate && wo.status !== 'DONE' && wo.status !== 'CANCELLED'
    && new Date(wo.dueDate) < new Date();
}

// ── Sub-components ─────────────────────────────────────────
function PriorityBadge({ priority }: { priority: WOPriority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full', cfg.badge)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: WOStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full', cfg.color, cfg.bg)}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

function CategoryBadge({ category }: { category: WOCategory }) {
  const cfg = CATEGORY_CONFIG[category];
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
      <span>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

function Avatar({ user, size = 6 }: { user: WOUser | null; size?: number }) {
  if (!user) return <div className={cn('rounded-full bg-gray-200', `w-${size} h-${size}`)} />;
  return user.avatar
    ? <img src={user.avatar} alt={user.fullName} className={cn('rounded-full object-cover flex-shrink-0', `w-${size} h-${size}`)} />
    : (
      <div className={cn('rounded-full bg-navy/10 flex items-center justify-center flex-shrink-0 text-navy font-semibold', `w-${size} h-${size}`, size <= 6 ? 'text-[10px]' : 'text-xs')}>
        {user.fullName.slice(0, 2).toUpperCase()}
      </div>
    );
}

// ── Create / Edit Modal ────────────────────────────────────
interface FormData {
  title: string; description: string; priority: WOPriority; category: WOCategory;
  location: string; dueDate: string; assignedToId: string; notes: string;
}

const DEFAULT_FORM: FormData = {
  title: '', description: '', priority: 'MEDIUM', category: 'OTHER',
  location: '', dueDate: '', assignedToId: '', notes: '',
};

function WorkOrderModal({
  open, onClose, editItem, onSaved, users,
}: {
  open: boolean; onClose: () => void;
  editItem: WorkOrder | null;
  onSaved: (wo: WorkOrder) => void;
  users: WOUser[];
}) {
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(editItem ? {
        title:        editItem.title,
        description:  editItem.description ?? '',
        priority:     editItem.priority,
        category:     editItem.category,
        location:     editItem.location ?? '',
        dueDate:      editItem.dueDate ? new Date(editItem.dueDate).toISOString().slice(0, 16) : '',
        assignedToId: editItem.assignee?.id ?? '',
        notes:        editItem.notes ?? '',
      } : DEFAULT_FORM);
    }
  }, [open, editItem]);

  if (!open) return null;

  function set<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Judul wajib diisi'); return; }
    setSaving(true);
    try {
      const payload = {
        title:        form.title.trim(),
        description:  form.description.trim() || null,
        priority:     form.priority,
        category:     form.category,
        location:     form.location.trim() || null,
        dueDate:      form.dueDate ? new Date(form.dueDate).toISOString() : null,
        assignedToId: form.assignedToId || null,
        notes:        form.notes.trim() || null,
      };
      const res = editItem
        ? await api.patch(`/work-orders/${editItem.id}`, payload)
        : await api.post('/work-orders', payload);
      onSaved(res.data.data);
      toast.success(editItem ? 'Work order diperbarui' : 'Work order dibuat');
      onClose();
    } catch (err) { toast.error(extractErr(err)); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            {editItem ? 'Edit Work Order' : 'Buat Work Order'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Judul *</label>
            <input
              value={form.title} onChange={(e) => set('title', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              placeholder="Deskripsi singkat masalah..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Deskripsi</label>
            <textarea
              value={form.description} onChange={(e) => set('description', e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none"
              placeholder="Detail lebih lanjut tentang masalah..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Prioritas</label>
              <select
                value={form.priority} onChange={(e) => set('priority', e.target.value as WOPriority)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              >
                {(Object.keys(PRIORITY_CONFIG) as WOPriority[]).map((k) => (
                  <option key={k} value={k}>{PRIORITY_CONFIG[k].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Kategori</label>
              <select
                value={form.category} onChange={(e) => set('category', e.target.value as WOCategory)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              >
                {(Object.keys(CATEGORY_CONFIG) as WOCategory[]).map((k) => (
                  <option key={k} value={k}>{CATEGORY_CONFIG[k].icon} {CATEGORY_CONFIG[k].label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Lokasi</label>
              <input
                value={form.location} onChange={(e) => set('location', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                placeholder="Gedung / lantai / ruangan"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Deadline</label>
              <input
                type="datetime-local" value={form.dueDate}
                onChange={(e) => set('dueDate', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Assign kepada</label>
            <select
              value={form.assignedToId} onChange={(e) => set('assignedToId', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            >
              <option value="">— Belum diassign —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName}</option>
              ))}
            </select>
          </div>

          {editItem && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Catatan Teknisi</label>
              <textarea
                value={form.notes} onChange={(e) => set('notes', e.target.value)}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none"
                placeholder="Catatan internal untuk teknisi..."
              />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
              Batal
            </button>
            <button
              type="submit" disabled={saving}
              className="flex-1 px-4 py-2 text-sm bg-navy text-white rounded-lg hover:bg-navy/90 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {editItem ? 'Simpan' : 'Buat WO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Status Change Modal ────────────────────────────────────
function StatusModal({
  open, onClose, wo, onChanged,
}: {
  open: boolean; onClose: () => void; wo: WorkOrder; onChanged: (updated: WorkOrder) => void;
}) {
  const [selected, setSelected] = useState<WOStatus | null>(null);
  const [note, setNote]         = useState('');
  const [saving, setSaving]     = useState(false);

  useEffect(() => { if (open) { setSelected(null); setNote(''); } }, [open]);
  if (!open) return null;

  const transitions = STATUS_TRANSITIONS[wo.status];

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await api.patch(`/work-orders/${wo.id}/status`, { status: selected, note: note.trim() || null });
      onChanged(res.data.data);
      toast.success('Status diperbarui');
      onClose();
    } catch (err) { toast.error(extractErr(err)); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Ubah Status</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {transitions.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-2">Status ini sudah final.</p>
          )}
          <div className="space-y-2">
            {transitions.map((s) => {
              const cfg = STATUS_CONFIG[s];
              const Icon = cfg.icon;
              return (
                <button
                  key={s}
                  onClick={() => setSelected(s)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors',
                    selected === s
                      ? 'border-navy bg-navy/5 ring-1 ring-navy/30'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50',
                  )}
                >
                  <Icon size={16} className={cfg.color} />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{cfg.label}</p>
                  </div>
                  {selected === s && <Check size={14} className="ml-auto text-navy" />}
                </button>
              );
            })}
          </div>
          {selected && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Catatan (opsional)</label>
              <textarea
                value={note} onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none"
                placeholder="Alasan perubahan status..."
              />
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
              Batal
            </button>
            <button
              onClick={handleSave} disabled={!selected || saving}
              className="flex-1 px-4 py-2 text-sm bg-navy text-white rounded-lg hover:bg-navy/90 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Simpan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Assignee Picker (used when dropping a card into the ASSIGNED column) ───
function AssigneePickerModal({
  wo, users, onClose, onAssigned,
}: {
  wo: WorkOrder | null; users: WOUser[]; onClose: () => void; onAssigned: (userId: string) => void;
}) {
  const [search, setSearch] = useState('');
  useEffect(() => { if (wo) setSearch(''); }, [wo]);

  if (!wo) return null;

  const filtered = search.trim()
    ? users.filter((u) => u.fullName.toLowerCase().includes(search.trim().toLowerCase()))
    : users;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-900">Assign Work Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="px-5 pt-3 text-xs text-gray-500">Pilih penerima tugas untuk &quot;{wo.title}&quot;</p>
        <div className="px-5 pt-3 flex-shrink-0">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama..."
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
          />
        </div>
        <div className="p-3 space-y-0.5 overflow-y-auto">
          {filtered.map((u) => (
            <button
              key={u.id}
              onClick={() => onAssigned(u.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 text-left"
            >
              <Avatar user={u} size={7} />
              <span className="text-sm text-gray-700">{u.fullName}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-xs text-gray-400 py-6">Tidak ada karyawan yang cocok</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Finalize Confirmation (DONE / CANCELLED are terminal) ──
function ConfirmFinalizeModal({
  pending, onClose, onConfirm,
}: {
  pending: { wo: WorkOrder; status: WOStatus } | null;
  onClose: () => void; onConfirm: () => void;
}) {
  if (!pending) return null;
  const cfg = STATUS_CONFIG[pending.status];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Tandai sebagai {cfg.label}?</h2>
          <p className="text-sm text-gray-500">
            &quot;{pending.wo.title}&quot; akan ditandai <span className={cn('font-medium', cfg.color)}>{cfg.label}</span>.
            Status ini final dan tidak bisa diubah lagi setelah disimpan.
          </p>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
            Batal
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 text-sm bg-navy text-white rounded-lg hover:bg-navy/90"
          >
            Ya, {cfg.label}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Kanban Card ────────────────────────────────────────────
function WOCard({
  wo, selected, draggable, onSelect, overlay,
}: {
  wo: WorkOrder; selected: boolean; draggable: boolean; onSelect: () => void; overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: overlay ? `overlay-${wo.id}` : wo.id, disabled: !draggable || overlay,
  });
  const overdue = isOverdue(wo);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onSelect}
      style={transform && !overlay ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={cn(
        'bg-white rounded-lg border p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow',
        selected ? 'border-navy ring-1 ring-navy/30' : 'border-gray-200',
        isDragging && !overlay && 'opacity-40',
        overlay && 'shadow-xl rotate-2 cursor-grabbing',
        draggable && !overlay && 'touch-none',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm font-medium text-gray-800 leading-snug flex-1">{wo.title}</p>
        <PriorityBadge priority={wo.priority} />
      </div>
      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
        <CategoryBadge category={wo.category} />
        {wo.location && (
          <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
            <MapPin size={10} /> {wo.location}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {wo.dueDate && (
          <span className={cn('flex items-center gap-0.5 text-[10px]', overdue ? 'text-red-500 font-medium' : 'text-gray-400')}>
            <Calendar size={10} /> {formatDate(wo.dueDate)}
          </span>
        )}
        <span className="text-[10px] text-gray-400 truncate">oleh {wo.reportedBy.fullName}</span>
        {wo.assignee && <div className="ml-auto flex-shrink-0"><Avatar user={wo.assignee} size={5} /></div>}
      </div>
    </div>
  );
}

// ── Kanban Column ──────────────────────────────────────────
function WOColumn({
  status, workOrders, selectedId, onSelect, canDragWO,
}: {
  status: WOStatus; workOrders: WorkOrder[]; selectedId: string | null; onSelect: (id: string) => void;
  canDragWO: (wo: WorkOrder) => boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const cfg  = STATUS_CONFIG[status];
  const Icon = cfg.icon;

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      <div className={cn('flex items-center gap-2 px-3 py-2 rounded-t-lg mb-2 flex-shrink-0', cfg.bg)}>
        <Icon size={13} className={cfg.color} />
        <span className={cn('text-xs font-semibold', cfg.color)}>{cfg.label}</span>
        <span className="text-[10px] text-gray-400 ml-auto">{workOrders.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 overflow-y-auto space-y-2 pb-2 px-0.5 rounded-lg transition-colors min-h-[140px]',
          isOver && 'bg-navy/5 ring-2 ring-navy/20',
        )}
      >
        {workOrders.map((wo) => (
          <WOCard key={wo.id} wo={wo} selected={selectedId === wo.id} draggable={canDragWO(wo)} onSelect={() => onSelect(wo.id)} />
        ))}
        {workOrders.length === 0 && (
          <p className="text-center text-[11px] text-gray-300 py-6">Kosong</p>
        )}
      </div>
    </div>
  );
}

// ── WO Detail Panel ────────────────────────────────────────
function WODetail({
  wo, onClose, onEdit, onStatusChange, onDeleted, currentUserId, currentDivisionId, editScope, deleteScope,
}: {
  wo: WorkOrder; onClose: () => void; onEdit: () => void;
  onStatusChange: () => void; onDeleted: () => void;
  currentUserId: string; currentDivisionId: string; editScope: Scope; deleteScope: Scope;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [confirmDel, setConfirmDel]   = useState(false);

  const isReporter    = wo.reportedBy.id === currentUserId;
  const isAssignee    = wo.assignee?.id === currentUserId;
  const sameDivision  = wo.reportedBy.divisionId === currentDivisionId || wo.assignee?.divisionId === currentDivisionId;

  const canEdit    = hasScope(editScope, isReporter, sameDivision);
  const canDelete  = hasScope(deleteScope, isReporter, sameDivision);
  // Status changes go through the 'edit' permission on the backend (same route guard),
  // and 'own' scope there additionally allows the assignee, not just the reporter.
  const canStatus  = hasScope(editScope, isReporter || isAssignee, sameDivision);
  const isFinal    = wo.status === 'DONE' || wo.status === 'CANCELLED';

  async function handleDelete() {
    if (!confirmDel) { setConfirmDel(true); return; }
    setDeleting(true);
    try {
      await api.delete(`/work-orders/${wo.id}`);
      toast.success('Work order dihapus');
      onDeleted();
    } catch (err) { toast.error(extractErr(err)); } finally { setDeleting(false); setConfirmDel(false); }
  }

  return (
    <div className="flex flex-col h-full bg-white shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex-1 min-w-0 pr-4">
          <h2 className="font-semibold text-gray-900 text-sm leading-snug">{wo.title}</h2>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <StatusBadge status={wo.status} />
            <PriorityBadge priority={wo.priority} />
            <CategoryBadge category={wo.category} />
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Dilaporkan oleh</p>
            <div className="flex items-center gap-2">
              <Avatar user={wo.reportedBy} size={6} />
              <span className="text-xs text-gray-700">{wo.reportedBy.fullName}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Ditugaskan ke</p>
            {wo.assignee ? (
              <div className="flex items-center gap-2">
                <Avatar user={wo.assignee} size={6} />
                <span className="text-xs text-gray-700">{wo.assignee.fullName}</span>
              </div>
            ) : <span className="text-xs text-gray-400">Belum diassign</span>}
          </div>
          {wo.location && (
            <div className="space-y-1 col-span-2">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Lokasi</p>
              <div className="flex items-center gap-1.5 text-xs text-gray-700">
                <MapPin size={12} className="text-gray-400" /> {wo.location}
              </div>
            </div>
          )}
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Dibuat</p>
            <p className="text-xs text-gray-700">{formatDate(wo.createdAt)}</p>
          </div>
          {wo.dueDate && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Deadline</p>
              <p className={cn('text-xs', isOverdue(wo) ? 'text-red-500 font-medium' : 'text-gray-700')}>
                {formatDate(wo.dueDate)} {isOverdue(wo) && '⚠️'}
              </p>
            </div>
          )}
          {wo.completedAt && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Selesai</p>
              <p className="text-xs text-green-600 font-medium">{formatDate(wo.completedAt)}</p>
            </div>
          )}
        </div>

        {/* Description */}
        {wo.description && (
          <div>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Deskripsi</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{wo.description}</p>
          </div>
        )}

        {/* Notes */}
        {wo.notes && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
            <p className="text-[10px] font-medium text-amber-700 uppercase tracking-wide mb-1">Catatan Teknisi</p>
            <p className="text-sm text-amber-900 whitespace-pre-wrap">{wo.notes}</p>
          </div>
        )}

        {/* Attachments */}
        {wo.attachments && wo.attachments.length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-2">
              Lampiran ({wo.attachments.length})
            </p>
            <div className="space-y-1">
              {wo.attachments.map((a) => (
                <a
                  key={a.id}
                  href={`${import.meta.env.VITE_API_BASE?.replace('/api', '') || ''}/uploads/${a.filePath}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-blue-600 hover:underline"
                >
                  <Paperclip size={12} /> {a.fileName}
                  <span className="text-gray-400">({Math.round(a.fileSize / 1024)} KB)</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* History */}
        {wo.history && wo.history.length > 0 && (
          <div>
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 uppercase tracking-wide hover:text-gray-600 w-full"
            >
              <History size={12} />
              Riwayat ({wo.history.length})
              {showHistory ? <ChevronUp size={12} className="ml-auto" /> : <ChevronDown size={12} className="ml-auto" />}
            </button>
            {showHistory && (
              <div className="mt-2 space-y-2">
                {wo.history.map((h) => (
                  <div key={h.id} className="flex items-start gap-2.5 text-xs">
                    <Avatar user={h.changedBy} size={5} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-medium text-gray-700">{h.changedBy.fullName}</span>
                        {h.fromStatus && (
                          <>
                            <span className="text-gray-400">mengubah dari</span>
                            <StatusBadge status={h.fromStatus} />
                            <ArrowRight size={10} className="text-gray-300" />
                          </>
                        )}
                        <StatusBadge status={h.toStatus} />
                      </div>
                      {h.note && <p className="text-gray-500 mt-0.5">{h.note}</p>}
                      <p className="text-gray-400 mt-0.5">{formatRelative(h.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 border-t border-gray-100 px-5 py-3 flex items-center gap-2">
        {canStatus && !isFinal && (
          <button
            onClick={onStatusChange}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-navy text-white rounded-lg hover:bg-navy/90"
          >
            <RefreshCw size={12} /> Ubah Status
          </button>
        )}
        {canEdit && !isFinal && (
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Edit
          </button>
        )}
        {canDelete && (
          <button
            onClick={handleDelete} disabled={deleting}
            className={cn(
              'ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors',
              confirmDel ? 'bg-red-500 text-white hover:bg-red-600' : 'border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200',
            )}
          >
            {deleting ? <Loader2 size={12} className="animate-spin" /> : null}
            {confirmDel ? 'Klik lagi untuk hapus' : 'Hapus'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Stats Bar ──────────────────────────────────────────────
function StatsBar({ stats }: {
  stats: {
    byStatus: { status: WOStatus; _count: number }[];
    byPriority: { priority: WOPriority; _count: number }[];
    overdue: number;
  } | null;
}) {
  if (!stats) return null;

  const openCount = stats.byStatus.filter((s) => s.status !== 'DONE' && s.status !== 'CANCELLED').reduce((a, b) => a + b._count, 0);
  const doneCount = stats.byStatus.find((s) => s.status === 'DONE')?._count ?? 0;
  const urgentCount = stats.byPriority.find((p) => p.priority === 'URGENT')?._count ?? 0;

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-white border-b border-gray-100 flex-shrink-0 overflow-x-auto">
      <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
        <Wrench size={12} className="text-navy" />
        <span className="font-semibold text-navy">{openCount}</span>
        <span className="text-gray-500">Open</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
        <CheckCircle2 size={12} className="text-green-500" />
        <span className="font-semibold text-green-600">{doneCount}</span>
        <span className="text-gray-500">Done</span>
      </div>
      {stats.overdue > 0 && (
        <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
          <AlertCircle size={12} className="text-red-500" />
          <span className="font-semibold text-red-600">{stats.overdue}</span>
          <span className="text-gray-500">Overdue</span>
        </div>
      )}
      {urgentCount > 0 && (
        <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
          <Zap size={12} className="text-red-500" />
          <span className="font-semibold text-red-600">{urgentCount}</span>
          <span className="text-gray-500">Urgent</span>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function WorkOrderPage() {
  const user      = useAuthStore((s) => s.user);
  const perms     = usePermStore((s) => s.perms);
  const woPerms   = perms.work_order;

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [view, setView]           = useState<ViewFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<WOPriority | ''>('');
  const [search, setSearch]       = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem]   = useState<WorkOrder | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);

  const [dragWO, setDragWO]           = useState<WorkOrder | null>(null);
  const [assignPickerWO, setAssignPickerWO] = useState<WorkOrder | null>(null);
  const [pendingFinalize, setPendingFinalize] = useState<{ wo: WorkOrder; status: WOStatus } | null>(null);

  const [users, setUsers]   = useState<WOUser[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats]   = useState<{
    byStatus: { status: WOStatus; _count: number }[];
    byPriority: { priority: WOPriority; _count: number }[];
    overdue: number;
  } | null>(null);

  const [boardPage, setBoardPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [loadingMore, setLoadingMore] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const fetchWOs = useCallback(async (pageArg = 1, append = false) => {
    (append ? setLoadingMore : setLoading)(true);
    try {
      const params: Record<string, string> = { view, limit: String(pageSize), page: String(pageArg) };
      if (priorityFilter) params.priority = priorityFilter;
      if (search.trim())  params.search   = search.trim();

      const res = await api.get('/work-orders', { params });
      setWorkOrders((prev) => (append ? [...prev, ...res.data.data] : res.data.data));
      setTotalCount(res.data.meta?.total ?? res.data.data.length);
      setBoardPage(pageArg);
    } catch (err) { toast.error(extractErr(err)); }
    finally { (append ? setLoadingMore : setLoading)(false); }
  }, [view, priorityFilter, search, pageSize]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/work-orders/stats');
      setStats(res.data.data);
    } catch { /* ignore */ }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      // Managers with company-wide scope see everyone; division-scoped roles
      // (e.g. Admin Lapangan) only see/assign within their own division.
      const params: Record<string, string | boolean> = { limit: '100', isActive: true };
      if (woPerms.edit !== 'all' && user?.division?.id) params.division = user.division.id;
      const res = await api.get('/users', { params });
      setUsers(res.data.data ?? []);
    } catch { /* ignore */ }
  }, [woPerms.edit, user?.division?.id]);

  useEffect(() => { fetchWOs(); }, [fetchWOs]);
  useEffect(() => { fetchStats(); fetchUsers(); }, [fetchStats, fetchUsers]);

  const fetchDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await api.get(`/work-orders/${id}`);
      setSelectedWO(res.data.data);
    } catch (err) { toast.error(extractErr(err)); }
    finally { setLoadingDetail(false); }
  }, []);

  function handleSelect(id: string) {
    setSelectedId(id);
    fetchDetail(id);
  }

  function handleSaved(wo: WorkOrder) {
    setWorkOrders((prev) => {
      const idx = prev.findIndex((w) => w.id === wo.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = { ...next[idx], ...wo }; return next; }
      return [wo, ...prev];
    });
    if (selectedId === wo.id) setSelectedWO(wo);
    fetchStats();
  }

  function handleStatusChanged(wo: WorkOrder) {
    handleSaved(wo);
    setStatusModalOpen(false);
  }

  function handleDeleted() {
    setWorkOrders((prev) => prev.filter((w) => w.id !== selectedId));
    setSelectedId(null);
    setSelectedWO(null);
    fetchStats();
  }

  async function applyStatusChange(wo: WorkOrder, status: WOStatus) {
    const prevStatus = wo.status;
    // Optimistic: move the card immediately so the drag feels instant, revert on failure.
    setWorkOrders((prev) => prev.map((w) => (w.id === wo.id ? { ...w, status } : w)));
    try {
      const res = await api.patch(`/work-orders/${wo.id}/status`, { status, note: null });
      handleSaved(res.data.data);
      toast.success('Status diperbarui');
    } catch (err) {
      setWorkOrders((prev) => prev.map((w) => (w.id === wo.id ? { ...w, status: prevStatus } : w)));
      toast.error(extractErr(err));
    }
  }

  async function assignAndActivate(userId: string) {
    if (!assignPickerWO) return;
    try {
      const res = await api.patch(`/work-orders/${assignPickerWO.id}`, { assignedToId: userId });
      handleSaved(res.data.data);
      toast.success('Work order ditugaskan');
    } catch (err) { toast.error(extractErr(err)); } finally { setAssignPickerWO(null); }
  }

  function handleDragStart(e: DragStartEvent) {
    setDragWO(workOrders.find((w) => w.id === e.active.id) ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setDragWO(null);
    const { active, over } = e;
    if (!over) return;

    const wo = workOrders.find((w) => w.id === active.id);
    if (!wo) return;

    const targetStatus = over.id as WOStatus;
    if (targetStatus === wo.status) return;

    if (!STATUS_TRANSITIONS[wo.status].includes(targetStatus)) {
      toast.error('Perpindahan status ini tidak diizinkan');
      return;
    }

    if (targetStatus === 'ASSIGNED' && !wo.assignee) {
      setAssignPickerWO(wo);
      return;
    }

    // DONE/CANCELLED are terminal — confirm before finalizing so an accidental
    // drag can't close a work order with no way back.
    if (targetStatus === 'DONE' || targetStatus === 'CANCELLED') {
      setPendingFinalize({ wo, status: targetStatus });
      return;
    }

    applyStatusChange(wo, targetStatus);
  }

  function canDragWO(wo: WorkOrder): boolean {
    if (STATUS_TRANSITIONS[wo.status].length === 0) return false; // DONE/CANCELLED are terminal
    const isReporter   = wo.reportedBy.id === user?.id;
    const isAssignee   = wo.assignee?.id === user?.id;
    const sameDivision = wo.reportedBy.divisionId === user?.division?.id || wo.assignee?.divisionId === user?.division?.id;
    return hasScope(woPerms.edit, isReporter || isAssignee, sameDivision);
  }

  const sidebarViews: { id: ViewFilter; label: string }[] = [
    { id: 'all',        label: 'Semua WO'     },
    { id: 'mine',       label: 'Ditugaskan ke Saya' },
    { id: 'reported',   label: 'Saya Laporkan' },
    { id: 'unassigned', label: 'Belum Diassign' },
  ];

  return (
    <div className="flex h-full overflow-hidden -m-6">
      {/* Left sidebar — view filters */}
      <div className="w-52 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Wrench size={18} className="text-navy" />
            <h1 className="font-semibold text-gray-900 text-sm">Work Orders</h1>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {sidebarViews.map((v) => (
            <button
              key={v.id}
              onClick={() => { setView(v.id); setSelectedId(null); setSelectedWO(null); }}
              className={cn(
                'flex items-center gap-2 w-full px-4 py-2 text-sm transition-colors',
                view === v.id
                  ? 'bg-navy/5 text-navy font-medium border-r-2 border-r-navy'
                  : 'text-gray-600 hover:bg-gray-50',
              )}
            >
              <List size={14} />
              {v.label}
            </button>
          ))}
        </nav>

        {woPerms.create && (
          <div className="p-4 border-t border-gray-100">
            <button
              onClick={() => { setEditItem(null); setModalOpen(true); }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-navy text-white text-sm rounded-lg hover:bg-navy/90"
            >
              <Plus size={16} /> Buat WO
            </button>
          </div>
        )}
      </div>

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Stats */}
        <StatsBar stats={stats} />

        {/* Search + filter bar */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 flex-shrink-0 bg-white">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchWOs()}
            placeholder="Cari work order..."
            className="flex-1 max-w-xs text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy/30"
          />
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn('p-1.5 rounded-lg border transition-colors', showFilters ? 'border-navy bg-navy/5 text-navy' : 'border-gray-200 text-gray-500 hover:bg-gray-50')}
          >
            <Filter size={14} />
          </button>
          <button onClick={() => fetchWOs()} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
            <RefreshCw size={14} />
          </button>
          <PageSizeSelect value={pageSize} onChange={(n) => setPageSize(n)} options={[25, 50, 100]} />

          {showFilters && (
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as WOPriority | '')}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
            >
              <option value="">Semua Prioritas</option>
              {(Object.keys(PRIORITY_CONFIG) as WOPriority[]).map((p) => (
                <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
              ))}
            </select>
          )}
        </div>

        {totalCount > workOrders.length && (
          <div className="flex items-center gap-2 px-4 py-1.5 text-[11px] text-amber-700 bg-amber-50 border-b border-amber-100 flex-shrink-0">
            <AlertTriangle size={11} />
            <span>Menampilkan {workOrders.length} dari {totalCount} work order.</span>
            <button
              onClick={() => fetchWOs(boardPage + 1, true)}
              disabled={loadingMore}
              className="ml-auto flex items-center gap-1 font-medium text-amber-800 hover:underline disabled:opacity-60"
            >
              {loadingMore ? <Loader2 size={11} className="animate-spin" /> : null}
              Muat lebih banyak
            </button>
          </div>
        )}

        {/* Board */}
        {loading && workOrders.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-gray-300" />
          </div>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex-1 overflow-x-auto">
              <div className="flex gap-4 h-full px-4 py-4 min-w-max">
                {BOARD_COLUMNS.map((status) => (
                  <WOColumn
                    key={status}
                    status={status}
                    workOrders={workOrders.filter((w) => w.status === status)}
                    selectedId={selectedId}
                    onSelect={handleSelect}
                    canDragWO={canDragWO}
                  />
                ))}
              </div>
            </div>

            <DragOverlay dropAnimation={null}>
              {dragWO && (
                <div className="w-72">
                  <WOCard wo={dragWO} selected={false} draggable={false} overlay onSelect={() => {}} />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Detail drawer */}
      {selectedWO && (
        <div
          className="fixed inset-0 z-40 flex justify-end"
          onClick={() => { setSelectedId(null); setSelectedWO(null); }}
        >
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative w-full max-w-md h-full" onClick={(e) => e.stopPropagation()}>
            {loadingDetail ? (
              <div className="flex items-center justify-center h-full bg-white">
                <Loader2 size={20} className="animate-spin text-gray-300" />
              </div>
            ) : (
              <WODetail
                wo={selectedWO}
                onClose={() => { setSelectedId(null); setSelectedWO(null); }}
                onEdit={() => { setEditItem(selectedWO); setModalOpen(true); }}
                onStatusChange={() => setStatusModalOpen(true)}
                onDeleted={handleDeleted}
                currentUserId={user?.id ?? ''}
                currentDivisionId={user?.division?.id ?? ''}
                editScope={woPerms.edit}
                deleteScope={woPerms.delete}
              />
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <WorkOrderModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditItem(null); }}
        editItem={editItem}
        onSaved={handleSaved}
        users={users}
      />

      {selectedWO && (
        <StatusModal
          open={statusModalOpen}
          onClose={() => setStatusModalOpen(false)}
          wo={selectedWO}
          onChanged={handleStatusChanged}
        />
      )}

      <AssigneePickerModal
        wo={assignPickerWO}
        users={users}
        onClose={() => setAssignPickerWO(null)}
        onAssigned={assignAndActivate}
      />

      <ConfirmFinalizeModal
        pending={pendingFinalize}
        onClose={() => setPendingFinalize(null)}
        onConfirm={() => {
          if (!pendingFinalize) return;
          applyStatusChange(pendingFinalize.wo, pendingFinalize.status);
          setPendingFinalize(null);
        }}
      />
    </div>
  );
}
