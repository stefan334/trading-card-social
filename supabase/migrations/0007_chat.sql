-- CardLink — chat: read tracking, thread helpers, realtime
-- chat_threads / chat_messages already exist (0001). This adds unread tracking,
-- a null-safe find-or-create for 1:1 threads, a list RPC, and realtime.

-- Per-user last-read marker per thread (for unread counts).
create table thread_reads (
  thread_id uuid not null references chat_threads(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);
alter table thread_reads enable row level security;
create policy "thread_reads own" on thread_reads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Find (or create) the 1:1 thread between the caller and p_other, optionally
-- scoped to a card or trade. NULL card/trade = the general DM thread. Uses
-- IS NOT DISTINCT FROM so NULL scopes match (a plain unique index wouldn't,
-- since NULLs compare distinct).
create or replace function get_or_create_thread(
  p_other uuid,
  p_card_id text default null,
  p_trade_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_p1 uuid;
  v_p2 uuid;
  v_id uuid;
begin
  if v_me is null then raise exception 'Not authenticated'; end if;
  if v_me = p_other then raise exception 'Cannot start a chat with yourself'; end if;

  if v_me < p_other then v_p1 := v_me; v_p2 := p_other;
  else v_p1 := p_other; v_p2 := v_me; end if;

  select id into v_id from chat_threads
   where participant_one = v_p1 and participant_two = v_p2
     and card_id is not distinct from p_card_id
     and trade_id is not distinct from p_trade_id;
  if v_id is not null then return v_id; end if;

  insert into chat_threads (participant_one, participant_two, card_id, trade_id)
    values (v_p1, v_p2, p_card_id, p_trade_id)
    returning id into v_id;
  return v_id;
end;
$$;
grant execute on function get_or_create_thread(uuid, text, uuid) to authenticated;

-- The caller's threads with last message + unread count, newest activity first.
create or replace function my_chat_threads()
returns table (
  thread_id uuid,
  other_id uuid,
  card_id text,
  trade_id uuid,
  last_body text,
  last_at timestamptz,
  unread int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    case when t.participant_one = auth.uid() then t.participant_two else t.participant_one end,
    t.card_id,
    t.trade_id,
    lm.body,
    lm.created_at,
    (
      select count(*) from chat_messages m
      where m.thread_id = t.id
        and m.sender_id <> auth.uid()
        and m.created_at > coalesce(tr.last_read_at, '-infinity'::timestamptz)
    )::int
  from chat_threads t
  left join lateral (
    select body, created_at from chat_messages m2
    where m2.thread_id = t.id
    order by created_at desc
    limit 1
  ) lm on true
  left join thread_reads tr on tr.thread_id = t.id and tr.user_id = auth.uid()
  where auth.uid() in (t.participant_one, t.participant_two)
  order by coalesce(lm.created_at, t.created_at) desc;
$$;
grant execute on function my_chat_threads() to authenticated;

-- Enable realtime on chat messages (idempotent guard) so new messages push to
-- open threads. RLS on chat_messages still scopes what each subscriber receives.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table chat_messages;
  end if;
end $$;
