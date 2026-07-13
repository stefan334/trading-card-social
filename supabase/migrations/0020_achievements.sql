-- CardLink — achievements: a public trades-completed counter on profiles so
-- badges can be shown on anyone's profile (trades themselves are only readable
-- by participants, so we can't count them client-side for other users).

alter table profiles add column if not exists trades_completed int not null default 0;

create or replace function bump_trades_completed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    update profiles set trades_completed = trades_completed + 1
      where id in (new.initiator_id, new.counterparty_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trades_bump_completed on trades;
create trigger trades_bump_completed
  after update on trades
  for each row execute function bump_trades_completed();

-- Backfill counts for any already-completed trades.
update profiles p set trades_completed = coalesce(sub.cnt, 0)
from (
  select uid, count(*)::int cnt from (
    select initiator_id as uid from trades where status = 'completed'
    union all
    select counterparty_id from trades where status = 'completed'
  ) t group by uid
) sub
where p.id = sub.uid;
