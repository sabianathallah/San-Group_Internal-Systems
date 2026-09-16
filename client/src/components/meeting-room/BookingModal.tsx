import { useEffect, useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import SearchableSelect from '@/components/shared/SearchableSelect';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { extractErr, type Booking, type Room } from '@/types/meetingRoom';

const inputCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-navy focus:ring-2 focus:ring-navy/10 transition-shadow';

function toDateInput(iso: string) { return iso.slice(0, 10); }
function toTimeInput(iso: string) { return new Date(iso).toTimeString().slice(0, 5); }

export default function BookingModal({
  rooms, booking, defaultRoomId, defaultDate, onClose, onSaved,
}: {
  rooms: Room[];
  booking?: Booking | null;
  defaultRoomId?: string;
  defaultDate?: string;
  onClose: () => void;
  onSaved: (b: Booking) => void;
}) {
  const { t } = useTranslation();
  useEscapeClose(onClose);
  const isEdit = !!booking;

  const [roomId, setRoomId] = useState(booking?.room.id ?? defaultRoomId ?? '');
  const [date, setDate] = useState(booking ? toDateInput(booking.startTime) : defaultDate ?? new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(booking ? toTimeInput(booking.startTime) : '09:00');
  const [endTime, setEndTime] = useState(booking ? toTimeInput(booking.endTime) : '10:00');
  const [title, setTitle] = useState(booking?.title ?? '');
  const [notes, setNotes] = useState(booking?.notes ?? '');
  const [attendees, setAttendees] = useState<string[]>(booking?.attendees ?? []);
  const [attendeeInput, setAttendeeInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<Booking | null>(null);

  const roomOptions = rooms.filter((r) => r.isActive || r.id === roomId).map((r) => ({ id: r.id, label: r.name }));

  // Live conflict check — as soon as room + date + both times are filled,
  // fetch that room's confirmed bookings for the day and check for overlap
  // client-side, so the warning shows before the user even submits (matches
  // the approved mockup's hard block rather than only surfacing the 409
  // after a failed save).
  useEffect(() => {
    if (!roomId || !date || !startTime || !endTime) { setConflict(null); return; }
    const start = new Date(`${date}T${startTime}:00`);
    const end = new Date(`${date}T${endTime}:00`);
    if (end <= start) { setConflict(null); return; }

    const dayStart = new Date(`${date}T00:00:00`).toISOString();
    const dayEnd = new Date(`${date}T23:59:59`).toISOString();
    let cancelled = false;
    const timer = setTimeout(() => {
      api.get('/meeting-rooms/bookings', { params: { roomId, from: dayStart, to: dayEnd } })
        .then((res) => {
          if (cancelled) return;
          const overlap = (res.data.data as Booking[]).find((b) =>
            b.id !== booking?.id &&
            new Date(b.startTime) < end && new Date(b.endTime) > start,
          );
          setConflict(overlap ?? null);
        })
        .catch(() => {});
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [roomId, date, startTime, endTime, booking?.id]);

  function addAttendee() {
    const v = attendeeInput.trim();
    if (v && !attendees.includes(v)) setAttendees([...attendees, v]);
    setAttendeeInput('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!roomId || !date || !startTime || !endTime || !title.trim()) {
      setError(t('meetingRoom.modal.validationError')); return;
    }
    const start = new Date(`${date}T${startTime}:00`);
    const end = new Date(`${date}T${endTime}:00`);
    if (end <= start) { setError(t('meetingRoom.modal.timeOrderError')); return; }

    setSaving(true);
    try {
      const payload = {
        roomId, title: title.trim(), notes: notes.trim() || null, attendees,
        startTime: start.toISOString(), endTime: end.toISOString(),
      };
      const res = isEdit
        ? await api.patch(`/meeting-rooms/bookings/${booking!.id}`, payload)
        : await api.post('/meeting-rooms/bookings', payload);
      onSaved(res.data.data);
    } catch (err) {
      setError(extractErr(err));
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-navy/10 flex items-center justify-center">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0F2942" strokeWidth="1.9"><path d="M12 5v14M5 12h14" /></svg>
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-gray-900">{isEdit ? t('meetingRoom.modal.editTitle') : t('meetingRoom.modal.createTitle')}</h2>
              <p className="text-[11.5px] text-gray-400 mt-0.5">{t('meetingRoom.modal.subtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-gray-50 text-gray-400 hover:text-gray-600 flex items-center justify-center">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('meetingRoom.modal.room')} <span className="text-danger">*</span></label>
            <SearchableSelect options={roomOptions} value={roomId} onChange={setRoomId} placeholder={t('meetingRoom.modal.roomPlaceholder')} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('meetingRoom.modal.date')} <span className="text-danger">*</span></label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('meetingRoom.modal.startTime')} <span className="text-danger">*</span></label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('meetingRoom.modal.endTime')} <span className="text-danger">*</span></label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
            </div>
          </div>

          {conflict && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle size={15} className="text-danger flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-700">{t('meetingRoom.modal.conflictTitle')}</p>
                <p className="text-[11.5px] text-red-600 mt-0.5 opacity-90">
                  {conflict.title} — {toTimeInput(conflict.startTime)}-{toTimeInput(conflict.endTime)}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('meetingRoom.modal.titleLabel')} <span className="text-danger">*</span></label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('meetingRoom.modal.titlePlaceholder')} className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('meetingRoom.modal.attendees')}</label>
            <div className="w-full min-h-[42px] px-2 py-1.5 border border-gray-200 rounded-lg flex items-center gap-1.5 flex-wrap focus-within:border-navy">
              {attendees.map((a) => (
                <span key={a} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-700">
                  {a}
                  <button type="button" onClick={() => setAttendees(attendees.filter((x) => x !== a))} className="text-gray-400 hover:text-gray-600">
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                value={attendeeInput}
                onChange={(e) => setAttendeeInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAttendee(); } }}
                onBlur={addAttendee}
                placeholder={attendees.length === 0 ? t('meetingRoom.modal.attendeesPlaceholder') : ''}
                className="flex-1 min-w-[100px] text-sm outline-none px-1 py-0.5"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('meetingRoom.modal.notes')}</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('meetingRoom.modal.notesPlaceholder')} rows={2} className={`${inputCls} resize-none`} />
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-danger"><AlertCircle size={13} /> {error}</p>
          )}
        </form>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50">
            {t('meetingRoom.modal.cancel')}
          </button>
          <button
            type="submit" onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-navy text-white hover:bg-navy-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? t('meetingRoom.modal.saving') : t('meetingRoom.modal.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
