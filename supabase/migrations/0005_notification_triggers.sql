-- CardLink — notification triggers
-- Notifications are created server-side by triggers (SECURITY DEFINER so they can
-- read other users' wishlists and insert into notifications, both of which are
-- otherwise blocked by RLS). No Edge Function needed for in-app notifications.

-- When a user adds a card to their collection, notify every user who (a) follows
-- them and (b) has that card on their wishlist. Only fires on the owner's FIRST
-- copy of the card, so adding duplicates doesn't spam.
create or replace function notify_wishlist_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from user_cards
    where owner_id = new.owner_id and card_id = new.card_id and id <> new.id
  ) then
    return new; -- not the first copy; already notified when it was first added
  end if;

  insert into notifications (user_id, type, payload)
  select w.user_id,
         'wishlist_match',
         jsonb_build_object('card_id', new.card_id, 'owner_id', new.owner_id)
  from wishlists w
  join follows f on f.follower_id = w.user_id and f.followee_id = new.owner_id
  where w.card_id = new.card_id
    and w.user_id <> new.owner_id;

  return new;
end;
$$;

create trigger user_cards_wishlist_match
  after insert on user_cards
  for each row execute function notify_wishlist_match();

-- When someone follows you, notify you.
create or replace function notify_new_follower()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, type, payload)
  values (new.followee_id, 'new_follower', jsonb_build_object('follower_id', new.follower_id));
  return new;
end;
$$;

create trigger follows_new_follower
  after insert on follows
  for each row execute function notify_new_follower();
