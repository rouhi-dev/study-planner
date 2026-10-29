import { useEffect, useState } from 'react';

/**
 * Tiny hash router. Hashes are plain names (`#weekly`, `#course-rp`) so they
 * work both on a normal host and inside the Claude artifact viewer.
 */
export type RouteName =
  | 'dashboard'
  | 'daily'
  | 'weekly'
  | 'courses'
  | 'course'
  | 'tasks'
  | 'focus'
  | 'analytics'
  | 'review'
  | 'app-settings';

export interface Route {
  name: RouteName;
  param?: string;
}

const SIMPLE: RouteName[] = [
  'dashboard',
  'daily',
  'weekly',
  'courses',
  'tasks',
  'focus',
  'analytics',
  'review',
  'app-settings',
];

export function parseHash(hash: string): Route {
  const h = decodeURIComponent(hash.replace(/^#/, ''));
  if (h.startsWith('course-')) return { name: 'course', param: h.slice('course-'.length) };
  return SIMPLE.includes(h as RouteName) ? { name: h as RouteName } : { name: 'dashboard' };
}

export function hrefFor(name: RouteName, param?: string): string {
  return name === 'course' ? `#course-${param ?? ''}` : `#${name}`;
}

export function navigate(name: RouteName, param?: string) {
  const target = hrefFor(name, param);
  if (window.location.hash !== target) window.location.hash = target;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
