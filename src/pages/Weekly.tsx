import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { CommitmentEditor } from '../components/CommitmentEditor';
import { IconAlert, IconCalendarPlus, IconChevronLeft, IconChevronRight, IconGrip, IconSparkles } from '../components/icons';
import { ProposalDialog, usePlanning } from '../components/planning';
import { Badge, Button, Callout, Card, cx, EmptyState, IconButton, PageHeader, useToast } from '../components/ui';
import { semesterInfo, weekLoad, weekNumberOf } from '../lib/analytics';
import {
  addDays,
  faInt,
  formatDayMonth,
  formatDuration,
  formatDurationShort,
  formatTime,
  fromMin,
  nowMinutes,
  startOfWeek,
  todayISO,
  toMin,
  WEEKDAYS,
  weekDates,
  weekdayOf,
} from '../lib/dates';
import { COMMITMENT_KIND_LABEL, COURSE_COLOR_CLASSES, TASK_TYPE_LABEL } from '../lib/labels';
import { scheduleTask } from '../lib/mutations';
import { busyBlocks, checkPlacement, commitmentsOn, dayWindow, PLACEMENT_MESSAGE, proposeWeek, tasksOn, type WeekPlan } from '../lib/schedule';
import type { Commitment, ISODate, Task } from '../lib/types';
import { useNow, useStore } from '../store/store';
import { takeHandoff } from '../store/ui-state';

const PX_PER_MIN = 0.85;
const SNAP = 15;

interface DragInfo {
  taskId: string;
  duration: number;
  grabOffsetMin: number;
}

