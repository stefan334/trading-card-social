import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase/client';
import { getProvider } from '../services/tcg-providers';
import type { Card, CardSet } from '../types/card';
import type { CardCondition } from '../types/domain';

export interface AddToCollectionInput {
  card: Card;
  set: CardSet;
  quantity?: number;
  condition?: CardCondition;
  isForTrade?: boolean;
  imageUrl?: string; // user's own scanned photo, if any
}

/**
 * Mutations for editing the current user's collection. `add` first lazy-caches
 * the card + set into the catalog via the cache_card RPC (so the user_cards FK
 * resolves), then inserts the ownership row. `remove` and `toggleForTrade` edit
 * existing user_cards rows under normal owner-only RLS.
 */
export function useCollectionActions() {
  const { user } = useAuth();
  const meId = user?.id;
  const qc = useQueryClient();

  function invalidate(cardId?: string) {
    qc.invalidateQueries({ queryKey: ['collection', meId] });
    qc.invalidateQueries({ queryKey: ['collection-by-set', meId] });
    qc.invalidateQueries({ queryKey: ['profile', meId] });
    if (cardId) qc.invalidateQueries({ queryKey: ['card-ownership', meId, cardId] });
  }

  const add = useMutation({
    mutationFn: async ({ card, set, quantity = 1, condition, isForTrade = false, imageUrl }: AddToCollectionInput) => {
      if (!supabase || !meId) throw new Error('Not signed in.');

      const gameName = getProvider(card.gameId).displayName;
      const { error: cacheErr } = await supabase.rpc('cache_card', {
        p_card_id: card.id,
        p_game_id: card.gameId,
        p_game_name: gameName,
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

      const { error: insertErr } = await supabase.from('user_cards').insert({
        owner_id: meId,
        card_id: card.id,
        quantity,
        condition: condition ?? null,
        is_for_trade: isForTrade,
        image_url: imageUrl ?? null,
      });
      if (insertErr) throw insertErr;
    },
    onSuccess: (_data, vars) => invalidate(vars.card.id),
  });

  const remove = useMutation({
    mutationFn: async ({ userCardId }: { userCardId: string; cardId?: string }) => {
      if (!supabase) throw new Error('Not signed in.');
      const { error } = await supabase.from('user_cards').delete().eq('id', userCardId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => invalidate(vars.cardId),
  });

  const toggleForTrade = useMutation({
    mutationFn: async ({ userCardId, isForTrade }: { userCardId: string; isForTrade: boolean; cardId?: string }) => {
      if (!supabase) throw new Error('Not signed in.');
      // Un-listing a card also clears its asking price.
      const patch = isForTrade ? { is_for_trade: true } : { is_for_trade: false, sale_price: null };
      const { error } = await supabase.from('user_cards').update(patch).eq('id', userCardId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => invalidate(vars.cardId),
  });

  const setSalePrice = useMutation({
    mutationFn: async ({ userCardId, price }: { userCardId: string; price: number | null; cardId?: string }) => {
      if (!supabase) throw new Error('Not signed in.');
      const { error } = await supabase.from('user_cards').update({ sale_price: price }).eq('id', userCardId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => invalidate(vars.cardId),
  });

  return { add, remove, toggleForTrade, setSalePrice };
}
