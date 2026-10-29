/** Pure state transitions. UI code calls these through the store's `update`. */
import { addDays, fromMin, todayISO } from './dates';
import type { Proposal } from './schedule';
import type {
  AppState,
  Commitment,
  Course,
  ISODate,
  Reflection,
  ReviewCard,
  ReviewRating,
  Settings,
  StudySession,
  Task,
  Topic,
  WeeklyReview,
} from './types';

export function uid(prefix = ''): string {
  const c = globalThis.crypto;
  const raw =
    c && 'randomUUID' in c
      ? c.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return prefix + raw;
}

const replace = <T extends { id: string }>(list: T[], id: string, fn: (x: T) => T) =>
  list.map((x) => (x.id === id ? fn(x) : x));

// ---- tasks -------------------------------------------------------------------

export type TaskDraft = Omit<Task, 'id' | 'createdAt'>;

export function addTask(state: AppState, draft: TaskDraft): AppState {
  const task: Task = { ...draft, id: uid('t'), createdAt: Date.now() };
  return { ...state, tasks: [...state.tasks, task] };
}

export function updateTask(state: AppState, id: string, patch: Partial<Task>): AppState {
  return { ...state, tasks: replace(state.tasks, id, (t) => ({ ...t, ...patch })) };
}

export function deleteTask(state: AppState, id: string): AppState {
  return {
    ...state,
    tasks: state.tasks.filter((t) => t.id !== id),
    focus: state.focus.taskId === id ? { ...state.focus, taskId: undefined } : state.focus,
  };
}

/**
 * Mark a task done (or undo). Completing a recurring task plans its next
 * occurrence `everyDays` after the day it was planned for (or today).
 */
export function setTaskDone(state: AppState, id: string, done: boolean, now = Date.now()): AppState {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return state;
  let next = updateTask(state, id, {
    status: done ? 'done' : 'todo',
    completedAt: done ? now : undefined,
  });
  if (done && task.status !== 'done' && task.recurrence) {
    const base = task.scheduledDate ?? todayISO(new Date(now));
    next = addTask(next, {
      ...task,
      status: 'todo',
      completedAt: undefined,
      scheduledDate: addDays(base, task.recurrence.everyDays),
      startTime: undefined,
      demo: undefined,
    });
  }
  return next;
}

export function scheduleTask(
  state: AppState,
  id: string,
  date: ISODate | undefined,
  start?: number | null,
): AppState {
  return updateTask(state, id, {
    scheduledDate: date,
    startTime: start === null || start === undefined ? undefined : fromMin(start),
  });
}

export function applyProposals(state: AppState, proposals: Proposal[]): AppState {
  let next = state;
  for (const p of proposals) {
    if (p.kind === 'move' && p.taskId) next = scheduleTask(next, p.taskId, p.date, p.start);
    else if (p.kind === 'new' && p.draft) next = addTask(next, p.draft);
  }
  return next;
}

// ---- courses & topics --------------------------------------------------------

export function updateCourse(state: AppState, id: string, patch: Partial<Course>): AppState {
  return { ...state, courses: replace(state.courses, id, (c) => ({ ...c, ...patch })) };
}

export function addCourse(state: AppState, course: Omit<Course, 'id' | 'topics'>): AppState {
  return { ...state, courses: [...state.courses, { ...course, id: uid('c'), topics: [] }] };
}

export function deleteCourse(state: AppState, id: string): AppState {
  return {
    ...state,
    courses: state.courses.filter((c) => c.id !== id),
    tasks: state.tasks.filter((t) => t.courseId !== id),
    cards: state.cards.filter((c) => c.courseId !== id),
    commitments: state.commitments.map((c) => (c.courseId === id ? { ...c, courseId: undefined } : c)),
  };
}

const mapTopics = (state: AppState, courseId: string, fn: (topics: Topic[]) => Topic[]) =>
  updateCourse(state, courseId, {
    topics: fn(state.courses.find((c) => c.id === courseId)?.topics ?? []),
  });

export function addTopic(state: AppState, courseId: string, topic: Omit<Topic, 'id' | 'difficulty'>): AppState {
  return mapTopics(state, courseId, (ts) => [...ts, { ...topic, id: uid('tp'), difficulty: 0 }]);
}

