import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CalendarClock, Plus, ChevronLeft, ChevronRight, LayoutGrid, List as ListIcon,
  Loader2, X,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toastStore';
import { usePermStore } from '@/stores/permStore';
import BookingModal from '@/components/meeting-room/BookingModal';
import { extractErr, roomColor, fmtTime, fmtDay, type Room, type Booking } from '@/types/meetingRoom';

const HOURS = Array.from({ length: 10 }, (_, i) => 8 + i); // 08:00–18:00
const ROW_H = 56; // px per hour, matches the approved mockup's grid rhythm
const DAY_LABELS_ID = ['SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB', 'MIN'];

function startOfWeek(d: Date) {
  const day = (d.getDay() + 6) % 7; // Monday-first
  const s = new Date(d);
  s.setDate(d.getDate() - day);
  s.setHours(0, 0, 0, 0);
  return s;
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(d.getDate() + n); return r; }
function isoDate(d: Date) { return d.toISOString().slice(0, 10); }
function sameDay(a: Date, b: Date) { return a.toDateString() === b.toDateString(); }

export default function MeetingRoomPage() {
  const { t } = useTranslation();
  const perms = usePermStore((s) => s.perms);
  const canCreate = perms.meeting_room?.create ?? false;

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [viewMode, setViewMode] = useState<'week' | 'list'>('week');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [roomFilter, setRoomFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [modalDefaults, setModalDefaults] = useState<{ roomId?: string; date?: string }>({});

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [roomsRes, bookingsRes] = await Promise.all([
        api.get('/meeting-rooms/rooms', { params: { isActive: true } }),
        api.get('/meeting-rooms/bookings', {
          params: {
            from: weekStart.toISOString(),
            to: addDays(weekStart, 7).toISOString(),
            roomId: roomFilter || undefined,
          },
        }),
      ]);
      setRooms(roomsRes.data.data ?? []);
      setBookings(bookingsRes.data.data ?? []);
    } catch (err) { toast.error(extractErr(err)); } finally { setLoading(false); }
  }, [weekStart, roomFilter]);

  useEffect(() => { load(); }, [load]);

  function openCreate(roomId?: string, date?: Date) {
    setEditBooking(null);
    setModalDefaults({ roomId, date: date ? isoDate(date) : undefined });
    setModalOpen(true);
  }
  function openEdit(b: Booking) {
    setEditBooking(b);
    setModalDefaults({});
    setModalOpen(true);
  }
  function handleSaved(b: Booking) {
    setModalOpen(false);
    toast.success(editBooking ? t('meetingRoom.modal.editSuccess') : t('meetingRoom.modal.createSuccess'));
    load();
    void b;
  }

  async function handleCancel(b: Booking) {
    if (!confirm(t('meetingRoom.cancelConfirm'))) return;
    try {
      await api.patch(`/meeting-rooms/bookings/${b.id}/cancel`);
      toast.success(t('meetingRoom.cancelSuccess'));
      load();
    } catch (err) { toast.error(extractErr(err) || t('meetingRoom.cancelError')); }
  }

  const bookingsByDay = weekDays.map((day) =>
    bookings.filter((b) => sameDay(new Date(b.startTime), day)),
  );

  return (
    <div className="flex h-full overflow-hidden -m-6 bg-gray-50">
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-5 flex-wrap">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-navy/10 flex items-center justify-center flex-shrink-0">
              <CalendarClock size={19} className="text-navy" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 leading-tight tracking-tight">{t('meetingRoom.title')}</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {t('meetingRoom.bookingCount', { count: bookings.filter((b) => b.status === 'CONFIRMED').length })}
                {' · '}
                {t('meetingRoom.roomsAvailable', { count: rooms.length })}
              </p>
            </div>
          </div>
          {canCreate && (
            <button
              onClick={() => openCreate()}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg bg-navy text-white hover:bg-navy-light hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 transition-all duration-200 shadow-sm shadow-navy/20"
            >
              <Plus size={15} /> {t('meetingRoom.newBooking')}
            </button>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 px-6 pb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
              {(['week', 'list'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
                    viewMode === v ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700')}
                >
                  {v === 'week' ? <LayoutGrid size={13} /> : <ListIcon size={13} />}
                  {t(`meetingRoom.views.${v}`)}
                </button>
              ))}
            </div>
            {viewMode === 'week' && (
              <div className="flex items-center gap-1 ml-1">
                <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="w-7 h-7 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 flex items-center justify-center">
                  <ChevronLeft size={13} />
                </button>
                <span className="text-[13px] font-semibold text-gray-800 px-1 whitespace-nowrap">
                  {weekDays[0].toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  {' – '}
                  {weekDays[6].toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="w-7 h-7 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 flex items-center justify-center">
                  <ChevronRight size={13} />
                </button>
              </div>
            )}
            <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 text-xs font-semibold hover:bg-gray-50">
              {t('meetingRoom.today')}
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setRoomFilter('')}
              className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11.5px] font-semibold transition-colors',
                roomFilter === '' ? 'border-navy bg-navy/5 text-navy' : 'border-gray-200 text-gray-500 hover:bg-gray-50')}
            >
              {t('meetingRoom.allRooms')}
            </button>
            {rooms.map((r) => {
              const c = roomColor(r.id);
              const active = roomFilter === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setRoomFilter(active ? '' : r.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11.5px] font-semibold transition-colors"
                  style={active ? { borderColor: c.dot, background: c.bg, color: c.text } : { borderColor: '#E5E7EB', color: '#6B7280' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.dot }} />
                  {r.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 px-6 pb-6 flex flex-col">
          <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            {loading ? (
              <div className="flex items-center justify-center h-full min-h-[240px]"><Loader2 className="animate-spin text-gray-300" size={26} /></div>
            ) : viewMode === 'week' ? (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-gray-100 flex-shrink-0">
                  <div />
                  {weekDays.map((d, i) => {
                    const isToday = sameDay(d, new Date());
                    return (
                      <div key={i} className="py-2.5 text-center border-l border-gray-50">
                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{DAY_LABELS_ID[i]}</div>
                        <div className={cn('text-[14px] font-semibold mt-0.5 w-6 h-6 leading-6 rounded-full mx-auto',
                          isToday ? 'bg-navy text-white' : 'text-gray-700')}>
                          {d.getDate()}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex-1 overflow-y-auto">
                  <div className="grid grid-cols-[56px_repeat(7,1fr)] relative">
                    <div className="flex flex-col">
                      {HOURS.map((h) => (
                        <div key={h} className="text-right pr-2.5 pt-0.5 text-[10px] text-gray-400 border-t border-gray-50 flex-shrink-0" style={{ height: ROW_H }}>
                          {String(h).padStart(2, '0')}:00
                        </div>
                      ))}
                    </div>
                    {weekDays.map((day, di) => (
                      <div
                        key={di}
                        className="relative border-l border-gray-50 cursor-pointer group"
                        onClick={() => canCreate && openCreate(roomFilter || undefined, day)}
                      >
                        {HOURS.map((h) => (
                          <div key={h} className="border-t border-gray-50 group-hover:bg-gray-50/40" style={{ height: ROW_H }} />
                        ))}
                        {bookingsByDay[di].map((b) => {
                          const c = roomColor(b.room.id);
                          const start = new Date(b.startTime);
                          const end = new Date(b.endTime);
                          const startMin = Math.max(0, (start.getHours() - 8) * 60 + start.getMinutes());
                          const endMin = Math.min(HOURS.length * 60, (end.getHours() - 8) * 60 + end.getMinutes());
                          const top = (startMin / 60) * ROW_H;
                          const height = Math.max(24, ((endMin - startMin) / 60) * ROW_H);
                          const cancelled = b.status === 'CANCELLED';
                          return (
                            <div
                              key={b.id}
                              onClick={(e) => { e.stopPropagation(); openEdit(b); }}
                              className="absolute left-1 right-1 rounded-lg px-2 py-1 overflow-hidden shadow-sm border-[1.5px] hover:z-10 hover:shadow-md transition-shadow"
                              style={{ top, height, background: cancelled ? '#F3F4F6' : c.bg, borderColor: cancelled ? '#E5E7EB' : c.dot, opacity: cancelled ? 0.6 : 1 }}
                            >
                              <div className="text-[11px] font-bold leading-tight truncate" style={{ color: cancelled ? '#9CA3AF' : c.text }}>{b.title}</div>
                              <div className="text-[10px] opacity-75 mt-0.5" style={{ color: cancelled ? '#9CA3AF' : c.text }}>{fmtTime(b.startTime)}-{fmtTime(b.endTime)}</div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <ListView bookings={bookings} onEdit={openEdit} onCancel={handleCancel} />
            )}
          </div>
        </div>
      </div>

      {modalOpen && (
        <BookingModal
          rooms={rooms}
          booking={editBooking}
          defaultRoomId={modalDefaults.roomId}
          defaultDate={modalDefaults.date}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function ListView({ bookings, onEdit, onCancel }: { bookings: Booking[]; onEdit: (b: Booking) => void; onCancel: (b: Booking) => void }) {
  const { t } = useTranslation();
  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[280px] gap-3 text-center px-6">
        <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/60 flex items-center justify-center">
          <CalendarClock size={24} className="text-gray-300" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600">{t('meetingRoom.empty')}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t('meetingRoom.emptyHint')}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 bg-white/95 backdrop-blur-sm z-10">
          <tr className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
            <th className="px-5 py-3">{t('meetingRoom.table.title')}</th>
            <th className="px-3 py-3">{t('meetingRoom.table.room')}</th>
            <th className="px-3 py-3">{t('meetingRoom.table.date')}</th>
            <th className="px-3 py-3">{t('meetingRoom.table.time')}</th>
            <th className="px-3 py-3">{t('meetingRoom.table.bookedBy')}</th>
            <th className="px-3 py-3">{t('meetingRoom.table.status')}</th>
            <th className="px-3 py-3" />
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => {
            const c = roomColor(b.room.id);
            const cancelled = b.status === 'CANCELLED';
            return (
              <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/80 cursor-pointer" onClick={() => onEdit(b)}>
                <td className="px-5 py-3 font-medium text-gray-800">{b.title}</td>
                <td className="px-3 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: c.text }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} /> {b.room.name}
                  </span>
                </td>
                <td className="px-3 py-3 text-gray-600 text-xs">{fmtDay(b.startTime)}</td>
                <td className="px-3 py-3 text-gray-600 text-xs">{fmtTime(b.startTime)}-{fmtTime(b.endTime)}</td>
                <td className="px-3 py-3 text-gray-600 text-xs">{b.bookedBy.fullName}</td>
                <td className="px-3 py-3">
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                    cancelled ? 'bg-gray-100 text-gray-400' : 'bg-emerald-50 text-emerald-700')}>
                    {t(`meetingRoom.status.${b.status}`)}
                  </span>
                </td>
                <td className="px-3 py-3 text-right">
                  {!cancelled && (
                    <button onClick={(e) => { e.stopPropagation(); onCancel(b); }} className="text-gray-300 hover:text-danger" title={t('meetingRoom.cancelConfirm')}>
                      <X size={14} />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
