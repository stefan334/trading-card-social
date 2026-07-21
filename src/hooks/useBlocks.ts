import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { track } from '../services/analytics';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';

/**
 * User blocking. A block hides content in BOTH directions client-side (feed,
 * marketplace, inbox DMs, search) — the blocks table's RLS lets both parties
 * see the row, so each side's app can filter the other out.
 */

/** Every user id involved in a block with me (either direction) — for filtering. */
export function useBlockedIds(): Set<string> {
  const { user } = useAuth();
  const meId = user?.id;
  const { data } = useQuery({
    queryKey: ['blocks', meId],
    enabled: isSupabaseConfigured && Boolean(meId),
    queryFn: async () => {
      const { data, error } = await supabase!.from('blocks').select('blocker_id, blocked_id');
      if (error) throw error;
      return data ?? [];
    },
  });
  const set = new Set<string>();
  for (const b of data ?? []) set.add(b.blocker_id === meId ? b.blocked_id : b.blocker_id);
  return set;
}

/** Whether I have blocked this specific user (drives the profile button label). */
export function useIsBlocked(userId: string | undefined): boolean {
  const { user } = useAuth();
  const meId = user?.id;
  const { data } = useQuery({
    queryKey: ['blocks', meId],
    enabled: isSupabaseConfigured && Boolean(meId),
    queryFn: async () => {
      const { data, error } = await supabase!.from('blocks').select('blocker_id, blocked_id');
      if (error) throw error;
      return data ?? [];
    },
  });
  return Boolean(userId && (data ?? []).some((b) => b.blocker_id === meId && b.blocked_id === userId));
}

/** The users I've blocked, with profile info — for the Settings management list. */
export function useBlockedList() {
  const { user } = useAuth();
  const meId = user?.id;
  return useQuery({
    queryKey: ['blocked-list', meId],
    enabled: isSupabaseConfigured && Boolean(meId),
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('blocks')
        .select('blocked_id, created_at, blocked:profiles!blocks_blocked_id_fkey(id, username, display_name, avatar_url)')
        .eq('blocker_id', meId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.blocked?.id ?? r.blocked_id,
        username: r.blocked?.username ?? 'unknown',
        displayName: r.blocked?.display_name ?? null,
        avatarUrl: r.blocked?.avatar_url ?? null,
      }));
    },
  });
}

export function useBlockActions() {
  const { user } = useAuth();
  const meId = user?.id;
  const qc = useQueryClient();

  // Blocking changes what half the app should show — refresh those queries.
  function invalidate() {
    qc.invalidateQueries({ queryKey: ['blocks', meId] });
    qc.invalidateQueries({ queryKey: ['blocked-list', meId] });
    qc.invalidateQueries({ queryKey: ['feed'] });
    qc.invalidateQueries({ queryKey: ['marketplace'] });
    qc.invalidateQueries({ queryKey: ['chat-threads'] });
  }

  const block = useMutation({
    mutationFn: async (blockedId: string) => {
      if (!supabase || !meId) throw new Error('Not signed in.');
      const { error } = await supabase.from('blocks').insert({ blocker_id: meId, blocked_id: blockedId });
      if (error && error.code !== '23505') throw error; // already blocked = fine
    },
    onSuccess: (_d, blockedId) => {
      invalidate();
      track('user_blocked', { blockedId });
    },
  });

  const unblock = useMutation({
    mutationFn: async (blockedId: string) => {
      if (!supabase || !meId) throw new Error('Not signed in.');
      const { error } = await supabase.from('blocks').delete().eq('blocker_id', meId).eq('blocked_id', blockedId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { block, unblock };
}
