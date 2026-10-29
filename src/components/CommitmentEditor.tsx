import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { formatTime, fromMin, toMin, WEEKDAYS, weekdayOf } from '../lib/dates';
import { COMMITMENT_KIND_LABEL, COMMITMENT_KINDS } from '../lib/labels';
import { deleteCommitment, upsertCommitment } from '../lib/mutations';
import type { Commitment, CommitmentKind, Weekday } from '../lib/types';
import { useStore } from '../store/store';
import { DatePicker } from './DatePicker';
import { IconTrash } from './icons';
import { Button, ConfirmDialog, cx, Field, Input, Modal, Segmented, Select, useToast } from './ui';

export function CommitmentEditor({
  open,
  onClose,
  commitment,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  commitment?: Commitment;
  defaults?: Partial<Commitment>;
}) {
  const { state, update } = useStore();
  const toast = useToast();
  const init = (): Omit<Commitment, 'id'> & { id?: string } => ({
    title: '',
    kind: 'personal',
    days: [],
    start: '18:00',
    end: '19:00',
    ...defaults,
    ...commitment,
  });
  const [f, setF] = useState(init);
  const [mode, setMode] = useState<'weekly' | 'once'>(commitment?.date || defaults?.date ? 'once' : 'weekly');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const ids = { title: useId(), start: useId(), end: useId(), course: useId(), kind: useId(), date: useId() };

  useEffect(() => {
    if (open) {
      setF(init());
      setMode(commitment?.date || defaults?.date ? 'once' : 'weekly');
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, commitment?.id]);

  const toggleDay = (d: Weekday) =>
    setF((x) => ({ ...x, days: x.days.includes(d) ? x.days.filter((y) => y !== d) : [...x.days, d].sort() }));

  // Study tasks that would now overlap this commitment (shown as a warning).
  const conflicts =
    f.start && f.end && toMin(f.end) > toMin(f.start)
      ? state.tasks.filter((t) => {
          if (!t.scheduledDate || !t.startTime || t.status === 'done') return false;
          const applies = mode === 'once' ? t.scheduledDate === f.date : f.days.includes(weekdayOf(t.scheduledDate));
          if (!applies) return false;
          const s = toMin(t.startTime);
          return s < toMin(f.end) && toMin(f.start) < s + t.estimateMin;
        })
      : [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!f.title.trim()) errs.title = 'عنوان را وارد کنید.';
    if (!f.start || !f.end || toMin(f.end) <= toMin(f.start)) errs.end = 'ساعت پایان باید بعد از ساعت شروع باشد.';
    if (mode === 'weekly' && f.days.length === 0) errs.days = 'دست‌کم یک روز را انتخاب کنید.';
    if (mode === 'once' && !f.date) errs.date = 'تاریخ را انتخاب کنید.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    update((s) =>
      upsertCommitment(s, {
        ...f,
        title: f.title.trim(),
        start: fromMin(toMin(f.start)),
        end: fromMin(toMin(f.end)),
        date: mode === 'once' ? f.date : undefined,
        days: mode === 'once' ? [] : f.days,
        courseId: f.kind === 'class' ? f.courseId : undefined,
      }),
    );
    toast({ tone: 'success', message: commitment ? 'تعهد ثابت به‌روز شد.' : 'تعهد ثابت اضافه شد.' });
    onClose();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={commitment ? 'ویرایش تعهد ثابت' : 'تعهد ثابت جدید'}
        description="زمان‌هایی که برای مطالعه در دسترس نیستید: کار، کلاس، رفت‌وآمد، خانواده یا استراحت."
        footer={
          <>
            {commitment && (
              <Button variant="ghost" icon={IconTrash} className="me-auto text-danger" onClick={() => setConfirm(true)}>
                حذف
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              انصراف
            </Button>
            <Button variant="primary" type="submit" form="commitment-form">
              ذخیره
            </Button>
          </>
        }
      >
        <form id="commitment-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="عنوان" htmlFor={ids.title} error={errors.title} className="sm:col-span-2">
            <Input id={ids.title} data-autofocus value={f.title} invalid={!!errors.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="مثلاً: ساعت کاری" />
          </Field>
          <Field label="نوع" htmlFor={ids.kind}>
            <Select id={ids.kind} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as CommitmentKind })}>
              {COMMITMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {COMMITMENT_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          {f.kind === 'class' ? (
            <Field label="درس مربوط" htmlFor={ids.course}>
              <Select id={ids.course} value={f.courseId ?? ''} onChange={(e) => setF({ ...f, courseId: e.target.value || undefined })}>
                <option value="">—</option>
                {state.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <div className="hidden sm:block" />
          )}
          <Field label="ساعت شروع" htmlFor={ids.start}>
            <Input id={ids.start} type="time" step={300} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} className="ltr text-start" />
          </Field>
          <Field label="ساعت پایان" htmlFor={ids.end} error={errors.end}>
            <Input id={ids.end} type="time" step={300} value={f.end} invalid={!!errors.end} onChange={(e) => setF({ ...f, end: e.target.value })} className="ltr text-start" />
          </Field>
          <div className="sm:col-span-2">
            <Segmented
              label="تکرار"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'weekly', label: 'هر هفته' },
                { value: 'once', label: 'فقط یک روز' },
              ]}
            />
          </div>
          {mode === 'weekly' ? (
            <fieldset className="sm:col-span-2">
              <legend className="mb-1.5 text-[13px] font-medium text-ink-2">روزهای هفته</legend>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((w, i) => {
                  const on = f.days.includes(i as Weekday);
                  return (
                    <button
                      key={w}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleDay(i as Weekday)}
                      className={cx(
                        'h-8 rounded-lg border px-3 text-[13px] transition-colors',
                        on ? 'border-primary bg-primary-soft font-medium text-primary' : 'border-line text-ink-2 hover:border-line-strong',
                      )}
                    >
                      {w}
                    </button>
                  );
                })}
              </div>
              {errors.days && <p className="mt-1.5 text-xs text-danger">{errors.days}</p>}
            </fieldset>
          ) : (
            <Field label="تاریخ" htmlFor={ids.date} error={errors.date} className="sm:col-span-2">
              <DatePicker id={ids.date} value={f.date} onChange={(v) => setF({ ...f, date: v })} invalid={!!errors.date} />
            </Field>
          )}
          {conflicts.length > 0 && (
            <p className="rounded-lg bg-warn-soft px-3 py-2 text-[13px] text-warn sm:col-span-2">
              {conflicts.length.toLocaleString('fa-IR')} کار مطالعه با این بازه هم‌پوشانی پیدا می‌کند (مثلاً «{conflicts[0]!.title}» ساعت{' '}
              {formatTime(conflicts[0]!.startTime!)}). پس از ذخیره، آن‌ها در برنامهٔ هفتگی با علامت هشدار نشان داده می‌شوند تا جابه‌جا کنید.
            </p>
          )}
        </form>
      </Modal>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="حذف این تعهد ثابت؟"
        body={`«${commitment?.title ?? ''}» از برنامهٔ هفتگی حذف می‌شود.`}
        confirmLabel="حذف"
        onConfirm={() => {
          if (!commitment) return;
          update((s) => deleteCommitment(s, commitment.id));
          toast({ tone: 'success', message: 'حذف شد.' });
          onClose();
        }}
      />
    </>
  );
}
