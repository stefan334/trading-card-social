import { useQuery } from '@tanstack/react-query';
import { getProvider } from '../services/tcg-providers';

/** Sets for a given game, sourced live from the TCG provider API (not the local catalog cache). */
export function useSets(gameId: string, query?: string) {
  return useQuery({
    queryKey: ['tcg-sets', gameId, query],
    queryFn: () => getProvider(gameId).searchSets(query),
  });
}
