import { useQuery } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';

export interface UserSearchResult {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

// Strip characters that would break PostgREST's `.or(...)` filter syntax.
function sanitize(q: string) {
  return q.replace(/[,()%]/g, '').trim();
}

/** Search profiles by username or display name (case-insensitive, min 2 chars). */
export function useUserSearch(query: string) {
  const q = sanitize(query);

  return useQuery({
    queryKey: ['user-search', q],
    enabled: isSupabaseConfigured && q.length >= 2,
    queryFn: async (): Promise<UserSearchResult[]> => {
      const { data, error } = await supabase!
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(25);
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        id: p.id,
        username: p.username,
        displayName: p.display_name,
        avatarUrl: p.avatar_url,
      }));
    },
  });
}
