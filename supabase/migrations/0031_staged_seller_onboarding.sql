-- CardLink — Vinted-style staged seller onboarding.
--
-- Selling requires only the TRANSFERS capability (name/DOB/address — money can
-- land in the seller's Stripe balance). Bank details + remaining KYC are only
-- needed to WITHDRAW (payouts_enabled), which sellers complete once money is
-- waiting. The buyability gate therefore moves from charges_enabled (full
-- onboarding) to transfers_active.

alter table seller_accounts add column transfers_active boolean not null default false;

create or replace function seller_can_charge(p_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select transfers_active or charges_enabled from seller_accounts where user_id = p_user),
    false
  );
$$;
