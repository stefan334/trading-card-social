-- CardLink — push notifications, sent straight from Postgres.
-- The app registers its Expo push token into push_tokens; DB triggers fire an
-- async HTTP call (pg_net) to Expo's Push API whenever a notification row is
-- created or a chat message arrives. No app server needed; delivery to Android
-- devices additionally requires FCM credentials uploaded to EAS (one-time).

create extension if not exists pg_net;

create table if not exists push_tokens (
  token text primary key,            -- ExponentPushToken[...]
  user_id uuid not null references profiles(id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on push_tokens(user_id);
alter table push_tokens enable row level security;
create policy "push tokens owner" on push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Fire-and-forget send to every device the user has registered. Push must never
-- break the transaction that triggered it, hence the blanket exception handler.
create or replace function send_expo_push(p_user uuid, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  msgs jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'to', token, 'title', p_title, 'body', p_body, 'sound', 'default', 'data', p_data
  )) into msgs
  from push_tokens where user_id = p_user;
  if msgs is null then return; end if;

  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
    body := msgs
  );
exception when others then
  null;
end;
$$;

-- In-app notifications (follows, wishlist matches, trade updates) → push.
create or replace function push_on_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t text;
  b text;
  actor text;
begin
  if new.type = 'new_follower' then
    select username into actor from profiles where id = (new.payload->>'follower_id')::uuid;
    t := 'New follower';
    b := coalesce('@' || actor, 'Someone') || ' started following you';
  elsif new.type = 'wishlist_match' then
    select username into actor from profiles where id = (new.payload->>'owner_id')::uuid;
    t := 'Wishlist match';
    b := coalesce('@' || actor, 'Someone') || ' has a card from your wishlist';
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

drop trigger if exists notifications_push on notifications;
create trigger notifications_push
  after insert on notifications
  for each row execute function push_on_notification();

-- New chat message → push the other participant (sender name + preview).
create or replace function push_on_chat_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  other uuid;
  sender text;
begin
  select case when participant_one = new.sender_id then participant_two else participant_one end
    into other
  from chat_threads where id = new.thread_id;
  if other is null then return new; end if;

  select coalesce(display_name, username) into sender from profiles where id = new.sender_id;
  perform send_expo_push(
    other,
    coalesce(sender, 'New message'),
    case when new.body is not null and length(new.body) > 0 then left(new.body, 120) else '📷 Photo' end,
    jsonb_build_object('type', 'chat_message', 'thread_id', new.thread_id)
  );
  return new;
end;
$$;

drop trigger if exists chat_messages_push on chat_messages;
create trigger chat_messages_push
  after insert on chat_messages
  for each row execute function push_on_chat_message();
