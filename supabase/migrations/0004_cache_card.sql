-- CardLink — lazy catalog caching
-- The cards/card_sets catalog is populated on demand (when a user adds a card to
-- their collection) rather than by a full up-front sync of every card. Catalog
-- RLS stays locked to service-role writes; this SECURITY DEFINER function is the
-- one controlled path an authenticated user can use to insert the specific card
-- (and its set + game) they're adding, so the user_cards FK resolves.

create or replace function cache_card(
  p_card_id text,
  p_game_id text,
  p_game_name text,
  p_set_id text,
  p_set_name text,
  p_set_series text,
  p_set_total int,
  p_set_image text,
  p_name text,
  p_number text,
  p_rarity text,
  p_image_small text,
  p_image_large text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into tcg_games (id, name)
    values (p_game_id, coalesce(p_game_name, initcap(p_game_id)))
    on conflict (id) do nothing;

  insert into card_sets (id, game_id, name, series, total_cards, image_url)
    values (p_set_id, p_game_id, p_set_name, p_set_series, coalesce(p_set_total, 0), p_set_image)
    on conflict (id) do update set
      name = excluded.name,
      series = excluded.series,
      total_cards = excluded.total_cards,
      image_url = excluded.image_url;

  insert into cards (id, game_id, set_id, name, number, rarity, image_url_small, image_url_large)
    values (p_card_id, p_game_id, p_set_id, p_name, p_number, p_rarity, p_image_small, p_image_large)
    on conflict (id) do update set
      name = excluded.name,
      number = excluded.number,
      rarity = excluded.rarity,
      image_url_small = excluded.image_url_small,
      image_url_large = excluded.image_url_large;
end;
$$;

-- Any signed-in user may call it (it only writes trusted catalog data derived
-- from the provider APIs, never another user's rows).
grant execute on function cache_card to authenticated;
