/**
 * Game-agnostic card types shared across all TCG providers and the UI.
 * Provider-specific fields go in `raw` (typed as unknown) — never leak
 * provider shapes into shared components.
 */

export interface CardSet {
  id: string; // provider-namespaced, e.g. "pokemon:swsh10"
  gameId: string; // 'pokemon' | 'mtg' | 'yugioh'
  name: string;
  series?: string;
  releaseDate?: string; // ISO date
  totalCards: number;
  imageUrl?: string; // set symbol/logo
}

/** Normalized market pricing, so the UI stays provider-agnostic. */
export interface CardMarketPrice {
  source: 'cardmarket' | 'tcgplayer';
  currency: string; // 'EUR' for Cardmarket, 'USD' for TCGplayer
  average?: number; // Cardmarket averageSellPrice / TCGplayer market
  trend?: number;
  low?: number;
  url?: string;
  updatedAt?: string;
}

export interface Card {
  id: string; // provider-namespaced, e.g. "pokemon:swsh10-1"
  gameId: string;
  setId: string;
  name: string;
  number: string; // e.g. "1", "SV001"
  rarity?: string;
  imageUrlSmall?: string;
  imageUrlLarge?: string;
  market?: CardMarketPrice;
  raw?: unknown; // original provider payload, for fields we haven't modeled yet
}

export interface TcgProvider {
  gameId: string;
  displayName: string;
  searchSets(query?: string): Promise<CardSet[]>;
  getSet(setId: string): Promise<CardSet>;
  searchCards(params: { setId?: string; name?: string; page?: number; pageSize?: number }): Promise<{
    cards: Card[];
    page: number;
    totalCount: number;
  }>;
  getCard(cardId: string): Promise<Card>;
  /** Batch lookup (used to enrich DB-sourced cards with live prices). */
  getCardsByIds(cardIds: string[]): Promise<Card[]>;
}
