import { useQuery } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';

export interface ForTradeCard {
  userCardId: string;
  cardId: string;
  name: string;
  number: string;
  imageUrlSmall: string | null;
  condition: string | null;
}

/** A user's cards marked available for trade (for building a trade offer). */
export function useForTradeCards(userId: string | undefined) {
  return useQuery({
    queryKey: ['for-trade-cards', userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    queryFn: async (): Promise<ForTradeCard[]> => {
      const { data, error } = await supabase!
        .from('user_cards')
        .select('id, condition, card:cards(id, name, number, image_url_small)')
        .eq('owner_id', userId!)
        .eq('is_for_trade', true);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        userCardId: r.id,
        cardId: r.card.id,
        name: r.card.name,
        number: r.card.number,
        imageUrlSmall: r.card.image_url_small,
        condition: r.condition,
      }));
    },
  });
}
