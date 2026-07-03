import { useQuery } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';

export interface FeedPost {
  id: string;
  type: 'text' | 'card_showcase' | 'card_added' | 'trade_completed';
  body: string | null;
  imageUrl: string | null;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  card: {
    id: string;
    name: string;
    imageUrlSmall: string | null;
  } | null;
}

/**
 * Home feed: posts by the current user and everyone they follow, newest first.
 *
 * Done client-side in two steps (follow list -> posts with embedded author/card)
 * so we get hydrated author + card data in one PostgREST round trip after the
 * follow lookup. The DB also exposes an RPC `get_feed(page_limit, page_offset)`
 * (see migration 0002) which encapsulates the same filter server-side — switch
 * to it if/when follow lists get large enough that the `in (...)` filter hurts.
 */
export function useFeed(userId: string | undefined) {
  return useQuery({
    queryKey: ['feed', userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    queryFn: async (): Promise<FeedPost[]> => {
      const { data: follows, error: followsError } = await supabase!
        .from('follows')
        .select('followee_id')
        .eq('follower_id', userId!);
      if (followsError) throw followsError;

      const authorIds = [userId!, ...(follows ?? []).map((f: any) => f.followee_id)];

      const { data, error } = await supabase!
        .from('posts')
        .select(
          'id, type, body, image_url, created_at, author:profiles(id, username, display_name, avatar_url), card:cards(id, name, image_url_small)'
        )
        .in('author_id', authorIds)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        type: row.type,
        body: row.body,
        imageUrl: row.image_url,
        createdAt: row.created_at,
        author: {
          id: row.author.id,
          username: row.author.username,
          displayName: row.author.display_name,
          avatarUrl: row.author.avatar_url,
        },
        card: row.card
          ? { id: row.card.id, name: row.card.name, imageUrlSmall: row.card.image_url_small }
          : null,
      }));
    },
  });
}
