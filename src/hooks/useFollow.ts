import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';

/**
 * Follow state + toggle for `targetId`, from the current user's perspective.
 * Disabled when the target is yourself or when signed out.
 */
export function useFollow(targetId: string | undefined) {
  const { user } = useAuth();
  const meId = user?.id;
  const qc = useQueryClient();

  const enabled =
    isSupabaseConfigured && Boolean(meId) && Boolean(targetId) && meId !== targetId;

  const query = useQuery({
    queryKey: ['isFollowing', meId, targetId],
    enabled,
    queryFn: async (): Promise<boolean> => {
      const { count, error } = await supabase!
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', meId!)
        .eq('followee_id', targetId!);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });

  const mutation = useMutation({
    mutationFn: async (currentlyFollowing: boolean) => {
      if (!supabase || !meId || !targetId) return;
      if (currentlyFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', meId)
          .eq('followee_id', targetId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: meId, followee_id: targetId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['isFollowing', meId, targetId] });
      qc.invalidateQueries({ queryKey: ['profile', targetId] });
      qc.invalidateQueries({ queryKey: ['profile', meId] });
      qc.invalidateQueries({ queryKey: ['feed', meId] });
    },
  });

  return {
    canFollow: enabled,
    isFollowing: query.data ?? false,
    loading: query.isLoading,
    toggling: mutation.isPending,
    toggle: () => mutation.mutate(query.data ?? false),
  };
}
