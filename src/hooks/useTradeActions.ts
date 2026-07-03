import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase/client';

export interface ProposeTradeInput {
  counterpartyId: string;
  myUserCardIds: string[]; // my for-trade cards I'm offering
  theirUserCardIds: string[]; // their for-trade cards I'm requesting
  note?: string;
}

/**
 * Trade lifecycle actions. `propose` inserts the trade + items (client-side under
 * RLS). accept/decline/cancel call SECURITY DEFINER RPCs — accept transfers card
 * ownership atomically (see 0006_trades.sql).
 */
export function useTradeActions() {
  const { user } = useAuth();
  const meId = user?.id;
  const qc = useQueryClient();

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ['trades'] });
    qc.invalidateQueries({ queryKey: ['trade'] });
    qc.invalidateQueries({ queryKey: ['collection-by-set'] });
    qc.invalidateQueries({ queryKey: ['for-trade-cards'] });
    qc.invalidateQueries({ queryKey: ['card-ownership'] });
    qc.invalidateQueries({ queryKey: ['profile'] });
  }

  const propose = useMutation({
    mutationFn: async ({ counterpartyId, myUserCardIds, theirUserCardIds, note }: ProposeTradeInput) => {
      if (!supabase || !meId) throw new Error('Not signed in.');
      if (myUserCardIds.length === 0 && theirUserCardIds.length === 0) {
        throw new Error('Add at least one card to the trade.');
      }

      const { data: trade, error: tErr } = await supabase
        .from('trades')
        .insert({ initiator_id: meId, counterparty_id: counterpartyId, note: note?.trim() || null })
        .select('id')
        .single();
      if (tErr) throw tErr;

      const items = [
        ...myUserCardIds.map((id) => ({ trade_id: trade.id, user_card_id: id, from_user_id: meId })),
        ...theirUserCardIds.map((id) => ({ trade_id: trade.id, user_card_id: id, from_user_id: counterpartyId })),
      ];
      const { error: iErr } = await supabase.from('trade_items').insert(items);
      if (iErr) throw iErr;

      return trade.id as string;
    },
    onSuccess: () => invalidateAll(),
  });

  const accept = useMutation({
    mutationFn: async (tradeId: string) => {
      if (!supabase) throw new Error('Not signed in.');
      const { error } = await supabase.rpc('accept_trade', { p_trade_id: tradeId });
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
  });

  const confirm = useMutation({
    mutationFn: async (tradeId: string) => {
      if (!supabase) throw new Error('Not signed in.');
      const { error } = await supabase.rpc('confirm_trade', { p_trade_id: tradeId });
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
  });

  const decline = useMutation({
    mutationFn: async (tradeId: string) => {
      if (!supabase) throw new Error('Not signed in.');
      const { error } = await supabase.rpc('decline_trade', { p_trade_id: tradeId });
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
  });

  const cancel = useMutation({
    mutationFn: async (tradeId: string) => {
      if (!supabase) throw new Error('Not signed in.');
      const { error } = await supabase.rpc('cancel_trade', { p_trade_id: tradeId });
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(),
  });

  return { propose, accept, confirm, decline, cancel };
}
