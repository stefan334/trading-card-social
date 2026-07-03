import { useQuery } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';

export interface WishlistCard {
  wishlistId: string;
  cardId: string;
  name: string;
  number: string;
  imageUrlSmall: string | null;
  setId: string;
  setName: string;
  gameId: string;
}

/** A user's wishlisted cards (optionally filtered by game), newest first. */
export function useWishlist(userId: string | undefined, gameId?: string) {
  return useQuery({
    queryKey: ['wishlist', userId, gameId],
    enabled: isSupabaseConfigured && Boolean(userId),
    queryFn: async (): Promise<WishlistCard[]> => {
      const { data, error } = await supabase!
        .from('wishlists')
        .select('id, created_at, card:cards(id, name, number, image_url_small, game_id, set:card_sets(id, name))')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;

      return (data ?? [])
        .map((row: any) => ({
          wishlistId: row.id,
          cardId: row.card.id,
          name: row.card.name,
          number: row.card.number,
          imageUrlSmall: row.card.image_url_small,
          setId: row.card.set?.id ?? '',
          setName: row.card.set?.name ?? '',
          gameId: row.card.game_id,
        }))
        .filter((c: WishlistCard) => !gameId || c.gameId === gameId);
    },
  });
}
