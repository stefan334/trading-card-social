import { useQuery } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';

export interface OwnedCard {
  userCardId: string;
  cardId: string;
  name: string;
  number: string;
  imageUrlSmall: string | null;
  isForTrade: boolean;
}

/**
 * All of a user's owned cards (flat), with their for-trade flag. Used by the
 * trade builder so you can offer/request any card, with for-trade ones marked.
 */
export function useOwnedCards(userId: string | undefined) {
  return useQuery({
    queryKey: ['owned-cards', userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    queryFn: async (): Promise<OwnedCard[]> => {
      const { data, error } = await supabase!
        .from('user_cards')
        .select('id, is_for_trade, card:cards(id, name, number, image_url_small)')
        .eq('owner_id', userId!)
        .order('acquired_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        userCardId: r.id,
        cardId: r.card.id,
        name: r.card.name,
        number: r.card.number,
        imageUrlSmall: r.card.image_url_small,
        isForTrade: r.is_for_trade,
      }));
    },
  });
}
