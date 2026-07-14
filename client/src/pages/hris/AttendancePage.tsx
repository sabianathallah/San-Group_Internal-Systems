import { useEffect, useState, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, CheckCircle2, Timer, Home,
  CalendarCheck, CalendarX2, Clock, Loader2, RefreshCw, Users,
  MapPin, MapPinOff, Camera, X,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { getHolidaySet } from '@/lib/holidays';
import { useAuthStore } from '@/stores/authStore';
import { usePermStore } from '@/stores/permStore';

type AttendanceStatus = 'PRESENT' | 'LATE' | 'WFH' | 'PERMISSION' | 'ABSENT' | 'HOLIDAY';

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: AttendanceStatus;
  isLate: boolean;
  lateMinutes: number;
  workMinutes: number | null;
  note: string | null;
  locationName: string | null;
  isOutOfArea: boolean;
  outOfAreaReason: string | null;
  photoUrl: string | null;
  user: { id: string; fullName: string; avatar: string | null };
}

interface Summary {
  present: number; late: number; wfh: number;
  permission: number; absent: number; holiday: number;
  totalWorkMinutes: number;
}

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; color: string; bg: string; dot: string; icon: React.ElementType }> = {
  PRESENT:    { label: 'Present',    color: 'text-green-700',  bg: 'bg-green-50',   dot: 'bg-green-500',  icon: CheckCircle2 },
  LATE:       { label: 'Late',color: 'text-orange-700', bg: 'bg-orange-50',  dot: 'bg-orange-500', icon: Timer        },
  WFH:        { label: 'WFH',      color: 'text-blue-700',   bg: 'bg-blue-50',    dot: 'bg-blue-500',   icon: Home         },
  PERMISSION: { label: 'On Leave',     color: 'text-purple-700', bg: 'bg-purple-50',  dot: 'bg-purple-500', icon: CalendarCheck },
  ABSENT:     { label: 'Absent',    color: 'text-red-700',    bg: 'bg-red-50',     dot: 'bg-red-500',    icon: CalendarX2   },
  HOLIDAY:    { label: 'Holiday',    color: 'text-gray-500',   bg: 'bg-gray-100',   dot: 'bg-gray-400',   icon: CalendarCheck },
};

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

function fmtMins(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay();
}

// ── Photo Lightbox ─────────────────────────────────────────────
function PhotoLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white">
        <X size={18} />
      </button>
      <img
        src={url}
        alt="Check-in photo"
        className="max-h-[80vh] max-w-full rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ── Log Table ──────────────────────────────────────────────────
