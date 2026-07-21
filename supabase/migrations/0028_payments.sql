-- CardLink — marketplace payments (Stripe Connect Express, EUR).
--
-- Money model (Vinted-style): buyer pays item price + buyer-protection fee
-- (5% + €0.50, computed server-side in the stripe-checkout edge function).
-- Funds land on the PLATFORM Stripe balance (separate charges & transfers);
-- the seller's share (full item price) is Transferred to their Express account
-- when the buyer confirms receipt, or by auto-release 14 days after shipping.
-- All order writes happen through edge functions (service role) except
-- order_mark_shipped, which is a pure-DB transition the seller performs.
--
-- Also fixes a latent 0025 bug: the wishlist-listed alert inserts notification
-- type 'wishlist_listed', which the 0001 check constraint never allowed — so
-- listing a card that anyone had wishlisted failed the whole update.

-- ------------------------------------------------ notifications type fix ----
alter table notifications drop constraint notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in (
    'wishlist_match', 'trade_update', 'chat_message', 'new_follower',
    'wishlist_listed',  -- used since 0025, never in the constraint (bug fix)
    'order_update'      -- new: marketplace order transitions
  ));

-- --------------------------------------------------------- seller_accounts ----
create table seller_accounts (
  user_id uuid primary key references profiles(id) on delete cascade,
  stripe_account_id text not null unique,
  -- Mirrors of the Stripe account state, refreshed via the stripe-onboard
  -- edge function and account.updated webhooks. charges_enabled is the gate
  -- for "this user's listings are buyable".
  details_submitted boolean not null default false,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table seller_accounts enable row level security;

-- Owner can read own payout status; only edge functions (service role) write.
create policy seller_accounts_select_own on seller_accounts
  for select using (auth.uid() = user_id);

-- Buyers need to know IF a listing's owner can take payments (not the details).
-- SECURITY DEFINER boolean probe keeps the row itself private.
create or replace function seller_can_charge(p_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select charges_enabled from seller_accounts where user_id = p_user),
    false
  );
$$;

grant execute on function seller_can_charge to authenticated;

-- ------------------------------------------------------------------ orders ----
create table orders (
  id uuid primary key default gen_random_uuid(),
  -- The listing may be deleted/sold-off later; the order must survive it.
  listing_id uuid references user_cards(id) on delete set null,
  -- Parties nullable: account deletion (0022) cascades profiles away; orders
  -- are financial records and must outlive them. Active-order handling on
  -- account deletion (refund first) lands in the disputes/cancellation phase.
  buyer_id uuid references profiles(id) on delete set null,
  seller_id uuid references profiles(id) on delete set null,

  -- Catalog snapshot at purchase time (listing row can vanish).
  card_id text not null,
  card_name text not null,
  card_image text,
  set_name text,

  -- EUR, matching sale_price / the Cardmarket reference prices app-wide.
  item_price numeric(10, 2) not null check (item_price > 0),
  buyer_fee numeric(10, 2) not null check (buyer_fee >= 0),
  total numeric(10, 2) not null check (total = item_price + buyer_fee),
  currency text not null default 'eur' check (currency = 'eur'),

  status text not null default 'pending_payment' check (status in (
    'pending_payment',  -- PaymentIntent created, sheet not completed
    'paid',             -- webhook: payment_intent.succeeded; escrow holds funds
    'shipped',          -- seller marked shipped (auto_release_at armed)
    'completed',        -- buyer confirmed / auto-release; Transfer sent
    'cancelled',        -- cancelled before payment or refunded before shipping
    'refunded',         -- refunded after payment (admin/dispute outcome)
    'disputed'          -- buyer flagged a problem; admin adjudicates
  )),

  stripe_payment_intent_id text unique,
  stripe_transfer_id text,

  shipping_address jsonb,      -- {name, line1, line2, city, county, postal_code, phone}
  tracking_ref text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  shipped_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  auto_release_at timestamptz  -- shipped_at + 14 days; pg_cron releases past-due
);

