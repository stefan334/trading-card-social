import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';

export interface ChatThreadSummary {
  threadId: string;
  cardId: string | null;
  tradeId: string | null;
  lastBody: string | null;
  lastAt: string | null;
  unread: number;
  other: { id: string; username: string; displayName: string | null; avatarUrl: string | null } | null;
}

/** The current user's chat threads (via my_chat_threads RPC), hydrated with the other participant. */
export function useChatThreads() {
  const { user } = useAuth();
  const meId = user?.id;

  return useQuery({
    queryKey: ['chat-threads', meId],
    enabled: isSupabaseConfigured && Boolean(meId),
    queryFn: async (): Promise<ChatThreadSummary[]> => {
      const { data, error } = await supabase!.rpc('my_chat_threads');
      if (error) throw error;
      const rows = (data ?? []) as any[];

      const otherIds = [...new Set(rows.map((r) => r.other_id).filter(Boolean))];
      const profiles = otherIds.length
        ? (await supabase!.from('profiles').select('id, username, display_name, avatar_url').in('id', otherIds)).data ?? []
        : [];
      const pmap = new Map(profiles.map((p: any) => [p.id, p]));

      return rows.map((r) => {
        const p = pmap.get(r.other_id);
        return {
          threadId: r.thread_id,
          cardId: r.card_id,
          tradeId: r.trade_id,
          lastBody: r.last_body,
          lastAt: r.last_at,
          unread: r.unread ?? 0,
          other: p ? { id: p.id, username: p.username, displayName: p.display_name, avatarUrl: p.avatar_url } : null,
        };
      });
    },
  });
}

/** Total unread messages across all threads, for the Chat tab badge. */
export function useUnreadChatTotal(): number {
  const { data } = useChatThreads();
  return (data ?? []).reduce((sum, t) => sum + t.unread, 0);
}
