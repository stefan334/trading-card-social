-- CardLink — keep the feed's "listed for trade" price in sync.
-- Users usually list a card first and set the asking price a moment later, so the
-- card_listed post was created with a null price and never updated. Extend the
-- trigger so that changing the asking price on an already-listed card updates the
-- most recent card_listed post's body (which the feed renders as the price).

create or replace function post_on_card_listed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_for_trade and not coalesce(old.is_for_trade, false) then
    -- Newly listed for trade → create the feed post (with price if already set).
    insert into posts (author_id, type, card_id, body)
    values (new.owner_id, 'card_listed', new.card_id,
            case when new.sale_price is not null then new.sale_price::text else null end);
  elsif new.is_for_trade and coalesce(old.is_for_trade, false)
        and new.sale_price is distinct from old.sale_price then
    -- Price changed on an already-listed card → refresh the latest listing post.
    update posts
      set body = case when new.sale_price is not null then new.sale_price::text else null end
      where id = (
        select id from posts
        where author_id = new.owner_id and card_id = new.card_id and type = 'card_listed'
        order by created_at desc
        limit 1
      );
  end if;
  return new;
end;
$$;
