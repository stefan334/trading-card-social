-- CardLink — analytics, moderation (reports + admin), and feedback.

-- ============================================================================
-- Admin flag + ban
-- ============================================================================
alter table profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists is_banned boolean not null default false;

-- SECURITY DEFINER so RLS policies can ask "is the caller an admin?" without
-- triggering recursive RLS on profiles.
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;
grant execute on function is_admin to authenticated;

-- Admin-only ban toggle (targeted, so admins don't get blanket profile writes).
create or replace function admin_set_banned(p_user uuid, p_banned boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'not authorized';
  end if;
  update profiles set is_banned = p_banned where id = p_user;
end;
$$;
grant execute on function admin_set_banned to authenticated;

-- ============================================================================
-- Analytics events — lightweight product analytics logged to our own DB.
-- ============================================================================
create table if not exists analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete set null,
  name text not null,
  props jsonb,
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_name_idx on analytics_events (name, created_at desc);
alter table analytics_events enable row level security;
-- Signed-in users log their own events; only admins can read them back.
create policy "analytics insert own" on analytics_events
  for insert to authenticated with check (user_id is null or user_id = auth.uid());
create policy "analytics readable by admin" on analytics_events
  for select using (is_admin());

-- ============================================================================
-- Reports — moderation queue (report a profile).
-- ============================================================================
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  reported_profile_id uuid references profiles(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open','reviewed','actioned','dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists reports_status_idx on reports (status, created_at desc);
alter table reports enable row level security;
create policy "reports insert by reporter" on reports
  for insert to authenticated with check (reporter_id = auth.uid());
create policy "reports readable by admin or reporter" on reports
  for select using (is_admin() or reporter_id = auth.uid());
create policy "reports updatable by admin" on reports
  for update using (is_admin());

-- ============================================================================
-- Feedback / contact messages.
-- ============================================================================
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  kind text not null default 'feedback' check (kind in ('feedback','bug','idea','other')),
  message text not null,
  created_at timestamptz not null default now()
);
alter table feedback enable row level security;
create policy "feedback insert signed in" on feedback
  for insert to authenticated with check (user_id is null or user_id = auth.uid());
create policy "feedback readable by admin" on feedback
  for select using (is_admin());