export function updateTopic(state: AppState, courseId: string, topicId: string, patch: Partial<Topic>): AppState {
  return mapTopics(state, courseId, (ts) => replace(ts, topicId, (t) => ({ ...t, ...patch })));
}

export function deleteTopic(state: AppState, courseId: string, topicId: string): AppState {
  const next = mapTopics(state, courseId, (ts) => ts.filter((t) => t.id !== topicId));
  return {
    ...next,
    tasks: next.tasks.map((t) => (t.topicId === topicId ? { ...t, topicId: undefined } : t)),
    cards: next.cards.map((c) => (c.topicId === topicId ? { ...c, topicId: undefined } : c)),
  };
}

/** Move a topic to `toIndex` within its course (index in the full list). */
export function moveTopic(state: AppState, courseId: string, topicId: string, toIndex: number): AppState {
  return mapTopics(state, courseId, (ts) => {
    const from = ts.findIndex((t) => t.id === topicId);
    if (from < 0) return ts;
    const copy = [...ts];
    const [item] = copy.splice(from, 1);
    copy.splice(Math.max(0, Math.min(copy.length, toIndex)), 0, item!);
    return copy;
  });
}

export function flagTopicDifficult(state: AppState, topicId: string, delta = 1): AppState {
  return {
    ...state,
    courses: state.courses.map((c) =>
      c.topics.some((t) => t.id === topicId)
        ? {
            ...c,
            topics: c.topics.map((t) =>
              t.id === topicId ? { ...t, difficulty: Math.max(0, t.difficulty + delta) } : t,
            ),
          }
        : c,
    ),
  };
}

// ---- commitments ---------------------------------------------------------------

export function upsertCommitment(state: AppState, c: Omit<Commitment, 'id'> & { id?: string }): AppState {
  if (c.id && state.commitments.some((x) => x.id === c.id)) {
    return { ...state, commitments: replace(state.commitments, c.id, () => c as Commitment) };
  }
  return { ...state, commitments: [...state.commitments, { ...c, id: uid('cm') }] };
}

export function deleteCommitment(state: AppState, id: string): AppState {
  return { ...state, commitments: state.commitments.filter((c) => c.id !== id) };
}

// ---- sessions & focus ----------------------------------------------------------

export function addSession(state: AppState, s: Omit<StudySession, 'id'>): AppState {
  return { ...state, sessions: [...state.sessions, { ...s, id: uid('s') }] };
}

export function updateSession(state: AppState, id: string, patch: Partial<StudySession>): AppState {
  return { ...state, sessions: replace(state.sessions, id, (s) => ({ ...s, ...patch })) };
}

export function deleteSession(state: AppState, id: string): AppState {
  return { ...state, sessions: state.sessions.filter((s) => s.id !== id) };
}

export function focusElapsedMs(state: AppState, now = Date.now()): number {
  const f = state.focus;
  return f.accumulatedMs + (f.status === 'running' && f.segmentStartedAt ? now - f.segmentStartedAt : 0);
}

export function startFocus(
  state: AppState,
  args: { courseId: string; taskId?: string; targetMin: number },
  now = Date.now(),
): AppState {
  return {
    ...state,
    focus: {
      status: 'running',
      courseId: args.courseId,
      taskId: args.taskId,
      targetMin: args.targetMin,
      segmentStartedAt: now,
      sessionStartedAt: now,
      accumulatedMs: 0,
    },
    tasks: args.taskId
      ? state.tasks.map((t) =>
          t.id === args.taskId && t.status === 'todo' ? { ...t, status: 'in_progress' } : t,
        )
      : state.tasks,
  };
}

export function pauseFocus(state: AppState, now = Date.now()): AppState {
  if (state.focus.status !== 'running') return state;
  return {
    ...state,
    focus: { ...state.focus, status: 'paused', accumulatedMs: focusElapsedMs(state, now), segmentStartedAt: undefined },
  };
}

export function resumeFocus(state: AppState, now = Date.now()): AppState {
  if (state.focus.status !== 'paused') return state;
  return { ...state, focus: { ...state.focus, status: 'running', segmentStartedAt: now } };
}

export function resetFocus(state: AppState): AppState {
  return {
    ...state,
    focus: { status: 'idle', targetMin: state.settings.focusDefaultMin, accumulatedMs: 0 },
  };
}

