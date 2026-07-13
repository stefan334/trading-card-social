import { useQuery } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';

export interface ConnectionUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export type ConnectionType = 'followers' | 'following';

/**
 * The list of a user's followers or the people they follow (public — follows are
 * readable by all). `followers` = people who follow this user; `following` =
 * people this user follows.
 */
export function useConnections(userId: string | undefined, type: ConnectionType) {
  return useQuery({
    queryKey: ['connections', userId, type],
    enabled: isSupabaseConfigured && Boolean(userId),
    queryFn: async (): Promise<ConnectionUser[]> => {
      // followers: rows where followee_id = user, take the follower profile.
      // following: rows where follower_id = user, take the followee profile.
      const matchCol = type === 'followers' ? 'followee_id' : 'follower_id';
      const joinFk = type === 'followers' ? 'follows_follower_id_fkey' : 'follows_followee_id_fkey';
      const { data, error } = await supabase!
        .from('follows')
        .select(`profile:profiles!${joinFk}(id, username, display_name, avatar_url)`)
        .eq(matchCol, userId!);
      if (error) throw error;
      return (data ?? [])
        .map((r: any) => r.profile)
        .filter(Boolean)
        .map((p: any) => ({ id: p.id, username: p.username, displayName: p.display_name, avatarUrl: p.avatar_url }));
    },
  });
}
