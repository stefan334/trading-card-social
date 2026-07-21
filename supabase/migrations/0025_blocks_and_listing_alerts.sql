-- CardLink — user blocking + wishlist listing alerts.
--
-- 1. blocks: user-level blocking (Play UGC policy expects block + report for
--    apps with DMs). Both parties can SEE a block row (so each side's client
--    can hide the other's content) but only the blocker creates/removes it.
-- 2. notify_wishlist_listed: when a card is listed for trade, alert everyone
--    who has it wishlisted — the higher-intent moment than a collection add
--    (0005's notify_wishlist_match, which stays follower-scoped).

-- ---------------------------------------------------------------- blocks ----
create table if not exists blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table blocks enable row level security;

create policy blocks_select on blocks
  for select using (auth.uid() in (blocker_id, blocked_id));
create policy blocks_insert on blocks
  for insert with check (auth.uid() = blocker_id);
create policy blocks_delete on blocks
  for delete using (auth.uid() = blocker_id);

-- ------------------------------------------------- wishlist listing alert ----
create or replace function notify_wishlist_listed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only on the false -> true transition (re-listing spam guard below).
  if not (new.is_for_trade and not coalesce(old.is_for_trade, false)) then
    return new;
  end if;

  insert into notifications (user_id, type, payload)
  select w.user_id,
         'wishlist_listed',
         jsonb_build_object('card_id', new.card_id, 'owner_id', new.owner_id)
  from wishlists w
  where w.card_id = new.card_id
    and w.user_id <> new.owner_id
    -- no alerts across a block, in either direction
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = w.user_id and b.blocked_id = new.owner_id)
         or (b.blocker_id = new.owner_id and b.blocked_id = w.user_id)
    )
    -- don't re-alert the same person about the same card/owner within a week
    and not exists (
      select 1 from notifications n
      where n.user_id = w.user_id
        and n.type = 'wishlist_listed'
        and n.payload->>'card_id' = new.card_id
        and n.payload->>'owner_id' = new.owner_id::text
        and n.created_at > now() - interval '7 days'
    );

  return new;
end;
$$;

drop trigger if exists user_cards_wishlist_listed on user_cards;
create trigger user_cards_wishlist_listed
  after update on user_cards
  for each row execute function notify_wishlist_listed();

-- Push copy for the new type.
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
  else
    t := 'CardLink';
    b := 'You have a new notification';
  end if;
  perform send_expo_push(new.user_id, t, b, jsonb_build_object('type', new.type));
  return new;
end;
$$;
