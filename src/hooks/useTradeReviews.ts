import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';

export interface TradeReview {
  id: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewer: { username: string; displayName: string | null; avatarUrl: string | null } | null;
}

/** Reviews left on a given trade (usually up to two — one per participant). */
export function useTradeReviews(tradeId: string | undefined) {
  return useQuery({
    queryKey: ['trade-reviews', tradeId],
    enabled: isSupabaseConfigured && Boolean(tradeId),
    queryFn: async (): Promise<TradeReview[]> => {
      const { data, error } = await supabase!
        .from('trade_reviews')
        .select('id, reviewer_id, reviewee_id, rating, comment, created_at, reviewer:profiles!trade_reviews_reviewer_id_fkey(username, display_name, avatar_url)')
        .eq('trade_id', tradeId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        reviewerId: r.reviewer_id,
        revieweeId: r.reviewee_id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.created_at,
        reviewer: r.reviewer
          ? { username: r.reviewer.username, displayName: r.reviewer.display_name, avatarUrl: r.reviewer.avatar_url }
          : null,
      }));
    },
  });
}

/** Submit a review of the other party after a completed trade. */
export function useSubmitReview() {
  const { user } = useAuth();
  const meId = user?.id;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { tradeId: string; revieweeId: string; rating: number; comment?: string }) => {
      if (!supabase || !meId) throw new Error('Not signed in.');
      const { error } = await supabase.from('trade_reviews').insert({
        trade_id: input.tradeId,
        reviewer_id: meId,
        reviewee_id: input.revieweeId,
        rating: input.rating,
        comment: input.comment?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['trade-reviews', vars.tradeId] });
      qc.invalidateQueries({ queryKey: ['profile', vars.revieweeId] });
    },
  });
}
