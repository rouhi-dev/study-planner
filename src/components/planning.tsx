import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  formatDayMonth,
  formatDuration,
  formatDurationShort,
  formatTime,
  fromMin,
  relativeDay,
  todayISO,
  WEEKDAYS,
  weekdayOf,
} from '../lib/dates';
import { TASK_TYPE_LABEL } from '../lib/labels';
import { applyProposals, scheduleTask, startFocus } from '../lib/mutations';
import { suggestReschedule, type Proposal, type WeekPlan } from '../lib/schedule';
import type { Task } from '../lib/types';
import { navigate } from '../store/router';
import { useNow, useStore } from '../store/store';
import { IconCalendarClock, IconCheck, IconInfo } from './icons';
import { TaskEditor } from './TaskEditor';
import { Badge, Button, Callout, ConfirmDialog, CourseTag, cx, EmptyState, Modal, useToast } from './ui';

// ---- shared dialogs, opened from anywhere ------------------------------------

interface PlanningApi {
  newTask: (defaults?: Partial<Task>) => void;
  editTask: (task: Task) => void;
  reschedule: (task: Task) => void;
  focusOn: (task?: Task) => void;
}

const PlanningContext = createContext<PlanningApi | null>(null);

export function PlanningProvider({ children }: { children: ReactNode }) {
  const { state, update } = useStore();
  const [editor, setEditor] = useState<{ open: boolean; task?: Task; defaults?: Partial<Task> }>({ open: false });
  const [resched, setResched] = useState<Task | null>(null);
  const [pendingFocus, setPendingFocus] = useState<Task | null>(null);

  const api = useMemo<PlanningApi>(
    () => ({
      newTask: (defaults) => setEditor({ open: true, defaults }),
      editTask: (task) => setEditor({ open: true, task }),
      reschedule: (task) => setResched(task),
      focusOn: (task) => {
        if (!task) {
          navigate('focus');
          return;
        }
        setPendingFocus(task);
      },
    }),
    [],
  );

  const busy = state.focus.status !== 'idle';
  const begin = (task: Task) => {
    update((s) => startFocus(s, { courseId: task.courseId, taskId: task.id, targetMin: s.settings.focusDefaultMin }));
    navigate('focus');
  };

  return (
    <PlanningContext.Provider value={api}>
      {children}
      <TaskEditor
        open={editor.open}
        task={editor.task}
        defaults={editor.defaults}
        onClose={() => setEditor({ open: false })}
      />
      {resched && <RescheduleDialog task={resched} onClose={() => setResched(null)} />}
      {pendingFocus && !busy && (
        <FocusStarter
          task={pendingFocus}
          onClose={() => setPendingFocus(null)}
          onStart={() => {
            begin(pendingFocus);
            setPendingFocus(null);
          }}
        />
      )}
      <ConfirmDialog
        open={!!pendingFocus && busy}
        onClose={() => setPendingFocus(null)}
        danger={false}
        title="یک جلسهٔ تمرکز در جریان است"
        body="ابتدا جلسهٔ فعلی را تمام کنید تا زمان آن ثبت شود. به صفحهٔ تمرکز بروید؟"
        confirmLabel="رفتن به جلسهٔ فعلی"
        onConfirm={() => navigate('focus')}
      />
    </PlanningContext.Provider>
  );
}

function FocusStarter({ task, onClose, onStart }: { task: Task; onClose: () => void; onStart: () => void }) {
  const { state } = useStore();
  const course = state.courses.find((c) => c.id === task.courseId);
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="شروع جلسهٔ تمرکز"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button variant="primary" data-autofocus onClick={onStart}>
            شروع {formatDuration(state.settings.focusDefaultMin)}
          </Button>
        </>
      }
    >
      <p className="font-medium">{task.title}</p>
      <div className="mt-1 flex items-center gap-3 text-[13px] text-ink-3">
        <CourseTag course={course} short={false} />
        <span>{TASK_TYPE_LABEL[task.type]}</span>
        <span>تخمین {formatDuration(task.estimateMin)}</span>
      </div>
      <p className="mt-3 text-[13px] text-ink-3">مدت پیش‌فرض را در صفحهٔ تمرکز یا تنظیمات می‌توانید تغییر دهید. هر وقت خواستید متوقف کنید.</p>
    </Modal>
  );
}

export function usePlanning(): PlanningApi {
  const ctx = useContext(PlanningContext);
  if (!ctx) throw new Error('usePlanning outside PlanningProvider');
  return ctx;
}

// ---- reschedule one task -------------------------------------------------------

