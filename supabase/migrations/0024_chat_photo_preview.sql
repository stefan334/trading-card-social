-- CardLink — inbox preview for photo messages.
-- An image-only chat message has an empty body, so the inbox's "last message"
-- line rendered blank. Substitute the same placeholder the push notification
-- uses ('📷 Photo') when the newest message is a photo without text.

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
    case
      when coalesce(lm.body, '') <> '' then lm.body
      when lm.image_url is not null then '📷 Photo'
      else lm.body
    end,
    lm.created_at,
    (
      select count(*) from chat_messages m
      where m.thread_id = t.id
        and m.sender_id <> auth.uid()
        and m.created_at > coalesce(tr.last_read_at, '-infinity'::timestamptz)
    )::int
  from chat_threads t
  left join lateral (
    select body, image_url, created_at from chat_messages m2
    where m2.thread_id = t.id
    order by created_at desc
    limit 1
  ) lm on true
  left join thread_reads tr on tr.thread_id = t.id and tr.user_id = auth.uid()
  where auth.uid() in (t.participant_one, t.participant_two)
  order by coalesce(lm.created_at, t.created_at) desc;
$$;
