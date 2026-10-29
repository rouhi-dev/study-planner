import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { formatDuration, fromMin, todayISO, toMin } from '../lib/dates';
import { PRIORITY_LABEL, TASK_TYPE_LABEL, TASK_TYPES } from '../lib/labels';
import { addTask, deleteTask, updateTask, type TaskDraft } from '../lib/mutations';
import { checkPlacement, PLACEMENT_MESSAGE } from '../lib/schedule';
import type { Priority, Task, TaskType } from '../lib/types';
import { useStore } from '../store/store';
import { DatePicker } from './DatePicker';
import { IconTrash } from './icons';
import { Button, Callout, ConfirmDialog, Field, Input, Modal, Segmented, Select, Textarea, useToast } from './ui';

interface FormState {
  title: string;
  courseId: string;
  topicId: string;
  type: TaskType;
  priority: Priority;
  estimate: string;
  scheduledDate?: string;
  startTime: string;
  deadline?: string;
  recurrence: string;
  notes: string;
  links: string;
}

function toForm(task: Partial<Task>, fallbackCourse: string): FormState {
  return {
    title: task.title ?? '',
    courseId: task.courseId ?? fallbackCourse,
    topicId: task.topicId ?? '',
    type: task.type ?? 'theory',
    priority: task.priority ?? 'medium',
    estimate: String(task.estimateMin ?? 45),
    scheduledDate: task.scheduledDate,
    startTime: task.startTime ?? '',
    deadline: task.deadline,
    recurrence: task.recurrence ? String(task.recurrence.everyDays) : '',
    notes: task.notes ?? '',
    links: (task.links ?? []).join('\n'),
  };
}

type Errors = Partial<Record<keyof FormState, string>>;

