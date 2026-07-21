import { useQuery } from '@tanstack/react-query';
import { dbGetPrices } from '../services/catalog';
import { getProvider } from '../services/tcg-providers';
import type { CardMarketPrice } from '../types/card';

/**
 * Prices for a set of card ids (used to enrich DB-sourced cards — collection,
 * wishlist — which don't store prices on their own rows). DB-first: reads the
 * synced catalog prices in one query, then only hits the live provider API for
 * ids the catalog hasn't synced yet. Returns a Map of cardId -> market price.
 */
export function useCardPrices(cardIds: string[]) {
  const ids = [...new Set(cardIds)].sort();

  return useQuery({
    queryKey: ['card-prices', ids],
    enabled: ids.length > 0,
    staleTime: 1000 * 60 * 30, // prices don't move minute-to-minute
    queryFn: async (): Promise<Map<string, CardMarketPrice>> => {
      const db = await dbGetPrices(ids);
      const prices = db?.prices ?? new Map<string, CardMarketPrice>();

      // Fall back to the live API for any id the catalog couldn't price — both
      // unsynced cards AND synced-but-priceless ones (brand-new sets often gain
      // upstream prices between our daily sweeps).
      const missing = ids.filter((id) => !prices.has(id));
      if (missing.length) {
        const byGame = new Map<string, string[]>();
        for (const id of missing) {
          const game = id.split(':')[0];
          if (!byGame.has(game)) byGame.set(game, []);
          byGame.get(game)!.push(id);
        }
        for (const [game, gameIds] of byGame) {
          const cards = await getProvider(game).getCardsByIds(gameIds);
          for (const c of cards) if (c.market) prices.set(c.id, c.market);
        }
      }
      return prices;
    },
  });
}
