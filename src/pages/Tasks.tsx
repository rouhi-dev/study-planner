import { useEffect, useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { IconBrain, IconFilter, IconListChecks, IconPencil, IconPlus, IconSearch, IconTrash } from '../components/icons';
import { usePlanning } from '../components/planning';
import { TaskRow } from '../components/TaskRow';
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
  Segmented,
  Select,
  Textarea,
  useToast,
} from '../components/ui';
import { dueCards } from '../lib/analytics';
import { addDays, faInt, formatDayMonth, relativeDay, startOfWeek } from '../lib/dates';
import { PRIORITY_LABEL, PRIORITY_RANK, TASK_TYPE_LABEL, TASK_TYPES } from '../lib/labels';
import { addCard, deleteCard, nextInterval, rateCard, upsertCard } from '../lib/mutations';
import type { Priority, ReviewCard, ReviewRating, TaskType } from '../lib/types';
import { useStore, useToday } from '../store/store';
import { takeHandoff } from '../store/ui-state';

type When = 'all' | 'today' | 'week' | 'missed' | 'overdue' | 'unscheduled' | 'deadline';
type StatusFilter = 'open' | 'done' | 'all';
type Sort = 'date' | 'deadline' | 'priority';

export function TasksPage() {
  const [tab, setTab] = useState<'list' | 'review'>(() => takeHandoff('tasksTab') ?? 'list');
  const { state } = useStore();
  const today = useToday();
  const dueCount = dueCards(state, today).length;
  const { newTask } = usePlanning();
  return (
    <div>
      <PageHeader
        title="وظایف و تکالیف"
        subtitle="همهٔ کارها، تکالیف و مرورهای فاصله‌دار"
        actions={
          <Button variant="primary" icon={IconPlus} onClick={() => newTask()}>
            کار جدید
          </Button>
        }
      />
      <div className="mb-5">
        <Segmented
          label="بخش"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'list', label: 'فهرست کارها' },
            {
              value: 'review',
              label: (
                <span className="flex items-center gap-1.5">
                  مرور فاصله‌دار
                  {dueCount > 0 && <span className="num rounded-full bg-primary px-1.5 text-[11px] text-on-primary">{faInt(dueCount)}</span>}
                </span>
              ),
            },
          ]}
        />
      </div>
      {tab === 'list' ? <TaskList /> : <SpacedReview />}
    </div>
  );
}

