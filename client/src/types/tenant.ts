export type TenantLocation = 'GREEN_TERRACE' | 'THE_AMBOJA' | 'ALOON_ALOON';
export type TenantStatus = 'ACTIVE' | 'FIT_OUT' | 'VACANT' | 'INACTIVE';
export interface MiniUser { id: string; fullName: string; avatar: string | null }

export interface Tenant {
  id: string;
  location: TenantLocation;
  block: string;
  unitNo: string;
  name: string | null;
  logoPath: string | null;
  status: TenantStatus;
  area: string | null;
  power: number | null;
  leaseStart: string | null;
  leaseEnd: string | null;
  fitOutDate: string | null;
  openDate: string | null;
  rentPrice?: string | null;
  serviceCharge?: string | null;
  notes: string | null;
  createdBy: MiniUser;
  createdAt: string;
}

export const LOCATIONS: TenantLocation[] = ['GREEN_TERRACE', 'THE_AMBOJA', 'ALOON_ALOON'];
export const STATUSES: TenantStatus[] = ['ACTIVE', 'FIT_OUT', 'VACANT', 'INACTIVE'];

export const STATUS_CONFIG: Record<TenantStatus, { bg: string; color: string; dot: string }> = {
  ACTIVE:   { bg: 'bg-emerald-50', color: 'text-emerald-700', dot: 'bg-emerald-500' },
  FIT_OUT:  { bg: 'bg-amber-50',   color: 'text-amber-700',   dot: 'bg-amber-500' },
  VACANT:   { bg: 'bg-gray-100',   color: 'text-gray-500',    dot: 'bg-gray-400' },
  INACTIVE: { bg: 'bg-gray-100',   color: 'text-gray-400',    dot: 'bg-gray-300' },
};

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

export function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

export function fmtMoney(n: string | number | null | undefined) {
  if (n == null) return '—';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n));
}
