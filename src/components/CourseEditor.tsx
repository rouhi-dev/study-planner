import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { COURSE_COLOR_CLASSES, COURSE_COLOR_LABEL } from '../lib/labels';
import { addCourse, deleteCourse, updateCourse } from '../lib/mutations';
import type { Course, CourseColor } from '../lib/types';
import { navigate } from '../store/router';
import { useStore } from '../store/store';
import { IconTrash } from './icons';
import { Button, ConfirmDialog, cx, Field, Input, Modal, Textarea, useToast } from './ui';

export function CourseEditor({ open, onClose, course }: { open: boolean; onClose: () => void; course?: Course }) {
  const { update } = useStore();
  const toast = useToast();
  const blank = { name: '', shortName: '', color: 'slate' as CourseColor, instructor: '', description: '', weight: 20 };
  const [f, setF] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const ids = { name: useId(), short: useId(), inst: useId(), desc: useId(), weight: useId() };

  useEffect(() => {
    if (open) {
      setF(course ? { name: course.name, shortName: course.shortName, color: course.color, instructor: course.instructor ?? '', description: course.description ?? '', weight: course.weight } : blank);
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, course?.id]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!f.name.trim()) errs.name = 'نام درس را وارد کنید.';
    if (!(f.weight >= 1 && f.weight <= 100)) errs.weight = 'عددی بین ۱ تا ۱۰۰ وارد کنید.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const data = {
      name: f.name.trim(),
      shortName: f.shortName.trim() || f.name.trim().split(' ')[0]!,
      color: f.color,
      instructor: f.instructor.trim() || undefined,
      description: f.description.trim() || undefined,
      weight: Math.round(f.weight),
    };
    update((s) => (course ? updateCourse(s, course.id, data) : addCourse(s, data)));
    toast({ tone: 'success', message: course ? 'درس به‌روز شد.' : 'درس اضافه شد.' });
    onClose();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={course ? 'ویرایش درس' : 'درس جدید'}
        footer={
          <>
            {course && (
              <Button variant="ghost" icon={IconTrash} className="me-auto text-danger" onClick={() => setConfirm(true)}>
                حذف درس
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              انصراف
            </Button>
            <Button variant="primary" type="submit" form="course-form">
              ذخیره
            </Button>
          </>
        }
      >
        <form id="course-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="نام درس" htmlFor={ids.name} error={errors.name} className="sm:col-span-2">
            <Input id={ids.name} data-autofocus value={f.name} invalid={!!errors.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="نام کوتاه" htmlFor={ids.short} hint="برای برچسب‌های فشرده">
            <Input id={ids.short} value={f.shortName} onChange={(e) => setF({ ...f, shortName: e.target.value })} />
          </Field>
          <Field label="استاد" htmlFor={ids.inst}>
            <Input id={ids.inst} value={f.instructor} onChange={(e) => setF({ ...f, instructor: e.target.value })} placeholder="اختیاری" />
          </Field>
          <Field label="سهم زمان (وزن نسبی)" htmlFor={ids.weight} error={errors.weight} hint="مثلاً ۴۵ / ۳۰ / ۲۵؛ نسبت وزن‌ها مهم است، نه جمع آن‌ها.">
            <Input id={ids.weight} type="number" min={1} max={100} value={f.weight} invalid={!!errors.weight} onChange={(e) => setF({ ...f, weight: Number(e.target.value) })} className="ltr text-start" />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium text-ink-2">رنگ نشانه</legend>
            <div className="flex gap-2">
              {(Object.keys(COURSE_COLOR_CLASSES) as CourseColor[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={f.color === c}
                  aria-label={COURSE_COLOR_LABEL[c]}
                  title={COURSE_COLOR_LABEL[c]}
                  onClick={() => setF({ ...f, color: c })}
                  className={cx('size-8 rounded-full border-2', COURSE_COLOR_CLASSES[c].dot, f.color === c ? 'border-ink' : 'border-transparent')}
                />
              ))}
            </div>
          </fieldset>
          <Field label="توضیح" htmlFor={ids.desc} className="sm:col-span-2">
            <Textarea id={ids.desc} rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
        </form>
      </Modal>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="حذف درس؟"
        body={`«${course?.name ?? ''}» همراه با مباحث، کارها و کارت‌های مرور آن حذف می‌شود. جلسات مطالعهٔ ثبت‌شده در گزارش باقی می‌مانند.`}
        confirmLabel="حذف درس"
        onConfirm={() => {
          if (!course) return;
          update((s) => deleteCourse(s, course.id));
          toast({ tone: 'success', message: 'درس حذف شد.' });
          onClose();
          navigate('courses');
        }}
      />
    </>
  );
}
