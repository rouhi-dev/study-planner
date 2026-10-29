import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import type { IconType } from 'react-icons/lu';
import { COURSE_COLOR_CLASSES } from '../lib/labels';
import type { Course } from '../lib/types';
import { IconAlert, IconCheck, IconCircleCheck, IconInfo, IconX } from './icons';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

// ---- Button ------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover shadow-card',
  secondary: 'bg-surface text-ink border border-line hover:border-line-strong hover:bg-subtle shadow-card',
  ghost: 'text-ink-2 hover:bg-subtle hover:text-ink',
  danger: 'bg-danger-soft text-danger hover:brightness-95',
  soft: 'bg-primary-soft text-primary hover:brightness-95',
};
const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-[13px] gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-[15px] gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconType;
}

export function Button({ variant = 'secondary', size = 'md', icon: Icon, className, children, type, ...rest }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors duration-150 disabled:opacity-50',
        BUTTON_VARIANT[variant],
        BUTTON_SIZE[size],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon aria-hidden className={size === 'sm' ? 'size-3.5' : 'size-4'} />}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  icon: Icon,
  className,
  size = 'md',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: IconType; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-subtle hover:text-ink disabled:opacity-40',
        size === 'sm' ? 'size-7' : 'size-9',
        className,
      )}
      {...rest}
    >
      <Icon aria-hidden className={size === 'sm' ? 'size-3.5' : 'size-[18px]'} />
    </button>
  );
}

// ---- Card ----------------------------------------------------------------------

export function Card({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
  ...rest
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
} & Omit<HTMLAttributes<HTMLElement>, 'title' | 'ref'>) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      className={cx('rounded-card border border-line bg-surface shadow-card', className)}
      {...rest}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            {title && (
              <h2 id={headingId} className="text-[15px] font-semibold text-ink">
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-0.5 text-[13px] text-ink-3">{subtitle}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-1">{action}</div>}
        </header>
      )}
      <div className={cx('p-5', title || action ? 'pt-3' : '', bodyClassName)}>{children}</div>
    </section>
  );
}

// ---- Badge -----------------------------------------------------------------------

type Tone = 'neutral' | 'primary' | 'success' | 'warn' | 'danger';
const BADGE_TONE: Record<Tone, string> = {
  neutral: 'bg-subtle text-ink-2',
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
};

export function Badge({ tone = 'neutral', children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap', BADGE_TONE[tone], className)}
    >
      {children}
    </span>
  );
}

export function DemoBadge() {
  return (
    <Badge tone="neutral" title="دادهٔ نمونه؛ قابل ویرایش یا حذف">
      نمونه
    </Badge>
  );
}

// ---- Course markers ------------------------------------------------------------

export function CourseDot({ course, className }: { course?: Course; className?: string }) {
  if (!course) return null;
  return <span aria-hidden className={cx('inline-block size-2 shrink-0 rounded-full', COURSE_COLOR_CLASSES[course.color].dot, className)} />;
}

export function CourseTag({ course, short = true }: { course?: Course; short?: boolean }) {
  if (!course) return <span className="text-xs text-ink-3">بدون درس</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2">
      <CourseDot course={course} />
      {short ? course.shortName : course.name}
    </span>
  );
}

// ---- Progress --------------------------------------------------------------------

