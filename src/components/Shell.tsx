import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { IconType } from 'react-icons/lu';
import { faNum } from '../lib/dates';
import { focusElapsedMs, updateSettings } from '../lib/mutations';
import { hrefFor, type Route, type RouteName } from '../store/router';
import { useNow, useStore } from '../store/store';
import {
  IconBook,
  IconCalendarDays,
  IconCalendarRange,
  IconChart,
  IconClipboardCheck,
  IconDashboard,
  IconEllipsis,
  IconListChecks,
  IconMoon,
  IconPlus,
  IconSettings,
  IconSun,
  IconTimer,
  IconX,
} from './icons';
import { usePlanning } from './planning';
import { Button, cx, IconButton } from './ui';

interface NavItem {
  name: RouteName;
  label: string;
  icon: IconType;
}

export const NAV: NavItem[] = [
  { name: 'dashboard', label: 'داشبورد', icon: IconDashboard },
  { name: 'daily', label: 'برنامه روزانه', icon: IconCalendarDays },
  { name: 'weekly', label: 'برنامه هفتگی', icon: IconCalendarRange },
  { name: 'courses', label: 'درس‌ها', icon: IconBook },
  { name: 'tasks', label: 'وظایف و تکالیف', icon: IconListChecks },
  { name: 'focus', label: 'جلسات تمرکز', icon: IconTimer },
  { name: 'analytics', label: 'گزارش پیشرفت', icon: IconChart },
  { name: 'review', label: 'مرور هفتگی', icon: IconClipboardCheck },
  { name: 'app-settings', label: 'تنظیمات', icon: IconSettings },
];

const MOBILE_PRIMARY: RouteName[] = ['dashboard', 'daily', 'weekly', 'tasks'];

function isActive(item: RouteName, route: Route) {
  return item === route.name || (item === 'courses' && route.name === 'course');
}

