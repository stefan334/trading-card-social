import type { Card, CardMarketPrice, CardSet, TcgProvider } from '../../types/card';

/**
 * Provider for the Pokemon TCG API (https://pokemontcg.io).
 * Free, no key required at low volume; set EXPO_PUBLIC_POKEMON_TCG_API_KEY for higher rate limits.
 * Response shapes confirmed against the live API on 2026-07-01 — see README §5 for the provider contract.
 */

const BASE_URL = 'https://api.pokemontcg.io/v2';
const GAME_ID = 'pokemon';

interface PokemonApiSet {
  id: string;
  name: string;
  series: string;
  releaseDate: string;
  total: number;
  images: { symbol: string; logo: string };
}

interface PokemonApiCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  set: PokemonApiSet;
  images: { small: string; large: string };
  cardmarket?: { url?: string; updatedAt?: string; prices?: Record<string, number> };
  tcgplayer?: { url?: string; updatedAt?: string; prices?: Record<string, Record<string, number>> };
}

function namespacedId(id: string): string {
  return `${GAME_ID}:${id}`;
}

function mapSet(raw: PokemonApiSet): CardSet {
  return {
    id: namespacedId(raw.id),
    gameId: GAME_ID,
    name: raw.name,
    series: raw.series,
    releaseDate: raw.releaseDate,
    totalCards: raw.total,
    imageUrl: raw.images?.logo,
  };
}

// Prefer Cardmarket (EUR averageSellPrice); fall back to a TCGplayer variant's market (USD).
function mapMarket(raw: PokemonApiCard): CardMarketPrice | undefined {
  const cm = raw.cardmarket?.prices;
  if (cm && (cm.averageSellPrice != null || cm.trendPrice != null)) {
    return {
      source: 'cardmarket',
      currency: 'EUR',
      average: cm.averageSellPrice,
      trend: cm.trendPrice,
      low: cm.lowPrice,
      url: raw.cardmarket?.url,
      updatedAt: raw.cardmarket?.updatedAt,
    };
  }
  const variants = raw.tcgplayer?.prices;
  const first = variants ? Object.values(variants)[0] : undefined;
  if (first) {
    return {
      source: 'tcgplayer',
      currency: 'USD',
      average: first.market ?? first.mid,
      low: first.low,
      url: raw.tcgplayer?.url,
      updatedAt: raw.tcgplayer?.updatedAt,
    };
  }
  return undefined;
}

function mapCard(raw: PokemonApiCard): Card {
  return {
    id: namespacedId(raw.id),
    gameId: GAME_ID,
    setId: namespacedId(raw.set.id),
    name: raw.name,
    number: raw.number,
    rarity: raw.rarity,
    imageUrlSmall: raw.images?.small,
    imageUrlLarge: raw.images?.large,
    market: mapMarket(raw),
    raw,
  };
}

/** Strip the "pokemon:" namespace prefix to get the raw provider id. */
function stripNamespace(id: string): string {
  return id.startsWith(`${GAME_ID}:`) ? id.slice(GAME_ID.length + 1) : id;
}

async function apiFetch<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const apiKey = process.env.EXPO_PUBLIC_POKEMON_TCG_API_KEY;
  const res = await fetch(url.toString(), {
    headers: apiKey ? { 'X-Api-Key': apiKey } : undefined,
  });

  if (!res.ok) {
    throw new Error(`Pokemon TCG API error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export const pokemonProvider: TcgProvider = {
  gameId: GAME_ID,
  displayName: 'Pokémon',

  async searchSets(query) {
    const data = await apiFetch<{ data: PokemonApiSet[] }>('/sets', {
      q: query ? `name:"*${query}*"` : undefined,
      orderBy: '-releaseDate',
      // Only fetch fields we render — shrinks the payload and speeds the response.
      select: 'id,name,series,releaseDate,total,images',
    });
    return data.data.map(mapSet);
  },

  async getSet(setId) {
    const data = await apiFetch<{ data: PokemonApiSet }>(`/sets/${stripNamespace(setId)}`, {});
    return mapSet(data.data);
  },

  async searchCards({ setId, name, page = 1, pageSize = 25 }) {
    const filters: string[] = [];
    if (setId) filters.push(`set.id:${stripNamespace(setId)}`);
    if (name) filters.push(`name:"*${name}*"`);

    const data = await apiFetch<{ data: PokemonApiCard[]; page: number; totalCount: number }>('/cards', {
      q: filters.length ? filters.join(' ') : undefined,
      page,
      pageSize,
      orderBy: 'number',
      // Fetch prices for list views too (so cards show a price while browsing),
      // but still skip the big fields (attacks, rules, flavor text) for speed.
      select: 'id,name,number,rarity,images,set,cardmarket,tcgplayer',
    });

    return {
      cards: data.data.map(mapCard),
      page: data.page,
      totalCount: data.totalCount,
    };
  },

  async getCard(cardId) {
    const data = await apiFetch<{ data: PokemonApiCard }>(`/cards/${stripNamespace(cardId)}`, {});
    return mapCard(data.data);
  },

  async getCardsByIds(cardIds) {
    const ids = cardIds.map(stripNamespace);
    const out: Card[] = [];
    // Batch into OR-queries to keep the URL short.
    for (let i = 0; i < ids.length; i += 20) {
      const chunk = ids.slice(i, i + 20);
      const data = await apiFetch<{ data: PokemonApiCard[] }>('/cards', {
        q: chunk.map((id) => `id:${id}`).join(' OR '),
        pageSize: chunk.length,
        select: 'id,name,number,images,set,cardmarket,tcgplayer',
      });
      out.push(...data.data.map(mapCard));
    }
    return out;
  },
};