create index orders_buyer_idx on orders (buyer_id, created_at desc);
create index orders_seller_idx on orders (seller_id, created_at desc);
create index orders_release_due_idx on orders (auto_release_at)
  where status = 'shipped';

-- One live purchase per listing at a time.
create unique index orders_one_active_per_listing on orders (listing_id)
  where status in ('pending_payment', 'paid', 'shipped', 'disputed');

alter table orders enable row level security;

create policy orders_select_own on orders
  for select using (auth.uid() in (buyer_id, seller_id));
-- No client insert/update/delete policies: writes go through edge functions
-- (service role) and the order_mark_shipped RPC below.

-- ------------------------------------------------------- seller: mark shipped ----
create or replace function order_mark_shipped(p_order uuid, p_tracking text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o orders;
begin
  select * into o from orders where id = p_order for update;

  if o.id is null then
    raise exception 'order not found';
  end if;
  if o.seller_id is distinct from auth.uid() then
    raise exception 'only the seller can mark shipped';
  end if;
  if o.status <> 'paid' then
    raise exception 'order is not in a shippable state (%)', o.status;
  end if;

  update orders
  set status = 'shipped',
      tracking_ref = nullif(trim(p_tracking), ''),
      shipped_at = now(),
      auto_release_at = now() + interval '14 days',
      updated_at = now()
  where id = p_order;

  insert into notifications (user_id, type, payload)
  values (o.buyer_id, 'order_update', jsonb_build_object(
    'order_id', o.id, 'status', 'shipped', 'role', 'buyer',
    'card_name', o.card_name
  ));
end;
$$;

grant execute on function order_mark_shipped to authenticated;

-- ------------------------------------------------------------- push copy ----
create or replace function push_on_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t text;
  b text;
  actor text;
  card_name text;
begin
  if new.type = 'new_follower' then
    select username into actor from profiles where id = (new.payload->>'follower_id')::uuid;
    t := 'New follower';
    b := coalesce('@' || actor, 'Someone') || ' started following you';
  elsif new.type = 'wishlist_match' then
    select username into actor from profiles where id = (new.payload->>'owner_id')::uuid;
    t := 'Wishlist match';
    b := coalesce('@' || actor, 'Someone') || ' has a card from your wishlist';
  elsif new.type = 'wishlist_listed' then
    select username into actor from profiles where id = (new.payload->>'owner_id')::uuid;
    select name into card_name from cards where id = new.payload->>'card_id';
    t := 'Wishlist alert';
    b := coalesce('@' || actor, 'Someone') || ' listed ' || coalesce(card_name, 'a card') || ' from your wishlist';
  elsif new.type = 'trade_update' then
    t := 'Trade update';
    b := 'One of your trades has news — open CardLink';
  elsif new.type = 'order_update' then
    card_name := coalesce(new.payload->>'card_name', 'your card');
    if new.payload->>'status' = 'paid' then
      t := 'Card sold!';
      b := card_name || ' was purchased — pack it up and mark it shipped';
    elsif new.payload->>'status' = 'shipped' then
      t := 'Order shipped';
      b := card_name || ' is on its way';
    elsif new.payload->>'status' = 'completed' then
      if new.payload->>'role' = 'seller' then
        t := 'Payment released';
        b := 'The payment for ' || card_name || ' is on its way to your account';
      else
        t := 'Order complete';
        b := 'Thanks for confirming — enjoy ' || card_name || '!';
      end if;
    elsif new.payload->>'status' in ('cancelled', 'refunded') then
      t := 'Order ' || (new.payload->>'status');
      b := 'Your order for ' || card_name || ' was ' || (new.payload->>'status');
    elsif new.payload->>'status' = 'disputed' then
      t := 'Order issue reported';
      b := 'A problem was reported on the order for ' || card_name;
    else
      t := 'Order update';
      b := 'Your order for ' || card_name || ' has news';
    end if;
  else
    t := 'CardLink';
    b := 'You have a new notification';
  end if;
  perform send_expo_push(new.user_id, t, b, jsonb_build_object('type', new.type));
  return new;
end;
$$;
