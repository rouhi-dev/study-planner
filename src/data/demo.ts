/**
 * Editable demo workspace. All dates are generated relative to "today" so the
 * demo always looks like week 7 of a 16-week semester (≈10 weeks left).
 * Everything created here carries `demo: true` and the workspace is flagged
 * `meta.demo` so the UI can label it clearly.
 */
import { addDays, startOfWeek, todayISO, weekdayOf } from '../lib/dates';
import type {
  AppState,
  Commitment,
  Course,
  ISODate,
  Priority,
  StudySession,
  Task,
  TaskStatus,
  TaskType,
  Topic,
  TopicKind,
  TopicStatus,
} from '../lib/types';

type TopicSeed = [key: string, title: string, kind: TopicKind, status: TopicStatus, week?: number, difficulty?: number];

const topic = ([key, title, kind, status, week, difficulty]: TopicSeed): Topic => ({
  id: key,
  title,
  kind,
  status,
  targetWeek: week,
  difficulty: difficulty ?? 0,
});

export function demoCourses(): Course[] {
  return [
    {
      id: 'rp',
      name: 'فرایندهای تصادفی',
      shortName: 'فرایندها',
      color: 'rp',
      weight: 45,
      instructor: '',
      description:
        'اولویت اول ترم. پایهٔ احتمال مهندسی هم‌زمان با مباحث کلاس بازسازی می‌شود؛ لازم نیست اول همهٔ پیش‌نیازها تمام شوند.',
      topics: [
        ['rp-basics', 'مبانی احتمال: فضای نمونه، اصول موضوعه و شمارش', 'prerequisite', 'in_progress', 7, 1],
        ['rp-bayes', 'احتمال شرطی و قضیهٔ بیز', 'prerequisite', 'in_progress', 7, 2],
        ['rp-rv', 'متغیرهای تصادفی', 'prerequisite', 'not_started', 8],
        ['rp-cdf', 'توابع CDF، PMF و PDF', 'prerequisite', 'not_started', 8],
        ['rp-exp', 'امید ریاضی و واریانس', 'prerequisite', 'not_started', 9],
        ['rp-joint', 'توزیع‌های توأم و استقلال', 'course', 'in_progress', 7, 1],
        ['rp-cov', 'کوواریانس و همبستگی', 'course', 'not_started', 8],
        ['rp-condexp', 'امید شرطی', 'course', 'not_started', 9],
        ['rp-proc', 'فرایندهای تصادفی و ویژگی‌های آماری', 'course', 'not_started', 10],
        ['rp-wss', 'خودهمبستگی و ایستایی', 'course', 'not_started', 11],
        ['rp-psd', 'چگالی طیف توان', 'course', 'not_started', 13],
        ['rp-extra', 'مباحث تکمیلی استاد (ویرایش کنید)', 'course', 'not_started', 14],
      ].map((s) => topic(s as TopicSeed)),
    },
    {
      id: 'math',
      name: 'ریاضیات مهندسی پیشرفته',
      shortName: 'ریاضیات',
      color: 'math',
      weight: 30,
      instructor: '',
      description:
        'تمرکز بر بازسازی پایهٔ ریاضی و توانایی حل مستقل مسئله. فهرست مباحث نمونه است؛ آن را با سرفصل واقعی استاد تطبیق دهید.',
      topics: [
        ['m-calc', 'مرور حسابان: روش‌های مشتق‌گیری و انتگرال‌گیری', 'prerequisite', 'in_progress', 7, 1],
        ['m-cplx-num', 'مرور اعداد مختلط', 'prerequisite', 'completed', 6],
        ['m-cplx-fn', 'توابع مختلط', 'course', 'in_progress', 7],
        ['m-ode', 'معادلات دیفرانسیل', 'course', 'not_started', 9],
        ['m-fs', 'سری فوریه', 'course', 'not_started', 10],
        ['m-ft', 'تبدیل فوریه', 'course', 'not_started', 11],
        ['m-lap', 'تبدیل لاپلاس', 'course', 'not_started', 12],
        ['m-extra', 'مباحث تعیین‌شده توسط استاد (ویرایش کنید)', 'course', 'not_started', 14],
      ].map((s) => topic(s as TopicSeed)),
    },
    {
      id: 'nn',
      name: 'شبکه‌های عصبی',
      shortName: 'شبکه عصبی',
      color: 'nn',
      weight: 25,
      instructor: '',
      description:
        'یادگیری از پایه با تمرین عملی در Python یا MATLAB. اولویت اولیه کمتر است، اما تمرین‌های برنامه‌نویسی زمان می‌برند.',
      topics: [
        ['nn-la', 'پیش‌نیاز جبر خطی: بردار، ماتریس و ضرب داخلی', 'prerequisite', 'in_progress', 7],
        ['nn-env', 'راه‌اندازی Python (NumPy) یا MATLAB', 'prerequisite', 'completed', 6],
        ['nn-perc', 'پرسپترون و توابع فعال‌سازی', 'course', 'completed', 6],
        ['nn-loss', 'توابع هزینه', 'course', 'in_progress', 7],
        ['nn-gd', 'گرادیان کاهشی', 'course', 'not_started', 8],
        ['nn-bp', 'پس‌انتشار خطا', 'course', 'not_started', 10, 0],
        ['nn-lab', 'تمرین عملی: پیاده‌سازی شبکهٔ چندلایه با NumPy', 'course', 'not_started', 11],
        ['nn-extra', 'مباحث تکمیلی استاد (ویرایش کنید)', 'course', 'not_started', 13],
      ].map((s) => topic(s as TopicSeed)),
    },
  ];
}

