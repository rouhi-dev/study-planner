import { addDays, formatDayMonth, formatDuration, formatTime, relativeDay } from '../lib/dates';
import { PRIORITY_LABEL, TASK_TYPE_LABEL } from '../lib/labels';
import { setTaskDone } from '../lib/mutations';
import type { Task } from '../lib/types';
import { useStore, useToday } from '../store/store';
import { IconCalendarClock, IconClock, IconFlag, IconLink, IconNote, IconPencil, IconPlay, IconRepeat } from './icons';
import { usePlanning } from './planning';
import { Badge, CourseTag, cx, DemoBadge, IconButton, TaskCheck, useToast } from './ui';

export function TaskRow({
  task,
  showDate = false,
  showCourse = true,
  compact = false,
}: {
  task: Task;
  showDate?: boolean;
  showCourse?: boolean;
  compact?: boolean;
}) {
  const { state, update } = useStore();
  const today = useToday();
  const toast = useToast();
  const { editTask, reschedule, focusOn } = usePlanning();
  const course = state.courses.find((c) => c.id === task.courseId);
  const topic = course?.topics.find((t) => t.id === task.topicId);
  const done = task.status === 'done';
  const missed = !done && !!task.scheduledDate && task.scheduledDate < today;
  const overdue = !done && !!task.deadline && task.deadline < today;
  const dueSoon = !done && !!task.deadline && !overdue && task.deadline <= addDays(today, 3);

  const toggle = (v: boolean) => {
    update((s) => setTaskDone(s, task.id, v));
    if (v) {
      toast({
        tone: 'success',
        message: task.recurrence ? 'انجام شد؛ نوبت بعدی مرور برنامه‌ریزی شد.' : 'انجام شد.',
        action: { label: 'بازگردانی', run: () => update((s) => setTaskDone(s, task.id, false)) },
      });
    }
  };

  return (
    <div
      className={cx(
        'group flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-subtle/70',
        compact ? 'py-2' : '',
      )}
    >
      <div className="pt-0.5">
        <TaskCheck checked={done} onChange={toggle} label={`${done ? 'برگرداندن' : 'انجام'}: ${task.title}`} />
      </div>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => editTask(task)}
          className={cx('text-start text-[14px] leading-6 font-medium hover:text-primary', done ? 'text-ink-3 line-through decoration-ink-3/50' : 'text-ink')}
        >
          {task.title}
        </button>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
          {showCourse && <CourseTag course={course} />}
          {!compact && topic && <span className="max-w-56 truncate">{topic.title}</span>}
          <span>{TASK_TYPE_LABEL[task.type]}</span>
          <span className="inline-flex items-center gap-1 num">
            <IconClock aria-hidden className="size-3" />
            {task.startTime && <>{formatTime(task.startTime)}، </>}
            {formatDuration(task.estimateMin)}
          </span>
          {showDate && task.scheduledDate && <span>{relativeDay(task.scheduledDate, today)}</span>}
          {task.priority === 'high' && !done && (
            <span className="inline-flex items-center gap-1 text-danger">
              <IconFlag aria-hidden className="size-3" />
              اولویت {PRIORITY_LABEL.high}
            </span>
          )}
          {task.deadline && (
            <Badge tone={overdue ? 'danger' : dueSoon ? 'warn' : 'neutral'}>
              {overdue ? 'مهلت گذشته' : 'مهلت'}: {formatDayMonth(task.deadline)}
            </Badge>
          )}
          {missed && <Badge tone="warn">عقب‌افتاده از {relativeDay(task.scheduledDate!, today)}</Badge>}
          {task.recurrence && (
            <span className="inline-flex items-center gap-1" title="تکرارشونده">
              <IconRepeat aria-hidden className="size-3" />
              تکرار
            </span>
          )}
          {task.notes && <IconNote aria-label="یادداشت دارد" className="size-3" />}
          {task.links.length > 0 && (
            <a
              href={task.links[0]}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <IconLink aria-hidden className="size-3" />
              منبع
            </a>
          )}
          {task.demo && <DemoBadge />}
        </div>
      </div>
      {!done && (
        <div className="flex shrink-0 items-center opacity-100 transition-opacity lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
          <IconButton size="sm" label="شروع جلسهٔ تمرکز برای این کار" icon={IconPlay} onClick={() => focusOn(task)} />
          <IconButton size="sm" label="زمان‌بندی دوباره" icon={IconCalendarClock} onClick={() => reschedule(task)} />
          <IconButton size="sm" label="ویرایش" icon={IconPencil} onClick={() => editTask(task)} />
        </div>
      )}
    </div>
  );
}