export function ProgressBar({
  value,
  max,
  label,
  barClassName = 'bg-primary',
  size = 'md',
  over = false,
  className,
}: {
  value: number;
  max: number;
  label: string;
  barClassName?: string;
  size?: 'sm' | 'md';
  over?: boolean;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(value)}
      className={cx('w-full overflow-hidden rounded-full bg-sunken', size === 'sm' ? 'h-1.5' : 'h-2', className)}
    >
      <div
        className={cx('h-full rounded-full transition-[width] duration-300', over ? 'bg-warn' : barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ---- Form fields -----------------------------------------------------------------

const CONTROL =
  'w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3 transition-colors hover:border-line-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60';

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input aria-invalid={invalid || undefined} className={cx(CONTROL, 'h-9', invalid && 'border-danger', className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(CONTROL, 'min-h-20 py-2 leading-6', className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(CONTROL, 'h-9 cursor-pointer pe-8', className)} {...rest}>
      {children}
    </select>
  );
}

/** Round completion checkbox used for tasks. */
export function TaskCheck({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors',
        checked ? 'border-success bg-success text-surface' : 'border-line-strong hover:border-success',
      )}
    >
      {checked && <IconCheck aria-hidden className="size-3" strokeWidth={3} />}
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line bg-subtle p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-md px-2.5 font-medium transition-colors',
            size === 'sm' ? 'h-7 text-xs' : 'h-8 text-[13px]',
            o.value === value ? 'bg-surface text-ink shadow-card' : 'text-ink-3 hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---- Modal -----------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () =>
      Array.from(
        el?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [],
      ).filter((x) => !x.hasAttribute('disabled'));
    const first = focusables().find((x) => x.dataset.autofocus !== undefined) ?? focusables()[1] ?? focusables()[0];
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab') {
        const list = focusables();
        if (list.length === 0) return;
        const a = list[0]!;
        const b = list[list.length - 1]!;
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          b.focus();
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          'relative flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-pop sm:rounded-xl',
          size === 'sm' ? 'sm:max-w-md' : size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-xl',
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>}
          </div>
          <IconButton label="بستن" icon={IconX} onClick={onClose} className="-me-2 -mt-1" />
        </header>
        <div className="scroll-thin overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
  danger = true,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  danger?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            data-autofocus
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-7 text-ink-2">{body}</div>
    </Modal>
  );
}

// ---- Empty state & callouts ----------------------------------------------------

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  compact,
}: {
  icon: IconType;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cx('flex flex-col items-center text-center', compact ? 'py-6' : 'py-12')}>
      <div className="mb-3 grid size-10 place-items-center rounded-full bg-subtle text-ink-3">
        <Icon aria-hidden className="size-5" />
      </div>
      <p className="font-medium text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-[13px] leading-6 text-ink-3">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Callout({
  tone = 'neutral',
  icon,
  title,
  children,
  action,
  className,
}: {
  tone?: Tone;
  icon?: IconType;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const Icon = icon ?? (tone === 'warn' || tone === 'danger' ? IconAlert : IconInfo);
  return (
    <div
      role={tone === 'warn' || tone === 'danger' ? 'status' : undefined}
      className={cx('flex flex-col gap-2 rounded-lg px-4 py-3 text-[13px] leading-6 sm:flex-row sm:items-start sm:gap-3', BADGE_TONE[tone], className)}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Icon aria-hidden className="mt-1 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className="opacity-90">{children}</div>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2 ps-7 sm:ps-0">{action}</div>}
    </div>
  );
}

/** A metric with a plain-language explanation of what it measures. */
export function Metric({
  label,
  value,
  sub,
  explain,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  explain: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <p className="text-[13px] text-ink-3">{label}</p>
      <p className="num mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-2">{sub}</p>}
      <p className="mt-2 border-t border-line pt-2 text-xs leading-5 text-ink-3">{explain}</p>
    </div>
  );
}

// ---- Toasts ------------------------------------------------------------------------

interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
  action?: { label: string; run: () => void };
}
const ToastContext = createContext<(t: Omit<Toast, 'id'>) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), t.action ? 6000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-md items-center gap-3 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm shadow-pop"
          >
            {t.tone === 'success' ? (
              <IconCircleCheck aria-hidden className="size-4 shrink-0 text-success" />
            ) : t.tone === 'error' ? (
              <IconAlert aria-hidden className="size-4 shrink-0 text-danger" />
            ) : (
              <IconInfo aria-hidden className="size-4 shrink-0 text-primary" />
            )}
            <span className="text-ink">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="ms-1 font-semibold text-primary hover:underline"
                onClick={() => {
                  t.action!.run();
                  setToasts((list) => list.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-ink-3">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, count, action }: { children: ReactNode; count?: number; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
        {children}
        {count !== undefined && <span className="num text-ink-3">{count.toLocaleString('fa-IR')}</span>}
      </h3>
      {action}
    </div>
  );
}
