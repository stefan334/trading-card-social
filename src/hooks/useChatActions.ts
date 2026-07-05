import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase/client';

/** Start/find a thread, send a message, and mark a thread read. */
export function useChatActions() {
  const { user } = useAuth();
  const meId = user?.id;
  const qc = useQueryClient();

  const startThread = useMutation({
    mutationFn: async (input: { otherId: string; cardId?: string | null; tradeId?: string | null }) => {
      if (!supabase) throw new Error('Not signed in.');
      const { data, error } = await supabase.rpc('get_or_create_thread', {
        p_other: input.otherId,
        p_card_id: input.cardId ?? null,
        p_trade_id: input.tradeId ?? null,
      });
      if (error) throw error;
      return data as string; // thread id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-threads', meId] }),
  });

  const sendMessage = useMutation({
    mutationFn: async ({ threadId, body, imageUrl }: { threadId: string; body?: string; imageUrl?: string }) => {
      if (!supabase || !meId) throw new Error('Not signed in.');
      const text = (body ?? '').trim();
      if (!text && !imageUrl) return;
      const { error } = await supabase
        .from('chat_messages')
        .insert({ thread_id: threadId, sender_id: meId, body: text, image_url: imageUrl ?? null });
      if (error) throw error;
    },
    // The message appends via the realtime subscription; just refresh the list preview/unread.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-threads', meId] }),
  });

  const markRead = useMutation({
    mutationFn: async (threadId: string) => {
      if (!supabase || !meId) return;
      const { error } = await supabase
        .from('thread_reads')
        .upsert({ thread_id: threadId, user_id: meId, last_read_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-threads', meId] }),
  });

  return { startThread, sendMessage, markRead };
}
