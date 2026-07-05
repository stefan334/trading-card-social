-- CardLink — automatic feed activity
-- The home feed is activity-driven (no manual posting). Posts are created by
-- triggers when a user adds a card to their collection or lists one for trade.

-- Allow the new 'card_listed' post type.
alter table posts drop constraint posts_type_check;
alter table posts add constraint posts_type_check
  check (type in ('text', 'card_showcase', 'card_added', 'card_listed', 'trade_completed'));

-- Adding a card to a collection -> a 'card_added' post. (The feed groups a burst
-- of these by the same user into "added N cards".)
create or replace function post_on_card_added()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into posts (author_id, type, card_id) values (new.owner_id, 'card_added', new.card_id);
  return new;
end;
$$;
create trigger user_cards_post_added
  after insert on user_cards
  for each row execute function post_on_card_added();

-- Listing a card for trade (is_for_trade false -> true) -> a 'card_listed' post,
-- carrying the asking price (if set) in `body`.
create or replace function post_on_card_listed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_for_trade and not coalesce(old.is_for_trade, false) then
    insert into posts (author_id, type, card_id, body)
    values (new.owner_id, 'card_listed', new.card_id,
            case when new.sale_price is not null then new.sale_price::text else null end);
  end if;
  return new;
end;
$$;
create trigger user_cards_post_listed
  after update on user_cards
  for each row execute function post_on_card_listed();
