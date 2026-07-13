-- CardLink — card finish/variant + wishlist feed activity.

-- The finish/variant of the copy you own (e.g. reverse holo), separate from
-- condition and grade. Free text so it stays game-agnostic.
alter table user_cards add column if not exists finish text;

-- Feed: adding a card to your wishlist now posts a 'card_wishlisted' activity so
-- followers can see what you're chasing (and offer it).
alter table posts drop constraint posts_type_check;
alter table posts add constraint posts_type_check
  check (type in ('text', 'card_showcase', 'card_added', 'card_listed', 'card_wishlisted', 'trade_completed'));

create or replace function post_on_wishlist_added()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into posts (author_id, type, card_id) values (new.user_id, 'card_wishlisted', new.card_id);
  return new;
end;
$$;

drop trigger if exists wishlists_post_added on wishlists;
create trigger wishlists_post_added
  after insert on wishlists
  for each row execute function post_on_wishlist_added();
