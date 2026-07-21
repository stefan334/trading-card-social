-- CardLink — track WHEN a copy was listed for trade.
-- The listing detail screen shows "Listed 3 days ago"; user_cards only had
-- acquired_at. listed_at is stamped on the false->true transition, cleared on
-- unlist, and backfilled with acquired_at for existing listings (best guess).

alter table user_cards add column if not exists listed_at timestamptz;

update user_cards set listed_at = acquired_at where is_for_trade and listed_at is null;

create or replace function set_listed_at()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.is_for_trade then new.listed_at := coalesce(new.listed_at, now()); end if;
  else
    if new.is_for_trade and not coalesce(old.is_for_trade, false) then
      new.listed_at := now();
    elsif not new.is_for_trade then
      new.listed_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists user_cards_set_listed_at on user_cards;
create trigger user_cards_set_listed_at
  before insert or update on user_cards
  for each row execute function set_listed_at();
