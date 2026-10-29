-- Run once in Supabase → SQL Editor.
create table if not exists public.planner_state (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.planner_state enable row level security;

create policy "own row select" on public.planner_state
  for select to authenticated using (user_id = auth.uid());
create policy "own row insert" on public.planner_state
  for insert to authenticated with check (user_id = auth.uid());
create policy "own row update" on public.planner_state
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own row delete" on public.planner_state
  for delete to authenticated using (user_id = auth.uid());
