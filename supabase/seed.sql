-- Local dev seed data. Run automatically by `supabase db reset`.
-- Card catalog rows (card_sets, cards) are populated by the sync job
-- (README §5 / CHECKLIST Phase 1), not seeded here — this just registers
-- the games we support so foreign keys (e.g. profiles.favorite_game_id) work.

insert into tcg_games (id, name) values
  ('pokemon', 'Pokémon')
on conflict (id) do nothing;
