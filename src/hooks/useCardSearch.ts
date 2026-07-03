import { useQuery } from '@tanstack/react-query';
import { getProvider } from '../services/tcg-providers';
import type { Card } from '../types/card';

/** Search a game's cards by name via the TCG provider API (min 2 chars). */
export function useCardSearch(query: string, gameId: string) {
  const q = query.trim();

  return useQuery({
    queryKey: ['card-search', gameId, q],
    enabled: q.length >= 2,
    queryFn: async (): Promise<Card[]> => {
      const { cards } = await getProvider(gameId).searchCards({ name: q, pageSize: 30 });
      return cards;
    },
  });
}
