import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { CommitmentEditor } from '../components/CommitmentEditor';
import { DatePicker } from '../components/DatePicker';
import { IconCalendarPlus, IconDownload, IconPencil, IconRotate, IconSparkles, IconUpload } from '../components/icons';
import { Badge, Button, Card, ConfirmDialog, CourseTag, cx, Field, Input, PageHeader, Segmented, useToast } from '../components/ui';
import { buildDemoState, freshFromState } from '../data/demo';
import { semesterInfo } from '../lib/analytics';
import { faInt, formatLongDate, formatTime, toMin, todayISO, WEEKDAYS } from '../lib/dates';
import { downloadText } from '../lib/download';
import { COMMITMENT_KIND_LABEL } from '../lib/labels';
import { updateSettings } from '../lib/mutations';
import { parseState } from '../lib/storage';
import type { AppState, Commitment, Settings, ThemePref, Weekday } from '../lib/types';
import { hrefFor } from '../store/router';
import { useStore } from '../store/store';

export function SettingsPage() {
  return (
    <div>
      <PageHeader title="تنظیمات" subtitle="مشخصات، ترم، زمان در دسترس، تعهدهای ثابت و داده‌ها" />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-6">
          <GeneralForm />
          <Appearance />
        </div>
        <div className="flex flex-col gap-6">
          <Commitments />
          <CoursesLinks />
          <CloudAccount />
          <DataManagement />
        </div>
      </div>
    </div>
  );
}

