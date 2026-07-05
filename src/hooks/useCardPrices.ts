import { useQuery } from '@tanstack/react-query';
import { getProvider } from '../services/tcg-providers';
import type { CardMarketPrice } from '../types/card';

/**
 * Live prices for a set of card ids (used to enrich DB-sourced cards — collection,
 * wishlist — which don't store prices). Batched per game via getCardsByIds and
 * cached; returns a Map of cardId -> market price.
 */
export function useCardPrices(cardIds: string[]) {
  const ids = [...new Set(cardIds)].sort();

  return useQuery({
    queryKey: ['card-prices', ids],
    enabled: ids.length > 0,
    staleTime: 1000 * 60 * 30, // prices don't move minute-to-minute
    queryFn: async (): Promise<Map<string, CardMarketPrice>> => {
      const byGame = new Map<string, string[]>();
      for (const id of ids) {
        const game = id.split(':')[0];
        if (!byGame.has(game)) byGame.set(game, []);
        byGame.get(game)!.push(id);
      }

      const prices = new Map<string, CardMarketPrice>();
      for (const [game, gameIds] of byGame) {
        const cards = await getProvider(game).getCardsByIds(gameIds);
        for (const c of cards) if (c.market) prices.set(c.id, c.market);
      }
      return prices;
    },
  });
}
