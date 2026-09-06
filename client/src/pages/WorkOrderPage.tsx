import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import {
  Wrench, Plus, ChevronDown, X, Check, Clock, AlertTriangle,
  MapPin, User, Calendar, List, Filter, RefreshCw, Loader2,
  CheckCircle2, Circle, ArrowRight, Camera, History, ChevronUp,
  Zap, AlertCircle, Ban, LayoutGrid, Table2, ImageOff, ThumbsUp, ThumbsDown,
  ShieldCheck, ClipboardCheck, Download, Info,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { usePermStore } from '@/stores/permStore';
import type { Scope, WorkOrderPerms } from '@/types/permissions';
import { PageSizeSelect } from '@/components/shared/PageSizeSelect';

// ── Permission helper ──────────────────────────────────────
// Mirrors the server-side scope check in work-order.service.ts: 'all' always
// passes, 'division' passes if the WO's reporter/assignee shares the user's
// division, 'own' passes the caller-supplied ownership check, 'none' never passes.
// Exported for reuse by WorkOrderHistoryPage — same permission model, one source of truth.
export function hasScope(scope: Scope, isOwner: boolean, sameDivision: boolean): boolean {
  if (scope === 'all')      return true;
  if (scope === 'division') return sameDivision;
  if (scope === 'own')      return isOwner;
  return false;
}

// Decides which sidebar view a role should even see — driven entirely by
// permission fields, never by role name. A back-office role with
// canBeAssignee=false simply never gets offered "My Tasks" (it would always
// be empty); "Unassigned"/"Pending Review" only make sense for roles with
// authority beyond their own work (edit !== 'own'). Superadmin (level <= 1)
// bypasses this the same way it bypasses every other permission check — that
// exception lives in the level-ceiling rule already, not here.
function canSeeWOView(viewId: 'all' | 'mine' | 'reported' | 'unassigned' | 'pendingReview', perms: WorkOrderPerms): boolean {
  if (viewId === 'mine')          return perms.canBeAssignee;
  if (viewId === 'reported')      return perms.create;
  if (viewId === 'unassigned')    return perms.edit !== 'own';
  if (viewId === 'pendingReview') return perms.edit !== 'own';
  if (viewId === 'all')           return perms.edit !== 'own';
  return true;
}

// ── Types ──────────────────────────────────────────────────
// Exported: WorkOrderHistoryPage shares this exact shape and vocabulary.
export type WOStatus =
  | 'OPEN' | 'VALIDATED' | 'ASSIGNED' | 'IN_PROGRESS' | 'PENDING_PARTS'
  | 'PENDING_REVIEW' | 'DONE' | 'CANCELLED';
export type WOPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type WOCategory = 'ELECTRICAL' | 'PLUMBING' | 'HVAC' | 'CIVIL' | 'CLEANING' | 'SECURITY' | 'OTHER';
type WOAttachmentType = 'BEFORE' | 'AFTER' | 'OTHER';
type ViewFilter = 'all' | 'mine' | 'reported' | 'unassigned' | 'pendingReview';
type BoardMode = 'kanban' | 'table';

export interface WOUser {
  id: string; fullName: string; username: string; avatar: string | null; divisionId: string;
}

interface WOHistory {
  id: string; fromStatus: WOStatus | null; toStatus: WOStatus;
  note: string | null; createdAt: string; changedBy: WOUser;
}

interface WOAttachment {
  id: string; type: WOAttachmentType; fileName: string; filePath: string;
  fileSize: number; mimeType: string; createdAt: string; uploadedBy: WOUser;
}

export interface WorkOrder {
  id: string; code: string; title: string; description: string | null;
  status: WOStatus; priority: WOPriority; category: WOCategory;
  location: string | null; dueDate: string | null; completedAt: string | null; closedAt: string | null;
  notes: string | null; createdAt: string; updatedAt: string;
  assignedAt: string | null; reviewedAt: string | null; reviewNotes: string | null;
  reportedBy: WOUser; assignee: WOUser | null; assignedBy: WOUser | null; reviewedBy: WOUser | null;
  _count: { history: number; attachments: number };
  history?: WOHistory[]; attachments?: WOAttachment[];
}

// ── Config ─────────────────────────────────────────────────
// The active board (this page) only ever shows work still in flight. DONE and
// CANCELLED are terminal/historical — they live in WorkOrderHistoryPage
// (?scope=history) instead, so this board doesn't keep growing forever.
const BOARD_COLUMNS: WOStatus[] = [
  'OPEN', 'VALIDATED', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_PARTS', 'PENDING_REVIEW',
];

export const STATUS_CONFIG: Record<WOStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  OPEN:           { label: 'New',            color: 'text-slate-600',  bg: 'bg-slate-100',   icon: Circle        },
  VALIDATED:      { label: 'Validated',      color: 'text-cyan-600',   bg: 'bg-cyan-50',     icon: ShieldCheck   },
  ASSIGNED:       { label: 'Assigned',       color: 'text-blue-600',   bg: 'bg-blue-50',     icon: User          },
  IN_PROGRESS:    { label: 'In Progress',    color: 'text-amber-600',  bg: 'bg-amber-50',    icon: Clock         },
  PENDING_PARTS:  { label: 'Pending Parts',  color: 'text-orange-600', bg: 'bg-orange-50',   icon: AlertTriangle },
  PENDING_REVIEW: { label: 'Pending Review', color: 'text-purple-600', bg: 'bg-purple-50',   icon: ClipboardCheck },
  DONE:           { label: 'Done',           color: 'text-green-600',  bg: 'bg-green-50',    icon: CheckCircle2  },
  CANCELLED:      { label: 'Cancelled',      color: 'text-red-500',    bg: 'bg-red-50',      icon: Ban           },
};

export const PRIORITY_CONFIG: Record<WOPriority, { label: string; dot: string; badge: string }> = {
  LOW:    { label: 'Low',    dot: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-600'   },
  MEDIUM: { label: 'Medium', dot: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-600'   },
  HIGH:   { label: 'High',   dot: 'bg-orange-400', badge: 'bg-orange-50 text-orange-600' },
  URGENT: { label: 'Urgent', dot: 'bg-red-500',    badge: 'bg-red-50 text-red-600'     },
};

export const CATEGORY_CONFIG: Record<WOCategory, { label: string; icon: string }> = {
  ELECTRICAL:  { label: 'Electrical',  icon: '⚡' },
  PLUMBING:    { label: 'Plumbing',    icon: '🔧' },
  HVAC:        { label: 'HVAC',        icon: '❄️' },
  CIVIL:       { label: 'Civil',       icon: '🏗️' },
  CLEANING:    { label: 'Cleaning',    icon: '🧹' },
  SECURITY:    { label: 'Security',    icon: '🔒' },
  OTHER:       { label: 'Other',       icon: '📋' },
};

// Mirrors server-side STATUS_TRANSITIONS in work-order.service.ts — kept in sync
// manually. PENDING_REVIEW is reachable from IN_PROGRESS/PENDING_PARTS but gated
// server-side on having at least one AFTER photo; leaving PENDING_REVIEW only
// happens via the dedicated review action (approve/reject), never a plain status change.
const STATUS_TRANSITIONS: Record<WOStatus, WOStatus[]> = {
  OPEN:           ['VALIDATED', 'CANCELLED'],
  VALIDATED:      ['ASSIGNED', 'CANCELLED'],
  ASSIGNED:       ['IN_PROGRESS', 'VALIDATED', 'CANCELLED'],
  IN_PROGRESS:    ['PENDING_PARTS', 'PENDING_REVIEW', 'CANCELLED'],
  PENDING_PARTS:  ['IN_PROGRESS', 'PENDING_REVIEW', 'CANCELLED'],
  PENDING_REVIEW: [],
  DONE:           [],
  CANCELLED:      [],
};

// ── Helpers ────────────────────────────────────────────────
// Close modals/drawers on Escape. Shared by every overlay in the WO module
// (exported for WorkOrderHistoryPage's detail drawer).
export function useEscapeClose(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, onClose]);
}