function GeneralForm() {
  const { state, update } = useStore();
  const toast = useToast();
  const s = state.settings;
  const [f, setF] = useState(() => toForm(s));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const ids = { name: useId(), uni: useId(), prog: useId(), start: useId(), weeks: useId(), budget: useId(), ds: useId(), de: useId(), focus: useId(), pref: useId() };
  useEffect(() => setF(toForm(state.settings)), [state.settings]);
  const sem = semesterInfo({ ...s, semesterStart: f.semesterStart, semesterWeeks: Number(f.semesterWeeks) || s.semesterWeeks }, todayISO());

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const weeks = Number(f.semesterWeeks);
    const budget = Number(f.dailyBudgetMin);
    const focus = Number(f.focusDefaultMin);
    if (!(weeks >= 4 && weeks <= 30)) errs.weeks = 'بین ۴ تا ۳۰ هفته.';
    if (!(budget >= 15 && budget <= 720)) errs.budget = 'بین ۱۵ تا ۷۲۰ دقیقه.';
    if (!(focus >= 5 && focus <= 240)) errs.focus = 'بین ۵ تا ۲۴۰ دقیقه.';
    if (!f.dayStart || !f.dayEnd || toMin(f.dayEnd) - toMin(f.dayStart) < 60) errs.window = 'پایان روز باید دست‌کم یک ساعت بعد از شروع باشد.';
    const overrides: Settings['budgetOverrides'] = {};
    f.overrides.forEach((v, i) => {
      if (v.trim() === '') return;
      const n = Number(v);
      if (!(n >= 0 && n <= 720)) errs.overrides = 'مقدار هر روز بین ۰ تا ۷۲۰ دقیقه باشد (خالی = پیش‌فرض).';
      else overrides[i as Weekday] = Math.round(n);
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    update((st) =>
      updateSettings(st, {
        name: f.name.trim(),
        university: f.university.trim(),
        program: f.program.trim(),
        semesterStart: f.semesterStart,
        semesterWeeks: Math.round(weeks),
        dailyBudgetMin: Math.round(budget),
        budgetOverrides: overrides,
        dayStart: f.dayStart,
        dayEnd: f.dayEnd,
        preferredStudyStart: f.preferredStudyStart || undefined,
        focusDefaultMin: Math.round(focus),
      }),
    );
    toast({ tone: 'success', message: 'تنظیمات ذخیره شد.' });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Card title="مشخصات">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="نام (برای خوشامدگویی)" htmlFor={ids.name}>
            <Input id={ids.name} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="مثلاً: سارا" />
          </Field>
          <Field label="دانشگاه" htmlFor={ids.uni}>
            <Input id={ids.uni} value={f.university} onChange={(e) => setF({ ...f, university: e.target.value })} />
          </Field>
          <Field label="رشته و مقطع" htmlFor={ids.prog} className="sm:col-span-2">
            <Input id={ids.prog} value={f.program} onChange={(e) => setF({ ...f, program: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card title="ترم" subtitle={sem.status === 'during' ? `اکنون هفتهٔ ${faInt(sem.week)}؛ پایان ترم ${formatLongDate(sem.endDate)}` : `پایان ترم ${formatLongDate(sem.endDate)}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="تاریخ شروع ترم" htmlFor={ids.start} hint="ترجیحاً یک شنبه؛ هفته‌ها از شنبه شمرده می‌شوند.">
            <DatePicker id={ids.start} value={f.semesterStart} onChange={(v) => v && setF({ ...f, semesterStart: v })} />
          </Field>
          <Field label="تعداد هفته‌ها" htmlFor={ids.weeks} error={errors.weeks}>
            <Input id={ids.weeks} type="number" min={4} max={30} value={f.semesterWeeks} invalid={!!errors.weeks} onChange={(e) => setF({ ...f, semesterWeeks: e.target.value })} className="ltr text-start" />
          </Field>
        </div>
      </Card>

      <Card title="زمان مطالعه" subtitle="برنامه‌ریز هرگز بیش از این سقف را خودکار برنامه‌ریزی نمی‌کند.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="سقف روزانه (دقیقه)" htmlFor={ids.budget} error={errors.budget} hint="پیش‌فرض: ۱۸۰ دقیقه (۳ ساعت)">
            <Input id={ids.budget} type="number" min={15} max={720} step={15} value={f.dailyBudgetMin} invalid={!!errors.budget} onChange={(e) => setF({ ...f, dailyBudgetMin: e.target.value })} className="ltr text-start" />
          </Field>
          <Field label="مدت پیش‌فرض جلسهٔ تمرکز (دقیقه)" htmlFor={ids.focus} error={errors.focus}>
            <Input id={ids.focus} type="number" min={5} max={240} value={f.focusDefaultMin} invalid={!!errors.focus} onChange={(e) => setF({ ...f, focusDefaultMin: e.target.value })} className="ltr text-start" />
          </Field>
          <Field label="شروع روز" htmlFor={ids.ds} error={errors.window} hint="هیچ مطالعه‌ای قبل از این ساعت برنامه‌ریزی نمی‌شود.">
            <Input id={ids.ds} type="time" value={f.dayStart} onChange={(e) => setF({ ...f, dayStart: e.target.value })} className="ltr text-start" />
          </Field>
          <Field label="پایان روز" htmlFor={ids.de}>
            <Input id={ids.de} type="time" value={f.dayEnd} onChange={(e) => setF({ ...f, dayEnd: e.target.value })} className="ltr text-start" />
          </Field>
          <Field label="ساعت ترجیحی شروع مطالعه" htmlFor={ids.pref} hint="پیشنهادهای خودکار ابتدا از این ساعت به بعد جا پیدا می‌کنند؛ اگر جا نبود، زمان آزاد زودتر.">
            <Input id={ids.pref} type="time" value={f.preferredStudyStart} onChange={(e) => setF({ ...f, preferredStudyStart: e.target.value })} className="ltr text-start" />
          </Field>
        </div>
        <fieldset className="mt-5">
          <legend className="mb-2 text-[13px] font-medium text-ink-2">سقف متفاوت برای روزهای خاص (اختیاری)</legend>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {WEEKDAYS.map((w, i) => (
              <label key={w} className="flex flex-col gap-1 text-xs text-ink-3">
                {w}
                <Input
                  type="number"
                  min={0}
                  max={720}
                  step={15}
                  placeholder={faInt(Number(f.dailyBudgetMin) || 0)}
                  value={f.overrides[i]}
                  onChange={(e) => setF({ ...f, overrides: f.overrides.map((x, j) => (j === i ? e.target.value : x)) })}
                  className="ltr px-2 text-start"
                />
              </label>
            ))}
          </div>
          {errors.overrides ? <p className="mt-1.5 text-xs text-danger">{errors.overrides}</p> : <p className="mt-1.5 text-xs text-ink-3">خالی = همان سقف روزانه. مثلاً روز کلاس را کمتر بگذارید.</p>}
        </fieldset>
      </Card>
      <div className="flex justify-end">
        <Button variant="primary" type="submit">
          ذخیرهٔ تنظیمات
        </Button>
      </div>
    </form>
  );
}

function toForm(s: Settings) {
  return {
    name: s.name,
    university: s.university,
    program: s.program,
    semesterStart: s.semesterStart,
    semesterWeeks: String(s.semesterWeeks),
    dailyBudgetMin: String(s.dailyBudgetMin),
    focusDefaultMin: String(s.focusDefaultMin),
    dayStart: s.dayStart,
    dayEnd: s.dayEnd,
    preferredStudyStart: s.preferredStudyStart ?? '17:00',
    overrides: Array.from({ length: 7 }, (_, i) => (s.budgetOverrides[i as Weekday] !== undefined ? String(s.budgetOverrides[i as Weekday]) : '')),
  };
}

function Appearance() {
  const { state, update } = useStore();
  return (
    <Card title="ظاهر">
      <Segmented<ThemePref>
        label="پوسته"
        value={state.settings.theme}
        onChange={(theme) => update((s) => updateSettings(s, { theme }))}
        options={[
          { value: 'light', label: 'روشن' },
          { value: 'dark', label: 'تیره' },
          { value: 'system', label: 'مطابق سیستم' },
        ]}
      />
      <p className="mt-3 text-xs text-ink-3">قلم وزیرمتن در صورت دسترسی به اینترنت بارگذاری می‌شود؛ در غیر این صورت از قلم فارسی سیستم استفاده می‌شود.</p>
    </Card>
  );
}

function Commitments() {
  const { state } = useStore();
  const [edit, setEdit] = useState<{ open: boolean; c?: Commitment }>({ open: false });
  const list = [...state.commitments].sort((a, b) => toMin(a.start) - toMin(b.start));
  return (
    <Card
      title="تعهدهای ثابت"
      subtitle="ساعت کاری، کلاس‌ها و برنامه‌های شخصی؛ مطالعه هیچ‌وقت روی این‌ها برنامه‌ریزی نمی‌شود."
      action={
        <Button size="sm" variant="ghost" icon={IconCalendarPlus} onClick={() => setEdit({ open: true })}>
          افزودن
        </Button>
      }
    >
      {list.length === 0 ? (
        <p className="text-[13px] text-ink-3">هنوز تعهد ثابتی ثبت نشده است. ساعت کاری خود را اضافه کنید تا برنامه‌ریز آن را در نظر بگیرد.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {list.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2.5">
              <span className="fixed-hatch h-8 w-1.5 shrink-0 rounded-full" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">
                  {c.title} {c.demo && <Badge className="ms-1">نمونه</Badge>}
                </p>
                <p className="num text-xs text-ink-3">
                  {COMMITMENT_KIND_LABEL[c.kind]}، {c.date ? formatLongDate(c.date) : c.days.map((d) => WEEKDAYS[d]).join('، ')}، {formatTime(c.start)} تا {formatTime(c.end)}
                </p>
              </div>
              <Button size="sm" variant="ghost" icon={IconPencil} onClick={() => setEdit({ open: true, c })}>
                ویرایش
              </Button>
            </li>
          ))}
        </ul>
      )}
      <CommitmentEditor open={edit.open} commitment={edit.c} onClose={() => setEdit({ open: false })} />
    </Card>
  );
}

function CoursesLinks() {
  const { state } = useStore();
  return (
    <Card title="درس‌ها" subtitle="نام، استاد، رنگ، سهم زمان و مباحث را در صفحهٔ هر درس ویرایش کنید.">
      <ul className="flex flex-col gap-1">
        {state.courses.map((c) => (
          <li key={c.id}>
            <a href={hrefFor('course', c.id)} className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-subtle">
              <CourseTag course={c} short={false} />
              <span className="text-xs text-primary">ویرایش</span>
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function CloudAccount() {
  const { account, sync, state } = useStore();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!account) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'in') await account.signIn(email.trim(), password);
      else {
        const done = await account.signUp(email.trim(), password);
        if (!done) toast({ tone: 'success', message: 'ایمیل تأیید ارسال شد. پس از تأیید، وارد شوید.' });
      }
      setPassword('');
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(
        status === 400 || status === 401 || status === 422
          ? 'ایمیل یا گذرواژه درست نیست (گذرواژهٔ جدید حداقل ۶ نویسه).'
          : 'ارتباط با سرور ممکن نشد. اینترنت را بررسی و دوباره تلاش کنید.',
      );
    } finally {
      setBusy(false);
    }
  };

  const loggedIn = !!account.email && sync !== 'auth';
  return (
    <Card title="همگام‌سازی ابری" subtitle="با ورود به حساب، داده‌ها روی همهٔ دستگاه‌ها یکسان می‌شوند.">
      {loggedIn ? (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] leading-6 text-ink-2" dir="ltr">
            {account.email}
          </p>
          <p className="text-[13px] leading-6 text-ink-2">
            {sync === 'error' ? 'همگام‌سازی ناموفق بود؛ داده‌ها در این مرورگر محفوظ‌اند و دوباره تلاش می‌شود.' : 'همگام است.'}
          </p>
          <div>
            <Button variant="secondary" onClick={account.signOut}>
              خروج
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          {sync === 'auth' && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">نشست شما منقضی شده است؛ دوباره وارد شوید.</p>}
          <p className="text-xs leading-5 text-ink-3">
            داده‌های فعلی این مرورگر ({state.tasks.length.toLocaleString('fa')} کار) پاک نمی‌شوند: در اولین ورود، اگر حساب خالی باشد همین داده‌ها بارگذاری می‌شوند و اگر داده‌ای جدیدتر در حساب باشد، نسخهٔ فعلی پیش از جایگزینی در این مرورگر پشتیبان می‌شود.
          </p>
          <Field label="ایمیل" htmlFor="cloud-email">
            <Input id="cloud-email" type="email" dir="ltr" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="گذرواژه" htmlFor="cloud-pw" error={error ?? undefined}>
            <Input id="cloud-pw" type="password" dir="ltr" minLength={6} required autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="primary" disabled={busy}>
              {mode === 'in' ? 'ورود' : 'ساخت حساب'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
              {mode === 'in' ? 'حساب ندارم' : 'حساب دارم'}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function DataManagement() {
  const { state, replaceState, sync, saveError, account } = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<AppState | null>(null);
  const [confirm, setConfirm] = useState<'fresh' | 'demo' | null>(null);
  const [copied, setCopied] = useState(false);

  const json = () => JSON.stringify(state, null, 2);
  const exportFile = async () => {
    try {
      await downloadText(`study-planner-${todayISO()}.json`, json());
      toast({ tone: 'success', message: 'فایل پشتیبان آماده شد.' });
    } catch {
      toast({ tone: 'error', message: 'دانلود انجام نشد؛ از «کپی» استفاده کنید.' });
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ tone: 'error', message: 'دسترسی به کلیپ‌بورد ممکن نشد.' });
    }
  };
  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = parseState(JSON.parse(await file.text()));
      if (!parsed) throw new Error('invalid');
      setPending(parsed);
    } catch {
      toast({ tone: 'error', message: 'این فایل پشتیبانِ معتبرِ این برنامه نیست.' });
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Card title="داده‌ها" subtitle="همهٔ داده‌ها نزد شماست؛ هیچ سرور جداگانه‌ای در کار نیست.">
      <div className={cx('mb-4 rounded-lg px-3 py-2.5 text-[13px] leading-6', saveError ? 'bg-danger-soft text-danger' : 'bg-subtle text-ink-2')}>
        {saveError
          ? saveError
          : sync === 'cloud' && account
            ? 'داده‌ها در این مرورگر و در حساب ابری خصوصی شما ذخیره می‌شوند و روی دستگاه‌های دیگر (پس از ورود) در دسترس‌اند.'
            : sync === 'cloud'
            ? 'داده‌ها در این مرورگر و در فضای خصوصی حساب Claude شما ذخیره می‌شوند و روی دستگاه‌های دیگر هم در دسترس‌اند.'
            : 'داده‌ها در حافظهٔ همین مرورگر ذخیره می‌شوند. پاک‌کردن داده‌های مرورگر آن‌ها را حذف می‌کند؛ گاهی پشتیبان بگیرید.'}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" icon={IconDownload} onClick={exportFile}>
          دریافت پشتیبان (JSON)
        </Button>
        <Button variant="ghost" onClick={copy}>
          {copied ? 'کپی شد' : 'کپی پشتیبان'}
        </Button>
        <Button variant="secondary" icon={IconUpload} onClick={() => fileRef.current?.click()}>
          بازیابی از فایل
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      <div className="mt-5 border-t border-line pt-4">
        <p className="mb-2 text-[13px] font-medium text-ink-2">شروع دوباره</p>
        <div className="flex flex-wrap gap-2">
          <Button variant={state.meta.demo ? 'primary' : 'secondary'} icon={IconSparkles} onClick={() => setConfirm('fresh')}>
            شروع با برنامهٔ خالی
          </Button>
          <Button variant="ghost" icon={IconRotate} onClick={() => setConfirm('demo')}>
            بازگردانی داده‌های نمونه
          </Button>
        </div>
        <p className="mt-2 text-xs leading-5 text-ink-3">
          «برنامهٔ خالی» درس‌ها، مباحث (با وضعیت شروع‌نشده) و تعهدهای ثابت را نگه می‌دارد و کارها، جلسات، کارت‌ها و مرورها را پاک می‌کند.
        </p>
      </div>

      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        title="جایگزینی داده‌ها با فایل پشتیبان؟"
        body={`داده‌های فعلی با فایل انتخاب‌شده (${faInt(pending?.tasks.length ?? 0)} کار، ${faInt(pending?.sessions.length ?? 0)} جلسه) جایگزین می‌شوند.`}
        confirmLabel="جایگزین کن"
        onConfirm={() => {
          if (pending) replaceState(pending);
          toast({ tone: 'success', message: 'داده‌ها بازیابی شد.' });
        }}
      />
      <ConfirmDialog
        open={confirm === 'fresh'}
        onClose={() => setConfirm(null)}
        title="شروع با برنامهٔ خالی؟"
        body="کارها، جلسات ثبت‌شده، کارت‌های مرور و مرورهای هفتگی حذف می‌شوند. درس‌ها، مباحث و تعهدهای ثابت باقی می‌مانند تا آن‌ها را با برنامهٔ واقعی خود تطبیق دهید. اگر لازم است اول پشتیبان بگیرید."
        confirmLabel="شروع کن"
        onConfirm={() => {
          replaceState(freshFromState(state));
          toast({ tone: 'success', message: 'برنامه خالی شد. ابتدا تعهدهای ثابت و مباحث را بررسی کنید.' });
        }}
      />
      <ConfirmDialog
        open={confirm === 'demo'}
        onClose={() => setConfirm(null)}
        title="بازگردانی داده‌های نمونه؟"
        body="همهٔ داده‌های فعلی با داده‌های نمونه جایگزین می‌شوند."
        confirmLabel="بازگردانی"
        onConfirm={() => {
          replaceState(buildDemoState());
          toast({ tone: 'success', message: 'داده‌های نمونه بازگردانی شد.' });
        }}
      />
    </Card>
  );
}
