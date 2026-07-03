-- CardLink — two-step trade completion + reviews
-- New lifecycle: proposed -> (accept) accepted -> (both confirm) completed.
-- Accepting now just AGREES the deal; card ownership only transfers in-app once
-- BOTH parties confirm the physical swap happened. Then each can review the other.

alter table trades add column initiator_confirmed_at timestamptz;
alter table trades add column counterparty_confirmed_at timestamptz;

-- Accept: agree to the trade (no transfer yet).
create or replace function accept_trade(p_trade_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_trade trades%rowtype;
begin
  select * into v_trade from trades where id = p_trade_id for update;
  if not found then raise exception 'Trade not found'; end if;
  if v_trade.status <> 'proposed' then raise exception 'Trade is no longer open'; end if;
  if auth.uid() <> v_trade.counterparty_id then raise exception 'Only the recipient can accept this trade'; end if;

  update trades set status = 'accepted', updated_at = now() where id = p_trade_id;

  insert into notifications (user_id, type, payload)
  values (v_trade.initiator_id, 'trade_update',
    jsonb_build_object('trade_id', p_trade_id, 'status', 'accepted', 'actor_id', v_trade.counterparty_id));
end;
$$;

-- Confirm the physical swap. When both sides have confirmed, transfer ownership
-- (validating each card is still held) and complete the trade.
create or replace function confirm_trade(p_trade_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_trade trades%rowtype;
  v_item record;
  v_new_owner uuid;
  v_other uuid;
begin
  select * into v_trade from trades where id = p_trade_id for update;
  if not found then raise exception 'Trade not found'; end if;
  if v_trade.status <> 'accepted' then raise exception 'Trade is not awaiting confirmation'; end if;
  if auth.uid() not in (v_trade.initiator_id, v_trade.counterparty_id) then
    raise exception 'Not a participant of this trade';
  end if;

  if auth.uid() = v_trade.initiator_id then
    update trades set initiator_confirmed_at = coalesce(initiator_confirmed_at, now()) where id = p_trade_id;
  else
    update trades set counterparty_confirmed_at = coalesce(counterparty_confirmed_at, now()) where id = p_trade_id;
  end if;

  select * into v_trade from trades where id = p_trade_id; -- reload with the new confirm

  if v_trade.initiator_confirmed_at is not null and v_trade.counterparty_confirmed_at is not null then
    for v_item in
      select ti.user_card_id, ti.from_user_id, uc.owner_id
      from trade_items ti join user_cards uc on uc.id = ti.user_card_id
      where ti.trade_id = p_trade_id
    loop
      if v_item.owner_id <> v_item.from_user_id then
        raise exception 'A card in this trade is no longer available';
      end if;
      v_new_owner := case when v_item.from_user_id = v_trade.initiator_id
                          then v_trade.counterparty_id else v_trade.initiator_id end;
      update user_cards set owner_id = v_new_owner, is_for_trade = false where id = v_item.user_card_id;
    end loop;

    update trades set status = 'completed', updated_at = now() where id = p_trade_id;

    v_other := case when auth.uid() = v_trade.initiator_id then v_trade.counterparty_id else v_trade.initiator_id end;
    insert into notifications (user_id, type, payload)
    values (v_other, 'trade_update',
      jsonb_build_object('trade_id', p_trade_id, 'status', 'completed', 'actor_id', auth.uid()));
  else
    v_other := case when auth.uid() = v_trade.initiator_id then v_trade.counterparty_id else v_trade.initiator_id end;
    insert into notifications (user_id, type, payload)
    values (v_other, 'trade_update',
      jsonb_build_object('trade_id', p_trade_id, 'status', 'confirmed', 'actor_id', auth.uid()));
  end if;
end;
$$;

grant execute on function confirm_trade(uuid) to authenticated;

-- Reviews: one per (trade, reviewer), only for completed trades you were part of.
create table trade_reviews (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references trades(id) on delete cascade,
  reviewer_id uuid not null references profiles(id) on delete cascade,
  reviewee_id uuid not null references profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (trade_id, reviewer_id)
);
create index trade_reviews_reviewee_idx on trade_reviews(reviewee_id);

alter table trade_reviews enable row level security;

-- Public read (reputation is visible on profiles).
create policy "reviews readable by all" on trade_reviews for select using (true);

-- Insert only your own review, only for a completed trade you were in, about the
-- other participant.
create policy "reviews insert by participant" on trade_reviews
  for insert with check (
    reviewer_id = auth.uid()
    and reviewer_id <> reviewee_id
    and exists (
      select 1 from trades t
      where t.id = trade_id
        and t.status = 'completed'
        and auth.uid() in (t.initiator_id, t.counterparty_id)
        and reviewee_id in (t.initiator_id, t.counterparty_id)
    )
  );
