-- CardLink — binders
-- Curated, ordered card showcases on a user's profile (think Instagram highlights
-- but for cards). A binder holds any cards (not just owned) in a chosen order.

create table binders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  cover_card_id text references cards(id),
  position int not null default 0, -- order of binders on the profile
  created_at timestamptz not null default now()
);
create index binders_owner_idx on binders(owner_id, position);

create table binder_cards (
  id uuid primary key default gen_random_uuid(),
  binder_id uuid not null references binders(id) on delete cascade,
  card_id text not null references cards(id),
  position int not null default 0, -- order within the binder
  note text,
  created_at timestamptz not null default now(),
  unique (binder_id, card_id)
);
create index binder_cards_binder_idx on binder_cards(binder_id, position);

alter table binders enable row level security;
alter table binder_cards enable row level security;

-- Binders are public showcases: readable by all, writable by their owner.
create policy "binders readable by all" on binders for select using (true);
create policy "binders writable by owner" on binders
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "binder_cards readable by all" on binder_cards for select using (true);
create policy "binder_cards writable by binder owner" on binder_cards
  for all using (
    exists (select 1 from binders b where b.id = binder_cards.binder_id and b.owner_id = auth.uid())
  ) with check (
    exists (select 1 from binders b where b.id = binder_cards.binder_id and b.owner_id = auth.uid())
  );
