import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';
import type { CardCondition } from '../types/domain';

export interface OwnedCopy {
  id: string;
  quantity: number;
  condition: CardCondition | null;
  isForTrade: boolean;
  salePrice: number | null;
}

/** The current user's owned copies of a specific card (empty if none / signed out). */
export function useCardOwnership(cardId: string | undefined) {
  const { user } = useAuth();
  const meId = user?.id;

  return useQuery({
    queryKey: ['card-ownership', meId, cardId],
    enabled: isSupabaseConfigured && Boolean(meId) && Boolean(cardId),
    queryFn: async (): Promise<OwnedCopy[]> => {
      const { data, error } = await supabase!
        .from('user_cards')
        .select('id, quantity, condition, is_for_trade, sale_price')
        .eq('owner_id', meId!)
        .eq('card_id', cardId!)
        .order('acquired_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        quantity: r.quantity,
        condition: r.condition,
        isForTrade: r.is_for_trade,
        salePrice: r.sale_price != null ? Number(r.sale_price) : null,
      }));
    },
  });
}
