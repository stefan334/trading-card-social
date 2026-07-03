import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';

/** Set of the current user's owned card ids within a given set (for completion highlighting). */
export function useOwnedCardIds(setId: string | undefined) {
  const { user } = useAuth();
  const meId = user?.id;

  return useQuery({
    queryKey: ['owned-card-ids', meId, setId],
    enabled: isSupabaseConfigured && Boolean(meId) && Boolean(setId),
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase!
        .from('user_cards')
        .select('card_id, cards!inner(set_id)')
        .eq('owner_id', meId!)
        .eq('cards.set_id', setId!);
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => r.card_id));
    },
  });
}