function isUrl(s: string) {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function TaskEditor({
  open,
  onClose,
  task,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  task?: Task;
  defaults?: Partial<Task>;
}) {
  const { state, update } = useStore();
  const toast = useToast();
  const fallbackCourse = state.courses[0]?.id ?? '';
  const [f, setF] = useState<FormState>(() => toForm(task ?? defaults ?? {}, fallbackCourse));
  const [errors, setErrors] = useState<Errors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ids = { title: useId(), course: useId(), topic: useId(), est: useId(), date: useId(), time: useId(), deadline: useId(), rec: useId(), notes: useId(), links: useId(), type: useId() };

  useEffect(() => {
    if (open) {
      setF(toForm(task ?? defaults ?? {}, fallbackCourse));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((x) => ({ ...x, [k]: v }));
  const course = state.courses.find((c) => c.id === f.courseId);
  const estimate = Number(f.estimate);

  const placement =
    f.scheduledDate && f.startTime && estimate > 0
      ? checkPlacement(state, { taskId: task?.id, date: f.scheduledDate, start: toMin(f.startTime), duration: estimate })
      : null;

  function validate(): Errors {
    const e: Errors = {};
    if (!f.title.trim()) e.title = 'عنوان را وارد کنید.';
    else if (f.title.trim().length > 140) e.title = 'عنوان حداکثر ۱۴۰ نویسه باشد.';
    if (!f.courseId) e.courseId = 'درس را انتخاب کنید.';
    if (!Number.isFinite(estimate) || estimate < 5 || estimate > 480) e.estimate = 'مدت را بین ۵ تا ۴۸۰ دقیقه وارد کنید.';
    if (f.startTime && !f.scheduledDate) e.startTime = 'برای تعیین ساعت، ابتدا روز را انتخاب کنید.';
    if (placement && !placement.ok && placement.problem !== 'past') {
      e.startTime =
        placement.problem === 'outside_day'
          ? PLACEMENT_MESSAGE.outside_day
          : `${PLACEMENT_MESSAGE[placement.problem!]}: «${placement.conflictTitle}»`;
    }
    if (f.recurrence && !(Number(f.recurrence) >= 1 && Number(f.recurrence) <= 60)) e.recurrence = 'فاصلهٔ تکرار بین ۱ تا ۶۰ روز باشد.';
    const badLink = f.links
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .find((l) => !isUrl(l));
    if (badLink) e.links = `این پیوند معتبر نیست: ${badLink}`;
    return e;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const draft: TaskDraft = {
      title: f.title.trim(),
      courseId: f.courseId,
      topicId: f.topicId || undefined,
      type: f.type,
      priority: f.priority,
      estimateMin: Math.round(estimate),
      status: task?.status ?? 'todo',
      scheduledDate: f.scheduledDate,
      startTime: f.scheduledDate && f.startTime ? fromMin(toMin(f.startTime)) : undefined,
      deadline: f.deadline,
      recurrence: f.recurrence ? { everyDays: Number(f.recurrence) } : undefined,
      notes: f.notes.trim() || undefined,
      links: f.links
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
      completedAt: task?.completedAt,
      demo: task?.demo,
    };
    if (task) {
      update((s) => updateTask(s, task.id, draft));
      toast({ tone: 'success', message: 'تغییرات ذخیره شد.' });
    } else {
      update((s) => addTask(s, draft));
      toast({ tone: 'success', message: 'کار جدید اضافه شد.' });
    }
    onClose();
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={task ? 'ویرایش کار' : 'کار جدید'}
        size="lg"
        footer={
          <>
            {task && (
              <Button variant="ghost" icon={IconTrash} className="me-auto text-danger" onClick={() => setConfirmDelete(true)}>
                حذف
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              انصراف
            </Button>
            <Button variant="primary" type="submit" form="task-form">
              {task ? 'ذخیره' : 'افزودن'}
            </Button>
          </>
        }
      >
        <form id="task-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="عنوان" htmlFor={ids.title} error={errors.title} className="sm:col-span-2">
            <Input
              id={ids.title}
              data-autofocus
              value={f.title}
              invalid={!!errors.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="مثلاً: حل ۵ مسئلهٔ قضیهٔ بیز"
            />
          </Field>
          <Field label="درس" htmlFor={ids.course} error={errors.courseId}>
            <Select
              id={ids.course}
              value={f.courseId}
              onChange={(e) => setF((x) => ({ ...x, courseId: e.target.value, topicId: '' }))}
            >
              {state.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="مبحث" htmlFor={ids.topic}>
            <Select id={ids.topic} value={f.topicId} onChange={(e) => set('topicId', e.target.value)}>
              <option value="">بدون مبحث مشخص</option>
              {course?.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.kind === 'prerequisite' ? '(پیش‌نیاز) ' : ''}
                  {t.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="نوع کار" htmlFor={ids.type}>
            <Select id={ids.type} value={f.type} onChange={(e) => set('type', e.target.value as TaskType)}>
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TASK_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="اولویت">
            <Segmented
              label="اولویت"
              value={f.priority}
              onChange={(v) => set('priority', v)}
              options={(['high', 'medium', 'low'] as Priority[]).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
            />
          </Field>
          <Field
            label="مدت تخمینی (دقیقه)"
            htmlFor={ids.est}
            error={errors.estimate}
            hint={estimate > 0 ? formatDuration(estimate) : undefined}
          >
            <Input
              id={ids.est}
              type="number"
              inputMode="numeric"
              min={5}
              max={480}
              step={5}
              value={f.estimate}
              invalid={!!errors.estimate}
              onChange={(e) => set('estimate', e.target.value)}
              className="ltr text-start"
            />
          </Field>
          <Field label="مهلت (اختیاری)" htmlFor={ids.deadline}>
            <DatePicker id={ids.deadline} value={f.deadline} onChange={(v) => set('deadline', v)} allowEmpty placeholder="بدون مهلت" />
          </Field>
          <Field label="روز برنامه‌ریزی‌شده" htmlFor={ids.date} hint="خالی بماند تا در فهرست کارهای زمان‌بندی‌نشده بماند.">
            <DatePicker id={ids.date} value={f.scheduledDate} onChange={(v) => set('scheduledDate', v)} allowEmpty placeholder="زمان‌بندی‌نشده" />
          </Field>
          <Field label="ساعت شروع (اختیاری)" htmlFor={ids.time} error={errors.startTime}>
            <Input
              id={ids.time}
              type="time"
              step={300}
              value={f.startTime}
              invalid={!!errors.startTime}
              disabled={!f.scheduledDate}
              onChange={(e) => set('startTime', e.target.value)}
              className="ltr text-start"
            />
          </Field>
          {placement?.ok && placement.overBudget && (
            <Callout tone="warn" className="sm:col-span-2" title="از سقف مطالعهٔ این روز بیشتر می‌شود">
              با این کار، برنامهٔ آن روز {formatDuration(placement.plannedAfter)} می‌شود؛ سقف شما {formatDuration(placement.budget)} است. ذخیره ممکن است، اما
              بهتر است روز دیگری انتخاب کنید.
            </Callout>
          )}
          <Field label="تکرار" htmlFor={ids.rec} error={errors.recurrence} hint="برای مرورهای دوره‌ای؛ با انجام هر بار، نوبت بعدی خودکار ساخته می‌شود.">
            <Select id={ids.rec} value={f.recurrence} onChange={(e) => set('recurrence', e.target.value)}>
              <option value="">بدون تکرار</option>
              <option value="3">هر ۳ روز</option>
              <option value="7">هر هفته</option>
              <option value="14">هر دو هفته</option>
            </Select>
          </Field>
          <div className="hidden sm:block" />
          <Field label="یادداشت" htmlFor={ids.notes} className="sm:col-span-2">
            <Textarea id={ids.notes} value={f.notes} onChange={(e) => set('notes', e.target.value)} rows={3} placeholder="منبع، صفحهٔ کتاب، نکتهٔ مهم…" />
          </Field>
          <Field label="پیوند منابع (هر خط یک پیوند)" htmlFor={ids.links} error={errors.links} className="sm:col-span-2">
            <Textarea
              id={ids.links}
              value={f.links}
              onChange={(e) => set('links', e.target.value)}
              rows={2}
              dir="ltr"
              className="text-left"
              placeholder="https://…"
            />
          </Field>
        </form>
      </Modal>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="حذف این کار؟"
        body={`«${task?.title ?? ''}» برای همیشه حذف می‌شود. جلسه‌های مطالعهٔ ثبت‌شده باقی می‌مانند.`}
        confirmLabel="حذف"
        onConfirm={() => {
          if (!task) return;
          update((s) => deleteTask(s, task.id));
          toast({ tone: 'success', message: 'کار حذف شد.' });
          onClose();
        }}
      />
    </>
  );
}

export function defaultDraftFor(date?: string): Partial<Task> {
  return { scheduledDate: date ?? todayISO() };
}
