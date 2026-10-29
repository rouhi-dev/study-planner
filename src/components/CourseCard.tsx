import { courseMinutes, semesterInfo, topicProgress } from '../lib/analytics';
import { addDays, faInt, formatDuration, startOfWeek } from '../lib/dates';
import { COURSE_COLOR_CLASSES } from '../lib/labels';
import { budgetFor } from '../lib/schedule';
import type { Course } from '../lib/types';
import { hrefFor } from '../store/router';
import { useStore, useToday } from '../store/store';
import { IconChevronLeft } from './icons';
import { Badge, cx, ProgressBar } from './ui';

/**
 * Course summary: topic progress (counts, not a blended percentage) and this
 * week's study time against the course's share of the weekly budget.
 */
export function CourseCard({ course, rank }: { course: Course; rank: number }) {
  const { state } = useStore();
  const today = useToday();
  const p = topicProgress(course.topics);
  const weekStart = startOfWeek(today);
  const weekMin = courseMinutes(state.sessions, course.id, weekStart, addDays(weekStart, 6));
  const totalWeight = state.courses.reduce((s, c) => s + c.weight, 0) || 1;
  const weekBudget = Array.from({ length: 7 }, (_, i) => budgetFor(state.settings, addDays(weekStart, i))).reduce((a, b) => a + b, 0);
  const target = Math.round(((course.weight / totalWeight) * weekBudget) / 5) * 5;
  const week = semesterInfo(state.settings, today).week;
  const focusTopic =
    course.topics.find((t) => t.status === 'in_progress' && t.kind === 'prerequisite') ??
    course.topics.find((t) => t.status !== 'completed' && (t.targetWeek ?? 99) <= week) ??
    course.topics.find((t) => t.status !== 'completed');
  const colors = COURSE_COLOR_CLASSES[course.color];

  return (
    <a
      href={hrefFor('course', course.id)}
      className={cx(
        'group relative block overflow-hidden rounded-card border border-line bg-surface p-4 shadow-card transition-colors hover:border-line-strong',
      )}
    >
      <span aria-hidden className={cx('absolute inset-y-0 start-0 w-1', colors.bar)} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{course.name}</p>
          <p className="mt-0.5 text-xs text-ink-3">
            سهم زمان: {faInt((course.weight / totalWeight) * 100)}٪
          </p>
        </div>
        {rank === 0 ? <Badge tone="primary">اولویت اول</Badge> : <IconChevronLeft aria-hidden className="mt-1 size-4 text-ink-3 group-hover:text-ink" />}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-ink-3">مباحث کلاس</dt>
          <dd className="num mt-1 font-medium text-ink">
            {faInt(p.course.completed)} از {faInt(p.course.total)}
            {p.course.inProgress > 0 && <bdi className="font-normal text-ink-3">، {faInt(p.course.inProgress)} در جریان</bdi>}
          </dd>
          <ProgressBar className="mt-1.5" size="sm" value={p.course.completed} max={p.course.total} label={`مباحث کلاس ${course.name}`} barClassName={colors.bar} />
        </div>
        <div>
          <dt className="text-ink-3">پیش‌نیازها</dt>
          <dd className="num mt-1 font-medium text-ink">
            {faInt(p.prerequisite.completed)} از {faInt(p.prerequisite.total)}
            {p.prerequisite.inProgress > 0 && <bdi className="font-normal text-ink-3">، {faInt(p.prerequisite.inProgress)} در جریان</bdi>}
          </dd>
          <ProgressBar className="mt-1.5" size="sm" value={p.prerequisite.completed} max={p.prerequisite.total} label={`پیش‌نیازهای ${course.name}`} barClassName={colors.bar} />
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs">
        <span className="text-ink-3">این هفته</span>
        <span className="num text-ink-2">
          <span className={cx('font-semibold', weekMin >= target ? 'text-success' : 'text-ink')}>{formatDuration(weekMin)}</span> از هدف {formatDuration(target)}
        </span>
      </div>
      {focusTopic && (
        <p className="mt-1.5 truncate text-xs text-ink-3">
          تمرکز فعلی: <span className="text-ink-2">{focusTopic.title}</span>
        </p>
      )}
    </a>
  );
}
