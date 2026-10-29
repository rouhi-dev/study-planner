import { useState } from 'react';
import { CourseCard } from '../components/CourseCard';
import { CourseEditor } from '../components/CourseEditor';
import { IconBook, IconPlus } from '../components/icons';
import { Button, Callout, EmptyState, PageHeader } from '../components/ui';
import { useStore } from '../store/store';

export function CoursesPage() {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const courses = [...state.courses].sort((a, b) => b.weight - a.weight);
  return (
    <div>
      <PageHeader
        title="درس‌ها"
        subtitle="مباحث هر درس، پیش‌نیازها و نقشهٔ هفته‌های باقی‌مانده"
        actions={
          <Button variant="secondary" icon={IconPlus} onClick={() => setOpen(true)}>
            درس جدید
          </Button>
        }
      />
      <Callout tone="neutral" className="mb-6">
        «سهم زمان» تعیین می‌کند پیشنهاددهندهٔ برنامهٔ هفتگی چه بخشی از زمان مطالعه را به هر درس بدهد. آن را در صفحهٔ هر درس یا در مرور هفتگی تنظیم
        کنید. پیشرفت هر درس به صورت «تعداد مباحث تکمیل‌شده» نمایش داده می‌شود، نه درصد ترکیبی.
      </Callout>
      {courses.length === 0 ? (
        <EmptyState icon={IconBook} title="هنوز درسی ثبت نشده" action={<Button variant="primary" onClick={() => setOpen(true)}>افزودن درس</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((c, i) => (
            <CourseCard key={c.id} course={c} rank={i} />
          ))}
        </div>
      )}
      <CourseEditor open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
