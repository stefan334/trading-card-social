// DB-first catalog reads. Once the sync job (scripts/sync-catalog.mjs) has
// populated the public-read catalog tables, browse / search / prices come
// straight from our Postgres — instant, no live-API round-trip. Every function
// returns null (or leaves ids "unknown") when the catalog isn't populated yet,
// so callers transparently fall back to the live provider API.

import type { Card, CardMarketPrice, CardSet } from '../types/card';
import { isSupabaseConfigured, supabase } from './supabase/client';

const CARD_COLS =
  'id, game_id, set_id, name, number, rarity, image_url_small, image_url_large, price_market, price_low, price_currency, price_source, price_updated_at';
const PRICE_COLS = 'id, price_market, price_low, price_currency, price_source, price_updated_at';

function rowToPrice(r: any): CardMarketPrice | undefined {
  if (r.price_market == null && r.price_low == null) return undefined;
  return {
    source: (r.price_source as 'cardmarket' | 'tcgplayer') ?? 'cardmarket',
    currency: r.price_currency ?? 'EUR',
    average: r.price_market != null ? Number(r.price_market) : undefined,
    low: r.price_low != null ? Number(r.price_low) : undefined,
    updatedAt: r.price_updated_at ?? undefined,
  };
}

function rowToCard(r: any): Card {
  return {
    id: r.id,
    gameId: r.game_id,
    setId: r.set_id,
    name: r.name,
    number: r.number,
    rarity: r.rarity ?? undefined,
    imageUrlSmall: r.image_url_small ?? undefined,
    imageUrlLarge: r.image_url_large ?? undefined,
    market: rowToPrice(r),
  };
}

// Card "numbers" are text ("2", "10", "SV001") — sort by the leading integer so
// they read in set order rather than lexically (10 after 2).
function naturalNumber(n: string): number {
  const m = n?.match(/\d+/);
  return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
}

/** All sets for a game, newest first. null = catalog not populated (fall back). */
export async function dbGetSets(gameId: string): Promise<CardSet[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('card_sets')
    .select('id, game_id, name, series, release_date, total_cards, image_url')
    .eq('game_id', gameId)
    .order('release_date', { ascending: false, nullsFirst: false });
  if (error || !data || data.length === 0) return null;
  return data.map((r: any) => ({
    id: r.id,
    gameId: r.game_id,
    name: r.name,
    series: r.series ?? undefined,
    releaseDate: r.release_date ?? undefined,
    totalCards: r.total_cards ?? 0,
    imageUrl: r.image_url ?? undefined,
  }));
}

/** A single set from the catalog. null = not synced (fall back to the API). */
export async function dbGetSet(setId: string): Promise<CardSet | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('card_sets')
    .select('id, game_id, name, series, release_date, total_cards, image_url')
    .eq('id', setId)
    .maybeSingle();
  if (error || !data) return null;
  const r: any = data;
  return {
    id: r.id,
    gameId: r.game_id,
    name: r.name,
    series: r.series ?? undefined,
    releaseDate: r.release_date ?? undefined,
    totalCards: r.total_cards ?? 0,
    imageUrl: r.image_url ?? undefined,
  };
}

/** Fuzzy name search (trigram index). null = no DB rows (fall back to API). */
export async function dbSearchCards(gameId: string, name: string, limit = 30): Promise<Card[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('cards')
    .select(CARD_COLS)
    .eq('game_id', gameId)
    .ilike('name', `%${name}%`)
    .limit(limit);
  if (error || !data || data.length === 0) return null;
  return data.map(rowToCard);
}

/** Every card in a set, in set order. null = not populated (fall back). */
export async function dbGetSetCards(setId: string): Promise<Card[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.from('cards').select(CARD_COLS).eq('set_id', setId).limit(1000);
  if (error || !data || data.length === 0) return null;
  return data.map(rowToCard).sort((a, b) => naturalNumber(a.number) - naturalNumber(b.number));
}

/**
 * Prices for a set of card ids from the DB. Returns which ids are `known` (have a
 * synced row) so the caller only falls back to the live API for ids we haven't
 * synced — cards that are synced but genuinely priceless don't waste a request.
 */
export async function dbGetPrices(
  ids: string[]
): Promise<{ prices: Map<string, CardMarketPrice>; known: Set<string> } | null> {
  if (!isSupabaseConfigured || !supabase || ids.length === 0) return null;
  const prices = new Map<string, CardMarketPrice>();
  const known = new Set<string>();
  // Chunk to keep the `in(...)` URL a sane length for big collections.
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data, error } = await supabase.from('cards').select(PRICE_COLS).in('id', chunk);
    if (error) return null;
    for (const r of (data ?? []) as any[]) {
      known.add(r.id);
      const p = rowToPrice(r);
      if (p?.average != null) prices.set(r.id, p);
    }
  }
  return { prices, known };
}
