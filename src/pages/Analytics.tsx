import { useState } from 'react';
import { BarChart, BarList } from '../components/charts';
import { IconCircleCheck, IconFlag } from '../components/icons';
import { usePlanning } from '../components/planning';
import { Button, Callout, Card, CourseTag, EmptyState, Metric, PageHeader, Segmented } from '../components/ui';
import {
  completionRate,
  courseMinutes,
  dueCards,
  minutesBetween,
  overdueTasks,
  practiceSplit,
  semesterInfo,
  topicProgress,
  weakTopics,
  weeklyTotals,
  weekLoad,
  weekNumberOf,
} from '../lib/analytics';
import { addDays, diffDays, faInt, faNum, faPercent, formatDayMonth, formatDuration, formatDurationShort, relativeDay, startOfWeek, WEEKDAYS_SHORT, weekdayOf } from '../lib/dates';
import { COURSE_COLOR_CLASSES } from '../lib/labels';
import { budgetFor } from '../lib/schedule';
import { useStore, useToday } from '../store/store';

type Range = 'week' | 'month' | 'semester';

export function AnalyticsPage() {
  const { state } = useStore();
  const today = useToday();
  const { reschedule, newTask } = usePlanning();
  const [range, setRange] = useState<Range>('month');
  const sem = semesterInfo(state.settings, today);
  const weekStart = startOfWeek(today);
  const from = range === 'week' ? weekStart : range === 'month' ? addDays(weekStart, -21) : state.settings.semesterStart;
  const to = today;
  const days = Math.max(1, diffDays(to, from) + 1);
  const weeksInRange = Math.max(1, days / 7);

  const total = minutesBetween(state.sessions, from, to);
  const completion = completionRate(state.tasks, from, to, today);
  const split = practiceSplit(state.sessions, from, to);
  const overdue = overdueTasks(state.tasks, today);
  const weak = weakTopics(state.courses, 8);
  const due = dueCards(state, today);
  const weekly = weeklyTotals(state.sessions, today, 8);
  const load = weekLoad(state, weekStart);
  const weeklyBudget = Array.from({ length: 7 }, (_, i) => budgetFor(state.settings, addDays(weekStart, i))).reduce((a, b) => a + b, 0);
  const totalWeight = state.courses.reduce((s, c) => s + c.weight, 0) || 1;
  const hours = (m: number) => faNum(Number.isInteger(m) ? m : m.toFixed(1));

  const empty = state.sessions.length === 0 && state.tasks.length === 0;

  return (
    <div>
      <PageHeader
        title="گزارش پیشرفت"
        subtitle="همهٔ اعداد از جلسات ثبت‌شده و کارهای شما محاسبه می‌شوند؛ زیر هر عدد توضیح داده شده که دقیقاً چه چیزی را می‌سنجد."
        actions={
          <Segmented
            label="بازهٔ زمانی"
            value={range}
            onChange={setRange}
            options={[
              { value: 'week', label: 'این هفته' },
              { value: 'month', label: '۴ هفتهٔ اخیر' },
              { value: 'semester', label: 'از ابتدای ترم' },
            ]}
          />
        }
      />
      {state.meta.demo && (
        <Callout tone="neutral" className="mb-6">
          این گزارش اکنون بر اساس داده‌های نمونه است و پیشرفت واقعی شما را نشان نمی‌دهد.
        </Callout>
      )}
      {empty ? (
        <EmptyState icon={IconCircleCheck} title="هنوز داده‌ای برای گزارش نیست" body="با ثبت اولین جلسهٔ تمرکز و کارها، این صفحه پر می‌شود." />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="زمان مطالعهٔ ثبت‌شده"
              value={formatDurationShort(total)}
              sub={`میانگین هفتگی ${formatDuration(total / weeksInRange)}`}
              explain="جمع مدت جلسات تمرکز و جلسات دستی در این بازه. زمانی که ثبت نشده باشد شمرده نمی‌شود."
            />
            <Metric
              label="نرخ انجام کارها"
              value={completion.rate === null ? '—' : faPercent(completion.rate)}
              sub={`${faInt(completion.done)} از ${faInt(completion.total)} کار`}
              explain="از کارهایی که روز برنامه‌شان در این بازه و تا امروز بوده، چند درصد انجام شده. کارهای آینده حساب نمی‌شوند."
            />
            <Metric
              label="سهم تمرین فعال"
              value={split.total ? faPercent(split.active / split.total) : '—'}
              sub={`${formatDuration(split.active)} حل مسئله، تکلیف، کدنویسی`}
              explain="بخشی از زمان ثبت‌شده که صرف حل مسئله، تکلیف، برنامه‌نویسی یا آمادگی امتحان شده؛ بر اساس نوع کارِ هر جلسه."
            />
            <Metric
              label="تکالیف با مهلت گذشته"
              value={faInt(overdue.length)}
              sub={due.length ? `${faInt(due.length)} کارت مرور برای امروز` : 'کارت مروری برای امروز نیست'}
              explain="کارهای انجام‌نشده‌ای که تاریخ مهلتشان گذشته است (مستقل از بازهٔ انتخابی)."
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="ساعت مطالعه در هشت هفتهٔ اخیر" subtitle="خط‌چین: مجموع سقف‌های روزانهٔ یک هفته">
              <BarChart
                caption="ساعت مطالعهٔ ثبت‌شده در هر هفته"
                groups={weekly.map((w) => {
                  const n = weekNumberOf(state.settings, w.weekStart);
                  return {
                    label: n >= 1 ? `هفتهٔ ${faInt(n)}` : formatDayMonth(w.weekStart),
                    values: { h: w.minutes / 60 },
                    highlight: w.weekStart === weekStart,
                  };
                })}
                series={[{ key: 'h', label: 'ساعت مطالعه', className: 'bg-primary' }]}
                format={(v) => `${hours(Math.round(v * 10) / 10)}س`}
                reference={{ value: weeklyBudget / 60, label: `سقف ${faInt(weeklyBudget / 60)} ساعت` }}
              />
              <p className="mt-3 text-xs text-ink-3">ستون پررنگ، هفتهٔ جاری است که هنوز تمام نشده.</p>
            </Card>

            <Card title="برنامه در برابر انجام‌شده، این هفته" subtitle="برنامه = جمع زمان تخمینی کارهای هر روز؛ انجام‌شده = جلسات ثبت‌شده">
              <BarChart
                caption="دقیقه‌های برنامه‌ریزی‌شده و انجام‌شده در هر روز این هفته"
                groups={load.map((d) => ({
                  label: WEEKDAYS_SHORT[weekdayOf(d.date)]!,
                  values: { planned: d.planned, actual: d.actual },
                  highlight: d.date === today,
                }))}
                series={[
                  { key: 'planned', label: 'برنامه‌ریزی‌شده', className: 'bg-line-strong' },
                  { key: 'actual', label: 'انجام‌شده', className: 'bg-primary' },
                ]}
                format={(v) => formatDurationShort(v)}
              />
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="زمان هر درس" subtitle="در بازهٔ انتخابی، در مقایسه با سهم تعیین‌شده">
              <BarList
                caption="زمان مطالعه به تفکیک درس"
                rows={[...state.courses]
                  .sort((a, b) => b.weight - a.weight)
                  .map((c) => {
                    const m = courseMinutes(state.sessions, c.id, from, to);
                    return {
                      key: c.id,
                      label: c.name,
                      value: m,
                      display: formatDuration(m),
                      className: COURSE_COLOR_CLASSES[c.color].bar,
                      note: `سهم واقعی ${total ? faPercent(m / total) : '—'}، سهم هدف ${faPercent(c.weight / totalWeight)}`,
                    };
                  })}
              />
            </Card>

            <Card title="نوع مطالعه" subtitle="حل مسئله در برابر مطالعهٔ نظری">
              <BarList
                caption="زمان مطالعه به تفکیک نوع"
                max={split.total}
                rows={[
                  { key: 'active', label: 'تمرین فعال (مسئله، تکلیف، کد، امتحان)', value: split.active, display: formatDurationShort(split.active), className: 'bg-primary' },
                  { key: 'reading', label: 'مطالعهٔ نظری و جزوه', value: split.reading, display: formatDurationShort(split.reading), className: 'bg-primary/60' },
                  { key: 'revision', label: 'مرور', value: split.revision, display: formatDurationShort(split.revision), className: 'bg-primary/40' },
                  { key: 'free', label: 'مطالعهٔ آزاد (بدون کار مشخص)', value: split.free, display: formatDurationShort(split.free), className: 'bg-ink-3/50' },
                ]}
              />
              {split.total > 0 && split.active / split.total < 0.4 && (
                <p className="mt-4 rounded-lg bg-warn-soft px-3 py-2 text-xs leading-5 text-warn">
                  کمتر از ۴۰٪ زمان صرف حل مسئله شده است. برای مهارت حل مستقل مسئله، بعد از هر مطالعهٔ نظری چند مسئله حل کنید.
                </p>
              )}
            </Card>

            <Card title="پیشرفت مباحث" subtitle="تعداد مباحث تکمیل‌شده، نه درصد تخمینی">
              <ul className="flex flex-col gap-4">
                {state.courses.map((c) => {
                  const p = topicProgress(c.topics);
                  return (
                    <li key={c.id}>
                      <CourseTag course={c} short={false} />
                      <BarList
                        caption={`پیشرفت مباحث ${c.name}`}
                        rows={[
                          { key: 'pre', label: 'پیش‌نیازها', value: p.prerequisite.completed, display: `${faInt(p.prerequisite.completed)} از ${faInt(p.prerequisite.total)}`, className: COURSE_COLOR_CLASSES[c.color].bar },
                          { key: 'course', label: 'مباحث کلاس', value: p.course.completed, display: `${faInt(p.course.completed)} از ${faInt(p.course.total)}`, className: COURSE_COLOR_CLASSES[c.color].bar },
                        ]}
                        max={Math.max(p.prerequisite.total, p.course.total)}
                      />
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4 text-xs text-ink-3">
                هفتهٔ {faInt(sem.week)} از {faInt(sem.totalWeeks)}؛ مبحثی «تکمیل» حساب می‌شود که خودتان آن را تکمیل‌شده علامت زده باشید.
              </p>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="مباحث دشوار" subtitle="بر اساس بازتاب جلسات و کارت‌های مروری که «بلد نبودم» خورده‌اند">
              {weak.length === 0 ? (
                <p className="text-[13px] text-ink-3">هنوز مبحثی دشوار علامت نخورده است. در بازتاب پایان هر جلسه می‌توانید مبحث دشوار را مشخص کنید.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {weak.map(({ course, topic }) => (
                    <li key={topic.id} className="flex items-center gap-3 py-2.5">
                      <IconFlag aria-hidden className="size-4 shrink-0 text-danger" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{topic.title}</p>
                        <p className="text-xs text-ink-3">
                          {course.shortName}، {faInt(topic.difficulty)} بار دشوار
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => newTask({ courseId: course.id, topicId: topic.id, type: 'problem_solving', priority: 'high', title: `حل تمرین: ${topic.title}`, estimateMin: 45 })}
                      >
                        برنامهٔ تمرین
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="مهلت‌های گذشته" subtitle="کارهای انجام‌نشده‌ای که مهلتشان گذشته">
              {overdue.length === 0 ? (
                <p className="flex items-center gap-2 text-[13px] text-success">
                  <IconCircleCheck aria-hidden className="size-4" />
                  هیچ تکلیف عقب‌افتاده‌ای ندارید.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {overdue.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{t.title}</p>
                        <p className="flex items-center gap-2 text-xs text-ink-3">
                          <CourseTag course={state.courses.find((c) => c.id === t.courseId)} />
                          <span className="text-danger">مهلت {relativeDay(t.deadline!, today)}</span>
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => reschedule(t)}>
                        زمان‌بندی
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
