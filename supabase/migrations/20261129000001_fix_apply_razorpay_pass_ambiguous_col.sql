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

  select p.id, p.starts_at, p.expires_at
    into v_existing_pass
  from public.passes p
  where p.razorpay_payment_id = p_razorpay_payment_id;

  if found then
    return query
    select
      v_existing_pass.id,
      true,
      v_existing_pass.starts_at,
      v_existing_pass.expires_at;
    return;
  end if;

  select pl.duration_days
    into v_duration_days
  from public.plans pl
  where pl.id = p_plan_id
    and pl.active = true;

  if not found then
    raise exception 'Unknown or inactive plan_id: %', p_plan_id;
  end if;

  insert into public.profiles (id)
  values (p_user_id)
  on conflict (id) do nothing;

  select max(p.expires_at)
    into v_base_time
  from public.passes p
  where p.user_id = p_user_id
    and p.status = 'active'
    and p.expires_at > now();

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