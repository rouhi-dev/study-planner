import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { addTask } from '../lib/mutations';
import type { ISODate } from '../lib/types';
import { useStore } from '../store/store';
import { IconPlus } from './icons';
import { Button, cx, Select, useToast } from './ui';

/** One-line task capture: title + course, planned for `date` without a time. */
export function QuickAdd({ date, className }: { date: ISODate; className?: string }) {
  const { state, update } = useStore();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState(state.courses[0]?.id ?? '');
  const [error, setError] = useState(false);
  const inputId = useId();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) {
      setError(true);
      return;
    }
    const course = state.courses.find((c) => c.id === courseId);
    const top = Math.max(...state.courses.map((c) => c.weight));
    update((s) =>
      addTask(s, {
        title: t,
        courseId,
        priority: course && course.weight === top ? 'high' : 'medium',
        estimateMin: 45,
        type: 'theory',
        status: 'todo',
        scheduledDate: date,
        links: [],
      }),
    );
    setTitle('');
    setError(false);
    toast({ tone: 'success', message: 'اضافه شد (۴۵ دقیقه، بدون ساعت مشخص).' });
  };

  return (
    <form onSubmit={submit} className={cx('flex flex-col gap-2 sm:flex-row', className)} noValidate>
      <label htmlFor={inputId} className="sr-only">
        افزودن سریع کار
      </label>
      <input
        id={inputId}
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          if (error) setError(false);
        }}
        aria-invalid={error || undefined}
        placeholder="افزودن سریع: مثلاً «مرور جزوهٔ جلسهٔ ۷»"
        className={cx(
          'h-9 w-full min-w-0 rounded-lg border bg-surface px-3 sm:flex-1 text-sm placeholder:text-ink-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
          error ? 'border-danger' : 'border-line',
        )}
      />
      <div className="flex gap-2">
        <Select aria-label="درس" value={courseId} onChange={(e) => setCourseId(e.target.value)} className="sm:w-40">
          {state.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.shortName}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="soft" icon={IconPlus}>
          افزودن
        </Button>
      </div>
    </form>
  );
}
