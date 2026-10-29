import { useState } from 'react';
import { DatePicker } from '../components/DatePicker';
import { IconCalendarClock, IconCalendarDays, IconChevronLeft, IconChevronRight, IconCoffee, IconPlus, IconTimer } from '../components/icons';
import { ProposalDialog, usePlanning } from '../components/planning';
import { QuickAdd } from '../components/QuickAdd';
import { TaskRow } from '../components/TaskRow';
import { Badge, Button, Callout, Card, cx, EmptyState, IconButton, PageHeader, ProgressBar, SectionTitle } from '../components/ui';
import { dayLoad, semesterInfo, weekNumberOf } from '../lib/analytics';
import {
  addDays,
  faInt,
  formatDuration,
  formatDurationShort,
  formatLongDate,
  formatTime,
  fromMin,
  relativeDay,
  startOfWeek,
  todayISO,
  toMin,
} from '../lib/dates';
import { COMMITMENT_KIND_LABEL, COURSE_COLOR_CLASSES, PRIORITY_RANK, TASK_TYPE_LABEL } from '../lib/labels';
import { commitmentsOn, dayWindow, freeIntervals, missedTasks, proposeWeek, tasksOn, busyBlocks, type WeekPlan } from '../lib/schedule';
import type { ISODate } from '../lib/types';
import { useNow, useStore } from '../store/store';
import { takeHandoff } from '../store/ui-state';

