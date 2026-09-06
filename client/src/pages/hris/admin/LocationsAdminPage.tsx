import { useEffect, useState, useCallback } from 'react';
import {
  MapPin, Plus, Pencil, Trash2, Loader2, X, CheckCircle2,
  Navigation, Building2, AlertCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toastStore';

// ── Types ──────────────────────────────────────────────────────
interface OfficeLocation {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  radiusMeters: number;
  isActive: boolean;
}

// ── Location Form Modal ────────────────────────────────────────
interface LocationFormProps {
  initial?: OfficeLocation | null;
  onClose: () => void;
  onSaved: () => void;
}

function LocationFormModal({ initial, onClose, onSaved }: LocationFormProps) {
  const { t } = useTranslation();
  const isEdit = !!initial;
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    address: initial?.address ?? '',
    lat: initial?.lat?.toString() ?? '',
    lng: initial?.lng?.toString() ?? '',
    radiusMeters: initial?.radiusMeters ?? 150,
    isActive: initial?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  function set(k: string, v: unknown) { setForm((f) => ({ ...f, [k]: v })); }

  function useMyLocation() {
    if (!navigator.geolocation) { toast.error(t('hris.admin.locations.toast.gpsUnsupported')); return; }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set('lat', pos.coords.latitude.toFixed(6));
        set('lng', pos.coords.longitude.toFixed(6));
        setGettingLocation(false);
        toast.success(t('hris.admin.locations.toast.locationObtained'));
      },
      () => { toast.error(t('hris.admin.locations.toast.getLocationFailed')); setGettingLocation(false); },
      { timeout: 10000, enableHighAccuracy: true },
    );
  }

  async function handleSave() {
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (!form.name.trim() || isNaN(lat) || isNaN(lng)) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        lat, lng,
        radiusMeters: form.radiusMeters,
        isActive: form.isActive,
      };
      if (isEdit) {
        await api.put(`/hris/office-locations/${initial!.id}`, payload);
        toast.success(t('hris.admin.locations.toast.updated'));
      } else {
        await api.post('/hris/office-locations', payload);
        toast.success(t('hris.admin.locations.toast.added'));
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t('hris.admin.locations.toast.saveFailed'));
    } finally { setSaving(false); }
  }

  const latVal = parseFloat(form.lat);
  const lngVal = parseFloat(form.lng);
  const hasCoords = !isNaN(latVal) && !isNaN(lngVal);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-blue-500" />
            <h3 className="font-semibold text-gray-900">{isEdit ? t('hris.admin.locations.modal.editTitle') : t('hris.admin.locations.modal.addTitle')}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('hris.admin.locations.modal.name')} <span className="text-red-500">*</span></label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={t('hris.admin.locations.modal.namePlaceholder')}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('hris.admin.locations.modal.address')}</label>
            <textarea value={form.address} onChange={(e) => set('address', e.target.value)} rows={2} placeholder={t('hris.admin.locations.modal.addressPlaceholder')}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 resize-none" />
          </div>

          {/* Coordinates */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-500">{t('hris.admin.locations.modal.gpsCoordinates')} <span className="text-red-500">*</span></label>
              <button onClick={useMyLocation} disabled={gettingLocation}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-40 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors">
                {gettingLocation ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
                {t('hris.admin.locations.modal.useMyLocation')}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">{t('hris.admin.locations.modal.latitude')}</label>
                <input value={form.lat} onChange={(e) => set('lat', e.target.value)} placeholder="-6.2297"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 font-mono" />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">{t('hris.admin.locations.modal.longitude')}</label>
                <input value={form.lng} onChange={(e) => set('lng', e.target.value)} placeholder="106.8295"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 font-mono" />
              </div>
            </div>
            {hasCoords && (
              <a href={`https://www.google.com/maps?q=${latVal},${lngVal}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline mt-1.5">
                <MapPin size={10} /> {t('hris.admin.locations.modal.viewOnGoogleMaps')}
              </a>
            )}
          </div>

          {/* Radius slider */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              {t('hris.admin.locations.modal.geofencingRadius', { radius: form.radiusMeters })}
            </label>
            <input type="range" min={50} max={500} step={25} value={form.radiusMeters}
              onChange={(e) => set('radiusMeters', parseInt(e.target.value))}
              className="w-full accent-blue-500" />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>50m</span><span>150m</span><span>300m</span><span>500m</span>
            </div>
            <div className={cn('text-xs mt-2 px-3 py-2 rounded-lg', form.radiusMeters <= 100 ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600')}>
              {form.radiusMeters <= 100
                ? t('hris.admin.locations.modal.radiusTight')
                : form.radiusMeters <= 200
                ? t('hris.admin.locations.modal.radiusStandard')
                : t('hris.admin.locations.modal.radiusWide')}
            </div>
          </div>

          {/* Toggle active */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div onClick={() => set('isActive', !form.isActive)}
              className={cn('relative w-9 h-5 rounded-full transition-colors flex-shrink-0', form.isActive ? 'bg-green-500' : 'bg-gray-200')}>
              <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', form.isActive ? 'left-4' : 'left-0.5')} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">{t('hris.admin.locations.modal.activeLocation')}</p>
              <p className="text-xs text-gray-400">{t('hris.admin.locations.modal.activeLocationHint')}</p>
            </div>
          </label>
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            {t('hris.admin.locations.modal.cancel')}
          </button>
          <button onClick={handleSave} disabled={saving || !form.name.trim() || !hasCoords}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-40 rounded-lg transition-colors flex items-center justify-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {isEdit ? t('hris.admin.locations.modal.saveChanges') : t('hris.admin.locations.modal.addLocation')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Location Card ──────────────────────────────────────────────
function LocationCard({
  loc,
  onEdit,
  onDelete,
}: {
  loc: OfficeLocation;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const mapsUrl = `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;

  return (
    <div className={cn('bg-white border rounded-xl overflow-hidden transition-all', loc.isActive ? 'border-gray-200' : 'border-dashed border-gray-200 opacity-60')}>
      {/* Map preview strip */}
      <div className="h-32 bg-gradient-to-br from-blue-50 to-blue-100 relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 opacity-30"
          style={{ backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        {/* Radius circle visualization */}
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-2 border-blue-300/60 bg-blue-200/30 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-blue-400 bg-blue-50 flex items-center justify-center">
              <MapPin size={14} className="text-blue-600" />
            </div>
          </div>
          <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            r={loc.radiusMeters}m
          </div>
        </div>
        {/* Action buttons */}
        <div className="absolute top-2 right-2 flex gap-1">
          <button onClick={onEdit} className="w-7 h-7 bg-white/90 hover:bg-white rounded-lg flex items-center justify-center shadow-sm text-gray-600 hover:text-navy transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={onDelete} className="w-7 h-7 bg-white/90 hover:bg-white rounded-lg flex items-center justify-center shadow-sm text-gray-600 hover:text-red-500 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
        {!loc.isActive && (
          <div className="absolute top-2 left-2 bg-gray-500/80 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
            {t('hris.admin.locations.card.inactive')}
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <p className="font-semibold text-gray-800 leading-tight">{loc.name}</p>
        </div>
        {loc.address && (
          <p className="text-xs text-gray-500 mb-2 leading-relaxed line-clamp-2">{loc.address}</p>
        )}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">{t('hris.admin.locations.card.radius')}</span>
            <span className={cn('font-medium', loc.radiusMeters <= 100 ? 'text-orange-600' : 'text-blue-600')}>
              {loc.radiusMeters} m
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">{t('hris.admin.locations.card.coordinates')}</span>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
              className="font-mono text-blue-500 hover:underline flex items-center gap-0.5">
              {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function LocationsAdminPage() {
  const { t } = useTranslation();
  const [locations, setLocations] = useState<OfficeLocation[]>([]);
  const [loading, setLoading]     = useState(false);
  const [formOpen, setFormOpen]   = useState(false);
  const [editTarget, setEditTarget] = useState<OfficeLocation | null>(null);

  const loadLocations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/hris/office-locations');
      setLocations(res.data.data ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadLocations(); }, [loadLocations]);

  async function handleDelete(loc: OfficeLocation) {
    if (!confirm(t('hris.admin.locations.deleteConfirm', { name: loc.name }))) return;
    try {
      await api.delete(`/hris/office-locations/${loc.id}`);
      toast.success(t('hris.admin.locations.toast.deleted'));
      loadLocations();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t('hris.admin.locations.toast.deleteFailed'));
    }
  }

  const activeCount = locations.filter((l) => l.isActive).length;

  return (
    <>
      {(formOpen || editTarget) && (
        <LocationFormModal
          initial={editTarget}
          onClose={() => { setFormOpen(false); setEditTarget(null); }}
          onSaved={loadLocations}
        />
      )}

      <div className="space-y-5 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <MapPin size={20} className="text-blue-500" /> {t('hris.admin.locations.header.title')}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">{t('hris.admin.locations.header.subtitle')}</p>
          </div>
          <button onClick={() => setFormOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
            <Plus size={15} /> {t('hris.admin.locations.addLocation')}
          </button>
        </div>

        {/* Info banner */}
        {activeCount > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <AlertCircle size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">{t('hris.admin.locations.banner.activeCount', { count: activeCount })}</p>
              <p className="text-xs text-blue-600 mt-0.5">
                {t('hris.admin.locations.banner.detail')}
              </p>
            </div>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gray-300" />
          </div>
        ) : locations.length === 0 ? (
          <div className="text-center py-20 bg-white border-2 border-dashed border-gray-200 rounded-xl">
            <Building2 size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">{t('hris.admin.locations.empty.title')}</p>
            <p className="text-gray-400 text-sm mt-1 mb-4">{t('hris.admin.locations.empty.subtitle')}</p>
            <button onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
              <Plus size={14} /> {t('hris.admin.locations.addFirstLocation')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {locations.map((loc) => (
              <LocationCard
                key={loc.id}
                loc={loc}
                onEdit={() => setEditTarget(loc)}
                onDelete={() => handleDelete(loc)}
              />
            ))}
          </div>
        )}

        {locations.length > 0 && (
          <p className="text-xs text-gray-400">
            {t('hris.admin.locations.footerNote')}
          </p>
        )}
      </div>
    </>
  );
}