/** Finish the running focus session and record it with its reflection. */
export function completeFocus(
  state: AppState,
  args: {
    durationMin: number;
    reflection: Reflection;
    markTaskDone: boolean;
    difficultTopicId?: string;
    addReviewCard?: string;
  },
  now = Date.now(),
): AppState {
  const f = state.focus;
  if (!f.courseId) return resetFocus(state);
  const task = f.taskId ? state.tasks.find((t) => t.id === f.taskId) : undefined;
  const date = todayISO(new Date(f.sessionStartedAt ?? now));
  let next = state;
  if (args.durationMin > 0) {
    next = addSession(next, {
      courseId: f.courseId,
      taskId: task?.id,
      topicId: task?.topicId,
      kind: task?.type ?? 'free',
      date,
      startedAt: f.sessionStartedAt ?? now,
      durationMin: args.durationMin,
      reflection: args.reflection,
    });
  }
  if (task && args.markTaskDone) next = setTaskDone(next, task.id, true, now);
  if (args.difficultTopicId) next = flagTopicDifficult(next, args.difficultTopicId, 1);
  if (args.addReviewCard?.trim()) {
    next = addCard(next, {
      courseId: f.courseId,
      topicId: args.difficultTopicId ?? task?.topicId,
      concept: args.addReviewCard.trim(),
      today: todayISO(new Date(now)),
    });
  }
  return resetFocus(next);
}

// ---- spaced repetition -----------------------------------------------------------

export function addCard(
  state: AppState,
  args: { courseId: string; topicId?: string; concept: string; hint?: string; today: ISODate },
): AppState {
  const card: ReviewCard = {
    id: uid('rc'),
    courseId: args.courseId,
    topicId: args.topicId,
    concept: args.concept,
    hint: args.hint,
    intervalDays: 1,
    due: addDays(args.today, 1),
    reps: 0,
    lapses: 0,
    createdAt: Date.now(),
  };
  return { ...state, cards: [...state.cards, card] };
}

/** Next interval for a rating — intentionally simple and predictable. */
export function nextInterval(card: Pick<ReviewCard, 'intervalDays' | 'reps'>, rating: ReviewRating): number {
  switch (rating) {
    case 'again':
      return 1;
    case 'hard':
      return Math.max(1, Math.round(card.intervalDays * 1.2));
    case 'good':
      return card.reps === 0 ? 3 : Math.max(2, Math.round(card.intervalDays * 2.2));
    case 'easy':
      return card.reps === 0 ? 5 : Math.max(4, Math.round(card.intervalDays * 3));
  }
}

export function rateCard(state: AppState, id: string, rating: ReviewRating, today: ISODate): AppState {
  const card = state.cards.find((c) => c.id === id);
  if (!card) return state;
  const interval = nextInterval(card, rating);
  let next: AppState = {
    ...state,
    cards: replace(state.cards, id, (c) => ({
      ...c,
      intervalDays: interval,
      due: addDays(today, interval),
      reps: c.reps + 1,
      lapses: rating === 'again' ? c.lapses + 1 : c.lapses,
      lastRating: rating,
    })),
  };
  if (rating === 'again' && card.topicId) next = flagTopicDifficult(next, card.topicId, 1);
  return next;
}

export function upsertCard(state: AppState, card: ReviewCard): AppState {
  return state.cards.some((c) => c.id === card.id)
    ? { ...state, cards: replace(state.cards, card.id, () => card) }
    : { ...state, cards: [...state.cards, card] };
}

export function deleteCard(state: AppState, id: string): AppState {
  return { ...state, cards: state.cards.filter((c) => c.id !== id) };
}

// ---- reviews & settings ---------------------------------------------------------

export function saveReview(state: AppState, review: Omit<WeeklyReview, 'id' | 'savedAt'>): AppState {
  const existing = state.reviews.find((r) => r.weekStart === review.weekStart);
  const saved: WeeklyReview = { ...review, id: existing?.id ?? uid('wr'), savedAt: Date.now() };
  return {
    ...state,
    reviews: existing
      ? replace(state.reviews, existing.id, () => saved)
      : [...state.reviews, saved],
  };
}

export function updateSettings(state: AppState, patch: Partial<Settings>): AppState {
  return { ...state, settings: { ...state.settings, ...patch } };
}
