import { useQuery } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';

/**
 * Estimated market value of a user's whole collection: Σ (synced market price ×
 * quantity). Cards without a synced price count as 0 — it's an estimate, and
 * `pricedCount` lets the UI say how much of the collection it covers.
 */
export function useCollectionValue(userId: string | undefined) {
  return useQuery({
    queryKey: ['collection-value', userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('user_cards')
        .select('quantity, card:cards(price_market)')
        .eq('owner_id', userId!);
      if (error) throw error;
      let total = 0;
      let pricedCount = 0;
      let cardCount = 0;
      for (const r of (data ?? []) as any[]) {
        const qty = r.quantity ?? 1;
        cardCount += qty;
        const p = r.card?.price_market != null ? Number(r.card.price_market) : null;
        if (p != null && p > 0) {
          total += p * qty;
          pricedCount += qty;
        }
      }
      return { total, pricedCount, cardCount };
    },
  });
}
