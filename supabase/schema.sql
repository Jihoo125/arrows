create table if not exists public.arrow_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cleared_levels integer[] not null default '{}',
  current_level integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.arrow_progress enable row level security;

drop policy if exists "Players can read own arrow progress" on public.arrow_progress;
create policy "Players can read own arrow progress"
on public.arrow_progress
for select
using (auth.uid() = user_id);

drop policy if exists "Players can upsert own arrow progress" on public.arrow_progress;
create policy "Players can upsert own arrow progress"
on public.arrow_progress
for insert
with check (auth.uid() = user_id);

drop policy if exists "Players can update own arrow progress" on public.arrow_progress;
create policy "Players can update own arrow progress"
on public.arrow_progress
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
