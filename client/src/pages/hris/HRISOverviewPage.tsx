import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock, CalendarCheck, ChevronRight,
  CheckCircle2, Timer, Home, AlertCircle, Loader2,
  MapPin, MapPinOff, AlertTriangle, X, Camera, CameraOff,
  TrendingUp, CalendarDays, CalendarX2,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { ROUTES } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

// ── Types ──────────────────────────────────────────────────────
type AttendanceStatus = 'PRESENT' | 'LATE' | 'WFH' | 'PERMISSION' | 'ABSENT' | 'HOLIDAY';
type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

interface TodayRecord {
  id: string;
  status: AttendanceStatus;
  checkIn: string | null;
  checkOut: string | null;
  isLate: boolean;
  lateMinutes: number;
  workMinutes: number | null;
  lat: number | null;
  lng: number | null;
  locationName: string | null;
  isOutOfArea: boolean;
  photoUrl: string | null;
  shift: { name: string; startTime: string; color: string } | null;
  officeLocation: { name: string } | null;
}

interface AttSummary {
  present: number; late: number; wfh: number;
  permission: number; absent: number; totalWorkMinutes: number;
}

interface LeaveBalance {
  leaveType: { id: string; name: string; color: string; maxDaysPerYear: number };
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number | null;
}

interface LeaveRequest {
  id: string;
  status: LeaveStatus;
  startDate: string;
  endDate: string;
  totalDays: number;
  leaveType: { name: string; color: string };
}

