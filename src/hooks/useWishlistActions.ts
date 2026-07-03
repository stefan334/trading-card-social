import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';
import { getProvider } from '../services/tcg-providers';
import type { Card, CardSet } from '../types/card';

/** Whether the current user has a given card on their wishlist. */
export function useIsWishlisted(cardId: string | undefined) {
  const { user } = useAuth();
  const meId = user?.id;

  return useQuery({
    queryKey: ['is-wishlisted', meId, cardId],
    enabled: isSupabaseConfigured && Boolean(meId) && Boolean(cardId),
    queryFn: async (): Promise<boolean> => {
      const { count, error } = await supabase!
        .from('wishlists')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', meId!)
        .eq('card_id', cardId!);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });
}

/** Add/remove a card from the current user's wishlist (lazy-caches the card first). */
export function useWishlistActions() {
  const { user } = useAuth();
  const meId = user?.id;
  const qc = useQueryClient();

  function invalidate(cardId: string) {
    qc.invalidateQueries({ queryKey: ['wishlist', meId] });
    qc.invalidateQueries({ queryKey: ['is-wishlisted', meId, cardId] });
  }

  const addToWishlist = useMutation({
    mutationFn: async ({ card, set }: { card: Card; set: CardSet }) => {
      if (!supabase || !meId) throw new Error('Not signed in.');

      const { error: cacheErr } = await supabase.rpc('cache_card', {
        p_card_id: card.id,
        p_game_id: card.gameId,
        p_game_name: getProvider(card.gameId).displayName,
        p_set_id: set.id,
        p_set_name: set.name,
        p_set_series: set.series ?? null,
        p_set_total: set.totalCards,
        p_set_image: set.imageUrl ?? null,
        p_name: card.name,
        p_number: card.number,
        p_rarity: card.rarity ?? null,
        p_image_small: card.imageUrlSmall ?? null,
        p_image_large: card.imageUrlLarge ?? null,
      });
      if (cacheErr) throw cacheErr;

      // Unique (user_id, card_id) — ignore if already present.
      const { error } = await supabase
        .from('wishlists')
        .upsert({ user_id: meId, card_id: card.id }, { onConflict: 'user_id,card_id', ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => invalidate(vars.card.id),
  });

  const removeFromWishlist = useMutation({
    mutationFn: async ({ cardId }: { cardId: string }) => {
      if (!supabase || !meId) throw new Error('Not signed in.');
      const { error } = await supabase.from('wishlists').delete().eq('user_id', meId).eq('card_id', cardId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => invalidate(vars.cardId),
  });

  return { addToWishlist, removeFromWishlist };
}
