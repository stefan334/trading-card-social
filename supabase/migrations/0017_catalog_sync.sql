-- CardLink — Catalog Sync
-- Serve browse / search / prices from our own DB instead of the live provider API.
-- A scheduled job (GitHub Actions cron, scripts/sync-catalog.mjs) sweeps the
-- provider and upserts the full catalog + prices over a direct service connection
-- (bypasses RLS). The app reads these public-read tables directly; the live API
-- stays a per-card fallback for anything not yet synced.

-- Denormalize market price onto `cards` so a single query (collection grids,
-- search results) returns the price with the card — no extra API round-trip.
-- Refreshed daily from the provider payload (Cardmarket EUR, else TCGplayer USD).
alter table cards
  add column if not exists price_market numeric(12,2),
  add column if not exists price_low numeric(12,2),
  add column if not exists price_currency text,
  add column if not exists price_source text,          -- 'cardmarket' | 'tcgplayer'
  add column if not exists price_updated_at timestamptz, -- provider's own timestamp
  add column if not exists prices_synced_at timestamptz;  -- when our sync last wrote it

-- Fast fuzzy name search (ILIKE '%q%') for DB-served card search.
create extension if not exists pg_trgm;
create index if not exists cards_name_trgm_idx on cards using gin (name gin_trgm_ops);

-- "Browse sets, newest first" straight from the DB.
create index if not exists card_sets_release_date_idx on card_sets (release_date desc nulls last);

-- Observability: one row per sync run so the app (and we) can see catalog freshness.
create table if not exists catalog_sync_runs (
  id bigint generated always as identity primary key,
  game_id text not null,
  kind text not null,                 -- 'sets' | 'cards'
  sets_upserted int,
  cards_upserted int,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  error text
);
alter table catalog_sync_runs enable row level security;
create policy "sync runs readable by all" on catalog_sync_runs for select using (true);
-- Writes come only from the sync job's service connection (bypasses RLS); no
-- insert/update policy is granted to anon/authenticated on purpose.
