-- CardLink — trade_completed feed event
-- When a trade completes (both parties confirmed), post a feed event for each
-- participant so it shows in their followers' feeds.

create or replace function post_on_trade_completed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    insert into posts (author_id, type)
    values (new.initiator_id, 'trade_completed'), (new.counterparty_id, 'trade_completed');
  end if;
  return new;
end;
$$;

create trigger trades_post_completed
  after update on trades
  for each row execute function post_on_trade_completed();
