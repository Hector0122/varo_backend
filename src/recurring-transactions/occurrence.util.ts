export type Frequency =
  | 'DAILY'
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'BIMONTHLY'
  | 'YEARLY';

const DAY = 86400000;

/** Medianoche UTC del día de `d`. */
export const utcDay = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** n-ésima fecha desde `start` (los meses se ajustan a fin de mes sin correrse). */
export function nthOccurrence(start: Date, frequency: Frequency, n: number) {
  const s = utcDay(start);
  const days = { DAILY: 1, WEEKLY: 7, BIWEEKLY: 14 }[frequency as string];
  if (days) return new Date(s.getTime() + n * days * DAY);
  const months =
    { MONTHLY: 1, BIMONTHLY: 2, YEARLY: 12 }[frequency as string]! * n;
  const y = s.getUTCFullYear();
  const m = s.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(s.getUTCDate(), lastDay)));
}

/** La fecha más reciente que toca (<= hoy), o null si aún no empieza. */
export function latestOccurrence(
  start: Date,
  frequency: Frequency,
  today: Date,
) {
  const t = utcDay(today).getTime();
  let latest: Date | null = null;
  for (let n = 0; n < 100000; n++) {
    const d = nthOccurrence(start, frequency, n);
    if (d.getTime() > t) break;
    latest = d;
  }
  return latest;
}
