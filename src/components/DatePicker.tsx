import { useEffect, useId, useRef, useState } from 'react';
import { faNum, formatLongDate, isoFromJalali, jalaliParts, todayISO, weekdayOf, WEEKDAYS_SHORT } from '../lib/dates';
import { JALALI_MONTHS, jalaliMonthLength } from '../lib/jalali';
import type { ISODate } from '../lib/types';
import { IconCalendarDays, IconChevronLeft, IconChevronRight, IconX } from './icons';
import { cx } from './ui';

/** Persian (Jalali) date picker. Stores ISO dates, shows Jalali. */
export function DatePicker({
  id,
  value,
  onChange,
  allowEmpty = false,
  placeholder = 'انتخاب تاریخ',
  min,
  invalid,
}: {
  id?: string;
  value?: ISODate;
  onChange: (v: ISODate | undefined) => void;
  allowEmpty?: boolean;
  placeholder?: string;
  min?: ISODate;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const base = jalaliParts(value ?? todayISO());
  const [view, setView] = useState({ jy: base.jy, jm: base.jm });
  const ref = useRef<HTMLDivElement>(null);
  const gridId = useId();

  useEffect(() => {
    if (!open) return;
    const j = jalaliParts(value ?? todayISO());
    setView({ jy: j.jy, jm: j.jm });
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const shift = (delta: number) =>
    setView((v) => {
      const m = v.jm + delta;
      if (m < 1) return { jy: v.jy - 1, jm: 12 };
      if (m > 12) return { jy: v.jy + 1, jm: 1 };
      return { jy: v.jy, jm: m };
    });

  const len = jalaliMonthLength(view.jy, view.jm);
  const first = isoFromJalali(view.jy, view.jm, 1);
  const lead = weekdayOf(first);
  const today = todayISO();

  return (
    <div ref={ref} className="relative">
      <div className="flex">
        <button
          id={id}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          onClick={() => setOpen((o) => !o)}
          className={cx(
            'flex h-9 w-full items-center gap-2 rounded-lg border bg-surface px-3 text-start text-sm transition-colors hover:border-line-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
            invalid ? 'border-danger' : 'border-line',
          )}
        >
          <IconCalendarDays aria-hidden className="size-4 shrink-0 text-ink-3" />
          <span className={cx('truncate', value ? 'text-ink' : 'text-ink-3')}>{value ? formatLongDate(value) : placeholder}</span>
        </button>
        {allowEmpty && value && (
          <button
            type="button"
            aria-label="حذف تاریخ"
            onClick={() => onChange(undefined)}
            className="-ms-8 grid w-8 place-items-center text-ink-3 hover:text-ink"
          >
            <IconX aria-hidden className="size-3.5" />
          </button>
        )}
      </div>
      {open && (
        <div role="dialog" aria-label="انتخاب تاریخ" className="absolute start-0 top-full z-50 mt-1 w-72 rounded-xl border border-line bg-surface p-3 shadow-pop">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label="ماه قبل" onClick={() => shift(-1)} className="grid size-8 place-items-center rounded-md text-ink-2 hover:bg-subtle">
              <IconChevronRight aria-hidden className="size-4" />
            </button>
            <span className="text-sm font-semibold" aria-live="polite">
              {JALALI_MONTHS[view.jm - 1]} {faNum(view.jy)}
            </span>
            <button type="button" aria-label="ماه بعد" onClick={() => shift(1)} className="grid size-8 place-items-center rounded-md text-ink-2 hover:bg-subtle">
              <IconChevronLeft aria-hidden className="size-4" />
            </button>
          </div>
          <div id={gridId} role="grid" className="grid grid-cols-7 gap-0.5 text-center text-[13px]">
            {WEEKDAYS_SHORT.map((w) => (
              <div key={w} role="columnheader" className="py-1 text-xs text-ink-3">
                {w}
              </div>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <div key={`b${i}`} />
            ))}
            {Array.from({ length: len }, (_, i) => {
              const iso = isoFromJalali(view.jy, view.jm, i + 1);
              const selected = iso === value;
              const disabled = !!min && iso < min;
              return (
                <button
                  key={iso}
                  type="button"
                  role="gridcell"
                  aria-selected={selected}
                  aria-label={formatLongDate(iso)}
                  disabled={disabled}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={cx(
                    'num h-8 rounded-md transition-colors disabled:opacity-30',
                    selected ? 'bg-primary font-semibold text-on-primary' : 'hover:bg-subtle',
                    !selected && iso === today && 'font-semibold text-primary ring-1 ring-primary/40 ring-inset',
                  )}
                >
                  {faNum(i + 1)}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between border-t border-line pt-2">
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => {
                onChange(today);
                setOpen(false);
              }}
            >
              امروز
            </button>
            {allowEmpty && (
              <button
                type="button"
                className="text-xs text-ink-3 hover:text-ink"
                onClick={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
              >
                بدون تاریخ
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
