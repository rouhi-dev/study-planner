import { useState } from 'react';
import { CourseCard } from '../components/CourseCard';
import {
  IconBrain,
  IconCalendarClock,
  IconCalendarDays,
  IconCircleCheck,
  IconFlag,
  IconPlay,
  IconSparkles,
} from '../components/icons';
import { ProposalDialog, usePlanning } from '../components/planning';
import { QuickAdd } from '../components/QuickAdd';
import { TaskRow } from '../components/TaskRow';
import { Badge, Button, Callout, Card, cx, EmptyState, ProgressBar, SectionTitle } from '../components/ui';
import { dayLoad, dueCards, semesterInfo, upcomingDeadlines, weekLoad } from '../lib/analytics';
import {
  diffDays,
  faInt,
  faPercent,
  formatDayMonth,
  formatDuration,
  formatDurationShort,
  formatLongDate,
  greeting,
  relativeDay,
  startOfWeek,
  todayISO,
  WEEKDAYS,
  weekdayOf,
} from '../lib/dates';
import { COURSE_COLOR_CLASSES, PRIORITY_LABEL, PRIORITY_ORDER, PRIORITY_RANK } from '../lib/labels';
import { missedTasks, proposeWeek, tasksOn, type WeekPlan } from '../lib/schedule';
import { hrefFor, navigate } from '../store/router';
import { useNow, useStore } from '../store/store';
import { setHandoff } from '../store/ui-state';

