import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { CourseEditor } from '../components/CourseEditor';
import {
  IconArrowDown,
  IconArrowUp,
  IconBook,
  IconCircle,
  IconCircleCheck,
  IconCircleDashed,
  IconFlag,
  IconGrip,
  IconNote,
  IconPencil,
  IconPlus,
  IconTrash,
} from '../components/icons';
import { usePlanning } from '../components/planning';
import { TaskRow } from '../components/TaskRow';
import {
  Badge,
  Button,
  Callout,
  Card,
  ConfirmDialog,
  cx,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  Select,
  Textarea,
  useToast,
} from '../components/ui';
import { courseMinutes, semesterInfo, topicProgress } from '../lib/analytics';
import { addDays, faInt, formatDuration, startOfWeek } from '../lib/dates';
import { COURSE_COLOR_CLASSES, TOPIC_KIND_LABEL, TOPIC_STATUS_LABEL, TOPIC_STATUSES } from '../lib/labels';
import { addTopic, deleteTopic, moveTopic, updateCourse, updateTopic } from '../lib/mutations';
import type { Course, Topic, TopicKind, TopicStatus } from '../lib/types';
import { hrefFor } from '../store/router';
import { useStore, useToday } from '../store/store';

const STATUS_ICON = { not_started: IconCircle, in_progress: IconCircleDashed, completed: IconCircleCheck } as const;
const STATUS_TONE = { not_started: 'text-ink-3', in_progress: 'text-warn', completed: 'text-success' } as const;

export function CourseDetailPage({ courseId }: { courseId: string }) {
  const { state, update } = useStore();
  const today = useToday();
  const course = state.courses.find((c) => c.id === courseId);
  const [editCourse, setEditCourse] = useState(false);
  const [topicEdit, setTopicEdit] = useState<{ open: boolean; topic?: Topic; kind?: TopicKind }>({ open: false });
  const { newTask } = usePlanning();

  if (!course) {
    return (
      <EmptyState
        icon={IconBook}
        title="این درس پیدا نشد"
        body="ممکن است حذف شده باشد."
        action={
          <a href={hrefFor('courses')} className="text-sm font-medium text-primary hover:underline">
            بازگشت به درس‌ها
          </a>
        }
      />
    );
  }

  const sem = semesterInfo(state.settings, today);
  const progress = topicProgress(course.topics);
  const colors = COURSE_COLOR_CLASSES[course.color];
  const weekStart = startOfWeek(today);
  const totalMin = courseMinutes(state.sessions, course.id);
  const weekMin = courseMinutes(state.sessions, course.id, weekStart, addDays(weekStart, 6));
  const openTasks = state.tasks
    .filter((t) => t.courseId === course.id && t.status !== 'done')
    .sort((a, b) => (a.scheduledDate ?? '9999').localeCompare(b.scheduledDate ?? '9999'));
  const behind = course.topics.filter((t) => t.status !== 'completed' && t.targetWeek && t.targetWeek < sem.week);
  const totalWeight = state.courses.reduce((s, c) => s + c.weight, 0) || 1;

  return (
    <div>
      <a href={hrefFor('courses')} className="mb-3 inline-block text-[13px] text-ink-3 hover:text-ink">
        → درس‌ها
      </a>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden className={cx('mt-2 h-8 w-1.5 rounded-full', colors.bar)} />
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{course.name}</h1>
            <p className="mt-1 text-sm text-ink-3">
              {course.instructor ? `استاد: ${course.instructor}` : 'نام استاد ثبت نشده'}، سهم زمان {faInt((course.weight / totalWeight) * 100)}٪
            </p>
            {course.description && <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-2">{course.description}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={IconPencil} onClick={() => setEditCourse(true)}>
            ویرایش درس
          </Button>
          <Button variant="primary" icon={IconPlus} onClick={() => newTask({ courseId: course.id })}>
            کار جدید
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'مباحث کلاس تکمیل‌شده', value: `${faInt(progress.course.completed)} از ${faInt(progress.course.total)}` },
          { label: 'پیش‌نیازهای تکمیل‌شده', value: `${faInt(progress.prerequisite.completed)} از ${faInt(progress.prerequisite.total)}` },
          { label: 'مطالعهٔ این هفته', value: formatDuration(weekMin) },
          { label: 'کل مطالعهٔ ثبت‌شده', value: formatDuration(totalMin) },
        ].map((m) => (
          <div key={m.label} className="rounded-card border border-line bg-surface p-4 shadow-card">
            <p className="text-xs text-ink-3">{m.label}</p>
            <p className="num mt-1 text-lg font-semibold">{m.value}</p>
          </div>
        ))}
      </div>

      <WeightControl course={course} onChange={(w) => update((s) => updateCourse(s, course.id, { weight: w }))} />

      {behind.length > 0 && (
        <Callout tone="warn" className="mb-6" title={`${faInt(behind.length)} مبحث از نقشهٔ ترم عقب است`}>
          {behind.map((t) => t.title).join('، ')}. نیازی نیست همه را یک‌جا جبران کنید؛ در مرور هفتگی برای هفتهٔ بعد پیشنهاد بگیرید.
        </Callout>
      )}

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="flex flex-col gap-6 xl:col-span-3">
          {(['prerequisite', 'course'] as TopicKind[]).map((kind) => (
            <TopicList
              key={kind}
              course={course}
              kind={kind}
              currentWeek={sem.week}
              onEdit={(topic) => setTopicEdit({ open: true, topic })}
              onAdd={() => setTopicEdit({ open: true, kind })}
            />
          ))}
        </div>
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Roadmap course={course} currentWeek={sem.week} totalWeeks={state.settings.semesterWeeks} />
          <Card title="کارهای باز این درس" subtitle={`${faInt(openTasks.length)} کار`}>
            {openTasks.length === 0 ? (
              <p className="text-[13px] text-ink-3">کار بازی برای این درس ثبت نشده است.</p>
            ) : (
              <div className="-mx-2 flex flex-col">
                {openTasks.slice(0, 8).map((t) => (
                  <TaskRow key={t.id} task={t} showCourse={false} showDate compact />
                ))}
              </div>
            )}
            {openTasks.length > 8 && (
              <a href={hrefFor('tasks')} className="mt-2 inline-block text-[13px] text-primary hover:underline">
                مشاهدهٔ همه در وظایف
              </a>
            )}
          </Card>
        </div>
      </div>

      <CourseEditor open={editCourse} onClose={() => setEditCourse(false)} course={course} />
      <TopicEditor
        open={topicEdit.open}
        course={course}
        topic={topicEdit.topic}
        defaultKind={topicEdit.kind}
        totalWeeks={state.settings.semesterWeeks}
        onClose={() => setTopicEdit({ open: false })}
      />
    </div>
  );
}

