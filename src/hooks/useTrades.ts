import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';
import type { TradeStatus } from '../types/domain';

export interface TradeSummary {
  id: string;
  status: TradeStatus;
  updatedAt: string;
  direction: 'incoming' | 'outgoing';
  counterpart: { id: string; username: string; displayName: string | null; avatarUrl: string | null } | null;
}

/** The current user's trades (both directions), newest activity first. */
export function useTrades() {
  const { user } = useAuth();
  const meId = user?.id;

  return useQuery({
    queryKey: ['trades', meId],
    enabled: isSupabaseConfigured && Boolean(meId),
    queryFn: async (): Promise<TradeSummary[]> => {
      const { data, error } = await supabase!
        .from('trades')
        .select(
          'id, status, updated_at, initiator_id, counterparty_id, initiator:profiles!trades_initiator_id_fkey(id, username, display_name, avatar_url), counterparty:profiles!trades_counterparty_id_fkey(id, username, display_name, avatar_url)'
        )
        .order('updated_at', { ascending: false });
      if (error) throw error;

      return (data ?? []).map((t: any) => {
        const outgoing = t.initiator_id === meId;
        const other = outgoing ? t.counterparty : t.initiator;
        return {
          id: t.id,
          status: t.status,
          updatedAt: t.updated_at,
          direction: outgoing ? 'outgoing' : 'incoming',
          counterpart: other
            ? { id: other.id, username: other.username, displayName: other.display_name, avatarUrl: other.avatar_url }
            : null,
        };
      });
    },
  });
}
