import type {
  CommitmentKind,
  CourseColor,
  Priority,
  TaskStatus,
  TaskType,
  TopicKind,
  TopicStatus,
} from './types';

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'بالا',
  medium: 'متوسط',
  low: 'پایین',
};
export const PRIORITY_ORDER: Priority[] = ['high', 'medium', 'low'];
export const PRIORITY_RANK: Record<Priority, number> = { high: 3, medium: 2, low: 1 };

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  theory: 'مطالعه نظری',
  problem_solving: 'حل مسئله',
  revision: 'مرور',
  assignment: 'تکلیف',
  programming: 'برنامه‌نویسی',
  exam_prep: 'آمادگی امتحان',
};
export const TASK_TYPES = Object.keys(TASK_TYPE_LABEL) as TaskType[];

/** Session kinds that count as active practice in analytics. */
export const ACTIVE_TYPES: ReadonlySet<TaskType> = new Set([
  'problem_solving',
  'assignment',
  'programming',
  'exam_prep',
]);

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'انجام‌نشده',
  in_progress: 'در حال انجام',
  done: 'انجام‌شده',
};

export const TOPIC_STATUS_LABEL: Record<TopicStatus, string> = {
  not_started: 'شروع‌نشده',
  in_progress: 'در حال یادگیری',
  completed: 'تکمیل‌شده',
};
export const TOPIC_STATUSES: TopicStatus[] = ['not_started', 'in_progress', 'completed'];

export const TOPIC_KIND_LABEL: Record<TopicKind, string> = {
  prerequisite: 'پیش‌نیاز و مرور پایه',
  course: 'مباحث کلاس',
};

export const COMMITMENT_KIND_LABEL: Record<CommitmentKind, string> = {
  work: 'کار',
  class: 'کلاس دانشگاه',
  personal: 'شخصی',
  break: 'استراحت',
};
export const COMMITMENT_KINDS = Object.keys(COMMITMENT_KIND_LABEL) as CommitmentKind[];

/**
 * Literal class strings per course colour (kept literal so the Tailwind
 * scanner can see them).
 */
export const COURSE_COLOR_CLASSES: Record<
  CourseColor,
  { dot: string; text: string; soft: string; bar: string; border: string; ring: string }
> = {
  rp: {
    dot: 'bg-rp',
    text: 'text-rp',
    soft: 'bg-rp-soft',
    bar: 'bg-rp',
    border: 'border-rp',
    ring: 'ring-rp/40',
  },
  math: {
    dot: 'bg-math',
    text: 'text-math',
    soft: 'bg-math-soft',
    bar: 'bg-math',
    border: 'border-math',
    ring: 'ring-math/40',
  },
  nn: {
    dot: 'bg-nn',
    text: 'text-nn',
    soft: 'bg-nn-soft',
    bar: 'bg-nn',
    border: 'border-nn',
    ring: 'ring-nn/40',
  },
  rose: {
    dot: 'bg-rose',
    text: 'text-rose',
    soft: 'bg-rose-soft',
    bar: 'bg-rose',
    border: 'border-rose',
    ring: 'ring-rose/40',
  },
  slate: {
    dot: 'bg-slate',
    text: 'text-slate',
    soft: 'bg-slate-soft',
    bar: 'bg-slate',
    border: 'border-slate',
    ring: 'ring-slate/40',
  },
};
export const COURSE_COLOR_LABEL: Record<CourseColor, string> = {
  rp: 'نیلی',
  math: 'سبزآبی',
  nn: 'کهربایی',
  rose: 'گلی',
  slate: 'خاکستری',
};
