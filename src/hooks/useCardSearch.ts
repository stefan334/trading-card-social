import { useQuery } from '@tanstack/react-query';
import { dbSearchCards } from '../services/catalog';
import { getProvider } from '../services/tcg-providers';
import type { Card } from '../types/card';

/**
 * Search a game's cards by name (min 2 chars). DB-first via the trigram index
 * (instant once the catalog is synced); falls back to the live provider API when
 * the local catalog has no match / isn't populated yet.
 */
export function useCardSearch(query: string, gameId: string) {
  const q = query.trim();

  return useQuery({
    queryKey: ['card-search', gameId, q],
    enabled: q.length >= 2,
    queryFn: async (): Promise<Card[]> => {
      const local = await dbSearchCards(gameId, q, 30);
      if (local && local.length) return local;
      const { cards } = await getProvider(gameId).searchCards({ name: q, pageSize: 30 });
      return cards;
    },
  });
}
