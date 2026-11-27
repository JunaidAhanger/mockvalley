-- 1. Find the pass by Razorpay payment ID or user_id
select id, user_id, plan_id, starts_at, expires_at, status, razorpay_payment_id
from public.passes
where razorpay_payment_id = 'pay_XXXXXXXXXXXXXX'; -- or filter by user_id

-- 2. Mark the pass as revoked (expired/cancelled so is_paid() immediately returns false)
update public.passes
set status = 'refunded',
    expires_at = least(expires_at, now())
where razorpay_payment_id = 'pay_XXXXXXXXXXXXXX';