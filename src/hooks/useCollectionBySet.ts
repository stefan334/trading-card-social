import { useQuery } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';

export interface CollectionCard {
  userCardId: string;
  cardId: string;
  name: string;
  number: string;
  imageUrlSmall: string | null;
  isForTrade: boolean;
}

export interface CollectionSetGroup {
  setId: string;
  gameId: string;
  setName: string;
  series: string | null;
  totalCards: number;
  ownedDistinct: number; // distinct cards owned in this set
  cards: CollectionCard[];
}

/**
 * A user's owned cards grouped by set, with per-set completion (distinct owned /
 * set total). Used for both the Collection tab (self) and public profiles.
 */
export function useCollectionBySet(userId: string | undefined, gameId?: string) {
  return useQuery({
    queryKey: ['collection-by-set', userId, gameId],
    enabled: isSupabaseConfigured && Boolean(userId),
    queryFn: async (): Promise<CollectionSetGroup[]> => {
      const { data, error } = await supabase!
        .from('user_cards')
        .select(
          'id, is_for_trade, card:cards(id, name, number, image_url_small, set:card_sets(id, name, series, total_cards, game_id))'
        )
        .eq('owner_id', userId!);
      if (error) throw error;

      const groups = new Map<string, CollectionSetGroup>();
      const ownedIds = new Map<string, Set<string>>();

      for (const row of (data ?? []) as any[]) {
        const set = row.card?.set;
        if (!set) continue;
        if (gameId && set.game_id !== gameId) continue;

        if (!groups.has(set.id)) {
          groups.set(set.id, {
            setId: set.id,
            gameId: set.game_id,
            setName: set.name,
            series: set.series,
            totalCards: set.total_cards ?? 0,
            ownedDistinct: 0,
            cards: [],
          });
          ownedIds.set(set.id, new Set());
        }

        const group = groups.get(set.id)!;
        group.cards.push({
          userCardId: row.id,
          cardId: row.card.id,
          name: row.card.name,
          number: row.card.number,
          imageUrlSmall: row.card.image_url_small,
          isForTrade: row.is_for_trade,
        });
        ownedIds.get(set.id)!.add(row.card.id);
      }

      for (const [setId, ids] of ownedIds) {
        groups.get(setId)!.ownedDistinct = ids.size;
      }

      // Most-complete sets first.
      return [...groups.values()].sort((a, b) => b.ownedDistinct - a.ownedDistinct);
    },
  });
}
