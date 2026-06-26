import { useEffect, useState, useCallback } from 'react';
import {
  CalendarClock, Plus, Pencil, Trash2, Loader2, X, CheckCircle2,
  Users, UserMinus, Search, ChevronDown, ChevronUp,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toastStore';

// ── Types ──────────────────────────────────────────────────────
interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  lateThresholdMinutes: number;
  isDefault: boolean;
  color: string;
  isActive: boolean;
  _count?: { users: number };
}

interface UserEntry {
  id: string;
  fullName: string;
  username: string;
  avatar: string | null;
  shift: { id: string; name: string; color: string } | null;
  division: { name: string } | null;
}

// ── Color Presets ──────────────────────────────────────────────
const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

// ── Helpers ────────────────────────────────────────────────────
function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

// ── Shift Form Modal ───────────────────────────────────────────
interface ShiftFormProps {
  initial?: Shift | null;
  onClose: () => void;
  onSaved: () => void;
}

function ShiftFormModal({ initial, onClose, onSaved }: ShiftFormProps) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    startTime: initial?.startTime ?? '08:00',
    endTime: initial?.endTime ?? '17:00',
    lateThresholdMinutes: initial?.lateThresholdMinutes ?? 15,
    color: initial?.color ?? '#3b82f6',
    isDefault: initial?.isDefault ?? false,
    isActive: initial?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);

  function set(k: string, v: unknown) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.name.trim() || !form.startTime || !form.endTime) return;
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/hris/shifts/${initial!.id}`, form);
        toast.success('Shift updated');
      } else {
        await api.post('/hris/shifts', form);
        toast.success('Shift created');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: form.color }} />
            <h3 className="font-semibold text-gray-900">{isEdit ? 'Edit Shift' : 'New Shift'}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Shift Name <span className="text-red-500">*</span></label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Office Staff, Security Shift A"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Start Time</label>
              <input type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">End Time</label>
              <input type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Late Tolerance: <span className="font-semibold text-gray-700">{form.lateThresholdMinutes} min</span>
            </label>
            <input type="range" min={0} max={60} step={5} value={form.lateThresholdMinutes}
              onChange={(e) => set('lateThresholdMinutes', parseInt(e.target.value))}
              className="w-full accent-navy" />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0 min</span><span>30 min</span><span>60 min</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Shift Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button key={c} onClick={() => set('color', c)}
                  className={cn('w-7 h-7 rounded-full transition-transform hover:scale-110', form.color === c && 'ring-2 ring-offset-2 ring-gray-400 scale-110')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <label className="flex items-center gap-3 cursor-pointer">
              <div onClick={() => set('isDefault', !form.isDefault)}
                className={cn('relative w-9 h-5 rounded-full transition-colors flex-shrink-0', form.isDefault ? 'bg-navy' : 'bg-gray-200')}>
                <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', form.isDefault ? 'left-4' : 'left-0.5')} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Default Shift</p>
                <p className="text-xs text-gray-400">Employees without a shift will use this</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <div onClick={() => set('isActive', !form.isActive)}
                className={cn('relative w-9 h-5 rounded-full transition-colors flex-shrink-0', form.isActive ? 'bg-green-500' : 'bg-gray-200')}>
                <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', form.isActive ? 'left-4' : 'left-0.5')} />
              </div>
              <p className="text-sm font-medium text-gray-700">Active Shift</p>
            </label>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-navy hover:bg-navy/90 disabled:opacity-40 rounded-lg transition-colors flex items-center justify-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {isEdit ? 'Save Changes' : 'Create Shift'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Assign Panel ───────────────────────────────────────────────
function AssignPanel({ shifts }: { shifts: Shift[] }) {
  const [users, setUsers]       = useState<UserEntry[]>([]);
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState('');
  const [saving, setSaving]     = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/hris/shifts/users', { params: { search: search || undefined } });
      setUsers(res.data.data ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function assignShift(userId: string, shiftId: string | null) {
    setSaving(userId);
    try {
      await api.post('/hris/shifts/assign', { userId, shiftId });
      toast.success('Shift assigned');
      loadUsers();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to assign shift');
    } finally { setSaving(null); }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">Assign Employee Shifts</span>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 flex-1 max-w-[220px]">
          <Search size={13} className="text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee..."
            className="flex-1 text-xs bg-transparent focus:outline-none placeholder:text-gray-400" />
        </div>
      </div>
      <div className="max-h-[480px] overflow-y-auto divide-y divide-gray-50">
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
        ) : users.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">No employees found</div>
        ) : users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
            <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 overflow-hidden">
              {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : getInitials(u.fullName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 leading-tight truncate">{u.fullName}</p>
              <p className="text-xs text-gray-400 truncate">{u.division?.name ?? '—'}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {saving === u.id ? (
                <Loader2 size={14} className="animate-spin text-gray-400" />
              ) : (
                <>
                  <select
                    value={u.shift?.id ?? ''}
                    onChange={(e) => assignShift(u.id, e.target.value || null)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-navy/20 bg-white max-w-[140px]"
                  >
                    <option value="">— Default —</option>
                    {shifts.filter((s) => s.isActive).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {u.shift && (
                    <button onClick={() => assignShift(u.id, null)} title="Reset to default"
                      className="text-gray-400 hover:text-red-500 transition-colors">
                      <UserMinus size={14} />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function ShiftsAdminPage() {
  const [shifts, setShifts]     = useState<Shift[]>([]);
  const [loading, setLoading]   = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Shift | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadShifts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/hris/shifts');
      setShifts(res.data.data ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadShifts(); }, [loadShifts]);

  async function handleDelete(shift: Shift) {
    if (!confirm(`Delete shift "${shift.name}"? Employees using this shift will be reset to default.`)) return;
    try {
      await api.delete(`/hris/shifts/${shift.id}`);
      toast.success('Shift deleted');
      loadShifts();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to delete');
    }
  }

  return (
    <>
      {(formOpen || editTarget) && (
        <ShiftFormModal
          initial={editTarget}
          onClose={() => { setFormOpen(false); setEditTarget(null); }}
          onSaved={loadShifts}
        />
      )}

      <div className="space-y-5 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <CalendarClock size={20} className="text-navy" /> Manage Shifts
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage work shifts and employee assignments</p>
          </div>
          <button onClick={() => setFormOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-navy text-white rounded-lg text-sm font-medium hover:bg-navy/90 transition-colors">
            <Plus size={15} /> New Shift
          </button>
        </div>

        {/* Shift list */}
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {shifts.map((s) => (
              <div key={s.id} className={cn('bg-white border rounded-xl overflow-hidden transition-all', s.isActive ? 'border-gray-200' : 'border-dashed border-gray-200 opacity-60')}>
                {/* Color bar */}
                <div className="h-1.5" style={{ backgroundColor: s.color }} />
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-800">{s.name}</p>
                        {s.isDefault && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-navy/10 text-navy font-medium">Default</span>
                        )}
                        {!s.isActive && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium">Inactive</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{s.startTime} – {s.endTime}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setEditTarget(s)} className="p-1.5 text-gray-400 hover:text-navy hover:bg-navy/5 rounded-lg transition-colors">
                        <Pencil size={14} />
                      </button>
                      {!s.isDefault && (
                        <button onClick={() => handleDelete(s)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Tolerance: {s.lateThresholdMinutes} min</span>
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {s._count?.users ?? 0} employees
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {shifts.length === 0 && (
              <div className="col-span-3 py-10 text-center">
                <CalendarClock size={28} className="text-gray-200 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No shifts created yet</p>
              </div>
            )}
          </div>
        )}

        {/* User assignment */}
        <AssignPanel shifts={shifts} />
      </div>
    </>
  );
}
