# برنامه‌ریز مطالعه — Persian RTL Study Planner

A Persian, right-to-left study planner for a working master's student in Telecommunications Systems (Yazd University): Random Processes, Advanced Engineering Mathematics, Neural Networks.

## Run

```bash
npm install          # react, react-dom, react-icons + dev tools
npm run dev          # http://localhost:5173 (watch + rebuild)
npm run build        # → dist/index.html (single self-contained file)
npm test             # core-logic tests (node:test via tsx)
npm run typecheck    # strict TypeScript with @types/react
```

`dist/index.html` is fully self-contained; open it directly or host it anywhere.

## Stack

React 19 + TypeScript (strict) + Tailwind CSS v4 + react-icons (Lucide). There's no Vite: `scripts/build.mjs` bundles with esbuild and compiles Tailwind through its programmatic API. That keeps dependencies minimal and produces a single HTML file.

## Architecture

```
src/lib/        pure logic, no React
  types.ts        domain model
  jalali.ts       Jalali ⇄ Gregorian conversion (verified against Intl for 1990–2060)
  dates.ts        ISO dates, Iranian week (Sat→Fri), Persian formatting
  schedule.ts     hard rules (no overlap with fixed commitments / other study,
                  stay inside the day window), budget checks, slot finding,
                  single-task rescheduling, reviewable weekly proposals
  mutations.ts    pure state transitions (tasks, topics, focus, spaced repetition…)
  analytics.ts    every metric shown in the UI
  storage.ts      persistence adapters (localStorage; optional private cloud copy
                  when running as a Claude artifact) — separate from UI
src/data/demo.ts  editable demo data, generated relative to today (week 7 of 16)
src/store/        React store (persist + sync), hash router, UI hand-offs
src/components/   design-system primitives, editors, planner dialogs, charts
src/pages/        Dashboard, Daily, Weekly, Courses, Course detail, Tasks,
                  Focus, Analytics, Weekly review, Settings
```

## Scheduling rules

- Study is never placed on fixed commitments (work, class, personal, break), never overlaps other timed study, and stays inside the configured day window.
- Automatic suggestions never exceed the daily budget (default 180 min). They try the preferred study start (default 17:00) first, and only fill up to 75% of the week with new practice so there's a buffer.
- A missed task is moved on its own. Nothing else is pushed forward.
- Every proposal (weekly plan, catch-up) is a reviewable list. Nothing changes until you apply it.

## Offline build note

This project was built in a sandbox with no access to the npm registry, GitHub or font CDNs. Two consequences:

- **Types:** `types-offline/react.d.ts` is a minimal React type shim, and `npm run typecheck:offline` uses it. After `npm install`, use `npm run typecheck`, which uses the real `@types/react`.
- **Font:** Vazirmatn loads from Google Fonts at runtime. Without internet access the app falls back to Tahoma/system Persian fonts. To bundle the font locally, `npm i @fontsource-variable/vazirmatn` and import it in `src/main.tsx`.

There is no ESLint config, because `typescript-eslint` wasn't available offline.

## Deployment & cloud sync

Hosted on GitHub Pages; every push to `main` runs `.github/workflows/deploy.yml` (test → build → deploy).
The router is hash-based, so refreshes and deep links work on static hosting.

Cross-device sync is optional and uses Supabase (Auth + one table protected by row-level security):

1. Create a free project at supabase.com and run `supabase/schema.sql` in the SQL Editor.
2. Authentication → Providers → Email: enabled (turn off "Confirm email" for a single-user setup, or confirm via mail).
3. In the GitHub repo → Settings → Secrets and variables → Actions → **Variables**, add `SUPABASE_URL` and `SUPABASE_ANON_KEY` (the anon/public key, never the service-role key), then re-run the workflow.
4. In the app: Settings → همگام‌سازی ابری → create an account / sign in. For local builds set the same two env vars before `npm run build`.

Without these variables the app is local-only (localStorage + JSON backup). Conflict rule: the newest `meta.updatedAt` wins at load / when the tab regains focus; the replaced local copy is kept under `study-planner:v1:pre-cloud-backup`.