export function DashboardPage() {
  const { state } = useStore();
  const now = useNow();
  const today = todayISO(now);
  const { focusOn, newTask } = usePlanning();
  const [plan, setPlan] = useState<WeekPlan | null>(null);

  const sem = semesterInfo(state.settings, today);
  const load = dayLoad(state, today);
  const todays = tasksOn(state.tasks, today).sort(
    (a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || (a.startTime ?? '99').localeCompare(b.startTime ?? '99'),
  );
  const open = todays.filter((t) => t.status !== 'done');
  const done = todays.filter((t) => t.status === 'done');
  const week = weekLoad(state, startOfWeek(today));
  const overloadedDays = week.filter((d) => d.date >= today && d.overloaded);
  const missed = missedTasks(state.tasks, today);
  const deadlines = upcomingDeadlines(state.tasks, today, 14).slice(0, 5);
  const due = dueCards(state, today);
  const courses = [...state.courses].sort((a, b) => b.weight - a.weight);
  const nextTask = open.find((t) => !t.startTime || t.startTime >= `${String(now.getHours()).padStart(2, '0')}:00`) ?? open[0];

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <section className="flex flex-col gap-5 rounded-card border border-line bg-surface p-5 shadow-card sm:p-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-ink-3">{formatLongDate(today)}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-[28px]">
            {greeting(now)}
            {state.settings.name ? `، ${state.settings.name}` : ''}
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            {sem.status === 'during' ? (
              <>
                هفتهٔ <span className="num font-semibold text-ink">{faInt(sem.week)}</span> از {faInt(sem.totalWeeks)}،{' '}
                {sem.weeksLeftAfterCurrent > 0 ? `${faInt(sem.weeksLeftAfterCurrent)} هفتهٔ کامل تا پایان ترم` : 'هفتهٔ آخر ترم'}
              </>
            ) : sem.status === 'before' ? (
              'ترم هنوز شروع نشده است.'
            ) : (
              'ترم به پایان رسیده است.'
            )}
            {!state.settings.name && (
              <a href={hrefFor('app-settings')} className="ms-2 text-[13px] text-primary hover:underline">
                افزودن نام
              </a>
            )}
          </p>
          <div className="mt-4 max-w-xl">
            <ProgressBar value={sem.elapsed * 100} max={100} label="پیشرفت زمانی ترم" />
            <div className="mt-1.5 flex justify-between text-xs text-ink-3">
              <span>{faPercent(sem.elapsed)} از زمان ترم گذشته</span>
              <span>
                پایان ترم: {formatDayMonth(sem.endDate)} ({faInt(sem.daysLeft)} روز)
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col lg:items-stretch">
          <Button variant="primary" size="lg" icon={IconPlay} onClick={() => (nextTask ? focusOn(nextTask) : navigate('focus'))}>
            شروع جلسهٔ تمرکز
          </Button>
          {nextTask && <p className="max-w-64 truncate text-center text-xs text-ink-3">پیشنهاد: {nextTask.title}</p>}
        </div>
      </section>

      {state.meta.demo && (
        <Callout
          tone="neutral"
          icon={IconSparkles}
          title="داده‌های نمونه"
          action={
            <a href={hrefFor('app-settings')} className="text-[13px] font-semibold text-primary hover:underline">
              مدیریت داده‌ها
            </a>
          }
        >
          درس‌ها، برنامه و پیشرفتِ نمایش‌داده‌شده نمونه‌اند تا امکانات برنامه را ببینید؛ فعالیت واقعی شما نیستند. همه قابل ویرایش‌اند و از تنظیمات
          می‌توانید با برنامهٔ خالی شروع کنید.
        </Callout>
      )}

      {(load.overloaded || overloadedDays.length > 0) && (
        <Callout
          tone="warn"
          title="برنامه از زمان در دسترس بیشتر است"
          action={
            <Button size="sm" variant="secondary" onClick={() => navigate(load.overloaded ? 'daily' : 'weekly')}>
              بررسی
            </Button>
          }
        >
          {load.overloaded
            ? `برای امروز ${formatDuration(load.planned)} برنامه دارید اما ${formatDuration(load.available)} زمان مطالعه در دسترس است.`
            : `${faInt(overloadedDays.length)} روز از این هفته بیش از زمان در دسترس برنامه دارد: ${overloadedDays.map((d) => WEEKDAYS[weekdayOf(d.date)]).join('، ')}.`}
        </Callout>
      )}

      {missed.length > 0 && (
        <Callout
          tone="neutral"
          icon={IconCalendarClock}
          title={`${faInt(missed.length)} کار از روزهای قبل انجام نشده`}
          action={
            <Button size="sm" variant="secondary" onClick={() => setPlan(proposeWeek(state, startOfWeek(today), now, { addPractice: false, currentWeek: sem.week }))}>
              پیشنهاد زمان جدید
            </Button>
          }
        >
          همه‌چیز را جلو نمی‌اندازیم؛ برای هر کار در روزهای باقی‌ماندهٔ این هفته، با رعایت سقف روزانه، زمان پیشنهاد می‌شود و شما تأیید می‌کنید.
        </Callout>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Today */}
          <Card
            title="امروز"
            subtitle={`${WEEKDAYS[weekdayOf(today)]} ${formatDayMonth(today)}`}
            action={
              <a href={hrefFor('daily')} className="text-[13px] font-medium text-primary hover:underline">
                برنامهٔ کامل روز
              </a>
            }
          >
            <div className="grid gap-4 rounded-lg bg-subtle p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-ink-3">انجام‌شده (جلسات ثبت‌شده)</p>
                <p className="num mt-0.5 text-xl font-semibold">{formatDurationShort(load.actual)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-3">برنامه‌ریزی‌شده</p>
                <p className={cx('num mt-0.5 text-xl font-semibold', load.overloaded && 'text-warn')}>{formatDurationShort(load.planned)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-3">در دسترس امروز</p>
                <p className="num mt-0.5 text-xl font-semibold">{formatDurationShort(load.available)}</p>
              </div>
              <div className="sm:col-span-3">
                <ProgressBar value={load.actual} max={Math.max(load.planned, load.available, 1)} label="زمان مطالعهٔ انجام‌شده نسبت به برنامه" barClassName="bg-success" />
                <p className="mt-1.5 text-xs text-ink-3">
                  سقف روزانه {formatDuration(load.budget)}؛ «در دسترس» یعنی همین سقف، محدود به زمان آزادِ بیرون از کار و کلاس.
                </p>
              </div>
            </div>

            <QuickAdd date={today} className="mt-4" />

            <div className="mt-4 flex flex-col gap-4">
              {todays.length === 0 ? (
                <EmptyState
                  compact
                  icon={IconCalendarDays}
                  title="برای امروز کاری برنامه‌ریزی نشده"
                  body="یک کار کوتاه اضافه کنید یا از برنامهٔ هفتگی کارها را به امروز بکشید."
                  action={
                    <Button variant="soft" onClick={() => newTask({ scheduledDate: today })}>
                      افزودن کار برای امروز
                    </Button>
                  }
                />
              ) : (
                <>
                  {PRIORITY_ORDER.map((p) => {
                    const list = open.filter((t) => t.priority === p);
                    if (list.length === 0) return null;
                    return (
                      <div key={p}>
                        <SectionTitle count={list.length}>
                          {p === 'high' && <IconFlag aria-hidden className="size-3.5 text-danger" />}
                          اولویت {PRIORITY_LABEL[p]}
                        </SectionTitle>
                        <div className="-mx-2 flex flex-col">
                          {list.map((t) => (
                            <TaskRow key={t.id} task={t} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {open.length === 0 && (
                    <div className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2.5 text-sm text-success">
                      <IconCircleCheck aria-hidden className="size-4" />
                      کارهای امروز تمام شد. اگر انرژی دارید، یک کارت مرور فاصله‌دار را مرور کنید.
                    </div>
                  )}
                  {done.length > 0 && (
                    <details className="group">
                      <summary className="cursor-pointer list-none text-[13px] font-semibold text-ink-3 hover:text-ink">
                        انجام‌شده ({faInt(done.length)})
                      </summary>
                      <div className="-mx-2 mt-1 flex flex-col">
                        {done.map((t) => (
                          <TaskRow key={t.id} task={t} compact />
                        ))}
                      </div>
                    </details>
                  )}
                </>
              )}
            </div>
          </Card>

          {/* Compact week */}
          <Card
            title="این هفته"
            subtitle="ساعت‌های برنامه‌ریزی‌شده نسبت به زمان در دسترس هر روز"
            action={
              <a href={hrefFor('weekly')} className="text-[13px] font-medium text-primary hover:underline">
                برنامهٔ هفتگی
              </a>
            }
          >
            <ol className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {week.map((d) => {
                const isToday = d.date === today;
                const dayTasks = tasksOn(state.tasks, d.date);
                return (
                  <li key={d.date}>
                    <button
                      type="button"
                      onClick={() => {
                        setHandoff({ dailyDate: d.date });
                        navigate('daily');
                      }}
                      aria-label={`${WEEKDAYS[weekdayOf(d.date)]} ${formatDayMonth(d.date)}: ${formatDuration(d.planned)} برنامه`}
                      className={cx(
                        'flex h-full w-full flex-col items-stretch rounded-lg border p-1.5 text-center transition-colors hover:border-line-strong sm:p-2',
                        isToday ? 'border-primary bg-primary-soft/60' : 'border-line',
                        d.date < today && 'opacity-70',
                      )}
                    >
                      <span className={cx('text-xs', isToday ? 'font-semibold text-primary' : 'text-ink-3')}>
                        <span className="sm:hidden">{WEEKDAYS[weekdayOf(d.date)]!.slice(0, 1)}</span>
                        <span className="hidden sm:inline">{WEEKDAYS[weekdayOf(d.date)]}</span>
                      </span>
                      <span className="num text-[13px] font-semibold">{formatDayMonth(d.date).split(' ')[0]}</span>
                      <span className="mt-2 flex h-14 items-end justify-center gap-1">
                        <span
                          className={cx('w-2.5 rounded-sm', d.overloaded ? 'bg-warn' : 'bg-primary/70')}
                          style={{ height: `${Math.min(100, (d.planned / Math.max(d.budget, 1)) * 100)}%` }}
                          title="برنامه‌ریزی‌شده"
                        />
                        <span className="w-2.5 rounded-sm bg-success" style={{ height: `${Math.min(100, (d.actual / Math.max(d.budget, 1)) * 100)}%` }} title="انجام‌شده" />
                      </span>
                      <span className="num mt-1 text-[11px] text-ink-3">{formatDurationShort(d.planned)}</span>
                      <span className="mt-1 hidden flex-wrap justify-center gap-0.5 sm:flex">
                        {dayTasks.slice(0, 6).map((t) => {
                          const c = state.courses.find((x) => x.id === t.courseId);
                          return (
                            <span
                              key={t.id}
                              className={cx('size-1.5 rounded-full', c ? COURSE_COLOR_CLASSES[c.color].dot : 'bg-ink-3', t.status === 'done' && 'opacity-40')}
                            />
                          );
                        })}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-3">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-primary/70" /> برنامه‌ریزی‌شده
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-success" /> انجام‌شده
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-warn" /> بیش از زمان در دسترس
              </span>
              <span>ارتفاع هر ستون نسبت به سقف روزانه است.</span>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="sr-only">درس‌ها</h2>
          {courses.map((c, i) => (
            <CourseCard key={c.id} course={c} rank={i} />
          ))}

          <Card title="مرور فاصله‌دار" subtitle="مفاهیم دشوار در فاصله‌های افزایشی">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary">
                  <IconBrain aria-hidden className="size-5" />
                </div>
                <div>
                  <p className="num text-lg font-semibold">{faInt(due.length)} کارت</p>
                  <p className="text-xs text-ink-3">{due.length ? 'برای امروز آماده مرور' : 'امروز مروری لازم نیست'}</p>
                </div>
              </div>
              <Button
                variant={due.length ? 'soft' : 'ghost'}
                size="sm"
                onClick={() => {
                  setHandoff({ tasksTab: 'review' });
                  navigate('tasks');
                }}
              >
                {due.length ? 'شروع مرور' : 'مدیریت کارت‌ها'}
              </Button>
            </div>
          </Card>

          <Card
            title="مهلت‌های نزدیک"
            subtitle="دو هفتهٔ آینده"
            action={
              <a href={hrefFor('tasks')} className="text-[13px] font-medium text-primary hover:underline">
                همه
              </a>
            }
          >
            {deadlines.length === 0 ? (
              <p className="text-[13px] text-ink-3">در دو هفتهٔ آینده مهلتی ثبت نشده است.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {deadlines.map((t) => {
                  const c = state.courses.find((x) => x.id === t.courseId);
                  const days = diffDays(t.deadline!, today);
                  return (
                    <li key={t.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span className={cx('h-8 w-1 rounded-full', c ? COURSE_COLOR_CLASSES[c.color].bar : 'bg-ink-3')} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{t.title}</p>
                        <p className="text-xs text-ink-3">{c?.shortName}</p>
                      </div>
                      <Badge tone={days <= 3 ? 'warn' : 'neutral'}>{relativeDay(t.deadline!, today)}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ProposalDialog
        open={!!plan}
        plan={plan}
        onClose={() => setPlan(null)}
        title="پیشنهاد زمان برای کارهای عقب‌افتاده"
        description="روزهای باقی‌ماندهٔ این هفته، بدون عبور از سقف روزانه و بدون هم‌پوشانی با کار و کلاس."
      />
    </div>
  );
}