export function demoCommitments(): Commitment[] {
  const c = (
    id: string,
    title: string,
    kind: Commitment['kind'],
    days: Commitment['days'],
    start: string,
    end: string,
    courseId?: string,
  ): Commitment => ({ id, title, kind, days, start, end, courseId, demo: true });
  return [
    c('cm-work', 'کار در شرکت مخابراتی', 'work', [0, 1, 2, 3, 4], '07:30', '16:00'),
    c('cm-commute', 'رفت‌وآمد و استراحت بعد از کار', 'personal', [0, 1, 2, 3, 4], '16:00', '18:00'),
    c('cm-dinner', 'شام و استراحت', 'break', [0, 1, 2, 3, 4, 5, 6], '20:00', '20:30'),
    c('cm-rp', 'کلاس فرایندهای تصادفی', 'class', [5], '08:00', '10:00', 'rp'),
    c('cm-math', 'کلاس ریاضیات مهندسی پیشرفته', 'class', [5], '10:15', '12:15', 'math'),
    c('cm-nn', 'کلاس شبکه‌های عصبی', 'class', [5], '13:30', '15:30', 'nn'),
    c('cm-thu-back', 'بازگشت از دانشگاه و استراحت', 'personal', [5], '15:30', '17:00'),
    c('cm-family', 'وقت خانواده', 'personal', [6], '12:00', '16:00'),
  ];
}

interface TaskSeed {
  title: string;
  course: string;
  topic?: string;
  type: TaskType;
  est: number;
  prio: Priority;
  day?: number; // offset from current week's Saturday
  time?: string;
  deadline?: number; // offset from current week's Saturday
  notes?: string;
  links?: string[];
  recurrence?: number;
  status?: TaskStatus;
}

const reflections = [
  {
    learned: 'تفاوت احتمال شرطی و احتمال توأم را با مثال کانال مخابراتی بهتر فهمیدم.',
    difficult: 'انتخاب افراز درست برای قانون احتمال کل.',
    revisit: 'مسئله‌های ۳ و ۴ تمرین بیز',
  },
  {
    learned: 'روش جزءبه‌جزء را روی سه انتگرال حل کردم.',
    difficult: 'تشخیص این‌که کدام تابع u باشد.',
    revisit: 'انتگرال‌های شامل نمایی و سینوسی',
  },
  {
    learned: 'پیاده‌سازی ساده‌ی پرسپترون در NumPy کار کرد.',
    difficult: 'شکل (shape) ماتریس وزن‌ها.',
    revisit: 'ضرب ماتریس و برداری‌سازی',
  },
  { learned: '', difficult: '', revisit: '' },
];

