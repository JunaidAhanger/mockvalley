-- Core reference tables matching data/topics.json and data/months.json.
-- "order" is quoted because ORDER is a reserved word in SQL.
create table if not exists public.topics (
  id text primary key,
  name text not null,
  "order" integer not null,
  active boolean not null default true
);

create table if not exists public.months (
  id text primary key,
  label text not null,
  "order" integer not null,
  active boolean not null default true
);

-- Question bank table storing all fields from data/questions/*.json.
create table if not exists public.questions (
  id text primary key,
  status text not null check (status in ('active', 'hidden')),
  is_free boolean not null default false,
  topic_id text not null references public.topics(id),
  month_id text references public.months(id),
  question text not null,
  options jsonb not null,
  correct text not null check (correct in ('A', 'B', 'C', 'D')),
  explanation text not null,
  option_notes jsonb not null,
  source text not null,
  last_verified date not null,
  difficulty text not null check (difficulty in ('easy', 'moderate', 'hard')),
  tags text[] not null default '{}'
);

-- Indexes to speed up filtering by topic, difficulty, and current affairs month.
create index if not exists idx_questions_topic_id on public.questions (topic_id);
create index if not exists idx_questions_difficulty on public.questions (difficulty);
create index if not exists idx_questions_month_id on public.questions (month_id);

-- User profile linked to Supabase Auth users.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Paid 3-month passes unlocked by server-side Razorpay webhook verification.
create table if not exists public.passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text not null,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null check (status in ('active', 'expired', 'cancelled', 'refunded')),
  razorpay_payment_id text unique not null
);

-- Tracks user attempts per question so each user has at most one record per question.
create table if not exists public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id text not null references public.questions(id),
  selected text not null check (selected in ('A', 'B', 'C', 'D')),
  is_correct boolean not null,
  first_attempted_at timestamptz not null default now(),
  last_attempted_at timestamptz not null default now(),
  constraint question_attempts_user_question_unique unique (user_id, question_id)
);

-- Key-value configuration (for example, default exam duration and negative marking).
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null
);

-- Default settings for exam scoring and timing.
insert into public.app_settings (key, value)
values
  ('exam_defaults', '{"default_questions": 20, "default_minutes": 20, "marks_correct": 1, "marks_wrong": -0.25}'::jsonb)
on conflict (key) do nothing;

-- User-submitted question error reports.
create table if not exists public.error_reports (
  id uuid primary key default gen_random_uuid(),
  question_id text not null references public.questions(id),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);