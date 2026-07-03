-- CardLink — activity feed / posts
-- The home tab is a feed of posts from users you follow (+ your own).
-- A "post" is either a manual share (a card showcase or a text update) or an
-- auto-generated activity event (added a card, completed a trade). For now the
-- app only creates manual posts; auto-events (card_added / trade_completed)
-- should be inserted later via DB triggers or Edge Functions when those flows
-- land — the `type` enum already accommodates them.

create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  type text not null default 'text'
    check (type in ('text','card_showcase','card_added','trade_completed')),
  card_id text references cards(id),      -- set for card_showcase / card_added
  body text,                              -- caption / status text
  image_url text,                         -- optional attached image (e.g. a pull photo)
  created_at timestamptz not null default now()
);
create index posts_author_id_created_idx on posts(author_id, created_at desc);
create index posts_created_idx on posts(created_at desc);

alter table posts enable row level security;

-- Public read: the feed is browsable, and the client filters to followed authors
-- (see get_feed below). Author-only insert/delete; posts are immutable once made.
create policy "posts readable by all" on posts for select using (true);
create policy "posts insertable by author" on posts
  for insert with check (auth.uid() = author_id);
create policy "posts deletable by author" on posts
  for delete using (auth.uid() = author_id);

-- Feed for the current user: their own posts + posts by everyone they follow,
-- newest first. Called via supabase.rpc('get_feed', { page_limit, page_offset }).
-- SECURITY INVOKER (default) so RLS on posts still applies to the caller.
create function get_feed(page_limit int default 30, page_offset int default 0)
returns setof posts
language sql
stable
as $$
  select p.*
  from posts p
  where p.author_id = auth.uid()
     or p.author_id in (
       select f.followee_id from follows f where f.follower_id = auth.uid()
     )
  order by p.created_at desc
  limit page_limit offset page_offset;
$$;