export function DailyPage() {
  const { state } = useStore();
  const now = useNow();
  const today = todayISO(now);
  const [date, setDate] = useState<ISODate>(() => takeHandoff('dailyDate') ?? today);
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const { newTask } = usePlanning();

  const load = dayLoad(state, date);
  const tasks = tasksOn(state.tasks, date).sort(
    (a, b) =>
      (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) ||
      (a.startTime ?? '99').localeCompare(b.startTime ?? '99') ||
      PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority],
  );
  const missed = date === today ? missedTasks(state.tasks, today) : [];
  const unfinishedPast = date < today ? tasks.filter((t) => t.status !== 'done') : [];
  const week = weekNumberOf(state.settings, date);
  const sem = semesterInfo(state.settings, today);
  const sessions = state.sessions.filter((s) => s.date === date).sort((a, b) => a.startedAt - b.startedAt);
  const remainingOk = load.planned <= load.available;

  // Timeline: commitments + timed tasks + free gaps.
  const win = dayWindow(state.settings);
  const blocks = busyBlocks(state, date);
  const gaps = freeIntervals(win, blocks).filter((g) => g.end - g.start >= 30);
  const timeline = [
    ...blocks.map((b) => ({ kind: b.source, start: b.start, end: b.end, id: b.id, title: b.title })),
    ...gaps.map((g) => ({ kind: 'free' as const, start: g.start, end: g.end, id: `g${g.start}`, title: '' })),
  ].sort((a, b) => a.start - b.start);

  const grouped = state.courses
    .map((c) => ({ course: c, list: tasks.filter((t) => t.courseId === c.id) }))
    .filter((g) => g.list.length > 0)
    .sort((a, b) => b.course.weight - a.course.weight);

  return (
    <div>
      <PageHeader
        title="برنامه روزانه"
        subtitle={
          <span>
            {formatLongDate(date)}
            {week >= 1 && week <= state.settings.semesterWeeks && <>، هفتهٔ {faInt(week)} ترم</>}
            {date !== today && <>، {relativeDay(date, today)}</>}
          </span>
        }
        actions={
          <>
            <div className="flex items-center gap-1">
              <IconButton label="روز قبل" icon={IconChevronRight} onClick={() => setDate(addDays(date, -1))} />
              <div className="w-56">
                <DatePicker value={date} onChange={(v) => v && setDate(v)} />
              </div>
              <IconButton label="روز بعد" icon={IconChevronLeft} onClick={() => setDate(addDays(date, 1))} />
            </div>
            {date !== today && (
              <Button variant="ghost" onClick={() => setDate(today)}>
                امروز
              </Button>
            )}
            <Button variant="primary" icon={IconPlus} onClick={() => newTask({ scheduledDate: date })}>
              کار برای این روز
            </Button>
          </>
        }
      />

      {/* Budget summary */}
      <section aria-label="بودجهٔ زمانی روز" className="mb-6 grid gap-3 sm:grid-cols-4">
        {[
          { label: 'سقف مطالعه', value: formatDurationShort(load.budget), hint: 'قابل تغییر در تنظیمات' },
          { label: 'در دسترس', value: formatDurationShort(load.available), hint: 'سقف، محدود به زمان آزاد' },
          { label: 'برنامه‌ریزی‌شده', value: formatDurationShort(load.planned), hint: 'جمع زمان تخمینی کارهای روز', warn: !remainingOk },
          { label: 'انجام‌شده', value: formatDurationShort(load.actual), hint: 'از جلسات تمرکز ثبت‌شده' },
        ].map((m) => (
          <div key={m.label} className="rounded-card border border-line bg-surface p-4 shadow-card">
            <p className="text-[13px] text-ink-3">{m.label}</p>
            <p className={cx('num mt-0.5 text-2xl font-semibold', m.warn && 'text-warn')}>{m.value}</p>
            <p className="mt-1 text-xs text-ink-3">{m.hint}</p>
          </div>
        ))}
        <div className="sm:col-span-4">
          <ProgressBar value={load.planned} max={Math.max(load.available, 1)} over={!remainingOk} label="برنامهٔ روز نسبت به زمان در دسترس" />
        </div>
      </section>

      {!remainingOk && (
        <Callout tone="warn" className="mb-6" title="برنامهٔ این روز واقع‌بینانه نیست">
          {formatDuration(load.planned - load.available)} بیشتر از زمان در دسترس برنامه دارید. یکی از کارهای کم‌اولویت‌تر را با دکمهٔ{' '}
          <IconCalendarClock aria-label="زمان‌بندی دوباره" className="inline size-3.5" /> به روز دیگری منتقل کنید.
        </Callout>
      )}

      {missed.length > 0 && (
        <Card
          className="mb-6"
          title="عقب‌افتاده از روزهای قبل"
          subtitle="هر کار جداگانه جابه‌جا می‌شود؛ بقیهٔ برنامه ثابت می‌ماند."
          action={
            <Button size="sm" variant="soft" onClick={() => setPlan(proposeWeek(state, startOfWeek(today), now, { addPractice: false, currentWeek: sem.week }))}>
              پیشنهاد برای همه
            </Button>
          }
        >
          <div className="-mx-2 flex flex-col">
            {missed.map((t) => (
              <TaskRow key={t.id} task={t} showDate />
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card title="کارهای روز" subtitle="بر اساس درس">
            {date >= today && <QuickAdd date={date} className="mb-4" />}
            {unfinishedPast.length > 0 && (
              <Callout tone="neutral" className="mb-4" icon={IconCalendarClock}>
                {faInt(unfinishedPast.length)} کار این روز ناتمام ماند. از دکمهٔ زمان‌بندی دوباره کنار هر کار استفاده کنید.
              </Callout>
            )}
            {tasks.length === 0 ? (
              <EmptyState
                icon={IconCalendarDays}
                title="برای این روز کاری نیست"
                body="کارها را اینجا اضافه کنید یا در برنامهٔ هفتگی به این روز بکشید."
                compact
              />
            ) : (
              <div className="flex flex-col gap-5">
                {grouped.map(({ course, list }) => {
                  const total = list.reduce((s, t) => s + t.estimateMin, 0);
                  const done = list.filter((t) => t.status === 'done').length;
                  return (
                    <div key={course.id}>
                      <SectionTitle
                        action={
                          <span className="num text-xs text-ink-3">
                            {faInt(done)}/{faInt(list.length)} انجام‌شده، {formatDuration(total)}
                          </span>
                        }
                      >
                        <span className={cx('size-2 rounded-full', COURSE_COLOR_CLASSES[course.color].dot)} />
                        {course.name}
                      </SectionTitle>
                      <div className="-mx-2 flex flex-col">
                        {list.map((t) => (
                          <TaskRow key={t.id} task={t} showCourse={false} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title="جلسات ثبت‌شده" subtitle="زمان واقعی مطالعه در این روز">
            {sessions.length === 0 ? (
              <p className="text-[13px] text-ink-3">هنوز جلسه‌ای برای این روز ثبت نشده است. زمان واقعی از صفحهٔ «جلسات تمرکز» ثبت می‌شود.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {sessions.map((s) => {
                  const c = state.courses.find((x) => x.id === s.courseId);
                  const t = state.tasks.find((x) => x.id === s.taskId);
                  return (
                    <li key={s.id} className="flex items-start gap-3 py-2.5">
                      <IconTimer aria-hidden className={cx('mt-1 size-4', c ? COURSE_COLOR_CLASSES[c.color].text : 'text-ink-3')} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium">{t?.title ?? `مطالعهٔ آزاد ${c?.shortName ?? ''}`}</p>
                        {s.reflection.learned && <p className="mt-0.5 text-xs text-ink-3">آموخته: {s.reflection.learned}</p>}
                      </div>
                      <span className="num text-xs text-ink-2">{formatDuration(s.durationMin)}</span>
                      {s.demo && <Badge>نمونه</Badge>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <Card title="خط زمانی روز" subtitle={`از ${formatTime(state.settings.dayStart)} تا ${formatTime(state.settings.dayEnd)}`}>
          <ol className="relative flex flex-col gap-1.5">
            {timeline.map((b) => {
              const dur = b.end - b.start;
              if (b.kind === 'commitment') {
                const c = commitmentsOn(state.commitments, date).find((x) => x.id === b.id);
                return (
                  <li key={b.id} className="fixed-hatch flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-ink-2">
                    <span className="num w-20 shrink-0 text-xs text-ink-3 ltr text-end">
                      {formatTime(fromMin(b.start))}–{formatTime(fromMin(b.end))}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{b.title}</span>
                    {c && <span className="text-[11px] text-ink-3">{COMMITMENT_KIND_LABEL[c.kind]}</span>}
                  </li>
                );
              }
              if (b.kind === 'task') {
                const t = state.tasks.find((x) => x.id === b.id)!;
                const c = state.courses.find((x) => x.id === t.courseId);
                return (
                  <li
                    key={b.id}
                    className={cx(
                      'flex items-center gap-3 rounded-lg border-s-[3px] px-3 py-2 text-[13px]',
                      c ? `${COURSE_COLOR_CLASSES[c.color].soft} ${COURSE_COLOR_CLASSES[c.color].border}` : 'bg-subtle',
                      t.status === 'done' && 'opacity-60',
                    )}
                  >
                    <span className="num w-20 shrink-0 text-xs text-ink-3 ltr text-end">
                      {formatTime(fromMin(b.start))}–{formatTime(fromMin(b.end))}
                    </span>
                    <span className={cx('min-w-0 flex-1 truncate font-medium', t.status === 'done' && 'line-through')}>{b.title}</span>
                    <span className="text-[11px] text-ink-3">{TASK_TYPE_LABEL[t.type]}</span>
                  </li>
                );
              }
              const disabled = date < today || (date === today && b.end <= toMin(`${now.getHours()}:${now.getMinutes()}`));
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => newTask({ scheduledDate: date, startTime: fromMin(b.start) })}
                    className="flex w-full items-center gap-3 rounded-lg border border-dashed border-line px-3 py-2 text-[13px] text-ink-3 transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-50"
                  >
                    <span className="num w-20 shrink-0 text-xs ltr text-end">
                      {formatTime(fromMin(b.start))}–{formatTime(fromMin(b.end))}
                    </span>
                    <span className="flex-1 text-start">زمان آزاد، {formatDuration(dur)}</span>
                    {!disabled && <IconPlus aria-hidden className="size-3.5" />}
                  </button>
                </li>
              );
            })}
            {timeline.length === 0 && (
              <EmptyState compact icon={IconCoffee} title="روز کاملاً آزاد" body="هیچ تعهد ثابتی برای این روز ثبت نشده است." />
            )}
          </ol>
          <p className="mt-3 text-xs leading-5 text-ink-3">
            بلوک‌های هاشورخورده تعهدهای ثابت‌اند (کار، کلاس، شخصی) و هیچ مطالعه‌ای روی آن‌ها برنامه‌ریزی نمی‌شود. با کلیک روی زمان آزاد، کاری در آن
            ساعت اضافه کنید.
          </p>
        </Card>
      </div>

      <ProposalDialog
        open={!!plan}
        plan={plan}
        onClose={() => setPlan(null)}
        title="پیشنهاد زمان برای کارهای عقب‌افتاده"
        description="روزهای باقی‌ماندهٔ این هفته، با رعایت سقف روزانه و تعهدهای ثابت."
      />
    </div>
  );
}
