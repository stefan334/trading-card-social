import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';

export interface ChatMessage {
  id: string;
  senderId: string;
  body: string;
  imageUrl: string | null;
  createdAt: string;
}

function mapMessage(m: any): ChatMessage {
  return { id: m.id, senderId: m.sender_id, body: m.body, imageUrl: m.image_url, createdAt: m.created_at };
}

/**
 * Messages in a thread (oldest→newest) with a live Supabase Realtime subscription:
 * new inserts (from either participant) are appended to the cache. RLS scopes the
 * realtime stream to threads the user is in.
 */
export function useThreadMessages(threadId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['thread-messages', threadId],
    enabled: isSupabaseConfigured && Boolean(threadId),
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase!
        .from('chat_messages')
        .select('id, sender_id, body, image_url, created_at')
        .eq('thread_id', threadId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapMessage);
    },
  });

  useEffect(() => {
    if (!supabase || !threadId) return;
    const key = ['thread-messages', threadId];

    const channel = supabase
      .channel(`thread-${threadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const msg = mapMessage(payload.new);
          qc.setQueryData<ChatMessage[]>(key, (prev = []) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
          );
        }
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, [threadId, qc]);

  return query;
}
