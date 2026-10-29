import { JALALI_MONTHS, toGregorian, toJalali } from './jalali';
import type { HHMM, ISODate, Weekday } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse an ISO date at local noon (safe against DST edges). */
export function parseISO(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISO(now);
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / 86_400_000);
}

/** Iranian weekday: Saturday = 0 … Friday = 6. */
export function weekdayOf(iso: ISODate): Weekday {
  return ((parseISO(iso).getDay() + 1) % 7) as Weekday;
}

/** Saturday that starts the week containing `iso`. */
export function startOfWeek(iso: ISODate): ISODate {
  return addDays(iso, -weekdayOf(iso));
}

export function weekDates(weekStart: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function toMin(t: HHMM): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function fromMin(min: number): HHMM {
  const m = Math.max(0, Math.min(24 * 60, Math.round(min)));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export function nowMinutes(now: Date = new Date()): number {
  return now.getHours() * 60 + now.getMinutes();
}

// ---- Persian formatting --------------------------------------------------

const faDigits = '۰۱۲۳۴۵۶۷۸۹';
export function faNum(value: number | string): string {
  return String(value).replace(/\d/g, (d) => faDigits[Number(d)]!);
}

export function faInt(n: number): string {
  return Math.round(n).toLocaleString('fa-IR');
}

export function faPercent(ratio: number): string {
  return `${faInt(ratio * 100)}٪`;
}

export const WEEKDAYS = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
] as const;
export const WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const;

export function jalaliParts(iso: ISODate) {
  const d = parseISO(iso);
  return toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function isoFromJalali(jy: number, jm: number, jd: number): ISODate {
  const g = toGregorian(jy, jm, jd);
  return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
}

/** e.g. «۷ آبان» */
export function formatDayMonth(iso: ISODate): string {
  const j = jalaliParts(iso);
  return `${faNum(j.jd)} ${JALALI_MONTHS[j.jm - 1]}`;
}

/** e.g. «پنجشنبه ۷ آبان ۱۴۰۵» */
export function formatLongDate(iso: ISODate): string {
  const j = jalaliParts(iso);
  return `${WEEKDAYS[weekdayOf(iso)]} ${faNum(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${faNum(j.jy)}`;
}

/** e.g. «۱۴۰۵/۰۸/۰۷» */
export function formatShortDate(iso: ISODate): string {
  const j = jalaliParts(iso);
  return faNum(`${j.jy}/${pad(j.jm)}/${pad(j.jd)}`);
}

export function formatTime(t: HHMM): string {
  return faNum(t);
}

/** Human duration: «۴۵ دقیقه»، «۲ ساعت»، «۱ ساعت و ۲۰ دقیقه». */
export function formatDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${faInt(r)} دقیقه`;
  if (r === 0) return `${faInt(h)} ساعت`;
  return `${faInt(h)} ساعت و ${faInt(r)} دقیقه`;
}

/** Compact duration that can't be mistaken for a clock time: «۲س ۱۵د»، «۴۵د»، «۳س». */
export function formatDurationShort(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${faInt(r)}د`;
  if (r === 0) return `${faInt(h)}س`;
  return `${faInt(h)}س ${faInt(r)}د`;
}

/** Relative day label: امروز، فردا، دیروز، or the date. */
export function relativeDay(iso: ISODate, today: ISODate): string {
  const d = diffDays(iso, today);
  if (d === 0) return 'امروز';
  if (d === 1) return 'فردا';
  if (d === -1) return 'دیروز';
  if (d > 1 && d < 7) return `${faInt(d)} روز دیگر`;
  if (d < -1 && d > -7) return `${faInt(-d)} روز پیش`;
  return formatDayMonth(iso);
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'شب بخیر';
  if (h < 12) return 'صبح بخیر';
  if (h < 17) return 'روز بخیر';
  return 'عصر بخیر';
}