// Debounce a fast-changing value (e.g. search input) so each keystroke doesn't
// fire its own API request. Exported for WorkOrderHistoryPage.
export function useDebounced<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

// datetime-local inputs work in local time; Date#toISOString is UTC. Feeding
// the raw ISO slice into the input shifts the time by the UTC offset (7h in
// WIB) — and silently re-saves the shifted value on every edit.
function toDatetimeLocal(d: Date | string): string {
  const dt = new Date(d);
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().slice(0, 16);
}

export function extractErr(err: unknown): string {
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
  return 'Something went wrong';
}

/** Locale for date formatting — mirrors i18next's active language. */
function dateLocale(language: string): string {
  return language === 'id' ? 'id-ID' : 'en-US';
}

export function formatDate(d: string | null, language = 'en') {
  if (!d) return null;
  return new Date(d).toLocaleDateString(dateLocale(language), { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatRelative(d: string, t: (key: string, opts?: Record<string, unknown>) => string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return t('workOrder.relative.justNow');
  if (mins < 60)  return t('workOrder.relative.minsAgo', { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return t('workOrder.relative.hrsAgo', { count: hrs });
  const days = Math.floor(hrs / 24);
  return t('workOrder.relative.daysAgo', { count: days });
}

export function isOverdue(wo: WorkOrder) {
  return wo.dueDate && wo.status !== 'DONE' && wo.status !== 'CANCELLED'
    && new Date(wo.dueDate) < new Date();
}

// ── Age (how long a WO has been open) ──────────────────────
// Age runs from creation until the WO is closed (closedAt/completedAt) — or
// until now while it's still in flight. This answers the owner's core
// question: "how long has this problem been open?"
export function woAgeMinutes(wo: Pick<WorkOrder, 'createdAt' | 'closedAt' | 'completedAt'>): number {
  const end = wo.closedAt ?? wo.completedAt;
  const endMs = end ? new Date(end).getTime() : Date.now();
  return Math.max(0, Math.round((endMs - new Date(wo.createdAt).getTime()) / 60000));
}

export function formatAge(mins: number, t?: (key: string) => string): string {
  const dayUnit    = t ? t('workOrder.units.day')    : 'd';
  const hourUnit    = t ? t('workOrder.units.hour')   : 'h';
  const minuteUnit = t ? t('workOrder.units.minute') : 'm';
  const days = Math.floor(mins / (60 * 24));
  const hrs  = Math.floor((mins % (60 * 24)) / 60);
  if (days > 0)  return hrs > 0 ? `${days}${dayUnit} ${hrs}${hourUnit}` : `${days}${dayUnit}`;
  if (hrs > 0)   return `${hrs}${hourUnit}`;
  return `${Math.max(1, mins)}${minuteUnit}`;
}

// Green under 2 days, amber 2–7 days, red past 7 days. Closed WOs show a
// neutral tone — their duration is a fact, not an alarm.
function ageTone(wo: WorkOrder, mins: number): string {
  if (wo.status === 'DONE' || wo.status === 'CANCELLED') return 'bg-gray-100 text-gray-500';
  const days = mins / (60 * 24);
  if (days < 2) return 'bg-green-50 text-green-600';
  if (days < 7) return 'bg-amber-50 text-amber-700';
  return 'bg-red-50 text-red-600';
}

export function AgeBadge({ wo }: { wo: WorkOrder }) {
  const { t } = useTranslation();
  const mins = woAgeMinutes(wo);
  return (
    <span
      className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap', ageTone(wo, mins))}
      title={wo.status === 'DONE' || wo.status === 'CANCELLED' ? t('workOrder.age.totalDurationTitle') : t('workOrder.age.openForTitle')}
    >
      <Clock size={10} />
      {formatAge(mins, t)}
    </span>
  );
}

function csvCell(v: string) {
  // Leading =, +, -, @ would be executed as a formula by Excel/Sheets —
  // neutralize with a leading apostrophe (standard CSV-injection guard).
  const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

function exportWorkOrdersCSV(workOrders: WorkOrder[], t: (key: string) => string) {
  const header = [
    t('workOrder.csv.code'), t('workOrder.csv.title'), t('workOrder.csv.status'), t('workOrder.csv.priority'),
    t('workOrder.csv.category'), t('workOrder.csv.location'), t('workOrder.csv.reportedBy'), t('workOrder.csv.assignee'),
    t('workOrder.csv.dueDate'), t('workOrder.csv.createdAt'), t('workOrder.csv.closedAt'), t('workOrder.csv.ageDuration'),
  ];
  const rows = workOrders.map((wo) => [
    wo.code, wo.title, STATUS_CONFIG[wo.status].label, PRIORITY_CONFIG[wo.priority].label,
    CATEGORY_CONFIG[wo.category].label, wo.location ?? '', wo.reportedBy.fullName,
    wo.assignee?.fullName ?? '', formatDate(wo.dueDate) ?? '', formatDate(wo.createdAt) ?? '',
    formatDate(wo.closedAt) ?? '', formatAge(woAgeMinutes(wo)),
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => csvCell(String(v))).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `work-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Sub-components ─────────────────────────────────────────
export function PriorityBadge({ priority }: { priority: WOPriority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full', cfg.badge)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: WOStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full', cfg.color, cfg.bg)}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

export function CategoryBadge({ category }: { category: WOCategory }) {
  const cfg = CATEGORY_CONFIG[category];
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
      <span>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

// Static class map — Tailwind's JIT can't see template-literal classes like
// `w-${size}`, so dynamic strings would silently produce no styling.
const AVATAR_SIZE_CLASS: Record<number, string> = {
  5: 'w-5 h-5', 6: 'w-6 h-6', 7: 'w-7 h-7', 8: 'w-8 h-8',
};

export function Avatar({ user, size = 6 }: { user: WOUser | null; size?: number }) {
  const sizeClass = AVATAR_SIZE_CLASS[size] ?? AVATAR_SIZE_CLASS[6];
  if (!user) return <div className={cn('rounded-full bg-gray-200', sizeClass)} />;
  return user.avatar
    ? <img src={user.avatar} alt={user.fullName} className={cn('rounded-full object-cover flex-shrink-0', sizeClass)} />
    : (
      <div className={cn('rounded-full bg-navy/10 flex items-center justify-center flex-shrink-0 text-navy font-semibold', sizeClass, size <= 6 ? 'text-[10px]' : 'text-xs')}>
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

// Default SLA per priority (days) — mirrors SLA_DAYS in work-order.service.ts.
// The server applies the same default when dueDate is omitted; prefilling here
// just makes the deadline visible (and adjustable) before submitting.
const SLA_DAYS: Record<WOPriority, number> = { URGENT: 1, HIGH: 3, MEDIUM: 7, LOW: 14 };

function slaDueDateInput(priority: WOPriority): string {
  const d = new Date();
  d.setDate(d.getDate() + SLA_DAYS[priority]);
  return toDatetimeLocal(d);
}

function WorkOrderModal({
  open, onClose, editItem, onSaved, users, canAssign,
}: {
  open: boolean; onClose: () => void;
  editItem: WorkOrder | null;
  onSaved: (wo: WorkOrder) => void;
  users: WOUser[];
  // edit scope 'all'/'division' only — assigning is an admin decision, so
  // own-scope reporters never see the field (and the server rejects it anyway).
  canAssign: boolean;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  // Once the user touches the due date, stop auto-adjusting it on priority change.
  const [dueTouched, setDueTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(editItem ? {
        title:        editItem.title,
        description:  editItem.description ?? '',
        priority:     editItem.priority,
        category:     editItem.category,
        location:     editItem.location ?? '',
        dueDate:      editItem.dueDate ? toDatetimeLocal(editItem.dueDate) : '',
        assignedToId: editItem.assignee?.id ?? '',
        notes:        editItem.notes ?? '',
      } : { ...DEFAULT_FORM, dueDate: slaDueDateInput(DEFAULT_FORM.priority) });
      setDueTouched(!!editItem);
    }
  }, [open, editItem]);

  useEscapeClose(open, onClose);

  if (!open) return null;

  function set<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handlePriorityChange(priority: WOPriority) {
    setForm((f) => ({
      ...f,
      priority,
      ...(dueTouched ? {} : { dueDate: slaDueDateInput(priority) }),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { toast.error(t('workOrder.modal.titleRequired')); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title:        form.title.trim(),
        description:  form.description.trim() || null,
        priority:     form.priority,
        category:     form.category,
        location:     form.location.trim() || null,
        dueDate:      form.dueDate ? new Date(form.dueDate).toISOString() : null,
        notes:        form.notes.trim() || null,
      };
      // Only include the assignee when the user has assignment authority —
      // sending it without would be rejected server-side (403).
      if (canAssign) payload.assignedToId = form.assignedToId || null;
      const res = editItem
        ? await api.patch(`/work-orders/${editItem.id}`, payload)
        : await api.post('/work-orders', payload);
      onSaved(res.data.data);
      toast.success(editItem ? t('workOrder.modal.updated') : t('workOrder.modal.created'));
      onClose();
    } catch (err) { toast.error(extractErr(err)); } finally { setSaving(false); }
  }

  const modalTitle = editItem ? t('workOrder.modal.editTitle', { code: editItem.code }) : t('workOrder.modal.createTitle');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={modalTitle}
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            {modalTitle}
          </h2>
          <button onClick={onClose} aria-label={t('workOrder.common.close')} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t('workOrder.modal.titleLabel')}</label>
            <input
              value={form.title} onChange={(e) => set('title', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              placeholder={t('workOrder.modal.titlePlaceholder')}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t('workOrder.modal.descriptionLabel')}</label>
            <textarea
              value={form.description} onChange={(e) => set('description', e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none"
              placeholder={t('workOrder.modal.descriptionPlaceholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('workOrder.modal.priorityLabel')}</label>
              <select
                value={form.priority} onChange={(e) => handlePriorityChange(e.target.value as WOPriority)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              >
                {(Object.keys(PRIORITY_CONFIG) as WOPriority[]).map((k) => (
                  <option key={k} value={k}>{PRIORITY_CONFIG[k].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('workOrder.modal.categoryLabel')}</label>
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
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('workOrder.modal.locationLabel')}</label>
              <input
                value={form.location} onChange={(e) => set('location', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                placeholder={t('workOrder.modal.locationPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('workOrder.modal.dueDateLabel')}</label>
              <input
                type="datetime-local" value={form.dueDate}
                onChange={(e) => { setDueTouched(true); set('dueDate', e.target.value); }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
              {!editItem && !dueTouched && (
                <p className="text-[10px] text-gray-400 mt-1">{t('workOrder.modal.dueDateAutoHint')}</p>
              )}
            </div>
          </div>

          {canAssign && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('workOrder.modal.assignLabel')}</label>
              <select
                value={form.assignedToId} onChange={(e) => set('assignedToId', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              >
                <option value="">{t('workOrder.modal.unassignedOption')}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
              </select>
            </div>
          )}

          {editItem && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('workOrder.modal.technicianNotesLabel')}</label>
              <textarea
                value={form.notes} onChange={(e) => set('notes', e.target.value)}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none"
                placeholder={t('workOrder.modal.technicianNotesPlaceholder')}
              />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
              {t('workOrder.common.cancel')}
            </button>
            <button
              type="submit" disabled={saving}
              className="flex-1 px-4 py-2 text-sm bg-navy text-white rounded-lg hover:bg-navy/90 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {editItem ? t('workOrder.common.save') : t('workOrder.createBtn')}
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
  const { t } = useTranslation();
  const [selected, setSelected] = useState<WOStatus | null>(null);
  const [note, setNote]         = useState('');
  const [saving, setSaving]     = useState(false);

  useEffect(() => { if (open) { setSelected(null); setNote(''); } }, [open]);
  useEscapeClose(open, onClose);
  if (!open) return null;

  const transitions = STATUS_TRANSITIONS[wo.status];

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await api.patch(`/work-orders/${wo.id}/status`, { status: selected, note: note.trim() || null });
      onChanged(res.data.data);
      toast.success(t('workOrder.statusModal.updated'));
      onClose();
    } catch (err) { toast.error(extractErr(err)); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t('workOrder.statusModal.title')} className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{t('workOrder.statusModal.title')}</h2>
          <button onClick={onClose} aria-label={t('workOrder.common.close')} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {transitions.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-2">{t('workOrder.statusModal.finalStatus')}</p>
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
                    {s === 'PENDING_REVIEW' && (
                      <p className="text-[10px] text-gray-400">
                        {wo.reviewedAt
                          ? t('workOrder.statusModal.afterPhotoRequiredAgain')
                          : t('workOrder.statusModal.afterPhotoRequired')}
                      </p>
                    )}
                  </div>
                  {selected === s && <Check size={14} className="ml-auto text-navy" />}
                </button>
              );
            })}
          </div>
          {selected && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('workOrder.statusModal.noteLabel')}</label>
              <textarea
                value={note} onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none"
                placeholder={t('workOrder.statusModal.notePlaceholder')}
              />
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
              {t('workOrder.common.cancel')}
            </button>
            <button
              onClick={handleSave} disabled={!selected || saving}
              className="flex-1 px-4 py-2 text-sm bg-navy text-white rounded-lg hover:bg-navy/90 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {t('workOrder.common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Review Modal (approve / reject a PENDING_REVIEW work order) ──
function ReviewModal({
  open, onClose, wo, onReviewed,
}: {
  open: boolean; onClose: () => void; wo: WorkOrder; onReviewed: (updated: WorkOrder) => void;
}) {
  const { t } = useTranslation();
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setDecision(null); setReviewNotes(''); } }, [open]);
  useEscapeClose(open, onClose);
  if (!open) return null;

  const afterPhotos = (wo.attachments ?? []).filter((a) => a.type === 'AFTER');

  async function handleSave() {
    if (!decision) return;
    if (decision === 'REJECTED' && !reviewNotes.trim()) {
      toast.error(t('workOrder.reviewModal.rejectionRequired'));
      return;
    }
    setSaving(true);
    try {
      const res = await api.patch(`/work-orders/${wo.id}/review`, { decision, reviewNotes: reviewNotes.trim() || null });
      onReviewed(res.data.data);
      toast.success(decision === 'APPROVED' ? t('workOrder.reviewModal.approved') : t('workOrder.reviewModal.rejected'));
      onClose();
    } catch (err) { toast.error(extractErr(err)); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t('workOrder.reviewModal.title')} className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{t('workOrder.reviewModal.title')}</h2>
          <button onClick={onClose} aria-label={t('workOrder.common.close')} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600">{wo.code} — {wo.title}</p>

          <div>
            <p className="text-xs font-medium text-gray-700 mb-1.5">{t('workOrder.reviewModal.afterPhotosLabel')}</p>
            {afterPhotos.length === 0 ? (
              <p className="text-xs text-gray-400 flex items-center gap-1.5"><ImageOff size={13} /> {t('workOrder.reviewModal.noPhotos')}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {afterPhotos.map((a) => (
                  <a key={a.id} href={a.filePath} target="_blank" rel="noopener noreferrer">
                    <img src={a.filePath} alt="After" className="w-full h-20 object-cover rounded-lg border border-gray-200" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setDecision('APPROVED')}
              className={cn(
                'flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                decision === 'APPROVED' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50',
              )}
            >
              <ThumbsUp size={14} /> {t('workOrder.reviewModal.approve')}
            </button>
            <button
              onClick={() => setDecision('REJECTED')}
              className={cn(
                'flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors',
                decision === 'REJECTED' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50',
              )}
            >
              <ThumbsDown size={14} /> {t('workOrder.reviewModal.reject')}
            </button>
          </div>

          {decision && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {decision === 'REJECTED' ? t('workOrder.reviewModal.rejectionReasonLabel') : t('workOrder.reviewModal.noteLabel')}
              </label>
              <textarea
                value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none"
                placeholder={decision === 'REJECTED' ? t('workOrder.reviewModal.rejectionPlaceholder') : t('workOrder.reviewModal.notePlaceholder')}
              />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
              {t('workOrder.common.cancel')}
            </button>
            <button
              onClick={handleSave} disabled={!decision || saving}
              className={cn(
                'flex-1 px-4 py-2 text-sm rounded-lg disabled:opacity-60 flex items-center justify-center gap-2 text-white',
                decision === 'REJECTED' ? 'bg-red-500 hover:bg-red-600' : 'bg-navy hover:bg-navy/90',
              )}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {decision === 'REJECTED' ? t('workOrder.reviewModal.sendRejection') : t('workOrder.reviewModal.approveAndClose')}
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
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  useEffect(() => { if (wo) setSearch(''); }, [wo]);
  useEscapeClose(!!wo, onClose);

  if (!wo) return null;

  const filtered = search.trim()
    ? users.filter((u) => u.fullName.toLowerCase().includes(search.trim().toLowerCase()))
    : users;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t('workOrder.assignModal.title')} className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-900">{t('workOrder.assignModal.title')}</h2>
          <button onClick={onClose} aria-label={t('workOrder.common.close')} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="px-5 pt-3 text-xs text-gray-500">{t('workOrder.assignModal.pickTechnicianFor', { title: wo.title })}</p>
        <div className="px-5 pt-3 flex-shrink-0">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('workOrder.assignModal.searchPlaceholder')}
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
            <p className="text-center text-xs text-gray-400 py-6">{t('workOrder.noMatchingEmployee')}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Kanban Card ────────────────────────────────────────────
function WOCard({
  wo, selected, draggable, onSelect, overlay, large,
}: {
  wo: WorkOrder; selected: boolean; draggable: boolean; onSelect: () => void; overlay?: boolean; large?: boolean;
}) {
  const { t, i18n } = useTranslation();
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
        'bg-white rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition-shadow',
        large ? 'p-4' : 'p-3',
        selected ? 'border-navy ring-1 ring-navy/30' : 'border-gray-200',
        isDragging && !overlay && 'opacity-40',
        overlay && 'shadow-xl rotate-2 cursor-grabbing',
        draggable && !overlay && 'touch-none',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono text-gray-400">{wo.code}</p>
          <p className={cn('font-medium text-gray-800 leading-snug', large ? 'text-base' : 'text-sm')}>{wo.title}</p>
        </div>
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
        <AgeBadge wo={wo} />
        {wo.dueDate && (
          <span className={cn('flex items-center gap-0.5 text-[10px]', overdue ? 'text-red-500 font-medium' : 'text-gray-400')}>
            <Calendar size={10} /> {formatDate(wo.dueDate, i18n.language)}
          </span>
        )}
        <span className="text-[10px] text-gray-400 truncate">{t('workOrder.card.reportedByPrefix', { name: wo.reportedBy.fullName })}</span>
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
  const { t } = useTranslation();
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
          <p className="text-center text-[11px] text-gray-300 py-6">{t('workOrder.empty')}</p>
        )}
      </div>
    </div>
  );
}

// ── Table / List view ───────────────────────────────────────
export function WOTable({
  workOrders, selectedId, onSelect, showClosed = false,
}: {
  workOrders: WorkOrder[]; selectedId: string | null; onSelect: (id: string) => void;
  // History page: swap the Due column for Closed date, and label age as Duration.
  showClosed?: boolean;
}) {
  const { t, i18n } = useTranslation();
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-50 z-10">
          <tr className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide">
            <th className="px-4 py-2.5">{t('workOrder.table.code')}</th>
            <th className="px-4 py-2.5">{t('workOrder.table.title')}</th>
            <th className="px-4 py-2.5">{t('workOrder.table.category')}</th>
            <th className="px-4 py-2.5">{t('workOrder.table.priority')}</th>
            <th className="px-4 py-2.5">{t('workOrder.table.status')}</th>
            <th className="px-4 py-2.5">{t('workOrder.table.technician')}</th>
            <th className="px-4 py-2.5">{showClosed ? t('workOrder.table.closed') : t('workOrder.table.due')}</th>
            <th className="px-4 py-2.5">{showClosed ? t('workOrder.table.duration') : t('workOrder.table.age')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {workOrders.map((wo) => {
            const overdue = isOverdue(wo);
            return (
              <tr
                key={wo.id}
                onClick={() => onSelect(wo.id)}
                className={cn('cursor-pointer hover:bg-gray-50 transition-colors', selectedId === wo.id && 'bg-navy/5')}
              >
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap">{wo.code}</td>
                <td className="px-4 py-2.5 text-gray-800 font-medium max-w-xs truncate">{wo.title}</td>
                <td className="px-4 py-2.5"><CategoryBadge category={wo.category} /></td>
                <td className="px-4 py-2.5"><PriorityBadge priority={wo.priority} /></td>
                <td className="px-4 py-2.5"><StatusBadge status={wo.status} /></td>
                <td className="px-4 py-2.5">
                  {wo.assignee ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar user={wo.assignee} size={5} />
                      <span className="text-xs text-gray-600 truncate">{wo.assignee.fullName}</span>
                    </div>
                  ) : <span className="text-xs text-gray-400">—</span>}
                </td>
                {showClosed ? (
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap text-gray-500">
                    {wo.closedAt ? formatDate(wo.closedAt, i18n.language) : '—'}
                  </td>
                ) : (
                  <td className={cn('px-4 py-2.5 text-xs whitespace-nowrap', overdue ? 'text-red-500 font-medium' : 'text-gray-500')}>
                    {wo.dueDate ? formatDate(wo.dueDate, i18n.language) : '—'}
                  </td>
                )}
                <td className="px-4 py-2.5 whitespace-nowrap"><AgeBadge wo={wo} /></td>
              </tr>
            );
          })}
          {workOrders.length === 0 && (
            <tr><td colSpan={8} className="text-center text-gray-400 text-sm py-12">{t('workOrder.noWorkOrders')}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Photo gallery + upload (before / after) ─────────────────
function PhotoSection({
  wo, canUpload, onUploaded,
}: {
  wo: WorkOrder; canUpload: boolean; onUploaded: (updated: WorkOrder) => void;
}) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState<WOAttachmentType | null>(null);
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef  = useRef<HTMLInputElement>(null);

  const before = (wo.attachments ?? []).filter((a) => a.type === 'BEFORE');
  const after  = (wo.attachments ?? []).filter((a) => a.type === 'AFTER');

  async function handleFile(type: WOAttachmentType, file?: File) {
    if (!file) return;
    setUploading(type);
    try {
      const photoBase64 = await fileToBase64(file);
      const res = await api.post(`/work-orders/${wo.id}/attachments`, { photoBase64, type });
      onUploaded({
        ...wo,
        attachments: [...(wo.attachments ?? []), res.data.data],
        _count: { ...wo._count, attachments: wo._count.attachments + 1 },
      });
      toast.success(file.type.startsWith('video/') ? t('workOrder.photos.videoUploaded') : t('workOrder.photos.photoUploaded'));
    } catch (err) { toast.error(extractErr(err)); } finally { setUploading(null); }
  }

  function PhotoGrid({ photos, emptyLabel }: { photos: WOAttachment[]; emptyLabel: string }) {
    if (photos.length === 0) {
      return <p className="text-xs text-gray-400 flex items-center gap-1.5 py-2"><ImageOff size={13} /> {emptyLabel}</p>;
    }
    return (
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <a key={p.id} href={p.filePath} target="_blank" rel="noopener noreferrer">
            {p.mimeType.startsWith('video/')
              ? <video src={p.filePath} className="w-full h-20 object-cover rounded-lg border border-gray-200" muted />
              : <img src={p.filePath} alt={p.type} className="w-full h-20 object-cover rounded-lg border border-gray-200" />}
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{t('workOrder.photos.before')}</p>
          {canUpload && (
            <button
              onClick={() => beforeInputRef.current?.click()}
              disabled={uploading === 'BEFORE'}
              aria-label={t('workOrder.photos.uploadBeforeAriaLabel')}
              className="text-navy hover:text-navy/70 disabled:opacity-50"
            >
              {uploading === 'BEFORE' ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            </button>
          )}
        </div>
        <PhotoGrid photos={before} emptyLabel={t('workOrder.photos.noPhotoYet')} />
        <input
          ref={beforeInputRef} type="file" accept="image/*,video/*" capture="environment" className="hidden"
          onChange={(e) => handleFile('BEFORE', e.target.files?.[0])}
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{t('workOrder.photos.after')}</p>
          {canUpload && (
            <button
              onClick={() => afterInputRef.current?.click()}
              disabled={uploading === 'AFTER'}
              aria-label={t('workOrder.photos.uploadAfterAriaLabel')}
              className="text-navy hover:text-navy/70 disabled:opacity-50"
            >
              {uploading === 'AFTER' ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            </button>
          )}
        </div>
        <PhotoGrid photos={after} emptyLabel={t('workOrder.photos.afterRequiredHint')} />
        <input
          ref={afterInputRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => handleFile('AFTER', e.target.files?.[0])}
        />
      </div>
    </div>
  );
}

// ── Duration timeline (Created → Assigned → Started → Closed) ──
// Answers "when did each step happen and how long did it take" at a glance,
// without expanding the raw history log. Built purely from timestamps that
// already exist on the WO + its history entries.
function formatDateTime(d: string, language = 'en') {
  return new Date(d).toLocaleString(dateLocale(language), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

function DurationTimeline({ wo }: { wo: WorkOrder }) {
  const { t, i18n } = useTranslation();
  const chrono = [...(wo.history ?? [])].reverse(); // history arrives newest-first
  const started = chrono.find((h) => h.toStatus === 'IN_PROGRESS');
  const review  = chrono.find((h) => h.toStatus === 'PENDING_REVIEW');

  const steps: { label: string; at: string }[] = [{ label: t('workOrder.timeline.created'), at: wo.createdAt }];
  if (wo.assignedAt) steps.push({ label: t('workOrder.timeline.assigned'), at: wo.assignedAt });
  if (started)       steps.push({ label: t('workOrder.timeline.workStarted'), at: started.createdAt });
  if (review)        steps.push({ label: t('workOrder.timeline.submittedForReview'), at: review.createdAt });
  if (wo.status === 'CANCELLED')  steps.push({ label: t('workOrder.timeline.cancelled'), at: wo.closedAt ?? wo.updatedAt });
  else if (wo.closedAt)           steps.push({ label: t('workOrder.timeline.closed'), at: wo.closedAt });

  steps.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const isFinal = wo.status === 'DONE' || wo.status === 'CANCELLED';
  const totalMins = woAgeMinutes(wo);

  return (
    <div>
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-2">{t('workOrder.timeline.title')}</p>
      <div className="space-y-0">
        {steps.map((s, i) => {
          const gapMins = i === 0 ? 0 : Math.round((new Date(s.at).getTime() - new Date(steps[i - 1].at).getTime()) / 60000);
          const last = i === steps.length - 1;
          return (
            <div key={`${s.label}-${s.at}`} className="flex gap-2.5">
              <div className="flex flex-col items-center">
                <span className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-1', last && isFinal ? 'bg-green-500' : 'bg-navy/40')} />
                {!last && <span className="w-px flex-1 bg-gray-200 my-0.5" />}
              </div>
              <div className={cn('flex-1 min-w-0', !last && 'pb-2.5')}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-gray-700">{s.label}</span>
                  {i > 0 && <span className="text-[10px] text-gray-400 whitespace-nowrap">+{formatAge(gapMins, t)}</span>}
                </div>
                <p className="text-[11px] text-gray-400">{formatDateTime(s.at, i18n.language)}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className={cn(
        'mt-2 px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5',
        isFinal ? 'bg-gray-50 text-gray-600' : totalMins < 2 * 60 * 24 ? 'bg-green-50 text-green-700' : totalMins < 7 * 60 * 24 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600',
      )}>
        <Clock size={12} />
        {isFinal
          ? t('workOrder.timeline.totalDuration', { duration: formatAge(totalMins, t) })
          : t('workOrder.timeline.openFor', { duration: formatAge(totalMins, t) })}
      </div>
    </div>
  );
}

// ── WO Detail Panel ────────────────────────────────────────
export function WODetail({
  wo, onClose, onEdit, onStatusChange, onReview, onDeleted, onUpdated,
  currentUserId, currentDivisionId, editScope, deleteScope,
}: {
  wo: WorkOrder; onClose: () => void; onEdit: () => void;
  onStatusChange: () => void; onReview: () => void; onDeleted: () => void; onUpdated: (wo: WorkOrder) => void;
  currentUserId: string; currentDivisionId: string; editScope: Scope; deleteScope: Scope;
}) {
  const { t, i18n } = useTranslation();
  const [showHistory, setShowHistory] = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [confirmDel, setConfirmDel]   = useState(false);

  const isReporter    = wo.reportedBy.id === currentUserId;
  const isAssignee    = wo.assignee?.id === currentUserId;
  const sameDivision  = wo.reportedBy.divisionId === currentDivisionId || wo.assignee?.divisionId === currentDivisionId;

  const isClosedWO = wo.status === 'DONE' || wo.status === 'CANCELLED';
  const canEdit    = hasScope(editScope, isReporter, sameDivision);
  // Closed WOs are the audit record — only company-wide admins may delete them
  // (mirrors the server-side guard in deleteWorkOrderService).
  const canDelete  = hasScope(deleteScope, isReporter, sameDivision) && (!isClosedWO || deleteScope === 'all');
  // Status changes go through the 'edit' permission on the backend (same route guard),
  // and 'own' scope there additionally allows the assignee, not just the reporter.
  const canStatus  = hasScope(editScope, isReporter || isAssignee, sameDivision);
  // Reviewing your own work order is blocked server-side too — the assignee (whoever
  // did the work) can never be the one who approves/rejects it, regardless of scope.
  const canReview  = canStatus && !isAssignee && wo.status === 'PENDING_REVIEW';
  const isFinal    = wo.status === 'DONE' || wo.status === 'CANCELLED';
  const isPendingReview = wo.status === 'PENDING_REVIEW';

  async function handleDelete() {
    if (!confirmDel) { setConfirmDel(true); return; }
    setDeleting(true);
    try {
      await api.delete(`/work-orders/${wo.id}`);
      toast.success(t('workOrder.detail.deleted'));
      onDeleted();
    } catch (err) { toast.error(extractErr(err)); } finally { setDeleting(false); setConfirmDel(false); }
  }

  return (
    <div className="flex flex-col h-full bg-white shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex-1 min-w-0 pr-4">
          <p className="text-[11px] font-mono text-gray-400">{wo.code}</p>
          <h2 className="font-semibold text-gray-900 text-sm leading-snug">{wo.title}</h2>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <StatusBadge status={wo.status} />
            <PriorityBadge priority={wo.priority} />
            <CategoryBadge category={wo.category} />
          </div>
        </div>
        <button onClick={onClose} aria-label={t('workOrder.common.close')} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{t('workOrder.detail.reportedBy')}</p>
            <div className="flex items-center gap-2">
              <Avatar user={wo.reportedBy} size={6} />
              <span className="text-xs text-gray-700">{wo.reportedBy.fullName}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{t('workOrder.detail.assignedTo')}</p>
            {wo.assignee ? (
              <div className="flex items-center gap-2">
                <Avatar user={wo.assignee} size={6} />
                <span className="text-xs text-gray-700">{wo.assignee.fullName}</span>
              </div>
            ) : <span className="text-xs text-gray-400">{t('workOrder.detail.unassigned')}</span>}
          </div>
          {wo.assignedBy && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{t('workOrder.detail.assignedBy')}</p>
              <span className="text-xs text-gray-700">{wo.assignedBy.fullName}</span>
            </div>
          )}
          {wo.location && (
            <div className="space-y-1 col-span-2">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{t('workOrder.detail.location')}</p>
              <div className="flex items-center gap-1.5 text-xs text-gray-700">
                <MapPin size={12} className="text-gray-400" /> {wo.location}
              </div>
            </div>
          )}
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{t('workOrder.detail.created')}</p>
            <p className="text-xs text-gray-700">{formatDate(wo.createdAt, i18n.language)}</p>
          </div>
          {wo.dueDate && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{t('workOrder.detail.dueDate')}</p>
              <p className={cn('text-xs', isOverdue(wo) ? 'text-red-500 font-medium' : 'text-gray-700')}>
                {formatDate(wo.dueDate, i18n.language)} {isOverdue(wo) && '⚠️'}
              </p>
            </div>
          )}
          {wo.closedAt && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{t('workOrder.detail.closed')}</p>
              <p className="text-xs text-green-600 font-medium">{formatDate(wo.closedAt, i18n.language)}</p>
            </div>
          )}
        </div>

        {/* Duration timeline */}
        <DurationTimeline wo={wo} />

        {/* Description */}
        {wo.description && (
          <div>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">{t('workOrder.detail.description')}</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{wo.description}</p>
          </div>
        )}

        {/* Notes */}
        {wo.notes && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
            <p className="text-[10px] font-medium text-amber-700 uppercase tracking-wide mb-1">{t('workOrder.detail.technicianNotes')}</p>
            <p className="text-sm text-amber-900 whitespace-pre-wrap">{wo.notes}</p>
          </div>
        )}

        {wo.reviewNotes && (
          <div className={cn('rounded-lg p-3 border', wo.status === 'DONE' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100')}>
            <p className={cn('text-[10px] font-medium uppercase tracking-wide mb-1', wo.status === 'DONE' ? 'text-green-700' : 'text-red-700')}>
              {wo.reviewedBy ? t('workOrder.detail.reviewNoteBy', { name: wo.reviewedBy.fullName }) : t('workOrder.detail.reviewNote')}
            </p>
            <p className="text-sm whitespace-pre-wrap text-gray-800">{wo.reviewNotes}</p>
          </div>
        )}

        {/* Photo evidence */}
        {!isFinal && wo.status !== 'OPEN' && wo.status !== 'VALIDATED' && (
          <div>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-2">{t('workOrder.detail.photoEvidence')}</p>
            <PhotoSection wo={wo} canUpload={canStatus && !isPendingReview} onUploaded={onUpdated} />
          </div>
        )}
        {(isFinal || isPendingReview) && wo.attachments && wo.attachments.length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-2">{t('workOrder.detail.photoEvidence')}</p>
            <PhotoSection wo={wo} canUpload={false} onUploaded={onUpdated} />
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
              {t('workOrder.detail.history', { count: wo.history.length })}
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
                            <span className="text-gray-400">{t('workOrder.detail.changedFrom')}</span>
                            <StatusBadge status={h.fromStatus} />
                            <ArrowRight size={10} className="text-gray-300" />
                          </>
                        )}
                        <StatusBadge status={h.toStatus} />
                      </div>
                      {h.note && <p className="text-gray-500 mt-0.5">{h.note}</p>}
                      <p className="text-gray-400 mt-0.5">{formatRelative(h.createdAt, t)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 border-t border-gray-100 px-5 py-3 flex items-center gap-2 flex-wrap">
        {canReview && (
          <button
            onClick={onReview}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <ClipboardCheck size={12} /> {t('workOrder.detail.reviewWorkBtn')}
          </button>
        )}
        {canStatus && !isFinal && !isPendingReview && (
          <button
            onClick={onStatusChange}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-navy text-white rounded-lg hover:bg-navy/90"
          >
            <RefreshCw size={12} /> {t('workOrder.detail.changeStatusBtn')}
          </button>
        )}
        {canEdit && !isFinal && (
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            {t('workOrder.detail.editBtn')}
          </button>
        )}
        {canDelete && (
          <button
            onClick={handleDelete} disabled={deleting}
            className={cn(
              'ml-auto flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors',
              confirmDel ? 'bg-red-500 text-white hover:bg-red-600' : 'border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200',
            )}
          >
            {deleting ? <Loader2 size={12} className="animate-spin" /> : null}
            {confirmDel ? t('workOrder.detail.confirmDelete') : t('workOrder.detail.deleteBtn')}
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
  const { t } = useTranslation();
  if (!stats) return null;

  const openCount = stats.byStatus.filter((s) => s.status !== 'DONE' && s.status !== 'CANCELLED').reduce((a, b) => a + b._count, 0);
  const pendingReviewCount = stats.byStatus.find((s) => s.status === 'PENDING_REVIEW')?._count ?? 0;
  const urgentCount = stats.byPriority.find((p) => p.priority === 'URGENT')?._count ?? 0;

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-white border-b border-gray-100 flex-shrink-0 overflow-x-auto">
      <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
        <Wrench size={12} className="text-navy" />
        <span className="font-semibold text-navy">{openCount}</span>
        <span className="text-gray-500">{t('workOrder.stats.active')}</span>
      </div>
      {pendingReviewCount > 0 && (
        <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
          <ClipboardCheck size={12} className="text-purple-500" />
          <span className="font-semibold text-purple-600">{pendingReviewCount}</span>
          <span className="text-gray-500">{t('workOrder.stats.pendingReview')}</span>
        </div>
      )}
      {stats.overdue > 0 && (
        <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
          <AlertCircle size={12} className="text-red-500" />
          <span className="font-semibold text-red-600">{stats.overdue}</span>
          <span className="text-gray-500">{t('workOrder.stats.overdue')}</span>
        </div>
      )}
      {urgentCount > 0 && (
        <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
          <Zap size={12} className="text-red-500" />
          <span className="font-semibold text-red-600">{urgentCount}</span>
          <span className="text-gray-500">{t('workOrder.stats.urgent')}</span>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function WorkOrderPage() {
  const { t } = useTranslation();
  const user      = useAuthStore((s) => s.user);
  const perms     = usePermStore((s) => s.perms);
  const woPerms   = perms.work_order;

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Default to the first view this role is actually allowed to see — e.g. a
  // back-office role without canBeAssignee/edit-beyond-own would never see
  // 'all' rendered as a tab, so defaulting to it would leave no tab highlighted.
  const [view, setView] = useState<ViewFilter>(() => {
    const order: ViewFilter[] = ['all', 'mine', 'reported', 'unassigned', 'pendingReview'];
    return order.find((v) => canSeeWOView(v, woPerms)) ?? 'reported';
  });
  const [boardMode, setBoardMode] = useState<BoardMode>('kanban');
  const [priorityFilter, setPriorityFilter] = useState<WOPriority | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<WOCategory | ''>('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [search, setSearch]       = useState('');
  // The committed search value actually sent to the API — follows typing with a
  // debounce, but Enter commits immediately (no stale-debounce fetch).
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounced(search);
  useEffect(() => { setSearchQuery(debouncedSearch); }, [debouncedSearch]);
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem]   = useState<WorkOrder | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  const [dragWO, setDragWO]           = useState<WorkOrder | null>(null);
  const [assignPickerWO, setAssignPickerWO] = useState<WorkOrder | null>(null);

  const [users, setUsers]   = useState<WOUser[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats]   = useState<{
    byStatus: { status: WOStatus; _count: number }[];
    byPriority: { priority: WOPriority; _count: number }[];
    overdue: number;
    unassigned: number;
    mine: number;
  } | null>(null);

  const [boardPage, setBoardPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [loadingMore, setLoadingMore] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Escape closes the detail drawer — but not while a modal is stacked on top,
  // otherwise one keypress would close both layers at once.
  const anyModalOpen = modalOpen || statusModalOpen || reviewModalOpen || !!assignPickerWO;
  useEscapeClose(!!selectedWO && !anyModalOpen, () => { setSelectedId(null); setSelectedWO(null); });

  // scope=active — DONE/CANCELLED work orders live in WorkOrderHistoryPage instead.
  const buildParams = useCallback((pageArg: number, limit: number): Record<string, string> => {
    const params: Record<string, string> = { scope: 'active', limit: String(limit), page: String(pageArg) };
    if (view === 'pendingReview') params.status = 'PENDING_REVIEW';
    else params.view = view;
    if (priorityFilter) params.priority = priorityFilter;
    if (categoryFilter) params.category = categoryFilter;
    if (assigneeFilter) params.assignedToId = assigneeFilter;
    if (dateFrom) params.dateFrom = new Date(dateFrom).toISOString();
    // End of day, not midnight — "to 14 Jul" must include WOs created on the 14th.
    if (dateTo)   params.dateTo   = new Date(`${dateTo}T23:59:59.999`).toISOString();
    if (searchQuery.trim()) params.search = searchQuery.trim();
    return params;
  }, [view, priorityFilter, categoryFilter, assigneeFilter, dateFrom, dateTo, searchQuery]);

  const fetchWOs = useCallback(async (pageArg = 1, append = false) => {
    (append ? setLoadingMore : setLoading)(true);
    try {
      const res = await api.get('/work-orders', { params: buildParams(pageArg, pageSize) });
      setWorkOrders((prev) => (append ? [...prev, ...res.data.data] : res.data.data));
      setTotalCount(res.data.meta?.total ?? res.data.data.length);
      setBoardPage(pageArg);
    } catch (err) { toast.error(extractErr(err)); }
    finally { (append ? setLoadingMore : setLoading)(false); }
  }, [buildParams, pageSize]);

  // Export the FULL filtered result set, not just the rows loaded on screen —
  // pages through the API (server caps limit at 100) with a sanity cap.
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const all: WorkOrder[] = [];
      const PAGE = 100;
      const MAX_PAGES = 50; // 5000 rows — far beyond any realistic export here
      for (let p = 1; p <= MAX_PAGES; p++) {
        const res = await api.get('/work-orders', { params: buildParams(p, PAGE) });
        all.push(...res.data.data);
        const total = res.data.meta?.total ?? all.length;
        if (all.length >= total || res.data.data.length < PAGE) break;
      }
      exportWorkOrdersCSV(all, t);
    } catch (err) { toast.error(extractErr(err)); }
    finally { setExporting(false); }
  }, [buildParams, t]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/work-orders/stats');
      setStats(res.data.data);
    } catch { /* ignore */ }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      // Managers with company-wide scope see everyone; division-scoped roles
      // (e.g. field admins) only see/assign within their own division.
      // workOrderAssignee=true is enforced server-side too — this isn't just a
      // display filter, roles with canBeAssignee=false can never be returned here.
      const params: Record<string, string | boolean> = { limit: '100', isActive: true, workOrderAssignee: true };
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

  // Deep link from notifications: /work-orders?id=<uuid> opens the detail
  // drawer directly (works for closed WOs too — the drawer hides actions).
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const id = searchParams.get('id');
    if (!id) return;
    setSelectedId(id);
    fetchDetail(id);
    setSearchParams({}, { replace: true }); // consume the param so refresh/close behaves normally
  }, [searchParams, setSearchParams, fetchDetail]);

  function handleSelect(id: string) {
    setSelectedId(id);
    fetchDetail(id);
  }

  // Whether a WO still belongs on the board under the current view — closed
  // WOs move to History, and e.g. assigning one away from the "Unassigned"
  // view means its card must leave immediately, not linger until a refetch.
  function matchesCurrentView(wo: WorkOrder): boolean {
    if (wo.status === 'DONE' || wo.status === 'CANCELLED') return false;
    if (view === 'mine')          return wo.assignee?.id === user?.id;
    if (view === 'reported')      return wo.reportedBy.id === user?.id;
    if (view === 'unassigned')    return !wo.assignee;
    if (view === 'pendingReview') return wo.status === 'PENDING_REVIEW';
    return true;
  }

  function handleSaved(wo: WorkOrder) {
    const keep = matchesCurrentView(wo);
    setWorkOrders((prev) => {
      const idx = prev.findIndex((w) => w.id === wo.id);
      if (idx >= 0) {
        const next = [...prev];
        if (keep) next[idx] = { ...next[idx], ...wo };
        else next.splice(idx, 1);
        return next;
      }
      return keep ? [wo, ...prev] : prev;
    });
    setTotalCount((prev) => {
      const wasListed = workOrders.some((w) => w.id === wo.id);
      if (wasListed && !keep) return Math.max(0, prev - 1);
      if (!wasListed && keep) return prev + 1;
      return prev;
    });
    // The detail drawer stays open regardless — it shows the updated state
    // (e.g. an approved WO now reads DONE) even after its card left the board.
    if (selectedId === wo.id) setSelectedWO(wo);
    fetchStats();
  }

  function handleStatusChanged(wo: WorkOrder) {
    handleSaved(wo);
    setStatusModalOpen(false);
  }

  function handleReviewed(wo: WorkOrder) {
    handleSaved(wo);
    setReviewModalOpen(false);
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
      toast.success(t('workOrder.statusModal.updated'));
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
      toast.success(t('workOrder.assignModal.assigned'));
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

    // Dropping into ASSIGNED from OPEN/VALIDATED always goes through the
    // assignee picker: the server treats the assignment PATCH itself as the
    // transition (assigning an OPEN WO implies the admin vetted it), so a
    // single drag replaces the old OPEN → VALIDATED → ASSIGNED double step.
    if (targetStatus === 'ASSIGNED' && (wo.status === 'OPEN' || wo.status === 'VALIDATED')) {
      setAssignPickerWO(wo);
      return;
    }

    if (!STATUS_TRANSITIONS[wo.status].includes(targetStatus)) {
      toast.error(t('workOrder.errors.transitionNotAllowed'));
      return;
    }

    applyStatusChange(wo, targetStatus);
  }

  function canDragWO(wo: WorkOrder): boolean {
    if (STATUS_TRANSITIONS[wo.status].length === 0) return false; // terminal statuses
    const isReporter   = wo.reportedBy.id === user?.id;
    const isAssignee   = wo.assignee?.id === user?.id;
    const sameDivision = wo.reportedBy.divisionId === user?.division?.id || wo.assignee?.divisionId === user?.division?.id;
    return hasScope(woPerms.edit, isReporter || isAssignee, sameDivision);
  }

  // Views grouped by intent: "My Work" is personal, "Management" is the
  // queues an admin has to drain. Staff with 'own' scope only ever see the
  // first group (labels are hidden when just one group is visible).
  const VIEW_SECTIONS: { label: string; views: { id: ViewFilter; label: string }[] }[] = [
    {
      label: t('workOrder.sections.myWork'),
      views: [
        { id: 'mine',     label: t('workOrder.views.mine')     },
        { id: 'reported', label: t('workOrder.views.reported') },
      ],
    },
    {
      label: t('workOrder.sections.management'),
      views: [
        { id: 'all',           label: t('workOrder.views.all')           },
        { id: 'unassigned',    label: t('workOrder.views.unassigned')    },
        { id: 'pendingReview', label: t('workOrder.views.pendingReview') },
      ],
    },
  ];
  const visibleSections = VIEW_SECTIONS
    .map((sec) => ({ ...sec, views: sec.views.filter((v) => canSeeWOView(v.id, woPerms)) }))
    .filter((sec) => sec.views.length > 0);
  const showSectionLabels = visibleSections.length > 1;
  const sidebarViews = visibleSections.flatMap((sec) => sec.views);

  // Live queue sizes on the nav — an admin sees waiting work without clicking.
  function viewCount(id: ViewFilter): number | undefined {
    if (!stats) return undefined;
    if (id === 'mine')          return stats.mine || undefined;
    if (id === 'unassigned')    return stats.unassigned || undefined;
    if (id === 'pendingReview') return stats.byStatus.find((b) => b.status === 'PENDING_REVIEW')?._count || undefined;
    return undefined;
  }

  return (
    <div className="flex h-full overflow-hidden -m-6">
      {/* Left sidebar — view filters (hidden on mobile, technicians get a flat list) */}
      <div className="hidden lg:flex w-52 flex-shrink-0 bg-white border-r border-gray-100 flex-col">
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Wrench size={18} className="text-navy" />
            <h1 className="font-semibold text-gray-900 text-sm">{t('workOrder.title')}</h1>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {visibleSections.map((sec, idx) => (
            <div key={sec.label}>
              {showSectionLabels && (
                <p className={cn('px-4 mb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider', idx > 0 ? 'mt-4' : 'mt-1')}>
                  {sec.label}
                </p>
              )}
              {sec.views.map((v) => {
                const n = viewCount(v.id);
                return (
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
                    <span className="flex-1 text-left truncate">{v.label}</span>
                    {n !== undefined && (
                      <span className={cn(
                        'text-[10px] font-semibold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center',
                        v.id === 'mine' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-700',
                      )}>
                        {n > 99 ? '99+' : n}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {woPerms.create && (
          <div className="p-4 border-t border-gray-100">
            <button
              onClick={() => { setEditItem(null); setModalOpen(true); }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-navy text-white text-sm rounded-lg hover:bg-navy/90"
            >
              <Plus size={16} /> {t('workOrder.createBtn')}
            </button>
          </div>
        )}
      </div>

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Mobile header — compact, big tap targets */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <Wrench size={18} className="text-navy" />
            <h1 className="font-semibold text-gray-900 text-sm">{t('workOrder.title')}</h1>
          </div>
          {woPerms.create && (
            <button
              onClick={() => { setEditItem(null); setModalOpen(true); }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-navy text-white text-sm rounded-lg"
            >
              <Plus size={16} /> {t('workOrder.createBtnShort')}
            </button>
          )}
        </div>
        <div className="lg:hidden flex gap-1.5 px-3 py-2 overflow-x-auto border-b border-gray-100 bg-white flex-shrink-0">
          {sidebarViews.map((v) => (
            <button
              key={v.id}
              onClick={() => { setView(v.id); setSelectedId(null); setSelectedWO(null); }}
              className={cn(
                'flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap',
                view === v.id ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600',
              )}
            >
              {v.label}{viewCount(v.id) !== undefined ? ` · ${viewCount(v.id)}` : ''}
            </button>
          ))}
        </div>

        {/* Stats */}
        <StatsBar stats={stats} />

        {/* Search + filter bar */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 flex-shrink-0 bg-white flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setSearchQuery(search); }}
            placeholder={t('workOrder.toolbar.searchPlaceholder')}
            aria-label={t('workOrder.toolbar.searchAriaLabel')}
            className="flex-1 min-w-[140px] max-w-xs text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy/30"
          />
          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-label={t('workOrder.toolbar.toggleFiltersAriaLabel')}
            className={cn('p-1.5 rounded-lg border transition-colors', showFilters ? 'border-navy bg-navy/5 text-navy' : 'border-gray-200 text-gray-500 hover:bg-gray-50')}
          >
            <Filter size={14} />
          </button>
          <button onClick={() => fetchWOs()} aria-label={t('workOrder.toolbar.refreshAriaLabel')} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
            <RefreshCw size={14} />
          </button>
          <button
            onClick={handleExport}
            disabled={workOrders.length === 0 || exporting}
            title={t('workOrder.toolbar.exportCsvTitle')}
            aria-label={t('workOrder.toolbar.exportCsvAriaLabel')}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          </button>
          <PageSizeSelect value={pageSize} onChange={(n) => setPageSize(n)} options={[25, 50, 100]} />

          {/* View mode toggle — desktop/admin only, mobile always gets the flat list */}
          <div className="hidden lg:flex items-center rounded-lg border border-gray-200 overflow-hidden ml-auto">
            <button
              onClick={() => setBoardMode('kanban')}
              className={cn('p-1.5', boardMode === 'kanban' ? 'bg-navy text-white' : 'text-gray-500 hover:bg-gray-50')}
              title={t('workOrder.toolbar.kanbanView')} aria-label={t('workOrder.toolbar.kanbanView')}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setBoardMode('table')}
              className={cn('p-1.5', boardMode === 'table' ? 'bg-navy text-white' : 'text-gray-500 hover:bg-gray-50')}
              title={t('workOrder.toolbar.tableView')} aria-label={t('workOrder.toolbar.tableView')}
            >
              <Table2 size={14} />
            </button>
          </div>

          {showFilters && (
            <div className="flex items-center gap-2 flex-wrap w-full">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as WOPriority | '')}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
              >
                <option value="">{t('workOrder.toolbar.allPriorities')}</option>
                {(Object.keys(PRIORITY_CONFIG) as WOPriority[]).map((p) => (
                  <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                ))}
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as WOCategory | '')}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
              >
                <option value="">{t('workOrder.toolbar.allCategories')}</option>
                {(Object.keys(CATEGORY_CONFIG) as WOCategory[]).map((c) => (
                  <option key={c} value={c}>{CATEGORY_CONFIG[c].icon} {CATEGORY_CONFIG[c].label}</option>
                ))}
              </select>
              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
              >
                <option value="">{t('workOrder.toolbar.allTechnicians')}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
              </select>
              <input
                type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
              />
              <span className="text-xs text-gray-400">{t('workOrder.toolbar.dateTo')}</span>
              <input
                type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
              />
            </div>
          )}
        </div>

        {totalCount > workOrders.length && (
          <div className="flex items-center gap-2 px-4 py-1.5 text-[11px] text-gray-500 bg-gray-50 border-b border-gray-100 flex-shrink-0">
            <Info size={11} />
            <span>{t('workOrder.loadMore.showing', { shown: workOrders.length, total: totalCount })}</span>
            <button
              onClick={() => fetchWOs(boardPage + 1, true)}
              disabled={loadingMore}
              className="ml-auto flex items-center gap-1 font-medium text-navy hover:underline disabled:opacity-60"
            >
              {loadingMore ? <Loader2 size={11} className="animate-spin" /> : null}
              {t('workOrder.loadMore.button')}
            </button>
          </div>
        )}

        {/* Board */}
        {loading && workOrders.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-gray-300" />
          </div>
        ) : (
          <>
            {/* Mobile: flat stacked list, large tap targets, no drag */}
            <div className="lg:hidden flex-1 overflow-y-auto p-3 space-y-2.5">
              {workOrders.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-12">{t('workOrder.noWorkOrders')}</p>
              ) : workOrders.map((wo) => (
                <WOCard key={wo.id} wo={wo} selected={selectedId === wo.id} draggable={false} large onSelect={() => handleSelect(wo.id)} />
              ))}
            </div>

            {/* Desktop: Kanban or Table */}
            <div className="hidden lg:flex flex-col flex-1 overflow-hidden">
              {boardMode === 'table' ? (
                <WOTable workOrders={workOrders} selectedId={selectedId} onSelect={handleSelect} />
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
          </>
        )}
      </div>

      {/* Detail panel — full-screen on mobile, side drawer on desktop */}
      {selectedWO && (
        <div
          className="fixed inset-0 z-40 flex justify-end"
          onClick={() => { setSelectedId(null); setSelectedWO(null); }}
        >
          <div className="absolute inset-0 bg-black/20 hidden lg:block" />
          <div className="relative w-full lg:max-w-md h-full" onClick={(e) => e.stopPropagation()}>
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
                onReview={() => setReviewModalOpen(true)}
                onDeleted={handleDeleted}
                onUpdated={handleSaved}
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
        canAssign={woPerms.edit === 'all' || woPerms.edit === 'division'}
      />

      {selectedWO && (
        <StatusModal
          open={statusModalOpen}
          onClose={() => setStatusModalOpen(false)}
          wo={selectedWO}
          onChanged={handleStatusChanged}
        />
      )}

      {selectedWO && (
        <ReviewModal
          open={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          wo={selectedWO}
          onReviewed={handleReviewed}
        />
      )}

      <AssigneePickerModal
        wo={assignPickerWO}
        users={users}
        onClose={() => setAssignPickerWO(null)}
        onAssigned={assignAndActivate}
      />
    </div>
  );
}
