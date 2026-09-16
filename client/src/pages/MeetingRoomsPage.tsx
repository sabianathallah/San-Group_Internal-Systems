import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Plus, Users2, Loader2, Settings2, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toastStore';
import { usePermStore } from '@/stores/permStore';
import RoomFormModal from '@/components/meeting-room/RoomFormModal';
import BookingModal from '@/components/meeting-room/BookingModal';
import { extractErr, roomColor, fmtTime, type Room, type Booking } from '@/types/meetingRoom';

export default function MeetingRoomsPage() {
  const { t } = useTranslation();
  const perms = usePermStore((s) => s.perms);
  const canManageRooms = perms.meeting_room?.manageRooms ?? false;
  const canCreate = perms.meeting_room?.create ?? false;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [roomFormOpen, setRoomFormOpen] = useState(false);
  const [editRoom, setEditRoom] = useState<Room | null>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/meeting-rooms/rooms');
      const list: Room[] = res.data.data ?? [];
      setRooms(list);
      if (!selectedId && list.length > 0) setSelectedId(list[0].id);
    } catch (err) { toast.error(extractErr(err)); } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadSchedule = useCallback(async (roomId: string) => {
    setScheduleLoading(true);
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const res = await api.get('/meeting-rooms/bookings', {
        params: { roomId, from: todayStart.toISOString(), to: todayEnd.toISOString() },
      });
      setTodayBookings((res.data.data ?? []).sort((a: Booking, b: Booking) => a.startTime.localeCompare(b.startTime)));
    } catch (err) { toast.error(extractErr(err)); } finally { setScheduleLoading(false); }
  }, []);

  useEffect(() => { if (selectedId) loadSchedule(selectedId); }, [selectedId, loadSchedule]);

  const selectedRoom = rooms.find((r) => r.id === selectedId) ?? null;
  const now = new Date();
  const isRoomBusyNow = selectedRoom
    ? todayBookings.some((b) => b.status === 'CONFIRMED' && new Date(b.startTime) <= now && new Date(b.endTime) > now)
    : false;

  function handleRoomSaved(r: Room) {
    setRoomFormOpen(false);
    toast.success(editRoom ? t('meetingRoom.rooms.editRoom') : t('meetingRoom.rooms.newRoom'));
    setEditRoom(null);
    load();
    setSelectedId(r.id);
  }

  async function handleDeactivate(r: Room) {
    if (!confirm(t('meetingRoom.rooms.deleteConfirm'))) return;
    try {
      await api.delete(`/meeting-rooms/rooms/${r.id}`);
      toast.success(t('meetingRoom.rooms.deleteSuccess'));
      load();
    } catch (err) { toast.error(extractErr(err)); }
  }

  return (
    <div className="flex h-full overflow-hidden -m-6 bg-gray-50">
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-5 flex-wrap">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-navy/10 flex items-center justify-center flex-shrink-0">
              <Building2 size={19} className="text-navy" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 leading-tight tracking-tight">{t('meetingRoom.rooms.title')}</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {t('meetingRoom.rooms.subtitle', { count: rooms.length, schedules: todayBookings.filter((b) => b.status === 'CONFIRMED').length })}
              </p>
            </div>
          </div>
          {canManageRooms && (
            <button
              onClick={() => { setEditRoom(null); setRoomFormOpen(true); }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg bg-navy text-white hover:bg-navy-light hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 transition-all duration-200 shadow-sm shadow-navy/20"
            >
              <Plus size={15} /> {t('meetingRoom.rooms.newRoom')}
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 flex gap-4 px-6 pb-6">
          {/* Room list */}
          <div className="w-[320px] flex-shrink-0 flex flex-col gap-2.5 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-gray-300" size={22} /></div>
            ) : rooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-60 gap-2 text-center px-4">
                <Building2 size={22} className="text-gray-300" />
                <p className="text-xs text-gray-400">{t('meetingRoom.rooms.empty')}</p>
              </div>
            ) : rooms.map((r) => {
              const c = roomColor(r.id);
              const isSelected = r.id === selectedId;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={cn(
                    'relative overflow-hidden bg-white rounded-xl border-[1.5px] shadow-sm px-4 py-3.5 cursor-pointer transition-colors',
                    isSelected ? '' : 'border-gray-100 hover:border-gray-200',
                    !r.isActive && 'opacity-50',
                  )}
                  style={isSelected ? { borderColor: c.dot } : undefined}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: c.dot }} />
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center flex-shrink-0" style={{ background: c.bg }}>
                        <Building2 size={16} style={{ color: c.dot }} />
                      </div>
                      <div>
                        <div className="text-[13.5px] font-semibold text-gray-800">{r.name}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">{[r.floor && `Lantai ${r.floor}`, r.building].filter(Boolean).join(' · ') || '—'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3.5 mt-2.5 pl-[44px]">
                    {r.capacity != null && (
                      <div className="flex items-center gap-1 text-[11px] text-gray-500">
                        <Users2 size={12} className="text-gray-400" /> {r.capacity} {t('meetingRoom.rooms.capacity')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detail panel */}
          <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
            {!selectedRoom ? (
              <div className="flex-1 flex items-center justify-center text-sm text-gray-400">{t('meetingRoom.rooms.empty')}</div>
            ) : (
              <>
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: roomColor(selectedRoom.id).bg }}>
                      <Building2 size={20} style={{ color: roomColor(selectedRoom.id).dot }} />
                    </div>
                    <div>
                      <div className="text-[16px] font-semibold text-gray-900">{selectedRoom.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {[selectedRoom.floor && `Lantai ${selectedRoom.floor}`, selectedRoom.building, selectedRoom.capacity != null ? `Kapasitas ${selectedRoom.capacity} orang` : null].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-[11px] font-bold px-3 py-1 rounded-full',
                      isRoomBusyNow ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700')}>
                      {isRoomBusyNow ? 'Sedang Dipakai' : 'Tersedia'}
                    </span>
                    {canCreate && (
                      <button onClick={() => setBookingModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-navy text-white hover:bg-navy-light">
                        <Plus size={13} /> {t('meetingRoom.newBooking')}
                      </button>
                    )}
                    {canManageRooms && (
                      <>
                        <button onClick={() => { setEditRoom(selectedRoom); setRoomFormOpen(true); }} className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center">
                          <Settings2 size={14} />
                        </button>
                        <button onClick={() => handleDeactivate(selectedRoom)} className="w-8 h-8 rounded-lg border border-gray-200 text-gray-400 hover:text-danger hover:bg-red-50 flex items-center justify-center">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {selectedRoom.facilities.length > 0 && (
                  <div className="flex items-center gap-2 px-6 py-3.5 border-b border-gray-50 flex-wrap">
                    {selectedRoom.facilities.map((f) => (
                      <span key={f} className="px-2.5 py-1 rounded-md bg-gray-50 border border-gray-100 text-[11px] font-medium text-gray-600">{f}</span>
                    ))}
                  </div>
                )}

                <div className="px-6 pt-4 pb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{t('meetingRoom.rooms.todaySchedule')}</div>

                <div className="flex-1 overflow-y-auto px-6 pb-5">
                  {scheduleLoading ? (
                    <div className="flex items-center justify-center h-32"><Loader2 className="animate-spin text-gray-300" size={20} /></div>
                  ) : todayBookings.length === 0 ? (
                    <p className="text-xs text-gray-400 py-4">{t('meetingRoom.rooms.emptySlot')}</p>
                  ) : (
                    todayBookings.map((b) => {
                      const cancelled = b.status === 'CANCELLED';
                      return (
                        <div key={b.id} className="flex gap-3.5 py-3 border-b border-gray-50 last:border-0">
                          <div className="w-16 flex-shrink-0 text-right">
                            <div className="text-xs font-semibold text-gray-800">{fmtTime(b.startTime)}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">{fmtTime(b.endTime)}</div>
                          </div>
                          <div className="w-0.5 rounded flex-shrink-0" style={{ background: cancelled ? '#E5E7EB' : roomColor(b.room.id).dot }} />
                          <div className="flex-1 min-w-0 py-0.5">
                            <div className={cn('text-[13px] font-semibold', cancelled ? 'text-gray-400 line-through' : 'text-gray-800')}>{b.title}</div>
                            <div className="text-[11.5px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                              <Users2 size={11} className="text-gray-400" /> {b.bookedBy.fullName}
                            </div>
                          </div>
                          {cancelled && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 h-fit">{t('meetingRoom.status.CANCELLED')}</span>}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {roomFormOpen && (
        <RoomFormModal room={editRoom} onClose={() => setRoomFormOpen(false)} onSaved={handleRoomSaved} />
      )}
      {bookingModalOpen && selectedRoom && (
        <BookingModal
          rooms={rooms}
          defaultRoomId={selectedRoom.id}
          onClose={() => setBookingModalOpen(false)}
          onSaved={() => { setBookingModalOpen(false); toast.success(t('meetingRoom.modal.createSuccess')); loadSchedule(selectedRoom.id); }}
        />
      )}
    </div>
  );
}

