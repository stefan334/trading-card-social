import { useQuery } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';

export interface TraderRating {
  avg: number;
  count: number;
}

/**
 * Batched trade-review scores for a set of users (marketplace listing rows).
 * One query for all visible sellers → Map<userId, {avg, count}>.
 */
export function useTraderRatings(userIds: string[]) {
  const ids = [...new Set(userIds)].sort();
  return useQuery({
    queryKey: ['trader-ratings', ids.join(',')],
    enabled: isSupabaseConfigured && ids.length > 0,
    queryFn: async (): Promise<Map<string, TraderRating>> => {
      const { data, error } = await supabase!
        .from('trade_reviews')
        .select('reviewee_id, rating')
        .in('reviewee_id', ids);
      if (error) throw error;
      const map = new Map<string, TraderRating>();
      for (const r of data ?? []) {
        const cur = map.get(r.reviewee_id) ?? { avg: 0, count: 0 };
        // Running mean keeps this a single pass.
        cur.avg = (cur.avg * cur.count + r.rating) / (cur.count + 1);
        cur.count += 1;
        map.set(r.reviewee_id, cur);
      }
      return map;
    },
  });
}
