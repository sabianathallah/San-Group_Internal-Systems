import { useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { extractErr, type Room } from '@/types/meetingRoom';

const inputCls = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-navy focus:ring-2 focus:ring-navy/10 transition-shadow';

export default function RoomFormModal({ room, onClose, onSaved }: { room?: Room | null; onClose: () => void; onSaved: (r: Room) => void }) {
  const { t } = useTranslation();
  useEscapeClose(onClose);
  const isEdit = !!room;

  const [name, setName] = useState(room?.name ?? '');
  const [building, setBuilding] = useState(room?.building ?? '');
  const [floor, setFloor] = useState(room?.floor ?? '');
  const [capacity, setCapacity] = useState(room?.capacity ? String(room.capacity) : '');
  const [facilities, setFacilities] = useState<string[]>(room?.facilities ?? []);
  const [facilityInput, setFacilityInput] = useState('');
  const [isActive, setIsActive] = useState(room?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function addFacility() {
    const v = facilityInput.trim();
    if (v && !facilities.includes(v)) setFacilities([...facilities, v]);
    setFacilityInput('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError(t('meetingRoom.modal.validationError')); return; }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        building: building.trim() || null,
        floor: floor.trim() || null,
        capacity: capacity ? Number(capacity) : null,
        facilities,
        isActive,
      };
      const res = isEdit
        ? await api.patch(`/meeting-rooms/rooms/${room!.id}`, payload)
        : await api.post('/meeting-rooms/rooms', payload);
      onSaved(res.data.data);
    } catch (err) { setError(extractErr(err)); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-[15px] font-semibold text-gray-900">{isEdit ? t('meetingRoom.rooms.editRoom') : t('meetingRoom.rooms.newRoom')}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-gray-50 text-gray-400 hover:text-gray-600 flex items-center justify-center"><X size={14} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('meetingRoom.rooms.form.name')} <span className="text-danger">*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('meetingRoom.rooms.form.namePlaceholder')} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('meetingRoom.rooms.form.building')}</label>
              <input value={building} onChange={(e) => setBuilding(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('meetingRoom.rooms.form.floor')}</label>
              <input value={floor} onChange={(e) => setFloor(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('meetingRoom.rooms.form.capacity')}</label>
            <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('meetingRoom.rooms.form.facilities')}</label>
            <div className="w-full min-h-[42px] px-2 py-1.5 border border-gray-200 rounded-lg flex items-center gap-1.5 flex-wrap focus-within:border-navy">
              {facilities.map((f) => (
                <span key={f} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-700">
                  {f}
                  <button type="button" onClick={() => setFacilities(facilities.filter((x) => x !== f))} className="text-gray-400 hover:text-gray-600"><X size={10} /></button>
                </span>
              ))}
              <input
                value={facilityInput}
                onChange={(e) => setFacilityInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFacility(); } }}
                onBlur={addFacility}
                placeholder={facilities.length === 0 ? t('meetingRoom.rooms.form.facilitiesPlaceholder') : ''}
                className="flex-1 min-w-[100px] text-sm outline-none px-1 py-0.5"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-gray-300 text-navy focus:ring-navy" />
            {t('meetingRoom.rooms.form.isActive')}
          </label>

          {error && <p className="flex items-center gap-1.5 text-xs text-danger"><AlertCircle size={13} /> {error}</p>}
        </form>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50">
            {t('meetingRoom.rooms.form.cancel')}
          </button>
          <button type="submit" onClick={handleSubmit} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-navy text-white hover:bg-navy-light disabled:opacity-50 transition-colors">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {t('meetingRoom.rooms.form.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
