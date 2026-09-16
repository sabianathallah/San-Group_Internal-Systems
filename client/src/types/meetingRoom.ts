export type BookingStatus = 'CONFIRMED' | 'CANCELLED';

export interface MiniUser { id: string; fullName: string; username: string; avatar: string | null }

export interface Room {
  id: string;
  name: string;
  building: string | null;
  floor: string | null;
  capacity: number | null;
  facilities: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  title: string;
  notes: string | null;
  attendees: string[];
  startTime: string;
  endTime: string;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
  room: { id: string; name: string; building: string | null; floor: string | null; capacity: number | null };
  bookedBy: MiniUser;
  cancelledAt: string | null;
  cancelledBy: MiniUser | null;
}

// Stable accent per room so the same room always renders the same color
// across the calendar and the room list, without needing a color field on
// the Room record itself (rooms are simple master data, not styled).
const ROOM_PALETTE = [
  { dot: '#0F2942', bg: '#E8F0F7', border: '#C7DAEA', text: '#0F2942' },
  { dot: '#059669', bg: '#ECFDF5', border: '#A7F3D0', text: '#047857' },
  { dot: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' },
  { dot: '#C9A84C', bg: '#F8F3E3', border: '#EADFB8', text: '#8A6D1F' },
  { dot: '#9333EA', bg: '#F5F3FF', border: '#DDD6FE', text: '#6D28D9' },
  { dot: '#DB2777', bg: '#FDF2F8', border: '#FBCFE8', text: '#BE185D' },
];

export function roomColor(roomId: string) {
  let hash = 0;
  for (let i = 0; i < roomId.length; i++) hash = (hash * 31 + roomId.charCodeAt(i)) >>> 0;
  return ROOM_PALETTE[hash % ROOM_PALETTE.length];
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

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
