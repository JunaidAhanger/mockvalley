-- 1. Ensure a public.profiles row is created on first login (Google OAuth or any auth user).
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

insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- Helper RPC so the client can explicitly guarantee a profile row exists after login.
create or replace function public.ensure_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.profiles (id)
  values (v_user_id)
  on conflict (id) do nothing;
end;
$$;

revoke all on function public.ensure_profile() from public;
grant execute on function public.ensure_profile() to authenticated;

-- 2. Update get_topics() to include free quota usage for the current user per topic.
-- Paid users get counts of all active questions; unpaid users get active is_free counts + free_used_count (max 10).
drop function if exists public.get_topics();

create or replace function public.get_topics()
returns table (
  id text,
  name text,
  "order" integer,
  easy_count integer,
  moderate_count integer,
  hard_count integer,
  total_count integer,
  free_used_count integer,
  free_quota_limit integer
)
language sql
stable
security definer
set search_path = public
as $$
  with caller as (
    select
      auth.uid() as uid,
      public.is_paid() as has_paid
  )
  select
    t.id,
    t.name,
    t."order",
    count(q.id) filter (where q.difficulty = 'easy')::integer as easy_count,
    count(q.id) filter (where q.difficulty = 'moderate')::integer as moderate_count,
    count(q.id) filter (where q.difficulty = 'hard')::integer as hard_count,
    count(q.id)::integer as total_count,
    count(distinct qa.question_id)::integer as free_used_count,
    10::integer as free_quota_limit
  from public.topics t
  cross join caller c
  left join public.questions q
    on q.topic_id = t.id
    and q.status = 'active'
    and (c.has_paid or q.is_free = true)
  left join public.question_attempts qa
    on qa.user_id = c.uid
    and qa.question_id = q.id
    and not c.has_paid
  where t.active = true
  group by t.id, t.name, t."order"
  order by t."order" asc, t.name asc;
$$;

-- 3. Update get_question_list() — requires login and enforces is_free = true for unpaid users.
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
  v_user_id uuid := auth.uid();
  v_paid boolean := public.is_paid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

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

-- 4. Update get_question() — requires login; returns only question text, options, and difficulty;
-- never returns correct answer, explanation, or option_notes; blocks paid questions for unpaid users.
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
  v_user_id uuid := auth.uid();
  v_paid boolean := public.is_paid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

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

-- 5. Update submit_answer() — enforces entitlement + 10 distinct attempted free questions per topic
-- for unpaid users, allows unlimited retries on already-attempted free questions, records attempt,
-- and returns answer feedback.
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
  v_topic_id text;
  v_correct text;
  v_explanation text;
  v_option_notes jsonb;
  v_already_attempted boolean;
  v_distinct_attempted_in_topic integer;
  v_is_correct boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required to submit an answer';
  end if;

  if p_selected not in ('A', 'B', 'C', 'D') then
    raise exception 'Selected option must be A, B, C, or D';
  end if;

  -- Fetch question only if active and allowed for this user's entitlement
  select q.topic_id, q.correct, q.explanation, q.option_notes
    into v_topic_id, v_correct, v_explanation, v_option_notes
  from public.questions q
  join public.topics t on t.id = q.topic_id
  where q.id = p_question_id
    and t.active = true
    and q.status = 'active'
    and (v_paid or q.is_free = true);

  if not found then
    raise exception 'Question not found or requires a paid pass';
  end if;

  -- Enforce the 10-question distinct-attempt cap per topic for unpaid users.
  -- Retrying an already-attempted question in that topic is allowed unlimited times.
  if not v_paid then
    select exists (
      select 1
      from public.question_attempts qa
      where qa.user_id = v_user_id
        and qa.question_id = p_question_id
    ) into v_already_attempted;

    if not v_already_attempted then
      select count(distinct qa.question_id)::integer
        into v_distinct_attempted_in_topic
      from public.question_attempts qa
      join public.questions q2 on q2.id = qa.question_id
      where qa.user_id = v_user_id
        and q2.topic_id = v_topic_id;

      if v_distinct_attempted_in_topic >= 10 then
        raise exception 'QUOTA_REACHED: Free limit of 10 distinct questions reached for this topic';
      end if;
    end if;
  end if;

  v_is_correct := (p_selected = v_correct);

  insert into public.profiles (id)
  values (v_user_id)
  on conflict (id) do nothing;

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

revoke all on function public.get_topics() from public;
grant execute on function public.get_topics() to authenticated;

revoke all on function public.get_question_list(text, text) from public;
grant execute on function public.get_question_list(text, text) to authenticated;

revoke all on function public.get_question(text) from public;
grant execute on function public.get_question(text) to authenticated;

revoke all on function public.submit_answer(text, text) from public;
grant execute on function public.submit_answer(text, text) to authenticated;