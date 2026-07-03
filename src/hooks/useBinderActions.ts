import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase/client';
import { getProvider } from '../services/tcg-providers';
import type { Card, CardSet } from '../types/card';

/** Create/rename/delete binders and add/remove cards. */
export function useBinderActions() {
  const { user } = useAuth();
  const meId = user?.id;
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: async (name: string) => {
      if (!supabase || !meId) throw new Error('Not signed in.');
      const { data, error } = await supabase
        .from('binders')
        .insert({ owner_id: meId, name: name.trim() || 'Untitled binder' })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['binders', meId] }),
  });

  const rename = useMutation({
    mutationFn: async ({ binderId, name }: { binderId: string; name: string }) => {
      if (!supabase) throw new Error('Not signed in.');
      const { error } = await supabase.from('binders').update({ name: name.trim() }).eq('id', binderId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['binders', meId] });
      qc.invalidateQueries({ queryKey: ['binder', v.binderId] });
    },
  });

  const remove = useMutation({
    mutationFn: async (binderId: string) => {
      if (!supabase) throw new Error('Not signed in.');
      const { error } = await supabase.from('binders').delete().eq('id', binderId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['binders', meId] }),
  });

  const addCard = useMutation({
    mutationFn: async ({ binderId, card, set, position }: { binderId: string; card: Card; set: CardSet; position: number }) => {
      if (!supabase) throw new Error('Not signed in.');
      // Lazy-cache the card so the FK resolves (same as collection/wishlist).
      const { error: cacheErr } = await supabase.rpc('cache_card', {
        p_card_id: card.id, p_game_id: card.gameId, p_game_name: getProvider(card.gameId).displayName,
        p_set_id: set.id, p_set_name: set.name, p_set_series: set.series ?? null, p_set_total: set.totalCards,
        p_set_image: set.imageUrl ?? null, p_name: card.name, p_number: card.number, p_rarity: card.rarity ?? null,
        p_image_small: card.imageUrlSmall ?? null, p_image_large: card.imageUrlLarge ?? null,
      });
      if (cacheErr) throw cacheErr;
      const { error } = await supabase
        .from('binder_cards')
        .upsert({ binder_id: binderId, card_id: card.id, position }, { onConflict: 'binder_id,card_id', ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['binder', v.binderId] });
      qc.invalidateQueries({ queryKey: ['binders', meId] });
    },
  });

  const removeCard = useMutation({
    mutationFn: async ({ binderCardId }: { binderCardId: string; binderId: string }) => {
      if (!supabase) throw new Error('Not signed in.');
      const { error } = await supabase.from('binder_cards').delete().eq('id', binderCardId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['binder', v.binderId] });
      qc.invalidateQueries({ queryKey: ['binders', meId] });
    },
  });

  const reorder = useMutation({
    mutationFn: async ({ binderId, orderedIds }: { binderId: string; orderedIds: string[] }) => {
      if (!supabase) throw new Error('Not signed in.');
      // Persist each card's new index as its position.
      for (let i = 0; i < orderedIds.length; i++) {
        const { error } = await supabase.from('binder_cards').update({ position: i }).eq('id', orderedIds[i]);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['binder', v.binderId] });
      qc.invalidateQueries({ queryKey: ['binders', meId] });
    },
  });

  const setCover = useMutation({
    mutationFn: async ({ binderId, cardId }: { binderId: string; cardId: string }) => {
      if (!supabase) throw new Error('Not signed in.');
      const { error } = await supabase.from('binders').update({ cover_card_id: cardId }).eq('id', binderId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['binder', v.binderId] });
      qc.invalidateQueries({ queryKey: ['binders', meId] });
    },
  });

  return { create, rename, remove, addCard, removeCard, reorder, setCover };
}

