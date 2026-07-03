import { useQuery } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';

export interface ProfileWithStats {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  favoriteGameId: string | null;
  followers: number;
  following: number;
  cardCount: number;
  ratingAvg: number | null;
  ratingCount: number;
}

/** Any user's public profile plus follower/following/collection counts. */
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    queryFn: async (): Promise<ProfileWithStats> => {
      const { data: p, error } = await supabase!
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio, favorite_game_id')
        .eq('id', userId!)
        .single();
      if (error) throw error;

      const [followers, following, cards, reviews] = await Promise.all([
        supabase!.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', userId!),
        supabase!.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId!),
        supabase!.from('user_cards').select('*', { count: 'exact', head: true }).eq('owner_id', userId!),
        supabase!.from('trade_reviews').select('rating').eq('reviewee_id', userId!),
      ]);

      const ratings = (reviews.data ?? []).map((r: any) => r.rating as number);
      const ratingAvg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

      return {
        id: p.id,
        username: p.username,
        displayName: p.display_name,
        avatarUrl: p.avatar_url,
        bio: p.bio,
        favoriteGameId: p.favorite_game_id,
        followers: followers.count ?? 0,
        following: following.count ?? 0,
        cardCount: cards.count ?? 0,
        ratingAvg,
        ratingCount: ratings.length,
      };
    },
  });
}
