/**
 * Scheduling rules. Everything here is pure and works on minutes-of-day.
 *
 * Hard rules (never violated by anything the app does automatically):
 *  - Study never overlaps a fixed commitment (work, class, personal, break).
 *  - Timed study tasks never overlap each other.
 *  - Study stays inside the configured day window.
 * Soft rule:
 *  - The daily study budget. Automatic proposals never exceed it; manual
 *    edits may, and the UI then shows a workload warning.
 */
import { addDays, diffDays, fromMin, nowMinutes, toMin, weekDates, weekdayOf } from './dates';
import { PRIORITY_RANK } from './labels';
import type { AppState, Commitment, ISODate, Settings, Task, TaskType, Topic } from './types';

export interface Interval {
  start: number;
  end: number;
}

export interface BusyBlock extends Interval {
  source: 'commitment' | 'task';
  id: string;
  title: string;
}

export function budgetFor(settings: Settings, date: ISODate): number {
  return settings.budgetOverrides[weekdayOf(date)] ?? settings.dailyBudgetMin;
}

export function commitmentsOn(commitments: Commitment[], date: ISODate): Commitment[] {
  const wd = weekdayOf(date);
  return commitments
    .filter((c) => (c.date ? c.date === date : c.days.includes(wd)))
    .sort((a, b) => toMin(a.start) - toMin(b.start));
}

export function tasksOn(tasks: Task[], date: ISODate): Task[] {
  return tasks.filter((t) => t.scheduledDate === date);
}

export function busyBlocks(
  state: Pick<AppState, 'commitments' | 'tasks'>,
  date: ISODate,
  excludeTaskId?: string,
): BusyBlock[] {
  const blocks: BusyBlock[] = commitmentsOn(state.commitments, date).map((c) => ({
    start: toMin(c.start),
    end: toMin(c.end),
    source: 'commitment',
    id: c.id,
    title: c.title,
  }));
  for (const t of tasksOn(state.tasks, date)) {
    if (!t.startTime || t.id === excludeTaskId) continue;
    const s = toMin(t.startTime);
    blocks.push({ start: s, end: s + t.estimateMin, source: 'task', id: t.id, title: t.title });
  }
  return blocks.sort((a, b) => a.start - b.start);
}

/** Free intervals of the day window minus the given busy blocks. */
export function freeIntervals(window: Interval, busy: Interval[]): Interval[] {
  const out: Interval[] = [];
  let cursor = window.start;
  for (const b of [...busy].sort((a, c) => a.start - c.start)) {
    if (b.end <= cursor) continue;
    if (b.start >= window.end) break;
    if (b.start > cursor) out.push({ start: cursor, end: Math.min(b.start, window.end) });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < window.end) out.push({ start: cursor, end: window.end });
  return out.filter((i) => i.end - i.start > 0);
}

export function dayWindow(settings: Settings): Interval {
  return { start: toMin(settings.dayStart), end: toMin(settings.dayEnd) };
}

/** Minutes not taken by fixed commitments inside the day window. */
export function freeMinutesAroundCommitments(state: AppState, date: ISODate): number {
  const busy = commitmentsOn(state.commitments, date).map((c) => ({
    start: toMin(c.start),
    end: toMin(c.end),
  }));
  return freeIntervals(dayWindow(state.settings), busy).reduce((s, i) => s + i.end - i.start, 0);
}

/** Study time realistically available: the budget, capped by free time. */
export function availableMinutes(state: AppState, date: ISODate): number {
  return Math.min(budgetFor(state.settings, date), freeMinutesAroundCommitments(state, date));
}

export function plannedMinutes(tasks: Task[], date: ISODate, excludeTaskId?: string): number {
  return tasksOn(tasks, date)
    .filter((t) => t.id !== excludeTaskId)
    .reduce((s, t) => s + t.estimateMin, 0);
}

export type PlacementProblem = 'outside_day' | 'overlap_commitment' | 'overlap_task' | 'past';

export interface PlacementCheck {
  ok: boolean;
  problem?: PlacementProblem;
  conflictTitle?: string;
  budget: number;
  plannedAfter: number;
  overBudget: boolean;
}

