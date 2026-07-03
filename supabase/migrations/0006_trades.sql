-- CardLink — trade lifecycle
-- All trade status changes go through SECURITY DEFINER RPCs so that:
--   (a) card ownership transfer on accept is atomic + validated, and
--   (b) clients can't set status directly (e.g. mark 'completed' without transfer).
-- Proposing a trade is still a plain client insert (trades + trade_items), guarded
-- by the existing RLS insert policies; a trigger notifies the recipient.

-- Close the direct-status-update hole from 0001 (participants could UPDATE any
-- column, including status). Status now moves only via the RPCs below.
drop policy if exists "trades updatable by participants" on trades;

-- Notify the counterparty when a trade is proposed to them.
create or replace function notify_trade_proposed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, type, payload)
  values (
    new.counterparty_id,
    'trade_update',
    jsonb_build_object('trade_id', new.id, 'status', 'proposed', 'actor_id', new.initiator_id)
  );
  return new;
end;
$$;

create trigger trades_notify_proposed
  after insert on trades
  for each row execute function notify_trade_proposed();

-- Accept a proposed trade: transfer every offered card to the other side,
-- validate the offerer still owns each card, mark completed, notify initiator.
create or replace function accept_trade(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trade trades%rowtype;
  v_item record;
  v_new_owner uuid;
begin
  select * into v_trade from trades where id = p_trade_id for update;
  if not found then raise exception 'Trade not found'; end if;
  if v_trade.status <> 'proposed' then raise exception 'Trade is no longer open'; end if;
  if auth.uid() <> v_trade.counterparty_id then raise exception 'Only the recipient can accept this trade'; end if;

  for v_item in
    select ti.user_card_id, ti.from_user_id, uc.owner_id
    from trade_items ti
    join user_cards uc on uc.id = ti.user_card_id
    where ti.trade_id = p_trade_id
  loop
    if v_item.owner_id <> v_item.from_user_id then
      raise exception 'A card in this trade is no longer available';
    end if;

    v_new_owner := case
      when v_item.from_user_id = v_trade.initiator_id then v_trade.counterparty_id
      else v_trade.initiator_id
    end;

    update user_cards
      set owner_id = v_new_owner, is_for_trade = false
      where id = v_item.user_card_id;
  end loop;

  update trades set status = 'completed', updated_at = now() where id = p_trade_id;

  insert into notifications (user_id, type, payload)
  values (
    v_trade.initiator_id,
    'trade_update',
    jsonb_build_object('trade_id', p_trade_id, 'status', 'completed', 'actor_id', v_trade.counterparty_id)
  );
end;
$$;

-- Recipient declines a proposed trade.
create or replace function decline_trade(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trade trades%rowtype;
begin
  select * into v_trade from trades where id = p_trade_id for update;
  if not found then raise exception 'Trade not found'; end if;
  if v_trade.status <> 'proposed' then raise exception 'Trade is no longer open'; end if;
  if auth.uid() <> v_trade.counterparty_id then raise exception 'Only the recipient can decline this trade'; end if;

  update trades set status = 'declined', updated_at = now() where id = p_trade_id;

  insert into notifications (user_id, type, payload)
  values (
    v_trade.initiator_id,
    'trade_update',
    jsonb_build_object('trade_id', p_trade_id, 'status', 'declined', 'actor_id', v_trade.counterparty_id)
  );
end;
$$;

-- Initiator cancels their own proposed trade.
create or replace function cancel_trade(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trade trades%rowtype;
begin
  select * into v_trade from trades where id = p_trade_id for update;
  if not found then raise exception 'Trade not found'; end if;
  if v_trade.status <> 'proposed' then raise exception 'Trade is no longer open'; end if;
  if auth.uid() <> v_trade.initiator_id then raise exception 'Only the sender can cancel this trade'; end if;

  update trades set status = 'cancelled', updated_at = now() where id = p_trade_id;

  insert into notifications (user_id, type, payload)
  values (
    v_trade.counterparty_id,
    'trade_update',
    jsonb_build_object('trade_id', p_trade_id, 'status', 'cancelled', 'actor_id', v_trade.initiator_id)
  );
end;
$$;

grant execute on function accept_trade(uuid) to authenticated;
grant execute on function decline_trade(uuid) to authenticated;
grant execute on function cancel_trade(uuid) to authenticated;
