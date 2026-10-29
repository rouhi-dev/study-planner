import { useState } from 'react';
import type { ReactNode } from 'react';
import { cx } from './ui';

export interface Series {
  key: string;
  label: string;
  /** Tailwind background class for the mark (e.g. `bg-primary`). */
  className: string;
}

export interface Group {
  label: string;
  sub?: string;
  values: Record<string, number>;
  highlight?: boolean;
}

/**
 * Vertical grouped bar chart. Thin bars with rounded data-ends, recessive
 * grid, a hover/focus tooltip per group, a legend for ≥2 series, and a
 * visually hidden data table for screen readers.
 */
export function BarChart({
  groups,
  series,
  format,
  height = 180,
  caption,
  reference,
}: {
  groups: Group[];
  series: Series[];
  format: (v: number) => string;
  height?: number;
  caption: string;
  /** Optional horizontal reference line (e.g. a target). */
  reference?: { value: number; label: string };
}) {
  const [hover, setHover] = useState<number | null>(null);
  const rawMax = Math.max(1, reference?.value ?? 0, ...groups.flatMap((g) => series.map((s) => g.values[s.key] ?? 0)));
  const step = niceStep(rawMax);
  const max = Math.ceil(rawMax / step) * step;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);

  return (
    <figure className="relative m-0">
      {series.length > 1 && <Legend series={series} />}
      <div className="flex gap-2 pt-3">
        <div className="relative w-12 shrink-0" style={{ height }} aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="num absolute end-0 -translate-y-1/2 text-[11px] text-ink-3" style={{ bottom: `${(t / max) * 100}%`, transform: 'translateY(50%)' }}>
              {format(t)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="relative" style={{ height }}>
            {ticks.map((t) => (
              <div key={t} aria-hidden className={cx('absolute inset-x-0 border-t', t === 0 ? 'border-line-strong' : 'border-line/60')} style={{ bottom: `${(t / max) * 100}%` }} />
            ))}
            {reference && (
              <div aria-hidden className="absolute inset-x-0 border-t border-dashed border-ink-3" style={{ bottom: `${(reference.value / max) * 100}%` }}>
                <span className="absolute -top-5 end-0 rounded bg-surface px-1 text-[11px] text-ink-3">{reference.label}</span>
              </div>
            )}
            <div className="absolute inset-0 flex items-end">
              {groups.map((g, i) => (
                <button
                  key={g.label + i}
                  type="button"
                  className="relative flex h-full flex-1 items-end justify-center gap-[2px] outline-none"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={`${g.label}: ${series.map((s) => `${s.label} ${format(g.values[s.key] ?? 0)}`).join('، ')}`}
                >
                  {hover === i && <span aria-hidden className="absolute inset-y-0 inset-x-1 rounded-md bg-subtle" />}
                  {series.map((s) => {
                    const v = g.values[s.key] ?? 0;
                    return (
                      <span
                        key={s.key}
                        aria-hidden
                        className={cx('relative w-full max-w-5 rounded-t-[4px]', s.className, g.highlight === false && 'opacity-60')}
                        style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 2 : 0 }}
                      />
                    );
                  })}
                  {hover === i && (
                    <span className="pointer-events-none absolute bottom-full z-10 mb-1 min-w-28 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-start text-xs shadow-pop" role="tooltip">
                      <span className="block font-semibold text-ink">{g.label}</span>
                      {series.map((s) => (
                        <span key={s.key} className="mt-0.5 flex items-center gap-1.5 text-ink-2">
                          <span className={cx('size-2 rounded-sm', s.className)} />
                          {s.label}: <span className="num font-medium text-ink">{format(g.values[s.key] ?? 0)}</span>
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-1.5 flex" aria-hidden>
            {groups.map((g, i) => (
              <span key={g.label + i} className={cx('flex-1 truncate text-center text-[11px]', g.highlight ? 'font-semibold text-ink' : 'text-ink-3')}>
                {g.label}
                {g.sub && <span className="block text-[10px] text-ink-3">{g.sub}</span>}
              </span>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
      <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">دوره</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g, i) => (
            <tr key={g.label + i}>
              <th scope="row">{g.label}</th>
              {series.map((s) => (
                <td key={s.key}>{format(g.values[s.key] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-4 text-xs text-ink-2">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className={cx('size-2.5 rounded-sm', s.className)} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/** Labelled horizontal bars — one row per item, value as text. */
export function BarList({
  rows,
  max,
  caption,
}: {
  rows: { key: string; label: ReactNode; value: number; display: string; className: string; note?: ReactNode }[];
  max?: number;
  caption: string;
}) {
  const m = Math.max(1, max ?? Math.max(...rows.map((r) => r.value), 0));
  return (
    <ul aria-label={caption} className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate text-ink-2">{r.label}</span>
            <span className="num shrink-0 font-medium text-ink">{r.display}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-sunken" aria-hidden>
            <div className={cx('h-full rounded-full', r.className)} style={{ width: `${(r.value / m) * 100}%`, minWidth: r.value > 0 ? 4 : 0 }} />
          </div>
          {r.note && <p className="mt-1 text-xs text-ink-3">{r.note}</p>}
        </li>
      ))}
    </ul>
  );
}

function niceStep(max: number) {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}
