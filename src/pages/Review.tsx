import { useEffect, useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { IconCalendarClock, IconChevronLeft, IconChevronRight, IconPlus, IconSparkles, IconTrash } from '../components/icons';
import { ProposalDialog } from '../components/planning';
import { TaskRow } from '../components/TaskRow';
import { Badge, Button, Callout, Card, CourseTag, cx, IconButton, Input, PageHeader, SectionTitle, Textarea, useToast } from '../components/ui';
import { courseMinutes, minutesBetween, weekNumberOf } from '../lib/analytics';
import { addDays, faInt, formatDayMonth, formatDuration, startOfWeek, todayISO } from '../lib/dates';
import { COURSE_COLOR_CLASSES } from '../lib/labels';
import { flagTopicDifficult, saveReview, uid, updateCourse } from '../lib/mutations';
import { proposeWeek, type WeekPlan } from '../lib/schedule';
import type { WeeklyGoal } from '../lib/types';
import { useNow, useStore } from '../store/store';

export function ReviewPage() {
  const { state, update } = useStore();
  const toast = useToast();
  const now = useNow();
  const today = todayISO(now);
  const [weekStart, setWeekStart] = useState(startOfWeek(today));
  const weekEnd = addDays(weekStart, 6);
  const existing = state.reviews.find((r) => r.weekStart === weekStart);
  const [lessons, setLessons] = useState('');
  const [difficult, setDifficult] = useState<string[]>([]);
  const [goals, setGoals] = useState<WeeklyGoal[]>([]);
  const [goalText, setGoalText] = useState('');
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const goalId = useId();
  const lessonsId = useId();

  useEffect(() => {
    setLessons(existing?.lessons ?? '');
    setDifficult(existing?.difficultTopicIds ?? state.courses.flatMap((c) => c.topics.filter((t) => t.difficulty > 0).map((t) => t.id)));
    setGoals(existing?.goals ?? []);
    setWeights(Object.fromEntries(state.courses.map((c) => [c.id, c.weight])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, existing?.id]);

  const weekTasks = state.tasks.filter((t) => t.scheduledDate && t.scheduledDate >= weekStart && t.scheduledDate <= weekEnd);
  const done = weekTasks.filter((t) => t.status === 'done');
  const unfinished = weekTasks.filter((t) => t.status !== 'done');
  const minutes = minutesBetween(state.sessions, weekStart, weekEnd);
  const reflections = useMemo(
    () => state.sessions.filter((s) => s.date >= weekStart && s.date <= weekEnd && (s.reflection.learned || s.reflection.difficult)),
    [state.sessions, weekStart, weekEnd],
  );
  const weekNo = weekNumberOf(state.settings, weekStart);
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;

  const commit = () => {
    const prev = new Set(existing?.difficultTopicIds ?? []);
    update((s) => {
      let next = saveReview(s, { weekStart, lessons: lessons.trim(), difficultTopicIds: difficult, goals });
      for (const id of difficult) if (!prev.has(id)) {
        const topic = s.courses.flatMap((c) => c.topics).find((t) => t.id === id);
        if (topic && topic.difficulty === 0) next = flagTopicDifficult(next, id, 1);
      }
      for (const c of s.courses) if (weights[c.id] !== undefined && weights[c.id] !== c.weight) next = updateCourse(next, c.id, { weight: weights[c.id]! });
      return next;
    });
  };

  const save = (e?: FormEvent) => {
    e?.preventDefault();
    commit();
    toast({ tone: 'success', message: 'مرور هفتگی ذخیره شد.' });
  };

  const propose = () => {
    commit();
    const next = addDays(weekStart, 7);
    const working = { ...state, courses: state.courses.map((c) => ({ ...c, weight: weights[c.id] ?? c.weight })) };
    setPlan(proposeWeek(working, next < today ? startOfWeek(today) : next, now, { currentWeek: weekNumberOf(state.settings, next) }));
  };

  const addGoal = () => {
    const t = goalText.trim();
    if (!t) return;
    setGoals((g) => [...g, { id: uid('g'), text: t, done: false }]);
    setGoalText('');
  };

  return (
    <form onSubmit={save} noValidate>
      <PageHeader
        title="مرور هفتگی"
        subtitle={
          <span>
            {weekNo >= 1 ? `هفتهٔ ${faInt(weekNo)} ترم، ` : ''}
            {formatDayMonth(weekStart)} تا {formatDayMonth(weekEnd)}
            {existing && <Badge className="ms-2">ذخیره‌شده</Badge>}
          </span>
        }
        actions={
          <>
            <IconButton label="هفتهٔ قبل" icon={IconChevronRight} onClick={() => setWeekStart(addDays(weekStart, -7))} />
            <IconButton label="هفتهٔ بعد" icon={IconChevronLeft} disabled={weekStart >= startOfWeek(today)} onClick={() => setWeekStart(addDays(weekStart, 7))} />
            <Button variant="secondary" type="submit">
              ذخیرهٔ مرور
            </Button>
            <Button variant="primary" icon={IconSparkles} onClick={propose}>
              پیشنهاد برنامهٔ هفتهٔ بعد
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'کارهای انجام‌شده', value: `${faInt(done.length)} از ${faInt(weekTasks.length)}` },
          { label: 'زمان مطالعهٔ ثبت‌شده', value: formatDuration(minutes) },
          ...state.courses.slice(0, 2).map((c) => ({ label: c.name, value: formatDuration(courseMinutes(state.sessions, c.id, weekStart, weekEnd)) })),
        ].map((m) => (
          <div key={m.label} className="rounded-card border border-line bg-surface p-4 shadow-card">
            <p className="truncate text-xs text-ink-3">{m.label}</p>
            <p className="num mt-1 text-lg font-semibold">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card title="کارهای ناتمام این هفته" subtitle="برای هر کدام تصمیم بگیرید: زمان جدید، ویرایش یا حذف.">
            {unfinished.length === 0 ? (
              <p className="text-[13px] text-success">همهٔ کارهای برنامه‌ریزی‌شدهٔ این هفته انجام شده است.</p>
            ) : (
              <div className="-mx-2 flex flex-col">
                {unfinished.map((t) => (
                  <TaskRow key={t.id} task={t} showDate compact />
                ))}
              </div>
            )}
          </Card>
          <Card title="انجام‌شده" subtitle={`${faInt(done.length)} کار`}>
            {done.length === 0 ? (
              <p className="text-[13px] text-ink-3">هنوز کاری در این هفته انجام نشده است.</p>
            ) : (
              <details>
                <summary className="cursor-pointer text-[13px] text-primary">نمایش فهرست</summary>
                <div className="-mx-2 mt-2 flex flex-col">
                  {done.map((t) => (
                    <TaskRow key={t.id} task={t} compact />
                  ))}
                </div>
              </details>
            )}
          </Card>
          <Card title="بازتاب‌های جلسات این هفته" subtitle="مواد خام برای درس‌گرفتن">
            {reflections.length === 0 ? (
              <p className="text-[13px] text-ink-3">در این هفته بازتابی ثبت نشده است.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {reflections.map((s) => (
                  <li key={s.id} className="rounded-lg bg-subtle px-3 py-2 text-[13px] leading-6">
                    <CourseTag course={state.courses.find((c) => c.id === s.courseId)} />
                    {s.reflection.learned && <p className="mt-1 text-ink-2">آموخته: {s.reflection.learned}</p>}
                    {s.reflection.difficult && <p className="text-ink-2">سخت: {s.reflection.difficult}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card title="درس‌های این هفته">
            <label htmlFor={lessonsId} className="sr-only">
              درس‌های آموخته
            </label>
            <Textarea
              id={lessonsId}
              rows={4}
              value={lessons}
              onChange={(e) => setLessons(e.target.value)}
              placeholder="چه چیزی جواب داد؟ چه چیزی نه؟ مثلاً: «حل مسئله بعد از خواندن جزوه بهتر از خواندن دوباره بود.»"
            />
          </Card>

          <Card title="مباحث دشوار" subtitle="مباحثی که هفتهٔ بعد باید تمرین بیشتری بگیرند">
            <div className="flex flex-col gap-4">
              {state.courses.map((c) => (
                <div key={c.id}>
                  <SectionTitle>
                    <span className={cx('size-2 rounded-full', COURSE_COLOR_CLASSES[c.color].dot)} />
                    {c.shortName}
                  </SectionTitle>
                  <div className="flex flex-wrap gap-1.5">
                    {c.topics
                      .filter((t) => t.status !== 'not_started' || difficult.includes(t.id))
                      .map((t) => {
                        const on = difficult.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setDifficult((d) => (on ? d.filter((x) => x !== t.id) : [...d, t.id]))}
                            className={cx(
                              'rounded-md border px-2 py-1 text-xs transition-colors',
                              on ? 'border-danger bg-danger-soft font-medium text-danger' : 'border-line text-ink-2 hover:border-line-strong',
                            )}
                          >
                            {t.title}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
              <p className="text-xs text-ink-3">فقط مباحث شروع‌شده نمایش داده می‌شوند. انتخاب‌های جدید در پیشنهاد برنامه اولویت تمرین می‌گیرند.</p>
            </div>
          </Card>

          <Card title="اولویت درس‌ها برای هفتهٔ بعد" subtitle="سهم هر درس از زمان مطالعه در پیشنهاد برنامه">
            <ul className="flex flex-col gap-4">
              {state.courses.map((c) => (
                <li key={c.id}>
                  <div className="mb-1 flex items-center justify-between text-[13px]">
                    <label htmlFor={`w-${c.id}`} className="flex items-center gap-2">
                      <span className={cx('size-2 rounded-full', COURSE_COLOR_CLASSES[c.color].dot)} />
                      {c.name}
                    </label>
                    <span className="num font-semibold">{faInt(((weights[c.id] ?? c.weight) / totalWeight) * 100)}٪</span>
                  </div>
                  <input
                    id={`w-${c.id}`}
                    type="range"
                    min={5}
                    max={70}
                    step={5}
                    value={weights[c.id] ?? c.weight}
                    onChange={(e) => setWeights((w) => ({ ...w, [c.id]: Number(e.target.value) }))}
                    className="w-full accent-primary"
                  />
                </li>
              ))}
            </ul>
          </Card>

          <Card title="هدف‌های هفتهٔ بعد">
            <div className="flex gap-2">
              <label htmlFor={goalId} className="sr-only">
                هدف جدید
              </label>
              <Input
                id={goalId}
                value={goalText}
                onChange={(e) => setGoalText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addGoal();
                  }
                }}
                placeholder="مثلاً: حل ۱۰ مسئلهٔ امید ریاضی"
              />
              <Button variant="soft" icon={IconPlus} onClick={addGoal}>
                افزودن
              </Button>
            </div>
            {goals.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1">
                {goals.map((g) => (
                  <li key={g.id} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-subtle">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={g.done}
                      aria-label={`انجام شد: ${g.text}`}
                      onChange={() => setGoals((list) => list.map((x) => (x.id === g.id ? { ...x, done: !x.done } : x)))}
                    />
                    <span className={cx('flex-1 text-[13px]', g.done && 'text-ink-3 line-through')}>{g.text}</span>
                    <IconButton size="sm" label="حذف هدف" icon={IconTrash} onClick={() => setGoals((list) => list.filter((x) => x.id !== g.id))} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Callout tone="neutral" icon={IconCalendarClock}>
            «پیشنهاد برنامهٔ هفتهٔ بعد» ابتدا همین مرور را ذخیره می‌کند، سپس فهرستی قابل بررسی می‌سازد. تا وقتی موارد را تأیید نکنید، برنامه تغییر نمی‌کند.
          </Callout>
        </div>
      </div>

      <ProposalDialog
        open={!!plan}
        plan={plan}
        onClose={() => setPlan(null)}
        title="پیشنهاد برنامهٔ هفتهٔ بعد"
        description="بر اساس کارهای ناتمام، مهلت‌ها، مباحث دشوار و اولویت‌های جدید. هر مورد را می‌توانید کنار بگذارید."
      />
    </form>
  );
}