export function RescheduleDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const { state, update } = useStore();
  const now = useNow();
  const toast = useToast();
  const { editTask } = usePlanning();
  // Computed once when the dialog opens so options don't shift while choosing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const options = useMemo(() => suggestReschedule(state, task, now), [task.id]);
  const [choice, setChoice] = useState(0);

  const apply = () => {
    const o = options[choice];
    if (!o) return;
    update((s) => scheduleTask(s, task.id, o.date, o.start));
    toast({
      tone: 'success',
      message: `«${task.title}» به ${relativeDay(o.date, todayISO(now))} ساعت ${formatTime(fromMin(o.start))} منتقل شد.`,
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="زمان‌بندی دوباره"
      description="فقط همین کار جابه‌جا می‌شود؛ بقیهٔ برنامه دست نمی‌خورد."
      footer={
        <>
          <Button
            variant="ghost"
            className="me-auto"
            onClick={() => {
              update((s) => scheduleTask(s, task.id, undefined, null));
              toast({ tone: 'info', message: 'به فهرست کارهای زمان‌بندی‌نشده منتقل شد.' });
              onClose();
            }}
          >
            فعلاً بدون زمان
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              onClose();
              editTask(task);
            }}
          >
            انتخاب دستی
          </Button>
          <Button variant="primary" onClick={apply} disabled={options.length === 0}>
            اعمال
          </Button>
        </>
      }
    >
      <div className="mb-4 rounded-lg bg-subtle px-3 py-2.5">
        <p className="font-medium">{task.title}</p>
        <p className="mt-0.5 text-[13px] text-ink-3">
          {formatDuration(task.estimateMin)}
          {task.deadline && `، مهلت: ${formatDayMonth(task.deadline)}`}
        </p>
      </div>
      {options.length === 0 ? (
        <EmptyState
          compact
          icon={IconCalendarClock}
          title="در سه هفتهٔ آینده جای مناسبی پیدا نشد"
          body="همهٔ روزها یا به سقف مطالعه رسیده‌اند یا زمان آزاد کافی ندارند. مدت کار را کوتاه کنید یا آن را به چند بخش تقسیم کنید."
        />
      ) : (
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-ink-2">پیشنهادها (با رعایت سقف روزانه و تعهدهای ثابت)</legend>
          {options[0]?.afterDeadline && (
            <Callout tone="warn" className="mb-3">
              تا پیش از مهلت جای خالی نیست. گزینه‌های زیر بعد از مهلت هستند.
            </Callout>
          )}
          <div className="flex flex-col gap-2" role="radiogroup">
            {options.map((o, i) => (
              <label
                key={o.date + o.start}
                className={cx(
                  'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                  choice === i ? 'border-primary bg-primary-soft' : 'border-line hover:border-line-strong',
                )}
              >
                <input type="radio" name="slot" className="accent-primary" checked={choice === i} onChange={() => setChoice(i)} />
                <span className="flex-1">
                  <span className="font-medium">
                    {WEEKDAYS[weekdayOf(o.date)]} {formatDayMonth(o.date)}
                  </span>
                  <span className="text-ink-3">، ساعت {formatTime(fromMin(o.start))}</span>
                </span>
                <span className="num text-xs text-ink-3">
                  بار روز: {formatDurationShort(o.plannedAfter)} از {formatDurationShort(o.budget)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </Modal>
  );
}

// ---- review a generated plan ----------------------------------------------------

export function ProposalDialog({
  open,
  onClose,
  plan,
  title,
  description,
}: {
  open: boolean;
  onClose: () => void;
  plan: WeekPlan | null;
  title: string;
  description?: string;
}) {
  const { state, update } = useStore();
  const toast = useToast();
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const proposals = plan?.proposals ?? [];
  const selected = proposals.filter((p) => !excluded.has(p.id));
  const byDay = new Map<string, Proposal[]>();
  for (const p of proposals) byDay.set(p.date, [...(byDay.get(p.date) ?? []), p]);

  const toggle = (id: string) =>
    setExcluded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={title}
      description={description}
      footer={
        <>
          <span className="me-auto text-[13px] text-ink-3">
            {selected.length.toLocaleString('fa-IR')} مورد انتخاب شده
          </span>
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button
            variant="primary"
            icon={IconCheck}
            disabled={selected.length === 0}
            onClick={() => {
              update((s) => applyProposals(s, selected));
              toast({ tone: 'success', message: `${selected.length.toLocaleString('fa-IR')} مورد در برنامه قرار گرفت.` });
              setExcluded(new Set());
              onClose();
            }}
          >
            اعمال موارد انتخاب‌شده
          </Button>
        </>
      }
    >
      {proposals.length === 0 ? (
        <EmptyState
          compact
          icon={IconInfo}
          title="پیشنهادی برای افزودن نیست"
          body="یا همه‌چیز زمان‌بندی شده، یا روزهای باقی‌مانده جای خالی کافی ندارند."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {[...byDay.entries()].map(([date, list]) => {
            const cap = plan?.capacity.find((c) => c.date === date);
            const after =
              (cap?.plannedBefore ?? 0) +
              list.filter((p) => !excluded.has(p.id)).reduce((s, p) => s + p.estimateMin, 0) -
              list
                .filter((p) => !excluded.has(p.id) && p.kind === 'move')
                .reduce((s, p) => {
                  const t = state.tasks.find((x) => x.id === p.taskId);
                  return s + (t?.scheduledDate === date ? t.estimateMin : 0);
                }, 0);
            return (
              <section key={date}>
                <div className="mb-1.5 flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold">
                    {WEEKDAYS[weekdayOf(date)]} {formatDayMonth(date)}
                  </h3>
                  <span className="num text-xs text-ink-3">
                    بار روز پس از اعمال: {formatDurationShort(after)} از {formatDurationShort(cap?.budget ?? 0)}
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {list.map((p) => {
                    const course = state.courses.find((c) => c.id === p.courseId);
                    return (
                      <li key={p.id}>
                        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3 py-2 hover:border-line-strong">
                          <input
                            type="checkbox"
                            className="mt-1.5 accent-primary"
                            checked={!excluded.has(p.id)}
                            onChange={() => toggle(p.id)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{p.title}</span>
                              {p.kind === 'new' && <Badge tone="primary">پیشنهاد جدید</Badge>}
                            </span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                              <CourseTag course={course} />
                              <span className="num">
                                {formatTime(fromMin(p.start))}، {formatDuration(p.estimateMin)}
                              </span>
                              <span>{p.reason}</span>
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      {plan && plan.unplaced.length > 0 && (
        <Callout tone="warn" className="mt-4" title="مواردی که جا نشدند">
          <ul className="mt-1 list-disc ps-4">
            {plan.unplaced.map((u) => (
              <li key={u.taskId}>
                {u.title} — {u.reason}
              </li>
            ))}
          </ul>
        </Callout>
      )}
    </Modal>
  );
}
