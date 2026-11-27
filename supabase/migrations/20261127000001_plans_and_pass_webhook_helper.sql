-- 1. Plans table: prices (in paise) and durations live in the database so you can update them without code.
create table if not exists public.plans (
  id text primary key,
  name text not null,
  description text not null,
  amount_paise integer not null check (amount_paise > 0),
  duration_days integer not null check (duration_days > 0),
  display_order integer not null default 1,
  active boolean not null default true
);

alter table public.plans enable row level security;

-- Active plans can be read by signed-in users; writes are blocked from browser roles.
revoke insert, update, delete on table public.plans from anon, authenticated;

drop policy if exists "plans_select_active_authenticated" on public.plans;
create policy "plans_select_active_authenticated"
  on public.plans
  for select
  to authenticated
  using (active = true);

-- Seed 1-month and 3-month passes (adjust amount_paise anytime in Supabase Table Editor).
insert into public.plans (id, name, description, amount_paise, duration_days, display_order, active)
values
  (
    'pass_1m',
    '1-Month Pass',
    'Full access to all topics, all difficulties, Current Affairs, and Timed Exam Mode for 30 days.',
    9900,
    30,
    1,
    true
  ),
  (
    'pass_3m',
    '3-Month Pass',
    'Full access to all topics, all difficulties, Current Affairs, and Timed Exam Mode for 90 days.',
    24900,
    90,
    2,
    true
  )
on conflict (id) do nothing;

-- 2. Idempotent server helper called ONLY by the razorpay_webhook Edge Function (service_role).
-- Creates a new pass or extends from the user's current latest active expiry date.
create or replace function public.apply_razorpay_pass(
  p_user_id uuid,
  p_plan_id text,
  p_razorpay_payment_id text
)
returns table (
  pass_id uuid,
  already_processed boolean,
  starts_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duration_days integer;
  v_existing_pass record;
  v_base_time timestamptz;
  v_starts_at timestamptz;
  v_expires_at timestamptz;
  v_new_id uuid;
begin
  if p_razorpay_payment_id is null or length(trim(p_razorpay_payment_id)) = 0 then
    raise exception 'Missing razorpay_payment_id';
  end if;

  -- Idempotency check: if this payment ID was already recorded, do not create a duplicate pass.
  select id, starts_at, expires_at
    into v_existing_pass
  from public.passes
  where razorpay_payment_id = p_razorpay_payment_id;

  if found then
    return query
    select
      v_existing_pass.id,
      true,
      v_existing_pass.starts_at,
      v_existing_pass.expires_at;
    return;
  end if;

  select duration_days
    into v_duration_days
  from public.plans
  where id = p_plan_id
    and active = true;

  if not found then
    raise exception 'Unknown or inactive plan_id: %', p_plan_id;
  end if;

  insert into public.profiles (id)
  values (p_user_id)
  on conflict (id) do nothing;

  -- If the user already has an active pass in the future, extend from its expiry date.
  select max(expires_at)
    into v_base_time
  from public.passes
  where user_id = p_user_id
    and status = 'active'
    and expires_at > now();

  v_starts_at := coalesce(v_base_time, now());
  v_expires_at := v_starts_at + make_interval(days => v_duration_days);

  insert into public.passes (
    user_id,
    plan_id,
    starts_at,
    expires_at,
    status,
    razorpay_payment_id
  )
  values (
    p_user_id,
    p_plan_id,
    v_starts_at,
    v_expires_at,
    'active',
    p_razorpay_payment_id
  )
  returning id into v_new_id;

  return query
  select
    v_new_id,
    false,
    v_starts_at,
    v_expires_at;
end;
$$;

revoke all on function public.apply_razorpay_pass(uuid, text, text) from public;
revoke all on function public.apply_razorpay_pass(uuid, text, text) from anon, authenticated;
grant execute on function public.apply_razorpay_pass(uuid, text, text) to service_role;