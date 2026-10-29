/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDemoState } from '../src/data/demo.ts';
import { semesterInfo, completionRate, dayLoad } from '../src/lib/analytics.ts';
import { addDays, formatLongDate, startOfWeek, toMin, weekdayOf } from '../src/lib/dates.ts';
import { toGregorian, toJalali } from '../src/lib/jalali.ts';
import {
  applyProposals,
  completeFocus,
  moveTopic,
  nextInterval,
  pauseFocus,
  rateCard,
  resumeFocus,
  setTaskDone,
  startFocus,
} from '../src/lib/mutations.ts';
import {
  busyBlocks,
  checkPlacement,
  freeIntervals,
  plannedMinutes,
  proposeWeek,
  suggestReschedule,
} from '../src/lib/schedule.ts';
import { parseState } from '../src/lib/storage.ts';

// Wednesday 2026-10-28, 10:00 local.
const NOW = new Date(2026, 9, 28, 10, 0, 0);
const TODAY = '2026-10-28';

test('jalali conversion: known dates', () => {
  assert.deepEqual(toJalali(2026, 10, 29), { jy: 1405, jm: 8, jd: 7 });
  assert.deepEqual(toJalali(2025, 3, 21), { jy: 1404, jm: 1, jd: 1 });
  assert.deepEqual(toGregorian(1405, 1, 1), { gy: 2026, gm: 3, gd: 21 });
  assert.equal(formatLongDate('2026-10-29'), 'پنجشنبه ۷ آبان ۱۴۰۵');
});

test('iranian week starts on Saturday', () => {
  assert.equal(weekdayOf('2026-10-24'), 0); // Saturday
  assert.equal(weekdayOf('2026-10-30'), 6); // Friday
  assert.equal(startOfWeek('2026-10-29'), '2026-10-24');
});

test('demo semester sits in week 7 of 16', () => {
  const s = buildDemoState(NOW);
  const info = semesterInfo(s.settings, TODAY);
  assert.equal(info.week, 7);
  assert.equal(info.weeksLeftAfterCurrent, 9);
  assert.ok(info.elapsed > 0.37 && info.elapsed < 0.44);
});

test('demo plan never overlaps commitments and fits the budget', () => {
  const s = buildDemoState(NOW);
  for (let i = -14; i < 7; i++) {
    const date = addDays(startOfWeek(TODAY), i);
    const blocks = busyBlocks(s, date);
    for (let a = 0; a < blocks.length; a++)
      for (let b = a + 1; b < blocks.length; b++) {
        const x = blocks[a]!;
        const y = blocks[b]!;
        assert.ok(!(x.start < y.end && y.start < x.end), `overlap on ${date}: ${x.title} / ${y.title}`);
      }
    assert.ok(plannedMinutes(s.tasks, date) <= 180, `budget exceeded on ${date}`);
  }
});

test('free intervals subtract busy blocks', () => {
  const free = freeIntervals({ start: 360, end: 1380 }, [
    { start: 450, end: 960 },
    { start: 1200, end: 1230 },
  ]);
  assert.deepEqual(free, [
    { start: 360, end: 450 },
    { start: 960, end: 1200 },
    { start: 1230, end: 1380 },
  ]);
});

test('placement rejects working hours and overlapping study', () => {
  const s = buildDemoState(NOW);
  const work = checkPlacement(s, { date: '2026-10-31', start: toMin('09:00'), duration: 60 }, NOW);
  assert.equal(work.ok, false);
  assert.equal(work.problem, 'overlap_commitment');
  const ok = checkPlacement(s, { date: '2026-10-28', start: toMin('21:30'), duration: 60 }, NOW);
  assert.equal(ok.ok, true);
  const study = checkPlacement(s, { date: '2026-10-28', start: toMin('18:30'), duration: 30 }, NOW);
  assert.equal(study.problem, 'overlap_task');
  const past = checkPlacement(s, { date: '2026-10-27', start: toMin('21:30'), duration: 30 }, NOW);
  assert.equal(past.problem, 'past');
});

test('rescheduling a missed task respects budget and only moves that task', () => {
  const s = buildDemoState(NOW);
  const missed = s.tasks.find((t) => t.title.startsWith('حل ۶ مسئلهٔ'))!;
  const before = s.tasks.filter((t) => t.id !== missed.id).map((t) => [t.scheduledDate, t.startTime]);
  const options = suggestReschedule(s, missed, NOW);
  assert.ok(options.length > 0);
  for (const o of options) {
    assert.ok(o.date >= TODAY);
    assert.ok(o.plannedAfter <= o.budget);
    const check = checkPlacement(s, { taskId: missed.id, date: o.date, start: o.start, duration: missed.estimateMin }, NOW);
    assert.equal(check.ok, true, `option ${o.date} invalid: ${check.problem}`);
  }
  const after = s.tasks.filter((t) => t.id !== missed.id).map((t) => [t.scheduledDate, t.startTime]);
  assert.deepEqual(after, before);
});

