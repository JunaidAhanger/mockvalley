-- 1. Automatically create a public.profiles row whenever a new auth user signs in
-- (works for temporary anonymous users now and Google sign-in users in Task 5).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill any existing auth users who don't have a profile row yet.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- 2. RPC: get_topics()
-- Returns active topics in display order along with accessible question counts per difficulty.
-- Paid users get counts of all active questions; unpaid/anonymous users get counts of active is_free questions.
create or replace function public.get_topics()
returns table (
  id text,
  name text,
  "order" integer,
  easy_count integer,
  moderate_count integer,
  hard_count integer,
  total_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with caller as (
    select public.is_paid() as has_paid
  )
  select
    t.id,
    t.name,
    t."order",
    count(q.id) filter (where q.difficulty = 'easy')::integer as easy_count,
    count(q.id) filter (where q.difficulty = 'moderate')::integer as moderate_count,
    count(q.id) filter (where q.difficulty = 'hard')::integer as hard_count,
    count(q.id)::integer as total_count
  from public.topics t
  cross join caller c
  left join public.questions q
    on q.topic_id = t.id
    and q.status = 'active'
    and (c.has_paid or q.is_free = true)
  where t.active = true
  group by t.id, t.name, t."order"
  order by t."order" asc, t.name asc;
$$;

-- 3. RPC: get_question_list(p_topic_id, p_difficulty)
-- Returns ordered question IDs (and total count) strictly for the chosen topic and difficulty.
-- Unpaid users only receive is_free = true questions.
create or replace function public.get_question_list(
  p_topic_id text,
  p_difficulty text default 'all'
)
returns table (
  question_id text,
  total_count integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paid boolean := public.is_paid();
begin
  if p_difficulty not in ('all', 'easy', 'moderate', 'hard') then
    raise exception 'Invalid difficulty filter: %', p_difficulty;
  end if;

  return query
  select
    q.id as question_id,
    count(*) over ()::integer as total_count
  from public.questions q
  join public.topics t on t.id = q.topic_id
  where q.topic_id = p_topic_id
    and t.active = true
    and q.status = 'active'
    and (v_paid or q.is_free = true)
    and (p_difficulty = 'all' or q.difficulty = p_difficulty)
  order by q.id asc;
end;
$$;

-- 4. RPC: get_question(p_question_id)
-- Returns ONLY question text, options, and difficulty.
-- Never exposes correct answer, explanation, or option_notes, and enforces entitlement.
create or replace function public.get_question(p_question_id text)
returns table (
  id text,
  question text,
  options jsonb,
  difficulty text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paid boolean := public.is_paid();
begin
  return query
  select
    q.id,
    q.question,
    q.options,
    q.difficulty
  from public.questions q
  join public.topics t on t.id = q.topic_id
  where q.id = p_question_id
    and t.active = true
    and q.status = 'active'
    and (v_paid or q.is_free = true);
end;
$$;

-- 5. RPC: submit_answer(p_question_id, p_selected)
-- Verifies entitlement, records/updates the user's attempt in question_attempts,
-- and returns whether it was correct along with the correct option, explanation, and option_notes.
create or replace function public.submit_answer(
  p_question_id text,
  p_selected text
)
returns table (
  is_correct boolean,
  correct text,
  explanation text,
  option_notes jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_paid boolean := public.is_paid();
  v_correct text;
  v_explanation text;
  v_option_notes jsonb;
  v_is_correct boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required to submit an answer';
  end if;

  if p_selected not in ('A', 'B', 'C', 'D') then
    raise exception 'Selected option must be A, B, C, or D';
  end if;

  -- Fetch the answer key only if the question is active and allowed for this user
  select q.correct, q.explanation, q.option_notes
    into v_correct, v_explanation, v_option_notes
  from public.questions q
  join public.topics t on t.id = q.topic_id
  where q.id = p_question_id
    and t.active = true
    and q.status = 'active'
    and (v_paid or q.is_free = true);

  if not found then
    raise exception 'Question not found or requires a paid pass';
  end if;

  v_is_correct := (p_selected = v_correct);

  -- Ensure profile row exists before recording attempt
  insert into public.profiles (id)
  values (v_user_id)
  on conflict (id) do nothing;

  -- Upsert attempt (unique on user_id + question_id)
  insert into public.question_attempts (
    user_id,
    question_id,
    selected,
    is_correct,
    first_attempted_at,
    last_attempted_at
  )
  values (
    v_user_id,
    p_question_id,
    p_selected,
    v_is_correct,
    now(),
    now()
  )
  on conflict (user_id, question_id) do update
    set selected = excluded.selected,
        is_correct = excluded.is_correct,
        last_attempted_at = now();

  return query
  select
    v_is_correct,
    v_correct,
    v_explanation,
    v_option_notes;
end;
$$;

-- Restrict function execution permissions cleanly
revoke all on function public.get_topics() from public;
grant execute on function public.get_topics() to anon, authenticated;

revoke all on function public.get_question_list(text, text) from public;
grant execute on function public.get_question_list(text, text) to anon, authenticated;

revoke all on function public.get_question(text) from public;
grant execute on function public.get_question(text) to anon, authenticated;

revoke all on function public.submit_answer(text, text) from public;
grant execute on function public.submit_answer(text, text) to authenticated;