function WeightControl({ course, onChange }: { course: Course; onChange: (w: number) => void }) {
  const id = useId();
  const [v, setV] = useState(course.weight);
  useEffect(() => setV(course.weight), [course.weight]);
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 shadow-card">
      <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
        وزن این درس در پیشنهاد برنامه
      </label>
      <input
        id={id}
        type="range"
        min={5}
        max={70}
        step={5}
        value={v}
        onChange={(e) => setV(Number(e.target.value))}
        onPointerUp={() => v !== course.weight && onChange(v)}
        onKeyUp={() => v !== course.weight && onChange(v)}
        onBlur={() => v !== course.weight && onChange(v)}
        className="w-48 accent-primary"
      />
      <span className="num text-sm font-semibold">{faInt(v)}</span>
      <span className="text-xs text-ink-3">نسبت به وزن درس‌های دیگر سنجیده می‌شود.</span>
    </div>
  );
}

function TopicList({
  course,
  kind,
  currentWeek,
  onEdit,
  onAdd,
}: {
  course: Course;
  kind: TopicKind;
  currentWeek: number;
  onEdit: (t: Topic) => void;
  onAdd: () => void;
}) {
  const { update } = useStore();
  const dragId = useRef<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const topics = course.topics.filter((t) => t.kind === kind);
  const indexOf = (id: string) => course.topics.findIndex((t) => t.id === id);

  const move = (topic: Topic, dir: -1 | 1) => {
    const pos = topics.findIndex((t) => t.id === topic.id);
    const neighbour = topics[pos + dir];
    if (!neighbour) return;
    update((s) => moveTopic(s, course.id, topic.id, indexOf(neighbour.id)));
  };

  const setStatus = (topic: Topic, status: TopicStatus) => update((s) => updateTopic(s, course.id, topic.id, { status }));

  return (
    <Card
      title={TOPIC_KIND_LABEL[kind]}
      subtitle={
        kind === 'prerequisite'
          ? 'بازسازی پایه، هم‌زمان با مباحث کلاس؛ لازم نیست اول همه تمام شوند.'
          : 'مباحثی که در کلاس تدریس می‌شود؛ با سرفصل استاد تطبیق دهید.'
      }
      action={
        <Button size="sm" variant="ghost" icon={IconPlus} onClick={onAdd}>
          مبحث
        </Button>
      }
    >
      {topics.length === 0 ? (
        <EmptyState compact icon={IconBook} title="مبحثی ثبت نشده" action={<Button size="sm" variant="soft" onClick={onAdd}>افزودن مبحث</Button>} />
      ) : (
        <ol className="flex flex-col">
          {topics.map((t, i) => {
            const Icon = STATUS_ICON[t.status];
            const late = t.status !== 'completed' && !!t.targetWeek && t.targetWeek < currentWeek;
            return (
              <li
                key={t.id}
                draggable
                onDragStart={(e) => {
                  dragId.current = t.id;
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', t.id);
                }}
                onDragOver={(e) => {
                  if (!dragId.current || !topics.some((x) => x.id === dragId.current)) return;
                  e.preventDefault();
                  setOver(t.id);
                }}
                onDragLeave={() => setOver((o) => (o === t.id ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = dragId.current;
                  dragId.current = null;
                  setOver(null);
                  if (id && id !== t.id) update((s) => moveTopic(s, course.id, id, indexOf(t.id)));
                }}
                onDragEnd={() => {
                  dragId.current = null;
                  setOver(null);
                }}
                className={cx(
                  'group flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line py-2.5 last:border-b-0 sm:flex-nowrap',
                  over === t.id && 'border-t-2 border-t-primary',
                )}
              >
                <IconGrip aria-hidden className="hidden size-4 shrink-0 cursor-grab text-ink-3 sm:block" />
                <Icon aria-hidden className={cx('size-[18px] shrink-0', STATUS_TONE[t.status])} />
                <button type="button" onClick={() => onEdit(t)} className="min-w-0 flex-1 text-start">
                  <span className={cx('block text-[14px] leading-6', t.status === 'completed' ? 'text-ink-3' : 'text-ink')}>{t.title}</span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                    {t.targetWeek && (
                      <span className={cx(late && 'font-medium text-warn')}>
                        هفتهٔ {faInt(t.targetWeek)}
                        {late && '، عقب از برنامه'}
                      </span>
                    )}
                    {t.difficulty > 0 && (
                      <span className="inline-flex items-center gap-1 text-danger" title="تعداد دفعاتی که دشوار علامت خورده">
                        <IconFlag aria-hidden className="size-3" />
                        دشوار ×{faInt(t.difficulty)}
                      </span>
                    )}
                    {t.notes && <IconNote aria-label="یادداشت دارد" className="size-3" />}
                  </span>
                </button>
                <label className="sr-only" htmlFor={`st-${t.id}`}>
                  وضعیت {t.title}
                </label>
                <select
                  id={`st-${t.id}`}
                  value={t.status}
                  onChange={(e) => setStatus(t, e.target.value as TopicStatus)}
                  className={cx(
                    'h-8 cursor-pointer rounded-md border border-line bg-surface px-2 text-xs font-medium focus:border-primary focus:outline-none',
                    STATUS_TONE[t.status],
                  )}
                >
                  {TOPIC_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {TOPIC_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <div className="flex shrink-0">
                  <IconButton size="sm" label="بالا بردن" icon={IconArrowUp} disabled={i === 0} onClick={() => move(t, -1)} />
                  <IconButton size="sm" label="پایین آوردن" icon={IconArrowDown} disabled={i === topics.length - 1} onClick={() => move(t, 1)} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

function Roadmap({ course, currentWeek, totalWeeks }: { course: Course; currentWeek: number; totalWeeks: number }) {
  const weeks = Array.from({ length: Math.max(0, totalWeeks - currentWeek + 1) }, (_, i) => currentWeek + i);
  const unplanned = course.topics.filter((t) => !t.targetWeek && t.status !== 'completed');
  const late = course.topics.filter((t) => t.targetWeek && t.targetWeek < currentWeek && t.status !== 'completed');
  return (
    <Card title="نقشهٔ هفته‌های باقی‌مانده" subtitle="هفتهٔ هدف هر مبحث؛ از ویرایش مبحث تغییر دهید.">
      <ol className="flex flex-col">
        {late.length > 0 && (
          <li className="flex gap-3 border-b border-line py-2">
            <span className="w-16 shrink-0 text-xs font-medium text-warn">عقب‌مانده</span>
            <TopicChips topics={late} />
          </li>
        )}
        {weeks.map((w) => {
          const list = course.topics.filter((t) => t.targetWeek === w);
          return (
            <li key={w} className="flex gap-3 border-b border-line py-2 last:border-b-0">
              <span className={cx('num w-16 shrink-0 text-xs', w === currentWeek ? 'font-semibold text-primary' : 'text-ink-3')}>
                هفتهٔ {faInt(w)}
                {w === currentWeek && <span className="block text-[11px] font-normal">این هفته</span>}
              </span>
              {list.length ? <TopicChips topics={list} /> : <span className="text-xs text-ink-3">—</span>}
            </li>
          );
        })}
      </ol>
      {unplanned.length > 0 && <p className="mt-3 text-xs text-ink-3">بدون هفتهٔ هدف: {unplanned.map((t) => t.title).join('، ')}</p>}
    </Card>
  );
}

function TopicChips({ topics }: { topics: Topic[] }) {
  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {topics.map((t) => (
        <Badge key={t.id} tone={t.status === 'completed' ? 'success' : t.status === 'in_progress' ? 'warn' : 'neutral'}>
          {t.kind === 'prerequisite' && <span className="opacity-70">پایه:</span>}
          <span className="max-w-52 truncate">{t.title}</span>
        </Badge>
      ))}
    </div>
  );
}

function TopicEditor({
  open,
  onClose,
  course,
  topic,
  defaultKind,
  totalWeeks,
}: {
  open: boolean;
  onClose: () => void;
  course: Course;
  topic?: Topic;
  defaultKind?: TopicKind;
  totalWeeks: number;
}) {
  const { update } = useStore();
  const toast = useToast();
  const [f, setF] = useState({ title: '', kind: 'course' as TopicKind, status: 'not_started' as TopicStatus, targetWeek: '', notes: '' });
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const ids = { title: useId(), kind: useId(), status: useId(), week: useId(), notes: useId() };

  useEffect(() => {
    if (!open) return;
    setF({
      title: topic?.title ?? '',
      kind: topic?.kind ?? defaultKind ?? 'course',
      status: topic?.status ?? 'not_started',
      targetWeek: topic?.targetWeek ? String(topic.targetWeek) : '',
      notes: topic?.notes ?? '',
    });
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, topic?.id]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.title.trim()) {
      setError('عنوان مبحث را وارد کنید.');
      return;
    }
    const data = {
      title: f.title.trim(),
      kind: f.kind,
      status: f.status,
      targetWeek: f.targetWeek ? Number(f.targetWeek) : undefined,
      notes: f.notes.trim() || undefined,
    };
    update((s) => (topic ? updateTopic(s, course.id, topic.id, data) : addTopic(s, course.id, data)));
    toast({ tone: 'success', message: topic ? 'مبحث به‌روز شد.' : 'مبحث اضافه شد.' });
    onClose();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={topic ? 'ویرایش مبحث' : 'مبحث جدید'}
        description={course.name}
        footer={
          <>
            {topic && (
              <Button variant="ghost" icon={IconTrash} className="me-auto text-danger" onClick={() => setConfirm(true)}>
                حذف
              </Button>
            )}
            {topic && topic.difficulty > 0 && (
              <Button
                variant="ghost"
                onClick={() => {
                  update((s) => updateTopic(s, course.id, topic.id, { difficulty: 0 }));
                  toast({ tone: 'success', message: 'شمارش دشواری صفر شد.' });
                }}
              >
                دیگر دشوار نیست
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              انصراف
            </Button>
            <Button variant="primary" type="submit" form="topic-form">
              ذخیره
            </Button>
          </>
        }
      >
        <form id="topic-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="عنوان" htmlFor={ids.title} error={error} className="sm:col-span-2">
            <Input id={ids.title} data-autofocus value={f.title} invalid={!!error} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <Field label="دسته" htmlFor={ids.kind}>
            <Select id={ids.kind} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as TopicKind })}>
              <option value="prerequisite">{TOPIC_KIND_LABEL.prerequisite}</option>
              <option value="course">{TOPIC_KIND_LABEL.course}</option>
            </Select>
          </Field>
          <Field label="وضعیت" htmlFor={ids.status}>
            <Select id={ids.status} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as TopicStatus })}>
              {TOPIC_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TOPIC_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="هفتهٔ هدف در ترم" htmlFor={ids.week}>
            <Select id={ids.week} value={f.targetWeek} onChange={(e) => setF({ ...f, targetWeek: e.target.value })}>
              <option value="">تعیین نشده</option>
              {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  هفتهٔ {faInt(w)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="hidden sm:block" />
          <Field label="یادداشت" htmlFor={ids.notes} className="sm:col-span-2">
            <Textarea id={ids.notes} rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="منبع، فصل کتاب، نکات استاد…" />
          </Field>
        </form>
      </Modal>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="حذف مبحث؟"
        body={`«${topic?.title ?? ''}» حذف می‌شود. کارهای مرتبط باقی می‌مانند اما دیگر به این مبحث متصل نیستند.`}
        confirmLabel="حذف"
        onConfirm={() => {
          if (!topic) return;
          update((s) => deleteTopic(s, course.id, topic.id));
          toast({ tone: 'success', message: 'مبحث حذف شد.' });
          onClose();
        }}
      />
    </>
  );
}
