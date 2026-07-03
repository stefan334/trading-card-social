import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';

export interface ChatThreadMeta {
  id: string;
  cardId: string | null;
  tradeId: string | null;
  other: { id: string; username: string; displayName: string | null; avatarUrl: string | null } | null;
}

/** Metadata for a single thread (the other participant + any linked card/trade), for the header. */
export function useChatThread(threadId: string | undefined) {
  const { user } = useAuth();
  const meId = user?.id;

  return useQuery({
    queryKey: ['chat-thread', threadId],
    enabled: isSupabaseConfigured && Boolean(threadId) && Boolean(meId),
    queryFn: async (): Promise<ChatThreadMeta> => {
      const { data: t, error } = await supabase!
        .from('chat_threads')
        .select('id, participant_one, participant_two, card_id, trade_id')
        .eq('id', threadId!)
        .single();
      if (error) throw error;

      const otherId = t.participant_one === meId ? t.participant_two : t.participant_one;
      const { data: p } = await supabase!
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .eq('id', otherId)
        .single();

      return {
        id: t.id,
        cardId: t.card_id,
        tradeId: t.trade_id,
        other: p ? { id: p.id, username: p.username, displayName: p.display_name, avatarUrl: p.avatar_url } : null,
      };
    },
  });
}
