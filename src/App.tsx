import { PlanningProvider } from './components/planning';
import { Shell } from './components/Shell';
import { ToastProvider } from './components/ui';
import { AnalyticsPage } from './pages/Analytics';
import { CourseDetailPage } from './pages/CourseDetail';
import { CoursesPage } from './pages/Courses';
import { DailyPage } from './pages/Daily';
import { DashboardPage } from './pages/Dashboard';
import { FocusPage } from './pages/Focus';
import { ReviewPage } from './pages/Review';
import { SettingsPage } from './pages/Settings';
import { TasksPage } from './pages/Tasks';
import { WeeklyPage } from './pages/Weekly';
import { useRoute, type Route } from './store/router';
import { StoreProvider, useStore, useThemeEffect } from './store/store';

const TITLES: Record<Route['name'], string> = {
  dashboard: 'داشبورد',
  daily: 'برنامه روزانه',
  weekly: 'برنامه هفتگی',
  courses: 'درس‌ها',
  course: 'درس',
  tasks: 'وظایف و تکالیف',
  focus: 'جلسات تمرکز',
  analytics: 'گزارش پیشرفت',
  review: 'مرور هفتگی',
  'app-settings': 'تنظیمات',
};

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'daily':
      return <DailyPage />;
    case 'weekly':
      return <WeeklyPage />;
    case 'courses':
      return <CoursesPage />;
    case 'course':
      return <CourseDetailPage courseId={route.param ?? ''} />;
    case 'tasks':
      return <TasksPage />;
    case 'focus':
      return <FocusPage />;
    case 'analytics':
      return <AnalyticsPage />;
    case 'review':
      return <ReviewPage />;
    case 'app-settings':
      return <SettingsPage />;
    default:
      return <DashboardPage />;
  }
}

function Root() {
  const route = useRoute();
  const { state } = useStore();
  useThemeEffect(state.settings.theme);
  document.title = `${TITLES[route.name]}، برنامه‌ریز مطالعه`;
  return (
    <PlanningProvider>
      <Shell route={route}>
        <Page key={route.name + (route.param ?? '')} route={route} />
      </Shell>
    </PlanningProvider>
  );
}

export function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <Root />
      </ToastProvider>
    </StoreProvider>
  );
}