export function buildDemoState(now: Date = new Date()): AppState {
  const today = todayISO(now);
  const W = startOfWeek(today);
  const todayIdx = weekdayOf(today);
  const d = (offset: number): ISODate => addDays(W, offset);
  let n = 0;
  const id = (p: string) => `${p}-demo-${++n}`;

  const seeds: TaskSeed[] = [
    // --- earlier weeks (history) ---
    { title: 'تمرین‌های فصل ۱: شمارش و فضای نمونه', course: 'rp', topic: 'rp-basics', type: 'problem_solving', est: 60, prio: 'high', day: -12, time: '18:00', status: 'done' },
    { title: 'مرور اعداد مختلط و نمایش قطبی', course: 'math', topic: 'm-cplx-num', type: 'revision', est: 45, prio: 'medium', day: -11, time: '18:00', status: 'done' },
    { title: 'نصب Python و NumPy و اجرای مثال اول', course: 'nn', topic: 'nn-env', type: 'programming', est: 60, prio: 'medium', day: -10, time: '20:30', status: 'done' },
    { title: 'جزوهٔ کلاس: توزیع‌های توأم', course: 'rp', topic: 'rp-joint', type: 'theory', est: 60, prio: 'high', day: -6, time: '18:00', status: 'done' },
    { title: 'حل ۶ مسئلهٔ قضیهٔ بیز', course: 'rp', topic: 'rp-bayes', type: 'problem_solving', est: 60, prio: 'high', day: -5, time: '18:00', notes: 'از کتاب Papoulis یا Leon-Garcia؛ اول مثال‌های حل‌شده.' },
    { title: 'گزارش کوتاه توابع فعال‌سازی', course: 'nn', topic: 'nn-perc', type: 'assignment', est: 60, prio: 'medium', day: -4, time: '20:30', deadline: -2 },
    { title: 'انتگرال‌گیری جزءبه‌جزء — ۸ تمرین', course: 'math', topic: 'm-calc', type: 'problem_solving', est: 45, prio: 'medium', day: -3, time: '18:00', status: 'done' },
    // --- current week ---
    { title: 'مرور اصول موضوعهٔ احتمال با مثال‌های مخابراتی', course: 'rp', topic: 'rp-basics', type: 'theory', est: 45, prio: 'high', day: 0, time: '18:00' },
    { title: 'جزوهٔ جلسهٔ ۶: توزیع‌های توأم گسسته', course: 'rp', topic: 'rp-joint', type: 'theory', est: 60, prio: 'high', day: 0, time: '20:30' },
    { title: 'توابع مختلط: حل ۵ تمرین کتاب', course: 'math', topic: 'm-cplx-fn', type: 'problem_solving', est: 60, prio: 'medium', day: 1, time: '18:00' },
    { title: 'احتمال شرطی: ۵ مسئلهٔ قدم‌به‌قدم', course: 'rp', topic: 'rp-bayes', type: 'problem_solving', est: 60, prio: 'high', day: 1, time: '20:30', notes: 'هر مسئله: صورت را بازنویسی کن، پیشامدها را نام‌گذاری کن، بعد فرمول.' },
    { title: 'جبر خطی: ضرب ماتریس و ضرب داخلی', course: 'nn', topic: 'nn-la', type: 'theory', est: 45, prio: 'medium', day: 2, time: '18:00', links: ['https://www.3blue1brown.com/topics/linear-algebra'] },
    { title: 'قضیهٔ بیز روی مثال کانال دودویی', course: 'rp', topic: 'rp-bayes', type: 'problem_solving', est: 60, prio: 'high', day: 2, time: '20:30' },
    { title: 'تکلیف ۳ ریاضیات: توابع مختلط', course: 'math', topic: 'm-cplx-fn', type: 'assignment', est: 90, prio: 'high', day: 3, time: '18:00', deadline: 5 },
    { title: 'توابع هزینه: MSE و آنتروپی متقاطع', course: 'nn', topic: 'nn-loss', type: 'theory', est: 45, prio: 'low', day: 3, time: '20:30' },
    { title: 'آماده شدن برای کلاس پنجشنبه: مرور جزوه‌ها', course: 'rp', topic: 'rp-joint', type: 'revision', est: 45, prio: 'medium', day: 4, time: '18:00' },
    { title: 'مرور انتگرال‌های نمایی و مثلثاتی', course: 'math', topic: 'm-calc', type: 'problem_solving', est: 45, prio: 'medium', day: 4, time: '20:30' },
    { title: 'پاک‌نویس جزوهٔ کلاس فرایندها', course: 'rp', topic: 'rp-cov', type: 'theory', est: 45, prio: 'medium', day: 5, time: '17:15' },
    { title: 'مرور هفتگی فرمول‌های احتمال', course: 'rp', topic: 'rp-basics', type: 'revision', est: 30, prio: 'high', day: 6, time: '09:00', recurrence: 7, notes: 'برگهٔ فرمول را از حفظ بنویس و بعد با جزوه مقایسه کن.' },
    { title: 'متغیر تصادفی گسسته: ۴ مثال حل‌شده', course: 'rp', topic: 'rp-rv', type: 'problem_solving', est: 60, prio: 'high', day: 6, time: '10:00' },
    // --- backlog & deadlines ---
    { title: 'تمرین سری ۲ فرایندها: احتمال شرطی و متغیر تصادفی', course: 'rp', topic: 'rp-rv', type: 'assignment', est: 90, prio: 'high', deadline: 9 },
    { title: 'تمرین برنامه‌نویسی ۱: پرسپترون در Python', course: 'nn', topic: 'nn-perc', type: 'programming', est: 120, prio: 'medium', deadline: 12, notes: 'اگر MATLAB راحت‌تر است همان را استفاده کن؛ مهم الگوریتم است.' },
    { title: 'آمادگی میان‌ترم: مرور مباحث ۱ تا ۳', course: 'rp', topic: 'rp-joint', type: 'exam_prep', est: 90, prio: 'high', deadline: 16 },
    { title: 'گرادیان کاهشی: پیاده‌سازی روی تابع درجه دو', course: 'nn', topic: 'nn-gd', type: 'programming', est: 60, prio: 'low' },
  ];

  const tasks: Task[] = seeds.map((s, i) => {
    const date = s.day === undefined ? undefined : d(s.day);
    let status: TaskStatus = s.status ?? 'todo';
    // In the current week, tasks before today are done except one, to show
    // how missed work is rescheduled.
    if (!s.status && s.day !== undefined && s.day >= 0 && s.day < todayIdx) {
      status = s.day === todayIdx - 1 && s.course === 'math' ? 'todo' : 'done';
    }
    return {
      id: id('t'),
      title: s.title,
      courseId: s.course,
      topicId: s.topic,
      priority: s.prio,
      estimateMin: s.est,
      type: s.type,
      status,
      deadline: s.deadline === undefined ? undefined : d(s.deadline),
      scheduledDate: date,
      startTime: date ? s.time : undefined,
      notes: s.notes,
      links: s.links ?? [],
      recurrence: s.recurrence ? { everyDays: s.recurrence } : undefined,
      createdAt: now.getTime() - (30 - i) * 86_400_000,
      completedAt: status === 'done' && date ? new Date(`${date}T21:00:00`).getTime() : undefined,
      demo: true,
    };
  });

  // Sessions: completed tasks get a matching session; earlier weeks get a
  // gently increasing amount of study so the analytics have something to show.
  const sessions: StudySession[] = [];
  const pushSession = (date: ISODate, courseId: string, kind: StudySession['kind'], durationMin: number, r: number, taskId?: string, topicId?: string) =>
    sessions.push({
      id: id('s'),
      courseId,
      taskId,
      topicId,
      kind,
      date,
      startedAt: new Date(`${date}T18:05:00`).getTime(),
      durationMin,
      reflection: reflections[r % reflections.length]!,
      demo: true,
    });

  tasks.forEach((t, i) => {
    if (t.status === 'done' && t.scheduledDate) {
      const ratio = [0.9, 1.1, 1, 0.8][i % 4]!;
      pushSession(t.scheduledDate, t.courseId, t.type, Math.round(t.estimateMin * ratio), i, t.id, t.topicId);
    }
  });
  const history: [week: number, day: number, course: string, kind: StudySession['kind'], min: number][] = [
    [-5, 0, 'rp', 'theory', 50], [-5, 2, 'math', 'theory', 40], [-5, 5, 'nn', 'theory', 60],
    [-4, 0, 'rp', 'theory', 60], [-4, 1, 'math', 'problem_solving', 45], [-4, 3, 'rp', 'theory', 70], [-4, 6, 'nn', 'programming', 50],
    [-3, 0, 'rp', 'problem_solving', 55], [-3, 1, 'rp', 'theory', 60], [-3, 2, 'math', 'theory', 45], [-3, 4, 'nn', 'theory', 50], [-3, 6, 'rp', 'revision', 40],
    [-2, 0, 'rp', 'theory', 60], [-2, 2, 'math', 'revision', 40], [-2, 4, 'nn', 'theory', 45], [-2, 6, 'rp', 'problem_solving', 70],
    [-1, 0, 'rp', 'theory', 45], [-1, 1, 'math', 'theory', 50], [-1, 3, 'nn', 'theory', 40], [-1, 6, 'rp', 'free', 60],
  ];
  history.forEach(([w, day, course, kind, min], i) => pushSession(d(w * 7 + day), course, kind, min, i + 1));

  const cards = [
    { concept: 'قانون احتمال کل و قضیهٔ بیز', topicId: 'rp-bayes', courseId: 'rp', due: today, intervalDays: 2, reps: 2, lapses: 1, hint: 'P(A|B) = P(B|A)P(A) / P(B)' },
    { concept: 'تفاوت PMF و PDF و رابطهٔ آن‌ها با CDF', topicId: 'rp-cdf', courseId: 'rp', due: today, intervalDays: 1, reps: 1, lapses: 0 },
    { concept: 'استقلال در برابر ناهمبستگی', topicId: 'rp-joint', courseId: 'rp', due: addDays(today, 2), intervalDays: 3, reps: 1, lapses: 0 },
    { concept: 'شرایط کوشی–ریمان برای تحلیلی بودن تابع مختلط', topicId: 'm-cplx-fn', courseId: 'math', due: addDays(today, 1), intervalDays: 3, reps: 2, lapses: 0 },
    { concept: 'قاعدهٔ به‌روزرسانی وزن پرسپترون', topicId: 'nn-perc', courseId: 'nn', due: addDays(today, 4), intervalDays: 7, reps: 3, lapses: 0 },
  ].map((c) => ({ ...c, id: id('rc'), createdAt: now.getTime() - 10 * 86_400_000, demo: true }));

  return {
    version: 1,
    settings: {
      name: '',
      university: 'دانشگاه یزد',
      program: 'کارشناسی ارشد مهندسی مخابرات سیستم',
      semesterStart: addDays(W, -42),
      semesterWeeks: 16,
      dailyBudgetMin: 180,
      budgetOverrides: {},
      dayStart: '06:30',
      dayEnd: '23:00',
      preferredStudyStart: '17:00',
      focusDefaultMin: 50,
      theme: 'system',
    },
    courses: demoCourses(),
    tasks,
    commitments: demoCommitments(),
    sessions,
    cards,
    reviews: [
      {
        id: id('wr'),
        weekStart: d(-7),
        lessons:
          'خواندن جزوه بدون حل مسئله حس فهمیدن می‌دهد ولی در تمرین گیر می‌کنم. از این هفته بعد از هر مبحث حداقل ۳ مسئله حل می‌کنم.',
        difficultTopicIds: ['rp-bayes', 'm-calc'],
        goals: [
          { id: id('g'), text: 'هر روز کاری حداقل ۶۰ دقیقه فرایندهای تصادفی', done: false },
          { id: id('g'), text: 'تحویل تکلیف ۳ ریاضیات قبل از کلاس پنجشنبه', done: false },
        ],
        savedAt: now.getTime() - 5 * 86_400_000,
      },
    ],
    focus: { status: 'idle', targetMin: 50, accumulatedMs: 0 },
    meta: { updatedAt: now.getTime(), demo: true },
  };
}

/**
 * Clean workspace: keeps settings, courses (topic lists reset to "not
 * started") and fixed commitments; removes demo tasks, sessions, cards and
 * reviews.
 */
export function freshFromState(state: AppState): AppState {
  return {
    ...state,
    courses: state.courses.map((c) => ({
      ...c,
      topics: c.topics.map((t) => ({ ...t, status: 'not_started', difficulty: 0 })),
    })),
    commitments: state.commitments.map((c) => ({ ...c, demo: undefined })),
    tasks: [],
    sessions: [],
    cards: [],
    reviews: [],
    focus: { status: 'idle', targetMin: state.settings.focusDefaultMin, accumulatedMs: 0 },
    meta: { updatedAt: Date.now(), demo: false },
  };
}