/** Validate putting a task of `duration` minutes at `date start`. */
export function checkPlacement(
  state: AppState,
  args: { taskId?: string; date: ISODate; start: number; duration: number },
  now: Date = new Date(),
): PlacementCheck {
  const { taskId, date, start, duration } = args;
  const budget = budgetFor(state.settings, date);
  const plannedAfter = plannedMinutes(state.tasks, date, taskId) + duration;
  const base = { budget, plannedAfter, overBudget: plannedAfter > budget };
  const win = dayWindow(state.settings);
  const end = start + duration;
  if (start < win.start || end > win.end) return { ...base, ok: false, problem: 'outside_day' };
  const today = toISODateLocal(now);
  if (date < today || (date === today && end <= nowMinutes(now)))
    return { ...base, ok: false, problem: 'past' };
  for (const b of busyBlocks(state, date, taskId)) {
    if (b.start < end && start < b.end) {
      return {
        ...base,
        ok: false,
        problem: b.source === 'commitment' ? 'overlap_commitment' : 'overlap_task',
        conflictTitle: b.title,
      };
    }
  }
  return { ...base, ok: true };
}

function toISODateLocal(d: Date): ISODate {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const roundUp = (m: number, step = 15) => Math.ceil(m / step) * step;

/** Earliest start that fits `duration` on `date`, or null. */
export function findSlot(
  state: AppState,
  date: ISODate,
  duration: number,
  opts: { excludeTaskId?: string; notBefore?: number; preferFrom?: number } = {},
): number | null {
  const win = dayWindow(state.settings);
  const busy = busyBlocks(state, date, opts.excludeTaskId);
  const free = freeIntervals(win, busy);
  const scan = (from: number) => {
    for (const iv of free) {
      const start = roundUp(Math.max(iv.start, opts.notBefore ?? 0, from));
      if (start + duration <= iv.end) return start;
    }
    return null;
  };
  return (opts.preferFrom !== undefined ? scan(opts.preferFrom) : null) ?? scan(0);
}

/** Preferred start for automatic suggestions (default: 17:00, after work). */
export function preferredFrom(settings: Settings): number {
  return toMin(settings.preferredStudyStart ?? '17:00');
}

export const PLACEMENT_MESSAGE: Record<PlacementProblem, string> = {
  outside_day: 'این زمان بیرون از بازهٔ روزانهٔ مطالعه است.',
  overlap_commitment: 'با یک تعهد ثابت هم‌پوشانی دارد',
  overlap_task: 'با یک برنامهٔ مطالعهٔ دیگر هم‌پوشانی دارد',
  past: 'این زمان گذشته است.',
};

// ---- rescheduling ----------------------------------------------------------

export interface SlotOption {
  date: ISODate;
  start: number;
  plannedAfter: number;
  budget: number;
  afterDeadline: boolean;
}

/**
 * Suggest a few realistic new slots for one task: days where the task still
 * fits inside the daily budget and a free window exists. Only this task is
 * moved — nothing else is pushed forward.
 */
export function suggestReschedule(
  state: AppState,
  task: Task,
  now: Date = new Date(),
  opts: { maxOptions?: number; horizonDays?: number } = {},
): SlotOption[] {
  const max = opts.maxOptions ?? 3;
  const horizon = opts.horizonDays ?? 21;
  const today = toISODateLocal(now);
  const inDeadline: SlotOption[] = [];
  const late: SlotOption[] = [];
  for (let i = 0; i <= horizon && inDeadline.length < max; i++) {
    const date = addDays(today, i);
    const budget = budgetFor(state.settings, date);
    const plannedAfter = plannedMinutes(state.tasks, date, task.id) + task.estimateMin;
    if (plannedAfter > budget) continue;
    const notBefore = i === 0 ? nowMinutes(now) + 10 : undefined;
    const start = findSlot(state, date, task.estimateMin, { excludeTaskId: task.id, notBefore, preferFrom: preferredFrom(state.settings) });
    if (start === null) continue;
    const afterDeadline = !!task.deadline && date > task.deadline;
    const opt = { date, start, plannedAfter, budget, afterDeadline };
    if (afterDeadline) {
      if (late.length < max) late.push(opt);
    } else inDeadline.push(opt);
  }
  return inDeadline.length > 0 ? inDeadline : late;
}

/** Tasks planned for a past day (or earlier today) that were not finished. */
export function missedTasks(tasks: Task[], today: ISODate): Task[] {
  return tasks
    .filter((t) => t.status !== 'done' && t.scheduledDate && t.scheduledDate < today)
    .sort((a, b) => (a.scheduledDate! < b.scheduledDate! ? -1 : 1));
}

// ---- weekly proposal ---------------------------------------------------------

/** Share of weekly study capacity the proposal may fill with new practice. */
export const PRACTICE_FILL = 0.75;

export interface Proposal {
  id: string;
  kind: 'move' | 'new';
  taskId?: string;
  draft?: Omit<Task, 'id' | 'createdAt'>;
  title: string;
  courseId: string;
  type: TaskType;
  date: ISODate;
  start: number;
  estimateMin: number;
  reason: string;
}

export interface WeekPlan {
  proposals: Proposal[];
  unplaced: { taskId: string; title: string; reason: string }[];
  capacity: { date: ISODate; budget: number; plannedBefore: number; plannedAfter: number }[];
}

function taskScore(task: Task, state: AppState, from: ISODate): number {
  const course = state.courses.find((c) => c.id === task.courseId);
  const totalWeight = state.courses.reduce((s, c) => s + c.weight, 0) || 1;
  let score = PRIORITY_RANK[task.priority] * 10 + ((course?.weight ?? 0) / totalWeight) * 30;
  if (task.deadline) score += Math.max(0, 30 - Math.max(0, diffDays(task.deadline, from)) * 2);
  if (task.scheduledDate && task.scheduledDate < from) score += 5;
  return score;
}

function pickTopicsForRevision(topics: Topic[], currentWeek: number): Topic[] {
  const rank = (t: Topic) =>
    t.difficulty * 10 +
    (t.status === 'in_progress' ? 6 : 0) +
    (t.kind === 'prerequisite' && t.status !== 'completed' ? 4 : 0) +
    (t.targetWeek && t.targetWeek <= currentWeek + 1 && t.status !== 'completed' ? 3 : 0);
  return topics
    .filter((t) => t.status !== 'completed' || t.difficulty > 0)
    .sort((a, b) => rank(b) - rank(a));
}

/**
 * Build a reviewable proposal for the week starting `weekStart`.
 * Unfinished/unscheduled tasks are placed first (by urgency), then — when
 * the course time shares fall short — revision/practice sessions are
 * suggested for the weakest topics. Nothing is applied here.
 */
export function proposeWeek(
  state: AppState,
  weekStart: ISODate,
  now: Date = new Date(),
  opts: { addPractice?: boolean; currentWeek?: number } = {},
): WeekPlan {
  const today = toISODateLocal(now);
  const days = weekDates(weekStart).filter((d) => d >= today);
  const work: AppState = { ...state, tasks: state.tasks.map((t) => ({ ...t })) };
  const proposals: Proposal[] = [];
  const unplaced: WeekPlan['unplaced'] = [];
  const capacityBefore = new Map(days.map((d) => [d, plannedMinutes(state.tasks, d)]));
  const lastDay = weekDates(weekStart)[6]!;

  const candidates = work.tasks
    .filter(
      (t) =>
        t.status !== 'done' &&
        (!t.scheduledDate ||
          t.scheduledDate < today ||
          (t.scheduledDate >= weekStart && t.scheduledDate <= lastDay && !t.startTime)),
    )
    .sort((a, b) => taskScore(b, state, today) - taskScore(a, state, today));

  const tryPlace = (task: Task, preferEarliest: boolean): { date: ISODate; start: number } | null => {
    const options: { date: ISODate; start: number; load: number }[] = [];
    for (const date of days) {
      if (task.deadline && date > task.deadline) continue;
      const budget = budgetFor(state.settings, date);
      const planned = plannedMinutes(work.tasks, date, task.id);
      if (planned + task.estimateMin > budget) continue;
      const notBefore = date === today ? nowMinutes(now) + 10 : undefined;
      const start = findSlot(work, date, task.estimateMin, { excludeTaskId: task.id, notBefore, preferFrom: preferredFrom(state.settings) });
      if (start === null) continue;
      options.push({ date, start, load: (planned + task.estimateMin) / Math.max(1, budget) });
      if (preferEarliest) break;
    }
    if (options.length === 0) return null;
    options.sort((a, b) => a.load - b.load || (a.date < b.date ? -1 : 1));
    return options[0]!;
  };

  for (const task of candidates) {
    const placed = tryPlace(task, !!task.deadline);
    if (!placed) {
      unplaced.push({
        taskId: task.id,
        title: task.title,
        reason:
          task.deadline && task.deadline < (days[0] ?? today)
            ? 'مهلت این کار گذشته است؛ دستی تصمیم بگیرید.'
            : 'در این هفته بدون عبور از سقف روزانه جای خالی نداشت.',
      });
      continue;
    }
    const wasScheduled = task.scheduledDate;
    task.scheduledDate = placed.date;
    task.startTime = fromMin(placed.start);
    proposals.push({
      id: `p-${task.id}`,
      kind: 'move',
      taskId: task.id,
      title: task.title,
      courseId: task.courseId,
      type: task.type,
      date: placed.date,
      start: placed.start,
      estimateMin: task.estimateMin,
      reason: wasScheduled && wasScheduled < today ? 'عقب‌افتاده از روزهای قبل' : task.deadline ? 'دارای مهلت' : 'هنوز زمان‌بندی نشده',
    });
  }

  if (opts.addPractice !== false && days.length > 0) {
    // Leave ~25% of the week unplanned as a buffer: new practice sessions only
    // fill each course up to its share of 75% of the available study time.
    const totalCapacity = days.reduce((s, d) => s + budgetFor(state.settings, d), 0) * PRACTICE_FILL;
    const totalWeight = state.courses.reduce((s, c) => s + c.weight, 0) || 1;
    const currentWeek = opts.currentWeek ?? 1;
    for (const course of [...state.courses].sort((a, b) => b.weight - a.weight)) {
      const target = (course.weight / totalWeight) * totalCapacity;
      let allotted = days.reduce(
        (s, d) =>
          s +
          tasksOn(work.tasks, d)
            .filter((t) => t.courseId === course.id)
            .reduce((x, t) => x + t.estimateMin, 0),
        0,
      );
      const topics = pickTopicsForRevision(course.topics, currentWeek);
      let i = 0;
      while (target - allotted >= 40 && i < topics.length) {
        const topic = topics[i++]!;
        const isPractice = topic.kind === 'prerequisite' || topic.difficulty > 0;
        const type: TaskType = isPractice ? 'problem_solving' : 'revision';
        const estimateMin = 45;
        const draft: Omit<Task, 'id' | 'createdAt'> = {
          title: `${isPractice ? 'حل تمرین' : 'مرور'}: ${topic.title}`,
          courseId: course.id,
          topicId: topic.id,
          priority: course.weight >= totalWeight * 0.4 ? 'high' : 'medium',
          estimateMin,
          type,
          status: 'todo',
          links: [],
        };
        const tmp: Task = { ...draft, id: `tmp-${course.id}-${topic.id}`, createdAt: 0 };
        const placed = tryPlace(tmp, false);
        if (!placed) break;
        tmp.scheduledDate = placed.date;
        tmp.startTime = fromMin(placed.start);
        work.tasks.push(tmp);
        allotted += estimateMin;
        proposals.push({
          id: `n-${course.id}-${topic.id}`,
          kind: 'new',
          draft: { ...draft, scheduledDate: placed.date, startTime: fromMin(placed.start) },
          title: draft.title,
          courseId: course.id,
          type,
          date: placed.date,
          start: placed.start,
          estimateMin,
          reason:
            topic.difficulty > 0
              ? 'مبحث دشوار از بازتاب‌های قبلی'
              : topic.kind === 'prerequisite'
                ? 'بازسازی پیش‌نیاز هم‌زمان با کلاس'
                : 'تعادل زمان بین درس‌ها',
        });
      }
    }
  }

  proposals.sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1));
  return {
    proposals,
    unplaced,
    capacity: days.map((date) => ({
      date,
      budget: budgetFor(state.settings, date),
      plannedBefore: capacityBefore.get(date) ?? 0,
      plannedAfter: plannedMinutes(work.tasks, date),
    })),
  };
}