test('weekly proposal stays valid and within budget', () => {
  const s = buildDemoState(NOW);
  const next = addDays(startOfWeek(TODAY), 7);
  const plan = proposeWeek(s, next, NOW, { currentWeek: 8 });
  assert.ok(plan.proposals.length > 0);
  const applied = applyProposals(s, plan.proposals);
  for (let i = 0; i < 7; i++) {
    const date = addDays(next, i);
    assert.ok(plannedMinutes(applied.tasks, date) <= 180, `over budget on ${date}`);
    const blocks = busyBlocks(applied, date);
    for (let a = 0; a < blocks.length; a++)
      for (let b = a + 1; b < blocks.length; b++)
        assert.ok(!(blocks[a]!.start < blocks[b]!.end && blocks[b]!.start < blocks[a]!.end), `overlap on ${date}`);
  }
  // New practice keeps a buffer: the whole week stays at or under 75% + existing work.
  const weekTotal = Array.from({ length: 7 }, (_, i) => plannedMinutes(applied.tasks, addDays(next, i))).reduce((a, b) => a + b, 0);
  assert.ok(weekTotal <= 7 * 180 * 0.8, `week filled to ${weekTotal} minutes`);
  // Evening preference: weekday proposals start after work when room exists.
  assert.ok(plan.proposals.filter((p) => p.date !== addDays(next, 6)).every((p) => p.start >= toMin('17:00')), 'proposal before preferred start');
  // Tasks with deadlines are never proposed after their deadline.
  for (const p of plan.proposals) {
    const t = p.taskId ? s.tasks.find((x) => x.id === p.taskId) : undefined;
    if (t?.deadline) assert.ok(p.date <= t.deadline);
  }
});

test('completing a recurring task plans the next occurrence', () => {
  const s = buildDemoState(NOW);
  const rec = s.tasks.find((t) => t.recurrence)!;
  const next = setTaskDone(s, rec.id, true, NOW.getTime());
  assert.equal(next.tasks.length, s.tasks.length + 1);
  const copy = next.tasks[next.tasks.length - 1]!;
  assert.equal(copy.scheduledDate, addDays(rec.scheduledDate!, 7));
  assert.equal(copy.status, 'todo');
});

test('focus session timing across pause/resume is recorded once', () => {
  let s = buildDemoState(NOW);
  const t0 = NOW.getTime();
  const task = s.tasks.find((t) => t.status === 'todo' && t.scheduledDate === TODAY)!;
  s = startFocus(s, { courseId: task.courseId, taskId: task.id, targetMin: 50 }, t0);
  s = pauseFocus(s, t0 + 20 * 60_000);
  s = resumeFocus(s, t0 + 30 * 60_000);
  s = pauseFocus(s, t0 + 45 * 60_000);
  assert.equal(Math.round(s.focus.accumulatedMs / 60_000), 35);
  const before = s.sessions.length;
  s = completeFocus(s, { durationMin: 35, reflection: { learned: 'x', difficult: '', revisit: '' }, markTaskDone: true, difficultTopicId: task.topicId }, t0 + 46 * 60_000);
  assert.equal(s.sessions.length, before + 1);
  assert.equal(s.tasks.find((t) => t.id === task.id)!.status, 'done');
  assert.equal(s.focus.status, 'idle');
});

test('spaced repetition intervals grow and reset', () => {
  assert.equal(nextInterval({ intervalDays: 3, reps: 2 }, 'again'), 1);
  assert.equal(nextInterval({ intervalDays: 3, reps: 2 }, 'good'), 7);
  assert.ok(nextInterval({ intervalDays: 3, reps: 2 }, 'easy') > 7);
  const s = buildDemoState(NOW);
  const card = s.cards[0]!;
  const topicBefore = s.courses[0]!.topics.find((t) => t.id === card.topicId)!.difficulty;
  const next = rateCard(s, card.id, 'again', TODAY);
  assert.equal(next.cards[0]!.due, addDays(TODAY, 1));
  assert.equal(next.courses[0]!.topics.find((t) => t.id === card.topicId)!.difficulty, topicBefore + 1);
});

test('topics reorder', () => {
  const s = buildDemoState(NOW);
  const ids = s.courses[0]!.topics.map((t) => t.id);
  const moved = moveTopic(s, 'rp', ids[0]!, 3);
  assert.equal(moved.courses[0]!.topics[3]!.id, ids[0]);
  assert.equal(moved.courses[0]!.topics.length, ids.length);
});

test('analytics: completion rate ignores future tasks', () => {
  const s = buildDemoState(NOW);
  const week = startOfWeek(TODAY);
  const r = completionRate(s.tasks, week, addDays(week, 6), TODAY);
  assert.ok(r.total > 0);
  assert.ok(s.tasks.every((t) => !(t.scheduledDate && t.scheduledDate > TODAY && t.status === 'done')));
  const load = dayLoad(s, TODAY);
  assert.ok(load.available <= 180);
});

test('storage validation round-trip', () => {
  const s = buildDemoState(NOW);
  assert.ok(parseState(JSON.parse(JSON.stringify(s))));
  assert.equal(parseState({ version: 2 }), null);
  assert.equal(parseState('nope'), null);
});
