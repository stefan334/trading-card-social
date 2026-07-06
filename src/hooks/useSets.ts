import { useQuery } from '@tanstack/react-query';
import { dbGetSets } from '../services/catalog';
import { getProvider } from '../services/tcg-providers';

/**
 * Sets for a given game. DB-first for the default browse list (instant once the
 * catalog is synced); name-search and the pre-sync case fall back to the live API.
 */
export function useSets(gameId: string, query?: string) {
  return useQuery({
    queryKey: ['tcg-sets', gameId, query],
    queryFn: async () => {
      if (!query) {
        const local = await dbGetSets(gameId);
        if (local) return local;
      }
      return getProvider(gameId).searchSets(query);
    },
  });
}