function LogTable({
  records,
  showUser,
  onPhotoClick,
}: {
  records: AttendanceRecord[];
  showUser: boolean;
  onPhotoClick: (url: string | null) => void;
}) {
  if (records.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-gray-400">No attendance records for this period.</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {showUser && <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Employee</th>}
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Date</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Status</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Check In</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Check Out</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Duration</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Location</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Photo</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const cfg = STATUS_CONFIG[r.status];
            return (
              <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                {showUser && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {r.user?.avatar ? (
                        <img src={r.user.avatar} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-navy/10 flex items-center justify-center text-navy text-[10px] font-semibold flex-shrink-0">
                          {r.user?.fullName?.slice(0, 2).toUpperCase() ?? '—'}
                        </div>
                      )}
                      <span className="text-gray-800 whitespace-nowrap">{r.user?.fullName ?? '—'}</span>
                    </div>
                  </td>
                )}
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(r.date)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full w-fit', cfg.color, cfg.bg)}>
                      <cfg.icon size={10} />{cfg.label}
                    </span>
                    {r.isLate && r.lateMinutes > 0 && (
                      <span className="text-[10px] text-gray-400">+{r.lateMinutes}m late</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmt(r.checkIn)}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmt(r.checkOut)}</td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.workMinutes ? fmtMins(r.workMinutes) : '—'}</td>
                <td className="px-4 py-3">
                  {r.locationName ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1 text-xs text-gray-600">
                        <MapPin size={10} className="text-gray-400 flex-shrink-0" />
                        <span className="max-w-[140px] truncate">{r.locationName}</span>
                      </span>
                      {r.isOutOfArea && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full w-fit">
                          <MapPinOff size={9} /> Out of area
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.photoUrl ? (
                    <button onClick={() => onPhotoClick(r.photoUrl)}>
                      <img
                        src={r.photoUrl}
                        alt="selfie"
                        className="w-9 h-9 rounded-lg object-cover border border-gray-100 hover:border-navy/40 hover:scale-105 transition-all"
                      />
                    </button>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-gray-300">
                      <Camera size={10} /> —
                    </span>
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

// ── Main Page ──────────────────────────────────────────────────
export default function AttendancePage() {
  const user = useAuthStore((s) => s.user);
  const perms = usePermStore((s) => s.perms);
  const attendanceScope = perms.hris.editAttendance;
  const canSeeTeam = attendanceScope === 'division' || attendanceScope === 'all';
  const teamLabel = attendanceScope === 'division' ? `Team — ${user?.division?.name ?? 'Division'}` : 'Team — All';

  const now = new Date();
  const [month, setMonth]           = useState(now.getMonth() + 1);
  const [year, setYear]             = useState(now.getFullYear());
  const [records, setRecords]       = useState<AttendanceRecord[]>([]);
  const [summary, setSummary]       = useState<Summary | null>(null);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState(false);
  const [holidays, setHolidays]     = useState<Set<string>>(new Set());
  const [viewMode, setViewMode]     = useState<'mine' | 'team'>('mine');
  const [teamRecords, setTeamRecords] = useState<AttendanceRecord[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [summaryRes, holidaySet] = await Promise.all([
        api.get('/hris/attendance/summary', { params: { month, year } }),
        getHolidaySet(year),
      ]);
      setSummary(summaryRes.data.data.summary);
      setRecords(summaryRes.data.data.records ?? []);
      setHolidays(holidaySet);

      if (canSeeTeam && viewMode === 'team') {
        const teamRes = await api.get('/hris/attendance', { params: { month, year, limit: 300 } });
        setTeamRecords(teamRes.data.data ?? []);
      }
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  }, [month, year, viewMode, canSeeTeam]);

  useEffect(() => { load(); }, [load]);

  function prevMonth() {
    setSelectedDay(null);
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    setSelectedDay(null);
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  const monthLabel  = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDayOfMonth(year, month);

  const recordMap: Record<number, AttendanceRecord> = {};
  records.forEach((r) => { recordMap[new Date(r.date).getUTCDate()] = r; });

  const calendarDays: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Records shown in log table — filter by selected day if any
  const logRecords = selectedDay
    ? records.filter((r) => new Date(r.date).getUTCDate() === selectedDay)
    : [...records].reverse(); // newest first

  // Team log filtered by selected day
  const teamLogRecords = selectedDay
    ? teamRecords.filter((r) => new Date(r.date).getUTCDate() === selectedDay)
    : [...teamRecords].reverse();

  return (
    <>
      {lightboxUrl && <PhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Attendance</h1>
            <p className="text-sm text-gray-500 mt-0.5">Monthly attendance summary</p>
          </div>
          <div className="flex items-center gap-2">
            {canSeeTeam && (
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                <button
                  onClick={() => setViewMode('mine')}
                  className={cn('px-3 py-1.5 flex items-center gap-1.5 transition-colors', viewMode === 'mine' ? 'bg-navy text-white' : 'text-gray-600 hover:bg-gray-50')}
                >
                  <Clock size={13} /> Me
                </button>
                <button
                  onClick={() => setViewMode('team')}
                  className={cn('px-3 py-1.5 flex items-center gap-1.5 transition-colors', viewMode === 'team' ? 'bg-navy text-white' : 'text-gray-600 hover:bg-gray-50')}
                >
                  <Users size={13} /> {teamLabel}
                </button>
              </div>
            )}
            <button onClick={load} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Month nav */}
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronLeft size={18} className="text-gray-500" />
          </button>
          <span className="text-base font-semibold text-gray-800 min-w-[160px] text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronRight size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { label: 'Present',  val: summary.present   },
              { label: 'Late',     val: summary.late      },
              { label: 'WFH',      val: summary.wfh       },
              { label: 'On Leave', val: summary.permission },
              { label: 'Absent',   val: summary.absent    },
              { label: 'Work Hrs', val: summary.totalWorkMinutes > 0 ? fmtMins(summary.totalWorkMinutes) : '—' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-center">
                <p className="text-lg font-bold tabular-nums text-gray-800">{s.val}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Calendar — mine view only */}
        {viewMode === 'mine' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-gray-100">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="py-2.5 text-center text-xs font-semibold text-gray-400">{d}</div>
              ))}
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 size={20} className="animate-spin text-gray-300" />
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {calendarDays.map((day, i) => {
                  if (!day) return <div key={`e-${i}`} className="border-b border-r border-gray-50 min-h-[84px]" />;
                  const rec        = recordMap[day];
                  const cfg        = rec ? STATUS_CONFIG[rec.status] : null;
                  const isToday    = day === now.getDate() && month === now.getMonth() + 1 && year === now.getFullYear();
                  const isSelected = day === selectedDay;
                  const isWeekend  = (firstDay + day - 1) % 7 === 0 || (firstDay + day - 1) % 7 === 6;
                  const dateKey    = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isHoliday  = holidays.has(dateKey);

                  return (
                    <button
                      type="button"
                      key={day}
                      onClick={() => setSelectedDay(isSelected ? null : day)}
                      className={cn(
                        'border-b border-r border-gray-50 min-h-[84px] p-2 cursor-pointer transition-colors text-left align-top',
                        isSelected ? 'bg-navy/5 ring-1 ring-inset ring-navy/20' : 'hover:bg-gray-50',
                        (isWeekend || isHoliday) && !rec ? 'bg-gray-50/60' : '',
                      )}
                    >
                      <div className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold mb-1',
                        isToday ? 'bg-navy text-white shadow-sm' : isSelected ? 'bg-navy/10 text-navy' : isHoliday ? 'text-red-400' : isWeekend ? 'text-gray-400' : 'text-gray-700',
                      )}>
                        {day}
                      </div>
                      {rec && cfg ? (
                        <div className="space-y-0.5">
                          <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full', cfg.color, cfg.bg)}>
                            <cfg.icon size={9} />
                            {cfg.label}
                          </span>
                          {rec.checkIn && (
                            <p className="text-[10px] text-gray-400 leading-tight">{fmt(rec.checkIn)}{rec.checkOut ? ` – ${fmt(rec.checkOut)}` : ''}</p>
                          )}
                          {rec.isLate && rec.lateMinutes > 0 && (
                            <p className="text-[9px] text-gray-400">+{rec.lateMinutes}m</p>
                          )}
                          {rec.photoUrl && (
                            <Camera size={9} className="text-gray-300 mt-0.5" />
                          )}
                        </div>
                      ) : isHoliday ? (
                        <span className="text-[10px] font-medium text-red-400">Holiday</span>
                      ) : isWeekend ? (
                        <span className="text-[10px] text-gray-300">Off</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Log table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">
                {viewMode === 'mine' ? 'Attendance Log' : 'Team Attendance'} —{' '}
                {selectedDay
                  ? new Date(year, month - 1, selectedDay).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
                  : monthLabel}
              </p>
              {selectedDay && (
                <button
                  onClick={() => setSelectedDay(null)}
                  className="text-xs text-navy hover:underline mt-0.5"
                >
                  ← Show all month
                </button>
              )}
            </div>
            {selectedDay && (
              <button
                onClick={() => setSelectedDay(null)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={20} className="animate-spin text-gray-300" />
            </div>
          ) : loadError ? (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-500 mb-3">Failed to load data. Check your connection and try again.</p>
              <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          ) : viewMode === 'mine' ? (
            <LogTable
              records={logRecords}
              showUser={false}
              onPhotoClick={setLightboxUrl}
            />
          ) : (
            <LogTable
              records={teamLogRecords}
              showUser={true}
              onPhotoClick={setLightboxUrl}
            />
          )}
        </div>
      </div>
    </>
  );
}
