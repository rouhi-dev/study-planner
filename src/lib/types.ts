/** ISO calendar date in local time, `YYYY-MM-DD`. */
export type ISODate = string;
/** Wall-clock time, `HH:MM` (24h). */
export type HHMM = string;
/** Iranian week index: 0 = Saturday … 6 = Friday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type CourseColor = 'rp' | 'math' | 'nn' | 'rose' | 'slate';

export type TopicKind = 'prerequisite' | 'course';
export type TopicStatus = 'not_started' | 'in_progress' | 'completed';

export interface Topic {
  id: string;
  title: string;
  kind: TopicKind;
  status: TopicStatus;
  /** Semester week (1-based) in which the topic is planned to be covered. */
  targetWeek?: number;
  /** How many times the topic was flagged as difficult (reflections, hard reviews). */
  difficulty: number;
  notes?: string;
}

export interface Course {
  id: string;
  name: string;
  shortName: string;
  color: CourseColor;
  instructor?: string;
  description?: string;
  /** Relative share of study time used by the weekly proposal generator. */
  weight: number;
  topics: Topic[];
}

export type Priority = 'high' | 'medium' | 'low';
export type TaskType =
  | 'theory'
  | 'problem_solving'
  | 'revision'
  | 'assignment'
  | 'programming'
  | 'exam_prep';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  title: string;
  courseId: string;
  topicId?: string;
  priority: Priority;
  estimateMin: number;
  type: TaskType;
  status: TaskStatus;
  /** Hard deadline (assignments, exams). */
  deadline?: ISODate;
  /** Day the task is planned for. */
  scheduledDate?: ISODate;
  /** Start time on the planned day; tasks without one sit in the day's tray. */
  startTime?: HHMM;
  notes?: string;
  links: string[];
  /** Recurring revision: on completion a copy is planned `everyDays` later. */
  recurrence?: { everyDays: number };
  createdAt: number;
  completedAt?: number;
  demo?: boolean;
}

export type CommitmentKind = 'work' | 'class' | 'personal' | 'break';

/** A fixed block of time the planner must never schedule study into. */
export interface Commitment {
  id: string;
  title: string;
  kind: CommitmentKind;
  /** Recurring weekdays. Ignored when `date` is set. */
  days: Weekday[];
  /** One-off commitment on a single date. */
  date?: ISODate;
  start: HHMM;
  end: HHMM;
  courseId?: string;
  demo?: boolean;
}

export interface Reflection {
  learned: string;
  difficult: string;
  revisit: string;
}

export interface StudySession {
  id: string;
  courseId: string;
  taskId?: string;
  topicId?: string;
  /** Task type at the time of the session; `free` when no task was selected. */
  kind: TaskType | 'free';
  date: ISODate;
  startedAt: number;
  durationMin: number;
  reflection: Reflection;
  demo?: boolean;
}

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

/** Lightweight spaced-repetition card for a difficult concept. */
export interface ReviewCard {
  id: string;
  courseId: string;
  topicId?: string;
  concept: string;
  hint?: string;
  intervalDays: number;
  due: ISODate;
  reps: number;
  lapses: number;
  lastRating?: ReviewRating;
  createdAt: number;
  demo?: boolean;
}

export interface WeeklyGoal {
  id: string;
  text: string;
  done: boolean;
}

export interface WeeklyReview {
  id: string;
  /** Saturday that starts the reviewed week. */
  weekStart: ISODate;
  lessons: string;
  difficultTopicIds: string[];
  goals: WeeklyGoal[];
  savedAt: number;
}

export type ThemePref = 'light' | 'dark' | 'system';

export interface Settings {
  name: string;
  university: string;
  program: string;
  semesterStart: ISODate;
  semesterWeeks: number;
  dailyBudgetMin: number;
  /** Per-weekday budget overrides in minutes (index = Weekday). */
  budgetOverrides: Partial<Record<Weekday, number>>;
  dayStart: HHMM;
  dayEnd: HHMM;
  /** Automatic suggestions try slots from this time first (e.g. after work). */
  preferredStudyStart?: HHMM;
  focusDefaultMin: number;
  theme: ThemePref;
}

export type FocusStatus = 'idle' | 'running' | 'paused';

export interface FocusState {
  status: FocusStatus;
  courseId?: string;
  taskId?: string;
  targetMin: number;
  /** Epoch ms when the current running segment started. */
  segmentStartedAt?: number;
  /** Epoch ms when the session first started. */
  sessionStartedAt?: number;
  accumulatedMs: number;
}

export interface AppState {
  version: 1;
  settings: Settings;
  courses: Course[];
  tasks: Task[];
  commitments: Commitment[];
  sessions: StudySession[];
  cards: ReviewCard[];
  reviews: WeeklyReview[];
  focus: FocusState;
  meta: {
    updatedAt: number;
    /** True while the workspace still contains the bundled demo data. */
    demo: boolean;
  };
}