function TaskList() {
  const { state } = useStore();
  const today = useToday();
  const { newTask } = usePlanning();
  const [q, setQ] = useState('');
  const [course, setCourse] = useState('');
  const [status, setStatus] = useState<StatusFilter>('open');
  const [type, setType] = useState<TaskType | ''>('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [when, setWhen] = useState<When>('all');
  const [sort, setSort] = useState<Sort>('date');
  const [showFilters, setShowFilters] = useState(false);
  const searchId = useId();

  const weekStart = startOfWeek(today);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = state.tasks.filter((t) => {
      if (needle && !`${t.title} ${t.notes ?? ''}`.toLowerCase().includes(needle)) return false;
      if (course && t.courseId !== course) return false;
      if (status === 'open' && t.status === 'done') return false;
      if (status === 'done' && t.status !== 'done') return false;
      if (type && t.type !== type) return false;
      if (priority && t.priority !== priority) return false;
      switch (when) {
        case 'today':
          return t.scheduledDate === today;
        case 'week':
          return !!t.scheduledDate && t.scheduledDate >= weekStart && t.scheduledDate <= addDays(weekStart, 6);
        case 'missed':
          return t.status !== 'done' && !!t.scheduledDate && t.scheduledDate < today;
        case 'overdue':
          return t.status !== 'done' && !!t.deadline && t.deadline < today;
        case 'unscheduled':
          return !t.scheduledDate;
        case 'deadline':
          return !!t.deadline;
        default:
          return true;
      }
    });
    const key = (d?: string) => d ?? '9999-99-99';
    return list.sort((a, b) => {
      if (sort === 'priority') return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || key(a.scheduledDate).localeCompare(key(b.scheduledDate));
      if (sort === 'deadline') return key(a.deadline).localeCompare(key(b.deadline)) || PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
      return key(a.scheduledDate).localeCompare(key(b.scheduledDate)) || (a.startTime ?? '99').localeCompare(b.startTime ?? '99');
    });
  }, [state.tasks, q, course, status, type, priority, when, sort, today, weekStart]);

  const activeFilters = [course, type, priority, when !== 'all' ? when : ''].filter(Boolean).length;

  return (
    <Card bodyClassName="p-0">
      <div className="flex flex-col gap-3 border-b border-line p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-60">
            <label htmlFor={searchId} className="sr-only">
              جست‌وجو
            </label>
            <IconSearch aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <Input id={searchId} value={q} onChange={(e) => setQ(e.target.value)} placeholder="جست‌وجو در عنوان و یادداشت…" className="ps-9" type="search" />
          </div>
          <Segmented
            label="وضعیت"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'open', label: 'باز' },
              { value: 'done', label: 'انجام‌شده' },
              { value: 'all', label: 'همه' },
            ]}
          />
          <Button variant={showFilters || activeFilters ? 'soft' : 'secondary'} icon={IconFilter} onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
            فیلتر{activeFilters ? ` (${faInt(activeFilters)})` : ''}
          </Button>
        </div>
        {showFilters && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Select aria-label="درس" value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="">همهٔ درس‌ها</option>
              {state.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select aria-label="زمان" value={when} onChange={(e) => setWhen(e.target.value as When)}>
              <option value="all">هر زمانی</option>
              <option value="today">امروز</option>
              <option value="week">این هفته</option>
              <option value="missed">عقب‌افتاده</option>
              <option value="overdue">مهلت گذشته</option>
              <option value="deadline">دارای مهلت</option>
              <option value="unscheduled">زمان‌بندی‌نشده</option>
            </Select>
            <Select aria-label="نوع" value={type} onChange={(e) => setType(e.target.value as TaskType | '')}>
              <option value="">همهٔ انواع</option>
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TASK_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
            <Select aria-label="اولویت" value={priority} onChange={(e) => setPriority(e.target.value as Priority | '')}>
              <option value="">همهٔ اولویت‌ها</option>
              {(['high', 'medium', 'low'] as Priority[]).map((p) => (
                <option key={p} value={p}>
                  اولویت {PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
            <Select aria-label="مرتب‌سازی" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="date">مرتب: روز برنامه</option>
              <option value="deadline">مرتب: مهلت</option>
              <option value="priority">مرتب: اولویت</option>
            </Select>
          </div>
        )}
        <p className="text-xs text-ink-3" aria-live="polite">
          {faInt(filtered.length)} کار
          {activeFilters > 0 && (
            <button
              type="button"
              className="ms-2 text-primary hover:underline"
              onClick={() => {
                setCourse('');
                setType('');
                setPriority('');
                setWhen('all');
              }}
            >
              پاک کردن فیلترها
            </button>
          )}
        </p>
      </div>
      <div className="p-2 sm:p-3">
        {filtered.length === 0 ? (
          state.tasks.length === 0 ? (
            <EmptyState
              icon={IconListChecks}
              title="هنوز کاری ثبت نشده"
              body="اولین کار را اضافه کنید؛ مثلاً حل چند مسئله از مبحثی که این هفته در کلاس تدریس شد."
              action={<Button variant="primary" onClick={() => newTask()}>افزودن کار</Button>}
            />
          ) : (
            <EmptyState icon={IconSearch} title="کاری با این فیلترها پیدا نشد" body="فیلترها یا عبارت جست‌وجو را تغییر دهید." />
          )
        ) : (
          <div className="flex flex-col divide-y divide-line/70">
            {filtered.map((t) => (
              <TaskRow key={t.id} task={t} showDate />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

const RATINGS: { value: ReviewRating; label: string; tone: string }[] = [
  { value: 'again', label: 'بلد نبودم', tone: 'bg-danger-soft text-danger' },
  { value: 'hard', label: 'سخت', tone: 'bg-warn-soft text-warn' },
  { value: 'good', label: 'خوب', tone: 'bg-primary-soft text-primary' },
  { value: 'easy', label: 'آسان', tone: 'bg-success-soft text-success' },
];

function SpacedReview() {
  const { state, update } = useStore();
  const today = useToday();
  const toast = useToast();
  const due = dueCards(state, today);
  const [reveal, setReveal] = useState(false);
  const [editing, setEditing] = useState<{ open: boolean; card?: ReviewCard }>({ open: false });
  const [toDelete, setToDelete] = useState<ReviewCard | null>(null);
  const current = due[0];
  useEffect(() => setReveal(false), [current?.id]);

  const all = [...state.cards].sort((a, b) => a.due.localeCompare(b.due));

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card
        className="lg:col-span-3"
        title="مرور امروز"
        subtitle="مفهوم را بدون نگاه کردن توضیح دهید یا روی کاغذ بنویسید، بعد خودتان را ارزیابی کنید."
      >
        {!current ? (
          <EmptyState
            icon={IconBrain}
            title="امروز کارتی برای مرور نیست"
            body="مفاهیمی را که در جلسات تمرکز دشوار بودند به‌عنوان کارت اضافه کنید تا در فاصله‌های افزایشی دوباره ببینید."
            action={<Button variant="soft" icon={IconPlus} onClick={() => setEditing({ open: true })}>کارت جدید</Button>}
          />
        ) : (
          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-ink-3">
              <CourseTag course={state.courses.find((c) => c.id === current.courseId)} short={false} />
              <span className="num">{faInt(due.length)} کارت باقی‌مانده</span>
            </div>
            <div className="rounded-xl border border-line bg-subtle px-5 py-8 text-center">
              <p className="text-lg font-semibold leading-8">{current.concept}</p>
              {reveal ? (
                <p className="mx-auto mt-4 max-w-md rounded-lg bg-surface px-4 py-3 text-sm leading-7 text-ink-2" dir="auto">
                  {current.hint || 'راهنمایی ثبت نشده؛ پاسخ خود را با جزوه یا کتاب مقایسه کنید.'}
                </p>
              ) : (
                <Button className="mt-5" variant="secondary" onClick={() => setReveal(true)}>
                  نمایش راهنما
                </Button>
              )}
            </div>
            <p className="mt-4 mb-2 text-[13px] text-ink-2">چقدر مسلط بودید؟</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RATINGS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => {
                    update((s) => rateCard(s, current.id, r.value, today));
                    if (r.value === 'again') toast({ tone: 'info', message: 'فردا دوباره می‌بینید؛ مبحث مرتبط دشوار علامت خورد.' });
                  }}
                  className={cx('flex flex-col items-center rounded-lg px-3 py-2.5 text-sm font-semibold transition hover:brightness-95', r.tone)}
                >
                  {r.label}
                  <span className="num mt-0.5 text-[11px] font-normal opacity-80">
                    {faInt(nextInterval(current, r.value))} روز بعد
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card
        className="lg:col-span-2"
        title="همهٔ کارت‌ها"
        subtitle={`${faInt(state.cards.length)} مفهوم`}
        action={<Button size="sm" variant="ghost" icon={IconPlus} onClick={() => setEditing({ open: true })}>کارت</Button>}
      >
        {all.length === 0 ? (
          <p className="text-[13px] text-ink-3">هنوز کارتی ساخته نشده است.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {all.map((c) => {
              const course = state.courses.find((x) => x.id === c.courseId);
              return (
                <li key={c.id} className="flex items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{c.concept}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-3">
                      <CourseTag course={course} />
                      <span>{c.due <= today ? 'امروز' : relativeDay(c.due, today)}</span>
                      {c.lapses > 0 && <Badge tone="warn">{faInt(c.lapses)} بار فراموشی</Badge>}
                    </p>
                  </div>
                  <IconButton size="sm" label="ویرایش کارت" icon={IconPencil} onClick={() => setEditing({ open: true, card: c })} />
                  <IconButton size="sm" label="حذف کارت" icon={IconTrash} onClick={() => setToDelete(c)} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <CardEditor open={editing.open} card={editing.card} onClose={() => setEditing({ open: false })} />
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="حذف کارت؟"
        body={`«${toDelete?.concept ?? ''}» از مرور فاصله‌دار حذف می‌شود.`}
        confirmLabel="حذف"
        onConfirm={() => toDelete && update((s) => deleteCard(s, toDelete.id))}
      />
    </div>
  );
}

function CardEditor({ open, onClose, card }: { open: boolean; onClose: () => void; card?: ReviewCard }) {
  const { state, update } = useStore();
  const today = useToday();
  const toast = useToast();
  const [f, setF] = useState({ concept: '', hint: '', courseId: '', topicId: '' });
  const [error, setError] = useState('');
  const ids = { concept: useId(), hint: useId(), course: useId(), topic: useId() };
  useEffect(() => {
    if (!open) return;
    setF({ concept: card?.concept ?? '', hint: card?.hint ?? '', courseId: card?.courseId ?? state.courses[0]?.id ?? '', topicId: card?.topicId ?? '' });
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, card?.id]);
  const course = state.courses.find((c) => c.id === f.courseId);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.concept.trim()) {
      setError('مفهوم را بنویسید.');
      return;
    }
    if (card) {
      update((s) => upsertCard(s, { ...card, concept: f.concept.trim(), hint: f.hint.trim() || undefined, courseId: f.courseId, topicId: f.topicId || undefined }));
    } else {
      update((s) => addCard(s, { courseId: f.courseId, topicId: f.topicId || undefined, concept: f.concept.trim(), hint: f.hint.trim() || undefined, today }));
    }
    toast({ tone: 'success', message: card ? 'کارت به‌روز شد.' : `کارت ساخته شد؛ اولین مرور: ${formatDayMonth(addDays(today, 1))}` });
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={card ? 'ویرایش کارت مرور' : 'کارت مرور جدید'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button variant="primary" type="submit" form="card-form">
            ذخیره
          </Button>
        </>
      }
    >
      <form id="card-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="مفهوم یا پرسش" htmlFor={ids.concept} error={error} className="sm:col-span-2" hint="مثلاً: «چرا ناهمبستگی، استقلال را نتیجه نمی‌دهد؟»">
          <Input id={ids.concept} data-autofocus value={f.concept} invalid={!!error} onChange={(e) => setF({ ...f, concept: e.target.value })} />
        </Field>
        <Field label="درس" htmlFor={ids.course}>
          <Select id={ids.course} value={f.courseId} onChange={(e) => setF({ ...f, courseId: e.target.value, topicId: '' })}>
            {state.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="مبحث" htmlFor={ids.topic}>
          <Select id={ids.topic} value={f.topicId} onChange={(e) => setF({ ...f, topicId: e.target.value })}>
            <option value="">—</option>
            {course?.topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="راهنما یا پاسخ کوتاه" htmlFor={ids.hint} className="sm:col-span-2">
          <Textarea id={ids.hint} rows={3} dir="auto" value={f.hint} onChange={(e) => setF({ ...f, hint: e.target.value })} />
        </Field>
      </form>
    </Modal>
  );
}
