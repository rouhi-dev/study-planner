/**
 * Transient, in-memory UI hand-offs between pages (e.g. "open the daily
 * planner on this date"). Not persisted on purpose.
 */
const handoff: { dailyDate?: string; weekStart?: string; tasksTab?: 'list' | 'review' } = {};

export function setHandoff(patch: typeof handoff) {
  Object.assign(handoff, patch);
}

export function takeHandoff<K extends keyof typeof handoff>(key: K): (typeof handoff)[K] {
  const v = handoff[key];
  delete handoff[key];
  return v;
}
