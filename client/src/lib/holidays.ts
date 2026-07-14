import api from '@/lib/api';

// Company holiday dates (YYYY-MM-DD) for a year, cached per session so the
// calendar, leave form, and overview don't refetch the same list.
const cache = new Map<number, Promise<Set<string>>>();

export function getHolidaySet(year: number): Promise<Set<string>> {
  let promise = cache.get(year);
  if (!promise) {
    promise = api
      .get('/hris/holidays', { params: { year } })
      .then((res) => new Set<string>((res.data.data ?? []).map((h: { date: string }) => h.date.slice(0, 10))))
      .catch(() => {
        cache.delete(year);
        return new Set<string>();
      });
    cache.set(year, promise);
  }
  return promise;
}

// Working days = Mon–Fri minus company holidays; mirrors the server rule so
// client previews and server-computed totals always agree.
export function countWorkdays(start: string, end: string, holidays: Set<string>): number {
  if (!start || !end) return 0;
  let count = 0;
  const cur = new Date(start + 'T00:00:00Z');
  const endD = new Date(end + 'T00:00:00Z');
  while (cur <= endD) {
    const d = cur.getUTCDay();
    if (d !== 0 && d !== 6 && !holidays.has(cur.toISOString().slice(0, 10))) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}
