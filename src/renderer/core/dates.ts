// Day keys are local dates "YYYY-MM-DD". A day can start later than midnight
// (Settings > "New day starts at"), so every key is computed with that offset.

const pad = (n: number) => String(n).padStart(2, '0');

export function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dayKey(ts: number, dayStartMin = 0): string {
  return fmtDate(new Date(ts - dayStartMin * 60000));
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
}

export function addDays(key: string, n: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}

/** b - a in whole days */
export function diffDays(a: string, b: string): number {
  return Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86400000);
}

/** Monday of the week containing `key` */
export function weekOf(key: string): string {
  const d = parseKey(key);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return fmtDate(d);
}

/** 0 = Monday ... 6 = Sunday */
export function weekdayIndex(key: string): number {
  return (parseKey(key).getDay() + 6) % 7;
}

export function monthOf(key: string): string {
  return key.slice(0, 7);
}

export function yearOf(key: string): number {
  return Number(key.slice(0, 4));
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
}

export function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
}

export function monthIndex(month: string): number {
  return Number(month.slice(5, 7)) - 1;
}

/** Wall-clock start of a day key, honouring the day start offset */
export function dayStartTs(key: string, dayStartMin = 0): number {
  return parseKey(key).getTime() + dayStartMin * 60000;
}

/** Number of whole weeks since a fixed Monday; used to rotate weekly bosses */
export function weekNumber(weekKey: string): number {
  return Math.floor(diffDays('2024-01-01', weekKey) / 7);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const monthShort = (i: number) => MONTHS[i];
export const monthLong = (i: number) => MONTHS_LONG[i];
export const weekdayShort = (i: number) => WEEKDAYS[i];

/** "Mon 3 Nov 2026" */
export function prettyDay(key: string): string {
  const d = parseKey(key);
  return `${WEEKDAYS[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "3 Nov" */
export function shortDay(key: string): string {
  const d = parseKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function prettyTime(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
