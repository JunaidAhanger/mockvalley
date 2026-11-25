-- Enable Row Level Security on every table.
alter table public.topics enable row level security;
alter table public.months enable row level security;
alter table public.questions enable row level security;
alter table public.profiles enable row level security;
alter table public.passes enable row level security;
alter table public.question_attempts enable row level security;
alter table public.app_settings enable row level security;
alter table public.error_reports enable row level security;

-- Block anon and authenticated roles from reading or writing questions directly.
-- Server RPCs / Edge Functions using elevated/service privileges will serve questions safely.
revoke all on table public.questions from anon, authenticated;

-- Public reference tables: readable by visitors and signed-in users, not writable by them.
revoke insert, update, delete on table public.topics from anon, authenticated;
revoke insert, update, delete on table public.months from anon, authenticated;

drop policy if exists "topics_select_all" on public.topics;
create policy "topics_select_all"
  on public.topics
  for select
  to anon, authenticated
  using (true);

drop policy if exists "months_select_all" on public.months;
create policy "months_select_all"
  on public.months
  for select
  to anon, authenticated
  using (true);

-- Profiles: users can view their own profile row.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Passes: users can read ONLY their own passes, and cannot insert/update/delete passes.
revoke insert, update, delete on table public.passes from anon, authenticated;

drop policy if exists "passes_select_own" on public.passes;
create policy "passes_select_own"
  on public.passes
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Question attempts: users can read and record only their own attempts.
drop policy if exists "question_attempts_select_own" on public.question_attempts;
create policy "question_attempts_select_own"
  on public.question_attempts
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "question_attempts_insert_own" on public.question_attempts;
create policy "question_attempts_insert_own"
  on public.question_attempts
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "question_attempts_update_own" on public.question_attempts;
create policy "question_attempts_update_own"
  on public.question_attempts
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- App settings: lock direct writes from browser roles.
revoke insert, update, delete on table public.app_settings from anon, authenticated;

-- Error reports: signed-in users can submit reports under their own user_id and read their own reports.
revoke update, delete on table public.error_reports from anon, authenticated;

drop policy if exists "error_reports_insert_own" on public.error_reports;
create policy "error_reports_insert_own"
  on public.error_reports
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "error_reports_select_own" on public.error_reports;
create policy "error_reports_select_own"
  on public.error_reports
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Returns true if the currently signed-in user has an active pass that has not expired yet.
create or replace function public.is_paid()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.passes
    where user_id = auth.uid()
      and status = 'active'
      and expires_at > now()
  );
$$;

-- Allow authenticated users (and anon, which returns false when auth.uid() is null) to call is_paid().
revoke all on function public.is_paid() from public;
grant execute on function public.is_paid() to anon, authenticated;