export function WeeklyPage() {
  const { state, update } = useStore();
  const now = useNow();
  const today = todayISO(now);
  const [weekStart, setWeekStart] = useState<ISODate>(() => takeHandoff('weekStart') ?? startOfWeek(today));
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [commitEdit, setCommitEdit] = useState<{ open: boolean; c?: Commitment; defaults?: Partial<Commitment> }>({ open: false });
  const [ghost, setGhost] = useState<{ date: ISODate; start: number; duration: number; ok: boolean } | null>(null);
  const drag = useRef<DragInfo | null>(null);
  const { editTask, reschedule, newTask } = usePlanning();
  const toastPush = useToast();

  const days = weekDates(weekStart);
  const loads = weekLoad(state, weekStart);
  const win = dayWindow(state.settings);
  const height = (win.end - win.start) * PX_PER_MIN;
  const weekNo = weekNumberOf(state.settings, weekStart);
  const sem = semesterInfo(state.settings, today);
  const weekPlanned = loads.reduce((s, d) => s + d.planned, 0);
  const weekAvailable = loads.reduce((s, d) => s + d.available, 0);

  const unplacedWeek = state.tasks.filter((t) => t.status !== 'done' && t.scheduledDate && days.includes(t.scheduledDate) && !t.startTime);
  const backlog = state.tasks.filter((t) => t.status !== 'done' && !t.scheduledDate);

  // Tasks overlapping a commitment (possible after editing commitments by hand).
  const conflicted = new Set<string>();
  for (const d of days) {
    const cs = commitmentsOn(state.commitments, d);
    for (const t of tasksOn(state.tasks, d)) {
      if (!t.startTime) continue;
      const s = toMin(t.startTime);
      if (cs.some((c) => toMin(c.start) < s + t.estimateMin && s < toMin(c.end))) conflicted.add(t.id);
    }
  }

  const startDrag = (e: DragEvent<HTMLElement>, task: Task, grabOffsetMin: number) => {
    drag.current = { taskId: task.id, duration: task.estimateMin, grabOffsetMin };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  };

  const positionFor = (e: DragEvent<HTMLElement>): number => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const raw = win.start + y / PX_PER_MIN - (drag.current?.grabOffsetMin ?? 0);
    return Math.max(win.start, Math.round(raw / SNAP) * SNAP);
  };

  const onDragOver = (e: DragEvent<HTMLElement>, date: ISODate) => {
    if (!drag.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const start = positionFor(e);
    if (ghost && ghost.date === date && ghost.start === start) return;
    const check = checkPlacement(state, { taskId: drag.current.taskId, date, start, duration: drag.current.duration }, now);
    setGhost({ date, start, duration: drag.current.duration, ok: check.ok });
  };

  const onDrop = (e: DragEvent<HTMLElement>, date: ISODate) => {
    e.preventDefault();
    const info = drag.current;
    if (!info) return;
    const start = positionFor(e);
    setGhost(null);
    drag.current = null;
    const check = checkPlacement(state, { taskId: info.taskId, date, start, duration: info.duration }, now);
    if (!check.ok) {
      const msg =
        check.problem === 'overlap_commitment' || check.problem === 'overlap_task'
          ? `${PLACEMENT_MESSAGE[check.problem]}: «${check.conflictTitle}»`
          : PLACEMENT_MESSAGE[check.problem!];
      toastPush({ tone: 'error', message: `جابه‌جا نشد. ${msg}` });
      return;
    }
    const task = state.tasks.find((t) => t.id === info.taskId);
    const prev = task ? { date: task.scheduledDate, start: task.startTime } : null;
    update((s) => scheduleTask(s, info.taskId, date, start));
    toastPush({
      tone: check.overBudget ? 'info' : 'success',
      message: check.overBudget
        ? `منتقل شد، اما برنامهٔ ${WEEKDAYS[weekdayOf(date)]} از سقف روزانه (${formatDurationShort(check.budget)}) بیشتر شد.`
        : `به ${WEEKDAYS[weekdayOf(date)]} ساعت ${formatTime(fromMin(start))} منتقل شد.`,
      action: prev
        ? {
            label: 'بازگردانی',
            run: () => update((s) => scheduleTask(s, info.taskId, prev.date, prev.start ? toMin(prev.start) : null)),
          }
        : undefined,
    });
  };

  const hours: number[] = [];
  for (let m = Math.ceil(win.start / 60) * 60; m < win.end; m += 60) hours.push(m);
  const nowLine = days.includes(today) ? nowMinutes(now) : null;

  return (
    <div>
      <PageHeader
        title="برنامه هفتگی"
        subtitle={
          <span>
            {weekNo >= 1 && weekNo <= state.settings.semesterWeeks ? `هفتهٔ ${faInt(weekNo)} ترم، ` : ''}
            {formatDayMonth(days[0]!)} تا {formatDayMonth(days[6]!)}
          </span>
        }
        actions={
          <>
            <div className="flex items-center gap-1">
              <IconButton label="هفتهٔ قبل" icon={IconChevronRight} onClick={() => setWeekStart(addDays(weekStart, -7))} />
              <Button variant="ghost" onClick={() => setWeekStart(startOfWeek(today))} disabled={weekStart === startOfWeek(today)}>
                این هفته
              </Button>
              <IconButton label="هفتهٔ بعد" icon={IconChevronLeft} onClick={() => setWeekStart(addDays(weekStart, 7))} />
            </div>
            <Button variant="secondary" icon={IconCalendarPlus} onClick={() => setCommitEdit({ open: true })}>
              تعهد ثابت
            </Button>
            <Button
              variant="primary"
              icon={IconSparkles}
              disabled={days[6]! < today}
              onClick={() => setPlan(proposeWeek(state, weekStart, now, { currentWeek: Math.max(weekNo, sem.week) }))}
            >
              پیشنهاد برنامه
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="fixed-hatch inline-block h-3 w-5 rounded-sm" /> تعهد ثابت (کار، کلاس، شخصی)؛ جابه‌جا نمی‌شود
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm border-s-2 border-rp bg-rp-soft" /> مطالعهٔ منعطف؛ با کشیدن جابه‌جا کنید
        </span>
        <span className="num ms-auto">
          برنامهٔ هفته: {formatDuration(weekPlanned)} از {formatDuration(weekAvailable)} در دسترس
        </span>
      </div>

      {conflicted.size > 0 && (
        <Callout tone="warn" className="mb-4" title={`${faInt(conflicted.size)} کار با تعهد ثابت هم‌پوشانی دارد`}>
          این کارها با علامت هشدار مشخص شده‌اند. آن‌ها را به زمان آزاد بکشید یا از دکمهٔ زمان‌بندی دوباره استفاده کنید.
        </Callout>
      )}

      {/* Desktop / tablet grid */}
      <div className="hidden overflow-x-auto rounded-card border border-line bg-surface shadow-card md:block">
        <div className="min-w-[860px]">
          <div className="sticky top-0 z-10 grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-line bg-surface">
            <div />
            {loads.map((d) => {
              const isToday = d.date === today;
              return (
                <div key={d.date} className={cx('border-s border-line px-2 py-2.5 text-center', isToday && 'bg-primary-soft/50')}>
                  <p className={cx('text-[13px] font-semibold', isToday ? 'text-primary' : 'text-ink')}>{WEEKDAYS[weekdayOf(d.date)]}</p>
                  <p className="num text-xs text-ink-3">{formatDayMonth(d.date)}</p>
                  <p className={cx('num mt-1 text-[11px]', d.overloaded ? 'font-semibold text-warn' : 'text-ink-3')} title="برنامه‌ریزی‌شده از در دسترس">
                    {d.overloaded && <IconAlert aria-label="بیش از زمان در دسترس" className="me-0.5 inline size-3" />}
                    {formatDurationShort(d.planned)} / {formatDurationShort(d.available)}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
            <div className="relative" style={{ height }}>
              {hours.map((m) => (
                <span key={m} className="num absolute end-2 -translate-y-1/2 text-[11px] text-ink-3" style={{ top: (m - win.start) * PX_PER_MIN }}>
                  {formatTime(fromMin(m))}
                </span>
              ))}
            </div>
            {days.map((date) => {
              const blocks = busyBlocks(state, date);
              const isPast = date < today;
              return (
                <div
                  key={date}
                  className={cx('relative border-s border-line', isPast && 'bg-subtle/50', ghost?.date === date && 'bg-primary-soft/30')}
                  style={{ height }}
                  onDragOver={(e) => onDragOver(e, date)}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.nativeEvent.relatedTarget as Node | null)) setGhost(null);
                  }}
                  onDrop={(e) => onDrop(e, date)}
                  onDoubleClick={(e) => {
                    if (e.target !== e.currentTarget || isPast) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const start = Math.round((win.start + (e.clientY - rect.top) / PX_PER_MIN) / SNAP) * SNAP;
                    newTask({ scheduledDate: date, startTime: fromMin(start) });
                  }}
                >
                  {hours.map((m) => (
                    <div key={m} aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-line/70" style={{ top: (m - win.start) * PX_PER_MIN }} />
                  ))}
                  {nowLine !== null && date === today && nowLine > win.start && nowLine < win.end && (
                    <div aria-hidden className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-danger" style={{ top: (nowLine - win.start) * PX_PER_MIN }}>
                      <span className="absolute -top-[5px] -start-[5px] size-2 rounded-full bg-danger" />
                    </div>
                  )}
                  {blocks.map((b) => {
                    const top = (Math.max(b.start, win.start) - win.start) * PX_PER_MIN;
                    const h = Math.max(14, (Math.min(b.end, win.end) - Math.max(b.start, win.start)) * PX_PER_MIN - 2);
                    if (b.end <= win.start || b.start >= win.end) return null;
                    if (b.source === 'commitment') {
                      const c = state.commitments.find((x) => x.id === b.id)!;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setCommitEdit({ open: true, c })}
                          className="fixed-hatch absolute inset-x-0.5 overflow-hidden rounded-md px-1.5 py-1 text-start text-[11px] leading-4 text-ink-2 hover:ring-1 hover:ring-line-strong"
                          style={{ top, height: h }}
                          title={`${c.title} (${COMMITMENT_KIND_LABEL[c.kind]})، ${formatTime(c.start)}–${formatTime(c.end)}`}
                        >
                          <span className="block truncate font-medium">{c.title}</span>
                          {h > 30 && <span className="num block text-ink-3 ltr text-end">{formatTime(c.start)}–{formatTime(c.end)}</span>}
                        </button>
                      );
                    }
                    const t = state.tasks.find((x) => x.id === b.id)!;
                    const course = state.courses.find((c) => c.id === t.courseId);
                    const colors = course ? COURSE_COLOR_CLASSES[course.color] : COURSE_COLOR_CLASSES.slate;
                    const done = t.status === 'done';
                    const draggable = !done && !isPast;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        draggable={draggable}
                        onDragStart={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          startDrag(e, t, (e.clientY - rect.top) / PX_PER_MIN);
                        }}
                        onDragEnd={() => {
                          drag.current = null;
                          setGhost(null);
                        }}
                        onClick={() => editTask(t)}
                        className={cx(
                          'absolute inset-x-0.5 z-10 overflow-hidden rounded-md border-s-[3px] px-1.5 py-1 text-start text-[11px] leading-4 shadow-card transition-shadow hover:shadow-pop',
                          colors.soft,
                          colors.border,
                          draggable && 'cursor-grab active:cursor-grabbing',
                          done && 'opacity-55',
                          conflicted.has(t.id) && 'ring-2 ring-warn',
                          ghost && drag.current?.taskId === t.id && 'opacity-40',
                        )}
                        style={{ top, height: h }}
                        title={`${t.title}، ${formatTime(t.startTime!)}، ${formatDuration(t.estimateMin)}${draggable ? '. برای جابه‌جایی بکشید.' : ''}`}
                      >
                        <span className={cx('block font-semibold text-ink', h > 34 ? 'line-clamp-2' : 'truncate', done && 'line-through')}>{t.title}</span>
                        {h > 44 && (
                          <span className="num block truncate text-ink-3">
                            {formatTime(t.startTime!)}، {formatDurationShort(t.estimateMin)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {ghost?.date === date && (
                    <div
                      aria-hidden
                      className={cx(
                        'pointer-events-none absolute inset-x-0.5 z-20 rounded-md border-2 border-dashed',
                        ghost.ok ? 'border-success bg-success-soft/60' : 'border-danger bg-danger-soft/60',
                      )}
                      style={{ top: (ghost.start - win.start) * PX_PER_MIN, height: ghost.duration * PX_PER_MIN - 2 }}
                    >
                      <span className="num block px-1.5 pt-0.5 text-[11px] font-semibold text-ink">{formatTime(fromMin(ghost.start))}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="mt-2 hidden text-xs text-ink-3 md:block">
        برای جابه‌جایی، کارت مطالعه را بکشید (هر ۱۵ دقیقه). روی کارت کلیک کنید تا ویرایش شود؛ برای افزودن، روی جای خالی دوبار کلیک کنید. جابه‌جایی روی
        تعهد ثابت یا مطالعهٔ دیگر انجام نمی‌شود.
      </p>

      {/* Mobile agenda */}
      <div className="flex flex-col gap-3 md:hidden">
        {loads.map((d) => {
          const items = busyBlocks(state, d.date);
          const isToday = d.date === today;
          return (
            <Card
              key={d.date}
              title={
                <span className={cx(isToday && 'text-primary')}>
                  {WEEKDAYS[weekdayOf(d.date)]} {formatDayMonth(d.date)}
                </span>
              }
              action={
                <span className={cx('num text-xs', d.overloaded ? 'font-semibold text-warn' : 'text-ink-3')}>
                  {formatDurationShort(d.planned)} / {formatDurationShort(d.available)}
                </span>
              }
            >
              {items.length === 0 ? (
                <p className="text-[13px] text-ink-3">برنامه‌ای ثبت نشده است.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {items.map((b) => {
                    if (b.source === 'commitment') {
                      const c = state.commitments.find((x) => x.id === b.id)!;
                      return (
                        <li key={b.id}>
                          <button type="button" onClick={() => setCommitEdit({ open: true, c })} className="fixed-hatch flex w-full items-center gap-3 rounded-md px-3 py-2 text-start text-[13px] text-ink-2">
                            <span className="num w-[86px] shrink-0 text-xs text-ink-3 ltr text-end">
                              {formatTime(c.start)}–{formatTime(c.end)}
                            </span>
                            <span className="truncate">{c.title}</span>
                          </button>
                        </li>
                      );
                    }
                    const t = state.tasks.find((x) => x.id === b.id)!;
                    const course = state.courses.find((c) => c.id === t.courseId);
                    const colors = course ? COURSE_COLOR_CLASSES[course.color] : COURSE_COLOR_CLASSES.slate;
                    return (
                      <li key={b.id}>
                        <button
                          type="button"
                          onClick={() => editTask(t)}
                          className={cx('flex w-full items-center gap-3 rounded-md border-s-[3px] px-3 py-2 text-start text-[13px]', colors.soft, colors.border, t.status === 'done' && 'opacity-55', conflicted.has(t.id) && 'ring-2 ring-warn')}
                        >
                          <span className="num w-[86px] shrink-0 text-xs text-ink-3 ltr text-end">
                            {formatTime(fromMin(b.start))}–{formatTime(fromMin(b.end))}
                          </span>
                          <span className={cx('min-w-0 flex-1 truncate font-medium', t.status === 'done' && 'line-through')}>{t.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      {/* Tray: tasks without a time */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="کارهای این هفته بدون ساعت" subtitle="روزشان مشخص است؛ آن‌ها را روی جدول بکشید یا زمان پیشنهادی بگیرید.">
          <TaskTray tasks={unplacedWeek} onDragStart={startDrag} onSchedule={reschedule} onEdit={editTask} showDay />
        </Card>
        <Card title="زمان‌بندی‌نشده" subtitle="کارهایی که هنوز روزی برایشان تعیین نشده است.">
          <TaskTray tasks={backlog} onDragStart={startDrag} onSchedule={reschedule} onEdit={editTask} />
        </Card>
      </div>

      <ProposalDialog
        open={!!plan}
        plan={plan}
        onClose={() => setPlan(null)}
        title="پیشنهاد برنامهٔ هفته"
        description="کارهای عقب‌افتاده و زمان‌بندی‌نشده بر اساس مهلت و اولویت جای‌گذاری شده‌اند و برای درس‌های کم‌زمان، تمرین روی مباحث دشوار پیشنهاد شده است. هیچ چیز تا تأیید شما تغییر نمی‌کند."
      />
      <CommitmentEditor open={commitEdit.open} commitment={commitEdit.c} defaults={commitEdit.defaults} onClose={() => setCommitEdit({ open: false })} />
    </div>
  );
}

function TaskTray({
  tasks,
  onDragStart,
  onSchedule,
  onEdit,
  showDay,
}: {
  tasks: Task[];
  onDragStart: (e: DragEvent<HTMLElement>, t: Task, grabOffsetMin: number) => void;
  onSchedule: (t: Task) => void;
  onEdit: (t: Task) => void;
  showDay?: boolean;
}) {
  const { state } = useStore();
  if (tasks.length === 0) return <EmptyState compact icon={IconSparkles} title="چیزی اینجا نیست" />;
  return (
    <ul className="flex flex-col gap-1.5">
      {tasks.map((t) => {
        const course = state.courses.find((c) => c.id === t.courseId);
        const colors = course ? COURSE_COLOR_CLASSES[course.color] : COURSE_COLOR_CLASSES.slate;
        return (
          <li
            key={t.id}
            draggable
            onDragStart={(e) => onDragStart(e, t, 10)}
            className="group flex items-center gap-2 rounded-lg border border-line bg-surface px-2 py-2 hover:border-line-strong"
          >
            <IconGrip aria-hidden className="hidden size-4 shrink-0 cursor-grab text-ink-3 md:block" />
            <span className={cx('h-8 w-1 shrink-0 rounded-full', colors.bar)} aria-hidden />
            <button type="button" onClick={() => onEdit(t)} className="min-w-0 flex-1 text-start">
              <span className="block truncate text-[13px] font-medium">{t.title}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
                <span>{course?.shortName}</span>
                <span>{TASK_TYPE_LABEL[t.type]}</span>
                <span className="num">{formatDuration(t.estimateMin)}</span>
                {showDay && t.scheduledDate && <span>{WEEKDAYS[weekdayOf(t.scheduledDate)]}</span>}
                {t.deadline && <Badge tone="warn">مهلت {formatDayMonth(t.deadline)}</Badge>}
              </span>
            </button>
            <Button size="sm" variant="ghost" onClick={() => onSchedule(t)}>
              پیشنهاد زمان
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
