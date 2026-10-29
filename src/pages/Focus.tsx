import { useEffect, useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { DatePicker } from '../components/DatePicker';
import { IconHistory, IconPause, IconPencil, IconPlay, IconPlus, IconSquare, IconTarget, IconTrash, IconX } from '../components/icons';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  CourseTag,
  cx,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
  useToast,
} from '../components/ui';
import { addDays, faInt, faNum, formatDuration, formatTime, relativeDay, todayISO } from '../lib/dates';
import { COURSE_COLOR_CLASSES, TASK_TYPE_LABEL } from '../lib/labels';
import {
  addSession,
  completeFocus,
  deleteSession,
  flagTopicDifficult,
  focusElapsedMs,
  pauseFocus,
  resetFocus,
  resumeFocus,
  startFocus,
  updateSession,
} from '../lib/mutations';
import type { Reflection, StudySession } from '../lib/types';
import { useNow, useStore } from '../store/store';

const PRESETS = [25, 45, 50, 60, 90];

function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return faNum(h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`);
}

export function FocusPage() {
  const { state } = useStore();
  const [immersive, setImmersive] = useState(false);
  const [reflectOpen, setReflectOpen] = useState(false);
  const [manual, setManual] = useState<{ open: boolean; session?: StudySession }>({ open: false });
  const active = state.focus.status !== 'idle';

  useEffect(() => {
    if (!active) setImmersive(false);
  }, [active]);

  return (
    <div>
      <PageHeader
        title="جلسات تمرکز"
        subtitle="زمان واقعی مطالعه را ثبت کنید؛ بدون پومودوروی اجباری، هر وقت لازم بود متوقف کنید."
        actions={
          <Button variant="secondary" icon={IconPlus} onClick={() => setManual({ open: true })}>
            ثبت دستی جلسه
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {active ? <RunningTimer onFinish={() => setReflectOpen(true)} onImmersive={() => setImmersive(true)} /> : <FocusSetup />}
        </div>
        <div className="lg:col-span-2">
          <SessionHistory onEdit={(s) => setManual({ open: true, session: s })} />
        </div>
      </div>

      {immersive && active && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg p-6">
          <IconButton label="خروج از حالت تمام‌صفحه" icon={IconX} onClick={() => setImmersive(false)} className="absolute end-4 top-4" />
          <RunningTimer onFinish={() => setReflectOpen(true)} bare />
        </div>
      )}
      <ReflectionDialog open={reflectOpen} onClose={() => setReflectOpen(false)} />
      <ManualSessionDialog open={manual.open} session={manual.session} onClose={() => setManual({ open: false })} />
    </div>
  );
}

function FocusSetup() {
  const { state, update } = useStore();
  const today = todayISO();
  const courses = [...state.courses].sort((a, b) => b.weight - a.weight);
  const [courseId, setCourseId] = useState(state.focus.courseId ?? courses[0]?.id ?? '');
  const [taskId, setTaskId] = useState('');
  const [minutes, setMinutes] = useState(state.settings.focusDefaultMin);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState('');
  const ids = { course: useId(), task: useId(), custom: useId() };

  const tasks = state.tasks
    .filter((t) => t.courseId === courseId && t.status !== 'done')
    .sort((a, b) => (a.scheduledDate === today ? -1 : 0) - (b.scheduledDate === today ? -1 : 0) || (a.scheduledDate ?? '9').localeCompare(b.scheduledDate ?? '9'));

  const start = () => {
    const m = custom ? Number(custom) : minutes;
    if (!courseId) {
      setError('یک درس انتخاب کنید.');
      return;
    }
    if (!(m >= 5 && m <= 240)) {
      setError('مدت را بین ۵ تا ۲۴۰ دقیقه وارد کنید.');
      return;
    }
    update((s) => startFocus(s, { courseId, taskId: taskId || undefined, targetMin: m }));
  };

  if (courses.length === 0) return <EmptyState icon={IconTarget} title="ابتدا یک درس اضافه کنید" />;

  return (
    <Card title="جلسهٔ جدید" subtitle="درس و کار را انتخاب کنید و مدت هدف را تعیین کنید.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="درس" htmlFor={ids.course}>
          <Select
            id={ids.course}
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              setTaskId('');
            }}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="کار" htmlFor={ids.task} hint="اختیاری؛ نوع کار برای گزارش «حل مسئله در برابر مطالعه» استفاده می‌شود.">
          <Select id={ids.task} value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            <option value="">مطالعهٔ آزاد (بدون کار مشخص)</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.scheduledDate === today ? '(امروز) ' : ''}
                {t.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <fieldset className="mt-5">
        <legend className="mb-2 text-[13px] font-medium text-ink-2">مدت هدف</legend>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={!custom && minutes === p}
              onClick={() => {
                setMinutes(p);
                setCustom('');
              }}
              className={cx(
                'num h-9 rounded-lg border px-3.5 text-sm transition-colors',
                !custom && minutes === p ? 'border-primary bg-primary-soft font-semibold text-primary' : 'border-line hover:border-line-strong',
              )}
            >
              {faInt(p)} دقیقه
            </button>
          ))}
          <label htmlFor={ids.custom} className="sr-only">
            مدت دلخواه به دقیقه
          </label>
          <Input
            id={ids.custom}
            type="number"
            min={5}
            max={240}
            placeholder="دلخواه"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="ltr w-28 text-start"
          />
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" icon={IconPlay} onClick={start}>
          شروع
        </Button>
        <p className="text-xs leading-5 text-ink-3">
          با رسیدن به مدت هدف، زمان متوقف نمی‌شود و فقط اعلام می‌شود. پایان جلسه همیشه با شماست.
        </p>
      </div>
    </Card>
  );
}

function RunningTimer({ onFinish, onImmersive, bare }: { onFinish: () => void; onImmersive?: () => void; bare?: boolean }) {
  const { state, update } = useStore();
  const now = useNow(1000);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const f = state.focus;
  const elapsed = focusElapsedMs(state, now.getTime());
  const target = f.targetMin * 60_000;
  const ratio = Math.min(1, elapsed / target);
  const over = elapsed >= target;
  const course = state.courses.find((c) => c.id === f.courseId);
  const task = state.tasks.find((t) => t.id === f.taskId);
  const R = 88;
  const C = 2 * Math.PI * R;
  const ring = course ? COURSE_COLOR_CLASSES[course.color].text : 'text-primary';

  useEffect(() => {
    const prev = document.title;
    document.title = `${clock(elapsed)}، تمرکز`;
    return () => {
      document.title = prev;
    };
  });

  const body = (
    <div className="flex flex-col items-center text-center">
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-sm">
        <CourseTag course={course} short={false} />
        {task && <span className="text-ink-3">{TASK_TYPE_LABEL[task.type]}</span>}
        {f.status === 'paused' && <Badge tone="warn">متوقف موقت</Badge>}
      </div>
      {task && <p className="mb-5 max-w-md text-lg font-semibold leading-8">{task.title}</p>}
      <div className="relative size-56">
        <svg viewBox="0 0 200 200" className="size-full -rotate-90" aria-hidden>
          <circle cx="100" cy="100" r={R} fill="none" stroke="var(--c-sunken)" strokeWidth="8" />
          <circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - ratio)}
            className={cx(ring, 'transition-[stroke-dashoffset] duration-700')}
            style={{ transform: 'scaleY(-1)', transformOrigin: 'center' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="num text-5xl font-semibold tracking-tight ltr" role="timer" aria-live="off">
            {clock(elapsed)}
          </span>
          <span className="mt-1 text-[13px] text-ink-3">
            {over ? `هدف ${faInt(f.targetMin)} دقیقه‌ای رسید` : `${faInt(Math.ceil((target - elapsed) / 60_000))} دقیقه تا هدف`}
          </span>
        </div>
      </div>
      {over && (
        <p className="mt-4 rounded-lg bg-success-soft px-3 py-2 text-[13px] text-success" role="status">
          به هدف رسیدید. اگر روی مسئله‌ای هستید ادامه دهید؛ وگرنه جلسه را تمام کنید و یک استراحت کوتاه بگیرید.
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {f.status === 'running' ? (
          <Button size="lg" variant="secondary" icon={IconPause} onClick={() => update((s) => pauseFocus(s))}>
            توقف موقت
          </Button>
        ) : (
          <Button size="lg" variant="secondary" icon={IconPlay} onClick={() => update((s) => resumeFocus(s))}>
            ادامه
          </Button>
        )}
        <Button
          size="lg"
          variant="primary"
          icon={IconSquare}
          onClick={() => {
            update((s) => pauseFocus(s));
            onFinish();
          }}
        >
          پایان و بازتاب
        </Button>
      </div>
      <div className="mt-3 flex gap-3 text-[13px]">
        {onImmersive && (
          <button type="button" className="text-ink-3 hover:text-ink" onClick={onImmersive}>
            حالت تمام‌صفحه
          </button>
        )}
        <button type="button" className="text-ink-3 hover:text-danger" onClick={() => setConfirmDiscard(true)}>
          لغو بدون ثبت
        </button>
      </div>
      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="لغو جلسه بدون ثبت؟"
        body="زمان این جلسه در گزارش ثبت نمی‌شود."
        confirmLabel="لغو جلسه"
        onConfirm={() => update((s) => resetFocus(s))}
      />
    </div>
  );
  if (bare) return body;
  return <Card bodyClassName="py-10">{body}</Card>;
}

function ReflectionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, update } = useStore();
  const toast = useToast();
  const f = state.focus;
  const course = state.courses.find((c) => c.id === f.courseId);
  const task = state.tasks.find((t) => t.id === f.taskId);
  const [minutes, setMinutes] = useState('0');
  const [r, setR] = useState<Reflection>({ learned: '', difficult: '', revisit: '' });
  const [topicId, setTopicId] = useState('');
  const [markDone, setMarkDone] = useState(false);
  const [toCard, setToCard] = useState(false);
  const [error, setError] = useState('');
  const ids = { min: useId(), l: useId(), d: useId(), v: useId(), topic: useId() };

  useEffect(() => {
    if (!open) return;
    setMinutes(String(Math.max(1, Math.round(focusElapsedMs(state) / 60_000))));
    setR({ learned: '', difficult: '', revisit: '' });
    setTopicId('');
    setMarkDone(false);
    setToCard(false);
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = (e: FormEvent) => {
    e.preventDefault();
    const m = Number(minutes);
    if (!(m >= 1 && m <= 600)) {
      setError('مدت را بین ۱ تا ۶۰۰ دقیقه وارد کنید.');
      return;
    }
    update((s) =>
      completeFocus(s, {
        durationMin: Math.round(m),
        reflection: { learned: r.learned.trim(), difficult: r.difficult.trim(), revisit: r.revisit.trim() },
        markTaskDone: markDone,
        difficultTopicId: topicId || undefined,
        addReviewCard: toCard ? r.revisit : undefined,
      }),
    );
    toast({ tone: 'success', message: `${formatDuration(Math.round(m))} مطالعه ثبت شد.` });
    onClose();
  };

  return (
    <Modal
      open={open && f.status !== 'idle'}
      onClose={onClose}
      title="بازتاب کوتاه"
      description="یک دقیقه وقت بگذارید؛ همین یادداشت‌ها مرور هفتگی و مباحث دشوار را می‌سازند."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            برگشت به تایمر
          </Button>
          <Button variant="primary" type="submit" form="reflect-form">
            ثبت جلسه
          </Button>
        </>
      }
    >
      <form id="reflect-form" onSubmit={save} noValidate className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
          <CourseTag course={course} short={false} />
          {task && <span>، {task.title}</span>}
        </div>
        <Field label="مدت مطالعهٔ واقعی (دقیقه)" htmlFor={ids.min} error={error} hint="اگر وسط جلسه کار دیگری کردید، عدد را اصلاح کنید.">
          <Input id={ids.min} type="number" min={1} max={600} value={minutes} invalid={!!error} onChange={(e) => setMinutes(e.target.value)} className="ltr w-32 text-start" />
        </Field>
        <Field label="چه چیزی یاد گرفتم؟" htmlFor={ids.l}>
          <Textarea id={ids.l} rows={2} data-autofocus value={r.learned} onChange={(e) => setR({ ...r, learned: e.target.value })} />
        </Field>
        <Field label="چه چیزی سخت بود؟" htmlFor={ids.d}>
          <Textarea id={ids.d} rows={2} value={r.difficult} onChange={(e) => setR({ ...r, difficult: e.target.value })} />
        </Field>
        {course && course.topics.length > 0 && (
          <Field label="مبحث دشوار (اختیاری)" htmlFor={ids.topic} hint="در گزارش «مباحث دشوار» و پیشنهاد برنامهٔ هفتهٔ بعد اثر می‌گذارد.">
            <Select id={ids.topic} value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              <option value="">—</option>
              {course.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="چه چیزی را باید دوباره مرور کنم؟" htmlFor={ids.v}>
          <Textarea id={ids.v} rows={2} value={r.revisit} onChange={(e) => setR({ ...r, revisit: e.target.value })} />
        </Field>
        <label className={cx('flex items-center gap-2 text-sm', !r.revisit.trim() && 'opacity-50')}>
          <input type="checkbox" className="accent-primary" disabled={!r.revisit.trim()} checked={toCard && !!r.revisit.trim()} onChange={(e) => setToCard(e.target.checked)} />
          این مورد را به مرور فاصله‌دار اضافه کن (اولین مرور: فردا)
        </label>
        {task && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-primary" checked={markDone} onChange={(e) => setMarkDone(e.target.checked)} />
            کار «{task.title}» انجام شد
          </label>
        )}
      </form>
    </Modal>
  );
}

function SessionHistory({ onEdit }: { onEdit: (s: StudySession) => void }) {
  const { state, update } = useStore();
  const today = todayISO();
  const [toDelete, setToDelete] = useState<StudySession | null>(null);
  const recent = useMemo(
    () => state.sessions.filter((s) => s.date >= addDays(today, -13)).sort((a, b) => b.startedAt - a.startedAt),
    [state.sessions, today],
  );
  const total = recent.reduce((s, x) => s + x.durationMin, 0);
  return (
    <Card title="جلسات اخیر" subtitle={`دو هفتهٔ اخیر: ${formatDuration(total)}`}>
      {recent.length === 0 ? (
        <EmptyState compact icon={IconHistory} title="هنوز جلسه‌ای ثبت نشده" body="اولین جلسهٔ تمرکز را شروع کنید." />
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {recent.map((s) => {
            const c = state.courses.find((x) => x.id === s.courseId);
            const t = state.tasks.find((x) => x.id === s.taskId);
            return (
              <li key={s.id} className="flex items-start gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{t?.title ?? 'مطالعهٔ آزاد'}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
                    <CourseTag course={c} />
                    <span>{relativeDay(s.date, today)}</span>
                    <span className="num">{formatTime(new Date(s.startedAt).toTimeString().slice(0, 5))}</span>
                    {s.demo && <Badge>نمونه</Badge>}
                  </p>
                  {s.reflection.difficult && <p className="mt-1 text-xs text-ink-2">سخت: {s.reflection.difficult}</p>}
                </div>
                <span className="num mt-0.5 shrink-0 text-xs font-medium text-ink-2">{formatDuration(s.durationMin)}</span>
                <IconButton size="sm" label="ویرایش جلسه" icon={IconPencil} onClick={() => onEdit(s)} />
                <IconButton size="sm" label="حذف جلسه" icon={IconTrash} onClick={() => setToDelete(s)} />
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="حذف جلسه؟"
        body="زمان این جلسه از گزارش‌ها کم می‌شود."
        confirmLabel="حذف"
        onConfirm={() => toDelete && update((s) => deleteSession(s, toDelete.id))}
      />
    </Card>
  );
}

function ManualSessionDialog({ open, onClose, session }: { open: boolean; onClose: () => void; session?: StudySession }) {
  const { state, update } = useStore();
  const toast = useToast();
  const today = todayISO();
  const [f, setF] = useState({ date: today, courseId: '', taskId: '', minutes: '45', learned: '', difficult: '', revisit: '', topicId: '' });
  const [error, setError] = useState('');
  const ids = { course: useId(), task: useId(), min: useId(), date: useId(), l: useId(), d: useId(), v: useId(), topic: useId() };
  useEffect(() => {
    if (!open) return;
    setF({
      date: session?.date ?? today,
      courseId: session?.courseId ?? state.courses[0]?.id ?? '',
      taskId: session?.taskId ?? '',
      minutes: String(session?.durationMin ?? 45),
      learned: session?.reflection.learned ?? '',
      difficult: session?.reflection.difficult ?? '',
      revisit: session?.reflection.revisit ?? '',
      topicId: '',
    });
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session?.id]);
  const course = state.courses.find((c) => c.id === f.courseId);
  const tasks = state.tasks.filter((t) => t.courseId === f.courseId);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const m = Number(f.minutes);
    if (!(m >= 1 && m <= 600)) return setError('مدت را بین ۱ تا ۶۰۰ دقیقه وارد کنید.');
    if (f.date > today) return setError('جلسهٔ آینده را نمی‌توان ثبت کرد.');
    const task = state.tasks.find((t) => t.id === f.taskId);
    const reflection = { learned: f.learned.trim(), difficult: f.difficult.trim(), revisit: f.revisit.trim() };
    if (session) {
      update((s) => updateSession(s, session.id, { date: f.date, courseId: f.courseId, taskId: task?.id, kind: task?.type ?? 'free', durationMin: Math.round(m), reflection }));
    } else {
      update((s) => {
        let next = addSession(s, {
          courseId: f.courseId,
          taskId: task?.id,
          topicId: task?.topicId,
          kind: task?.type ?? 'free',
          date: f.date,
          startedAt: new Date(`${f.date}T12:00:00`).getTime(),
          durationMin: Math.round(m),
          reflection,
        });
        if (f.topicId) next = flagTopicDifficult(next, f.topicId, 1);
        return next;
      });
    }
    toast({ tone: 'success', message: session ? 'جلسه به‌روز شد.' : 'جلسه ثبت شد.' });
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={session ? 'ویرایش جلسه' : 'ثبت دستی جلسه'}
      description="برای مطالعه‌ای که بدون تایمر انجام شده است."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button variant="primary" type="submit" form="manual-form">
            ذخیره
          </Button>
        </>
      }
    >
      <form id="manual-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="تاریخ" htmlFor={ids.date}>
          <DatePicker id={ids.date} value={f.date} onChange={(v) => v && setF({ ...f, date: v })} />
        </Field>
        <Field label="مدت (دقیقه)" htmlFor={ids.min} error={error}>
          <Input id={ids.min} type="number" min={1} max={600} value={f.minutes} invalid={!!error} onChange={(e) => setF({ ...f, minutes: e.target.value })} className="ltr text-start" />
        </Field>
        <Field label="درس" htmlFor={ids.course}>
          <Select id={ids.course} value={f.courseId} onChange={(e) => setF({ ...f, courseId: e.target.value, taskId: '', topicId: '' })}>
            {state.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="کار" htmlFor={ids.task}>
          <Select id={ids.task} value={f.taskId} onChange={(e) => setF({ ...f, taskId: e.target.value })}>
            <option value="">مطالعهٔ آزاد</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="چه چیزی یاد گرفتم؟" htmlFor={ids.l} className="sm:col-span-2">
          <Textarea id={ids.l} rows={2} value={f.learned} onChange={(e) => setF({ ...f, learned: e.target.value })} />
        </Field>
        <Field label="چه چیزی سخت بود؟" htmlFor={ids.d} className="sm:col-span-2">
          <Textarea id={ids.d} rows={2} value={f.difficult} onChange={(e) => setF({ ...f, difficult: e.target.value })} />
        </Field>
        {!session && course && (
          <Field label="مبحث دشوار (اختیاری)" htmlFor={ids.topic}>
            <Select id={ids.topic} value={f.topicId} onChange={(e) => setF({ ...f, topicId: e.target.value })}>
              <option value="">—</option>
              {course.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="چه چیزی را دوباره مرور کنم؟" htmlFor={ids.v} className="sm:col-span-2">
          <Textarea id={ids.v} rows={2} value={f.revisit} onChange={(e) => setF({ ...f, revisit: e.target.value })} />
        </Field>
      </form>
    </Modal>
  );
}