// ── Helpers ────────────────────────────────────────────────────
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
      headers: { 'Accept-Language': 'id' },
    });
    const data = await res.json();
    const addr = data.address;
    const parts = [addr.road, addr.suburb || addr.neighbourhood, addr.city || addr.town].filter(Boolean);
    return parts.join(', ') || data.display_name?.split(',').slice(0, 2).join(',') || 'Unknown location';
  } catch {
    return 'Unknown location';
  }
}

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  PRESENT:    { label: 'Present',    color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200',  icon: CheckCircle2 },
  LATE:       { label: 'Late',color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200', icon: Timer        },
  WFH:        { label: 'WFH',      color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',   icon: Home         },
  PERMISSION: { label: 'On Leave',     color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200', icon: CalendarCheck },
  ABSENT:     { label: 'Absent',    color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',    icon: CalendarX2   },
  HOLIDAY:    { label: 'Holiday',    color: 'text-gray-500',   bg: 'bg-gray-100',   border: 'border-gray-200',   icon: CalendarCheck },
};


function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function fmtMins(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  PENDING:   'Pending',
  APPROVED:  'Approved',
  REJECTED:  'Rejected',
  CANCELLED: 'Cancelled',
};

const LEAVE_STATUS_STYLE: Record<LeaveStatus, string> = {
  PENDING:   'bg-yellow-50 text-yellow-700 border border-yellow-200',
  APPROVED:  'bg-green-50 text-green-700 border border-green-200',
  REJECTED:  'bg-red-50 text-red-700 border border-red-200',
  CANCELLED: 'bg-gray-100 text-gray-500 border border-gray-200',
};

// ── Out-of-Area Modal ──────────────────────────────────────────
interface OutOfAreaInfo {
  distanceMeters: number;
  nearestLocation: { name: string; lat: number; lng: number; radiusMeters: number };
  userLat: number;
  userLng: number;
  locationName: string;
  checkInStatus: 'PRESENT' | 'WFH';
}

function OutOfAreaModal({ info, onCancel, onForce }: {
  info: OutOfAreaInfo;
  onCancel: () => void;
  onForce: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleForce() {
    if (reason.trim().length < 10) return;
    setSubmitting(true);
    await onForce(reason.trim());
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-navy px-5 py-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <MapPinOff size={18} className="text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Out of Office Area</p>
              <p className="text-red-100 text-xs mt-0.5">You are outside the check-in radius</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-white/70 hover:text-white mt-0.5">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 space-y-2.5 border border-gray-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Nearest location</span>
              <span className="font-semibold text-gray-800">{info.nearestLocation.name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Your distance</span>
              <span className="font-bold text-gray-900">{info.distanceMeters.toLocaleString('en-US')} m</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Allowed radius</span>
              <span className="text-gray-700">{info.nearestLocation.radiusMeters} m</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-navy/40 rounded-full"
                style={{ width: `${Math.min(100, (info.nearestLocation.radiusMeters / info.distanceMeters) * 100)}%` }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Reason for being out of area <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Client visit, off-site meeting, etc. (min. 10 characters)"
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-navy/20 resize-none"
            />
            <p className="text-xs mt-1 text-gray-400">
              {reason.length}/10 characters minimum
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex gap-2.5">
            <AlertTriangle size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500">
              Check-in outside the area will be recorded and visible to your manager.
            </p>
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleForce}
            disabled={reason.trim().length < 10 || submitting}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-navy hover:bg-navy/90 disabled:opacity-40 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <MapPinOff size={14} />}
            Check In Anyway
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Camera Modal ───────────────────────────────────────────────
function CameraModal({ onCapture, onClose }: { onCapture: (photo: string | null) => void; onClose: () => void }) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } })
      .then((s) => {
        if (!mounted) { s.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setLoading(false);
          };
        }
      })
      .catch(() => { if (mounted) setError('Cannot access camera. Please allow camera permissions.'); });
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  function capture() {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    canvasRef.current.width  = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.translate(canvasRef.current.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, 0, 0);
    setPreview(canvasRef.current.toDataURL('image/jpeg', 0.85));
  }

  function handleConfirm() {
    if (!preview) return;
    streamRef.current?.getTracks().forEach(t => t.stop());
    onCapture(preview);
  }

  function handleClose() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
              <Camera size={14} className="text-green-600" />
            </div>
            <span className="font-semibold text-sm text-gray-800">Selfie Photo</span>
          </div>
          <button onClick={handleClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <div className="p-4">
          {error ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <CameraOff size={28} className="text-gray-300" />
              </div>
              <p className="text-sm text-gray-500 mb-1">{error}</p>
              <p className="text-xs text-gray-400 mb-4">You can still check-in without a photo</p>
              <div className="flex gap-2 justify-center">
                <button onClick={handleClose} className="px-4 py-2 text-sm bg-gray-100 rounded-xl hover:bg-gray-200 font-medium">Close</button>
                <button
                  onClick={() => { handleClose(); onCapture(null); }}
                  className="px-4 py-2 text-sm bg-navy text-white rounded-xl hover:bg-navy/90 font-medium"
                >
                  Continue without photo
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative bg-black rounded-xl overflow-hidden aspect-[4/3]">
                <video
                  ref={videoRef}
                  autoPlay muted playsInline
                  className={cn('w-full h-full object-cover', preview ? 'hidden' : 'block')}
                  style={{ transform: 'scaleX(-1)' }}
                />
                {preview && <img src={preview} alt="preview" className="w-full h-full object-cover" />}
                {loading && !error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black">
                    <Loader2 size={24} className="animate-spin text-white" />
                  </div>
                )}
                {!preview && !loading && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-36 h-44 border-2 border-white/60 rounded-full shadow-[0_0_0_4px_rgba(255,255,255,0.15)]" />
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />

              {!preview && !loading && (
                <p className="text-xs text-gray-400 text-center mt-2">Position your face inside the oval</p>
              )}

              <div className="flex gap-2 mt-4">
                {!preview ? (
                  <button
                    onClick={capture}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                  >
                    <Camera size={16} />
                    Take Photo
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setPreview(null)}
                      className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      Retake
                    </button>
                    <button
                      onClick={handleConfirm}
                      className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={15} />
                      Use Photo
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────
export default function HRISOverviewPage() {
  const user = useAuthStore((s) => s.user);
  const [today, setToday]       = useState<TodayRecord | null>(null);
  const [attSummary, setAttSummary] = useState<AttSummary | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [recentLeaves, setRecentLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [checkinLoading, setCheckinLoading]   = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [outOfAreaInfo, setOutOfAreaInfo] = useState<OutOfAreaInfo | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const pendingCheckInStatus = useRef<'PRESENT' | 'WFH'>('PRESENT');
  const pendingPhotoDataUrl  = useRef<string | null>(null);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 10 ? 'Good morning' : hour < 15 ? 'Good afternoon' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr  = now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  async function load() {
    setLoading(true);
    const thisMonth = now.getMonth() + 1;
    const thisYear  = now.getFullYear();
    try {
      const [todayRes, balRes, leaveRes, summaryRes] = await Promise.all([
        api.get('/hris/attendance/today'),
        api.get('/hris/leave-balances'),
        api.get('/hris/leave-requests', { params: { limit: 5 } }),
        api.get('/hris/attendance/summary', { params: { month: thisMonth, year: thisYear } }),
      ]);
      setToday(todayRes.data.data);
      setBalances(balRes.data.data);
      setRecentLeaves(leaveRes.data.data);
      setAttSummary(summaryRes.data.data.summary);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function doCheckIn(opts: {
    status: 'PRESENT' | 'WFH';
    lat?: number | null;
    lng?: number | null;
    locationName?: string | null;
    outOfAreaReason?: string | null;
    photoDataUrl?: string | null;
  }) {
    setCheckinLoading(true);
    try {
      const payload: Record<string, unknown> = { status: opts.status };
      if (opts.photoDataUrl) payload.photoBase64 = opts.photoDataUrl;
      if (opts.lat != null)        payload.lat = opts.lat;
      if (opts.lng != null)        payload.lng = opts.lng;
      if (opts.locationName)       payload.locationName = opts.locationName;
      if (opts.outOfAreaReason)    payload.outOfAreaReason = opts.outOfAreaReason;

      const res = await api.post('/hris/attendance/check-in', payload);
      setToday(res.data.data);
      toast.success('Checked in successfully!');
    } catch (err: any) {
      const data = err?.response?.data;
      if (err?.response?.status === 422 && data?.data?.distanceMeters !== undefined) {
        setOutOfAreaInfo({
          distanceMeters: data.data.distanceMeters,
          nearestLocation: data.data.nearestLocation,
          userLat: opts.lat!,
          userLng: opts.lng!,
          locationName: opts.locationName ?? 'Lokasi kamu',
          checkInStatus: opts.status,
        });
      } else {
        toast.error(data?.message ?? 'Check-in failed');
      }
    } finally {
      setCheckinLoading(false);
    }
  }

  function handleCheckIn(status: 'PRESENT' | 'WFH' = 'PRESENT') {
    pendingCheckInStatus.current = status;
    if (status === 'WFH') {
      doCheckIn({ status: 'WFH' });
      return;
    }
    setShowCamera(true);
  }

  async function handlePhotoCapture(photo: string | null) {
    setShowCamera(false);
    pendingPhotoDataUrl.current = photo;
    const status = pendingCheckInStatus.current;

    if (!navigator.geolocation) {
      toast.error('Perangkat kamu tidak mendukung lokasi. Aktifkan GPS untuk check-in.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const locationName = await reverseGeocode(lat, lng);
        await doCheckIn({ status, lat, lng, locationName, photoDataUrl: photo });
      },
      () => {
        toast.error('Gagal mendapatkan lokasi. Aktifkan izin lokasi lalu coba lagi.');
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  }

  async function handleForceCheckIn(reason: string) {
    const info = outOfAreaInfo!;
    setOutOfAreaInfo(null);
    await doCheckIn({
      status: info.checkInStatus,
      lat: info.userLat,
      lng: info.userLng,
      locationName: info.locationName,
      outOfAreaReason: reason,
      photoDataUrl: pendingPhotoDataUrl.current,
    });
  }

  async function handleCheckOut() {
    setCheckoutLoading(true);
    try {
      const res = await api.post('/hris/attendance/check-out', {});
      setToday(res.data.data);
      toast.success('Checked out successfully!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Check-out failed');
    } finally { setCheckoutLoading(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-300" />
      </div>
    );
  }

  const statusCfg = today ? STATUS_CONFIG[today.status] : null;
  const StatusIcon = statusCfg?.icon ?? CheckCircle2;

  const totalAttDays = attSummary
    ? attSummary.present + attSummary.late + attSummary.wfh + attSummary.permission
    : 0;
  const workdaysPassed = (() => {
    let count = 0;
    for (let d = 1; d <= now.getDate(); d++) {
      const day = new Date(now.getFullYear(), now.getMonth(), d).getDay();
      if (day !== 0 && day !== 6) count++;
    }
    return count;
  })();
  const attendanceRate = workdaysPassed > 0 ? Math.round((totalAttDays / workdaysPassed) * 100) : 0;

  return (
    <>
      {showCamera && (
        <CameraModal onCapture={handlePhotoCapture} onClose={() => setShowCamera(false)} />
      )}
      {outOfAreaInfo && (
        <OutOfAreaModal
          info={outOfAreaInfo}
          onCancel={() => setOutOfAreaInfo(null)}
          onForce={handleForceCheckIn}
        />
      )}

      <div className="max-w-4xl mx-auto space-y-5">

        {/* Greeting */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">{dateStr}</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-0.5">
              {greeting}, <span className="text-navy">{user?.fullName?.split(' ')[0]}</span>
            </h1>
          </div>
          {attSummary && workdaysPassed > 0 && (
            <div className="hidden sm:flex items-center gap-2 bg-navy/5 rounded-xl px-3 py-2">
              <TrendingUp size={14} className="text-navy" />
              <div className="text-right">
                <p className="text-xs text-gray-500">Attendance this month</p>
                <p className="text-sm font-bold text-navy">{attendanceRate}%</p>
              </div>
            </div>
          )}
        </div>

        {/* Today attendance card */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Colored header */}
          <div className="bg-navy px-6 py-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Clock size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-white/80 text-xs font-medium">Today's Attendance</p>
                  {today?.shift ? (
                    <p className="text-white font-semibold text-sm mt-0.5">
                      Shift {today.shift.name} · Starts {today.shift.startTime}
                    </p>
                  ) : (
                    <p className="text-white font-semibold text-sm mt-0.5">Not checked in</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {today?.isOutOfArea && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-white/20 text-white">
                    <MapPinOff size={10} /> Out of Area
                  </span>
                )}
                {today && statusCfg && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-white/20 text-white">
                    <StatusIcon size={12} />
                    {statusCfg.label}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            {!today ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-gray-700 text-sm font-medium">You haven't checked in today.</p>
                  <p className="text-gray-400 text-xs mt-1 flex items-center gap-1">
                    <MapPin size={10} /> GPS will be detected automatically on check-in.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCheckIn('PRESENT')}
                    disabled={checkinLoading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-semibold hover:bg-navy/90 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {checkinLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
                    Check In
                  </button>
                  <button
                    onClick={() => handleCheckIn('WFH')}
                    disabled={checkinLoading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 border border-gray-200"
                  >
                    <Home size={15} />
                    WFH
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex gap-8">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Check In</p>
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">{fmt(today.checkIn)}</p>
                    {today.isLate && (
                      <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
                        <AlertCircle size={10} /> Late {today.lateMinutes} min
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Check Out</p>
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">{fmt(today.checkOut)}</p>
                    {today.checkOut && today.workMinutes != null && today.workMinutes > 0 && (
                      <p className="text-xs text-gray-400 mt-1">{fmtMins(today.workMinutes)} work</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  {today.photoUrl && (
                    <a href={today.photoUrl} target="_blank" rel="noopener noreferrer" className="group">
                      <img
                        src={today.photoUrl}
                        alt="Check-in selfie"
                        className="w-14 h-14 rounded-xl object-cover border-2 border-gray-100 group-hover:border-navy/30 transition-colors shadow-sm"
                      />
                    </a>
                  )}
                  <div className="flex flex-col items-end gap-2">
                    {!today.checkOut && (
                      <button
                        onClick={handleCheckOut}
                        disabled={checkoutLoading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-semibold hover:bg-navy/90 transition-colors disabled:opacity-50 shadow-sm"
                      >
                        {checkoutLoading ? <Loader2 size={14} className="animate-spin" /> : <Clock size={15} />}
                        Check Out
                      </button>
                    )}
                    {today.locationName && (
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <MapPin size={10} /> {today.locationName}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Monthly summary strip */}
          {attSummary && (
            <div className="border-t border-gray-100 px-6 py-3 flex gap-5 overflow-x-auto">
              {[
                { label: 'Present', val: attSummary.present    },
                { label: 'Late',    val: attSummary.late       },
                { label: 'WFH',     val: attSummary.wfh        },
                { label: 'On Leave',val: attSummary.permission },
                { label: 'Absent',  val: attSummary.absent     },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-base font-bold tabular-nums text-gray-700">{s.val}</span>
                  <span className="text-xs text-gray-400">{s.label}</span>
                </div>
              ))}
              {attSummary.totalWorkMinutes > 0 && (
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
                  <Clock size={12} className="text-gray-400" />
                  <span className="text-xs text-gray-500 font-medium">{fmtMins(attSummary.totalWorkMinutes)} this month</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Leave balance */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                  <CalendarCheck size={14} className="text-gray-500" />
                </div>
                <span className="text-sm font-semibold text-gray-800">Leave Balance {now.getFullYear()}</span>
              </div>
              <Link to={ROUTES.HRIS_LEAVE} className="text-xs text-navy hover:underline flex items-center gap-0.5 font-medium">
                Detail <ChevronRight size={12} />
              </Link>
            </div>
            <div className="px-5 py-4 space-y-4">
              {balances.length === 0 && (
                <p className="text-sm text-gray-400 py-2">No leave balance data.</p>
              )}
              {balances.map((b) => (
                <div key={b.leaveType.id}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-700 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: b.leaveType.color }} />
                      {b.leaveType.name}
                    </span>
                    {b.remainingDays !== null ? (
                      <div className="text-right">
                        <span className="text-sm font-bold text-gray-800">{b.remainingDays}</span>
                        <span className="text-xs text-gray-400"> / {b.totalDays} days</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Unlimited</span>
                    )}
                  </div>
                  {b.remainingDays !== null && (
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(0, Math.min(100, (b.remainingDays / b.totalDays) * 100))}%`,
                          backgroundColor: b.leaveType.color,
                        }}
                      />
                    </div>
                  )}
                  {b.pendingDays > 0 && (
                    <p className="text-xs text-gray-400 mt-1">{b.pendingDays} days pending approval</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right column: recent leaves + pending OT */}
          <div className="space-y-5">
            {/* Recent leave requests */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                    <CalendarDays size={14} className="text-gray-500" />
                  </div>
                  <span className="text-sm font-semibold text-gray-800">Leave Requests</span>
                </div>
                <Link to={ROUTES.HRIS_LEAVE} className="text-xs text-navy hover:underline flex items-center gap-0.5 font-medium">
                  All <ChevronRight size={12} />
                </Link>
              </div>
              <div className="divide-y divide-gray-50">
                {recentLeaves.length === 0 && (
                  <p className="text-sm text-gray-400 py-5 text-center">No leave requests.</p>
                )}
                {recentLeaves.slice(0, 4).map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.leaveType.color }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{r.leaveType.name}</p>
                        <p className="text-xs text-gray-400">
                          {fmtDate(r.startDate)} – {fmtDate(r.endDate)} · {r.totalDays}h
                        </p>
                      </div>
                    </div>
                    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ml-2', LEAVE_STATUS_STYLE[r.status])}>
                      {LEAVE_STATUS_LABEL[r.status]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