function formatClock(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return faNum(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
}

function FocusPill({ className }: { className?: string }) {
  const { state } = useStore();
  const now = useNow(1000);
  if (state.focus.status === 'idle') return null;
  const course = state.courses.find((c) => c.id === state.focus.courseId);
  return (
    <a
      href={hrefFor('focus')}
      className={cx(
        'flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] shadow-card hover:border-line-strong',
        className,
      )}
    >
      <span className={cx('size-2 rounded-full', state.focus.status === 'running' ? 'animate-pulse bg-success' : 'bg-warn')} />
      <span className="truncate text-ink-2">{state.focus.status === 'running' ? 'در حال تمرکز' : 'متوقف موقت'}</span>
      <span className="num ms-auto font-semibold text-ink ltr">{formatClock(focusElapsedMs(state, now.getTime()))}</span>
      <span className="sr-only">{course?.name}</span>
    </a>
  );
}

function ThemeToggle() {
  const { state, update } = useStore();
  const theme = state.settings.theme;
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return (
    <IconButton
      label={dark ? 'پوستهٔ روشن' : 'پوستهٔ تیره'}
      icon={dark ? IconSun : IconMoon}
      onClick={() => update((s) => updateSettings(s, { theme: dark ? 'light' : 'dark' }))}
    />
  );
}

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const { state, sync } = useStore();
  const { newTask } = usePlanning();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => setMoreOpen(false), [route.name, route.param]);

  // Keyboard shortcut: N → new task (outside text fields).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (t.closest('input, textarea, select, [contenteditable], [role="dialog"]')) return;
      if (e.key === 'n' || e.key === 'N' || e.key === 'د') {
        e.preventDefault();
        newTask();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [newTask]);

  return (
    <div className="min-h-screen lg:ps-60">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[70] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
        رفتن به محتوای اصلی
      </a>

      {/* Desktop sidebar (on the right in RTL) */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-60 flex-col border-e border-line bg-surface lg:flex">
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
          <div className="grid size-8 place-items-center rounded-lg bg-primary text-on-primary">
            <IconCalendarRange aria-hidden className="size-[18px]" />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-bold leading-5">برنامه‌ریز مطالعه</p>
            <p className="truncate text-[11px] text-ink-3">{state.settings.university || 'نیم‌سال جاری'}</p>
          </div>
        </div>
        <div className="px-3 pb-3">
          <Button variant="primary" icon={IconPlus} className="w-full" onClick={() => newTask()} title="میان‌بر: N">
            کار جدید
          </Button>
        </div>
        <nav aria-label="ناوبری اصلی" className="scroll-thin flex-1 overflow-y-auto px-3">
          <ul className="flex flex-col gap-0.5">
            {NAV.map((item) => {
              const active = isActive(item.name, route);
              const Icon = item.icon;
              return (
                <li key={item.name}>
                  <a
                    href={hrefFor(item.name)}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'flex h-9 items-center gap-3 rounded-lg px-3 text-[14px] transition-colors',
                      active ? 'bg-primary-soft font-semibold text-primary' : 'text-ink-2 hover:bg-subtle hover:text-ink',
                    )}
                  >
                    <Icon aria-hidden className="size-[18px] shrink-0" />
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="flex flex-col gap-2 border-t border-line p-3">
          <FocusPill />
          <div className="flex items-center justify-between gap-2 ps-2">
            <span className="flex items-center gap-1.5 text-[11px] text-ink-3" title="محل ذخیرهٔ داده‌ها">
              <span className={cx('size-1.5 rounded-full', sync === 'error' || sync === 'auth' ? 'bg-danger' : 'bg-success')} />
              {sync === 'cloud' ? 'ذخیره در حساب شما' : sync === 'auth' ? 'ورود دوباره لازم است' : sync === 'error' ? 'همگام‌سازی ناموفق' : 'ذخیره در این مرورگر'}
            </span>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/90 px-4 backdrop-blur lg:hidden">
        <div className="grid size-7 place-items-center rounded-md bg-primary text-on-primary">
          <IconCalendarRange aria-hidden className="size-4" />
        </div>
        <p className="flex-1 truncate text-[15px] font-bold">برنامه‌ریز مطالعه</p>
        <ThemeToggle />
        <IconButton label="کار جدید" icon={IconPlus} onClick={() => newTask()} className="bg-primary text-on-primary hover:bg-primary-hover hover:text-on-primary" />
      </header>

      <main id="main" className="mx-auto w-full max-w-[1280px] px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pt-8 lg:pb-12">
        {children}
      </main>

      {/* Mobile bottom navigation */}
      <FocusPill className="fixed inset-x-4 bottom-[72px] z-30 lg:hidden" />
      <nav aria-label="ناوبری اصلی" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="grid grid-cols-5">
          {NAV.filter((n) => MOBILE_PRIMARY.includes(n.name)).map((item) => {
            const active = isActive(item.name, route);
            const Icon = item.icon;
            return (
              <li key={item.name}>
                <a
                  href={hrefFor(item.name)}
                  aria-current={active ? 'page' : undefined}
                  className={cx('flex h-16 flex-col items-center justify-center gap-1 text-[11px]', active ? 'font-semibold text-primary' : 'text-ink-3')}
                >
                  <Icon aria-hidden className="size-5" />
                  {item.label.replace('برنامه ', '').replace(' و تکالیف', '')}
                </a>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(true)}
              className={cx(
                'flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px]',
                !MOBILE_PRIMARY.includes(route.name) ? 'font-semibold text-primary' : 'text-ink-3',
              )}
            >
              <IconEllipsis aria-hidden className="size-5" />
              بیشتر
            </button>
          </li>
        </ul>
      </nav>
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="بخش‌های دیگر">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMoreOpen(false)} aria-hidden />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-line bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-pop">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold">بخش‌های دیگر</p>
              <IconButton label="بستن" icon={IconX} onClick={() => setMoreOpen(false)} />
            </div>
            <ul className="grid grid-cols-2 gap-2">
              {NAV.filter((n) => !MOBILE_PRIMARY.includes(n.name)).map((item) => {
                const Icon = item.icon;
                const active = isActive(item.name, route);
                return (
                  <li key={item.name}>
                    <a
                      href={hrefFor(item.name)}
                      className={cx(
                        'flex h-12 items-center gap-3 rounded-lg border px-3 text-sm',
                        active ? 'border-primary bg-primary-soft text-primary' : 'border-line text-ink-2',
                      )}
                    >
                      <Icon aria-hidden className="size-[18px]" />
                      {item.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
