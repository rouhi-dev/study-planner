/** Derived metrics. Every number shown in the UI comes from these functions. */
import { addDays, diffDays, startOfWeek, weekDates } from './dates';
import { ACTIVE_TYPES } from './labels';
import { availableMinutes, budgetFor, plannedMinutes } from './schedule';
import type { AppState, Course, ISODate, Settings, StudySession, Task, Topic } from './types';

export interface SemesterInfo {
  week: number;
  totalWeeks: number;
  /** Full weeks left after the current one. */
  weeksLeftAfterCurrent: number;
  daysLeft: number;
  /** Elapsed fraction of the semester, by calendar days (0–1). */
  elapsed: number;
  endDate: ISODate;
  status: 'before' | 'during' | 'after';
}

export function semesterInfo(settings: Settings, today: ISODate): SemesterInfo {
  const totalDays = settings.semesterWeeks * 7;
  const endDate = addDays(settings.semesterStart, totalDays - 1);
  const dayIndex = diffDays(today, settings.semesterStart);
  const status = dayIndex < 0 ? 'before' : dayIndex >= totalDays ? 'after' : 'during';
  const week = Math.min(settings.semesterWeeks, Math.max(1, Math.floor(dayIndex / 7) + 1));
  return {
    week,
    totalWeeks: settings.semesterWeeks,
    weeksLeftAfterCurrent: Math.max(0, settings.semesterWeeks - week),
    daysLeft: Math.max(0, diffDays(endDate, today)),
    elapsed: Math.min(1, Math.max(0, dayIndex / totalDays)),
    endDate,
    status,
  };
}

export function weekNumberOf(settings: Settings, date: ISODate): number {
  return Math.floor(diffDays(date, settings.semesterStart) / 7) + 1;
}

export function minutesOn(sessions: StudySession[], date: ISODate): number {
  return sessions.filter((s) => s.date === date).reduce((sum, s) => sum + s.durationMin, 0);
}

export function minutesBetween(sessions: StudySession[], from: ISODate, to: ISODate): number {
  return sessions
    .filter((s) => s.date >= from && s.date <= to)
    .reduce((sum, s) => sum + s.durationMin, 0);
}

/** Total study minutes for the last `count` weeks (oldest first). */
export function weeklyTotals(sessions: StudySession[], today: ISODate, count: number) {
  const current = startOfWeek(today);
  return Array.from({ length: count }, (_, i) => {
    const start = addDays(current, -7 * (count - 1 - i));
    return { weekStart: start, minutes: minutesBetween(sessions, start, addDays(start, 6)) };
  });
}

export interface DayLoad {
  date: ISODate;
  budget: number;
  available: number;
  planned: number;
  actual: number;
  overloaded: boolean;
}

export function dayLoad(state: AppState, date: ISODate): DayLoad {
  const planned = plannedMinutes(state.tasks, date);
  const available = availableMinutes(state, date);
  return {
    date,
    budget: budgetFor(state.settings, date),
    available,
    planned,
    actual: minutesOn(state.sessions, date),
    overloaded: planned > available,
  };
}

export function weekLoad(state: AppState, weekStart: ISODate): DayLoad[] {
  return weekDates(weekStart).map((d) => dayLoad(state, d));
}

/**
 * Completion rate over tasks that were *due to be done* in the range: planned
 * for a day in [from, min(to, today)]. Future tasks are excluded so the rate
 * is not deflated by work that isn't due yet.
 */
export function completionRate(tasks: Task[], from: ISODate, to: ISODate, today: ISODate) {
  const end = to < today ? to : today;
  const due = tasks.filter((t) => t.scheduledDate && t.scheduledDate >= from && t.scheduledDate <= end);
  const done = due.filter((t) => t.status === 'done').length;
  return { done, total: due.length, rate: due.length ? done / due.length : null };
}

export function practiceSplit(sessions: StudySession[], from: ISODate, to: ISODate) {
  let active = 0;
  let reading = 0;
  let revision = 0;
  let free = 0;
  for (const s of sessions) {
    if (s.date < from || s.date > to) continue;
    if (s.kind === 'free') free += s.durationMin;
    else if (s.kind === 'theory') reading += s.durationMin;
    else if (s.kind === 'revision') revision += s.durationMin;
    else if (ACTIVE_TYPES.has(s.kind)) active += s.durationMin;
  }
  return { active, reading, revision, free, total: active + reading + revision + free };
}

export function topicProgress(topics: Topic[]) {
  const count = (k?: Topic['kind']) => {
    const list = k ? topics.filter((t) => t.kind === k) : topics;
    return {
      total: list.length,
      completed: list.filter((t) => t.status === 'completed').length,
      inProgress: list.filter((t) => t.status === 'in_progress').length,
    };
  };
  return { all: count(), prerequisite: count('prerequisite'), course: count('course') };
}

export function courseMinutes(sessions: StudySession[], courseId: string, from?: ISODate, to?: ISODate) {
  return sessions
    .filter((s) => s.courseId === courseId && (!from || s.date >= from) && (!to || s.date <= to))
    .reduce((sum, s) => sum + s.durationMin, 0);
}

export function overdueTasks(tasks: Task[], today: ISODate): Task[] {
  return tasks
    .filter((t) => t.status !== 'done' && t.deadline && t.deadline < today)
    .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1));
}

export function upcomingDeadlines(tasks: Task[], today: ISODate, days = 14): Task[] {
  const limit = addDays(today, days);
  return tasks
    .filter((t) => t.status !== 'done' && t.deadline && t.deadline >= today && t.deadline <= limit)
    .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1));
}

export function weakTopics(courses: Course[], limit = 6) {
  return courses
    .flatMap((c) => c.topics.filter((t) => t.difficulty > 0).map((t) => ({ course: c, topic: t })))
    .sort((a, b) => b.topic.difficulty - a.topic.difficulty)
    .slice(0, limit);
}

export function dueCards(state: AppState, today: ISODate) {
  return state.cards.filter((c) => c.due <= today).sort((a, b) => (a.due < b.due ? -1 : 1));
}
