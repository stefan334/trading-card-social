import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';
import type { NotificationType } from '../types/domain';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  readAt: string | null;
  createdAt: string;
  actor: { id: string; username: string; displayName: string | null; avatarUrl: string | null } | null;
  card: { id: string; name: string; imageUrlSmall: string | null } | null;
  tradeId: string | null;
  tradeStatus: string | null;
}

/** Actor id embedded in a notification payload (owner for a match, follower for a follow). */
function actorIdOf(type: NotificationType, payload: any): string | undefined {
  if (type === 'wishlist_match' || type === 'wishlist_listed') return payload?.owner_id;
  if (type === 'new_follower') return payload?.follower_id;
  if (type === 'trade_update') return payload?.actor_id;
  return undefined;
}

/** The current user's notifications, newest first, hydrated with actor + card. */
export function useNotifications() {
  const { user } = useAuth();
  const meId = user?.id;

  return useQuery({
    queryKey: ['notifications', meId],
    enabled: isSupabaseConfigured && Boolean(meId),
    queryFn: async (): Promise<NotificationItem[]> => {
      const { data, error } = await supabase!
        .from('notifications')
        .select('id, type, payload, read_at, created_at')
        .eq('user_id', meId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;

      const rows = data ?? [];
      const actorIds = new Set<string>();
      const cardIds = new Set<string>();
      for (const r of rows as any[]) {
        const a = actorIdOf(r.type, r.payload);
        if (a) actorIds.add(a);
        if (r.payload?.card_id) cardIds.add(r.payload.card_id);
      }

      const [profilesRes, cardsRes] = await Promise.all([
        actorIds.size
          ? supabase!.from('profiles').select('id, username, display_name, avatar_url').in('id', [...actorIds])
          : Promise.resolve({ data: [] as any[] }),
        cardIds.size
          ? supabase!.from('cards').select('id, name, image_url_small').in('id', [...cardIds])
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const profiles = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
      const cards = new Map((cardsRes.data ?? []).map((c: any) => [c.id, c]));

      return (rows as any[]).map((r) => {
        const actorId = actorIdOf(r.type, r.payload);
        const p = actorId ? profiles.get(actorId) : undefined;
        const c = r.payload?.card_id ? cards.get(r.payload.card_id) : undefined;
        return {
          id: r.id,
          type: r.type,
          readAt: r.read_at,
          createdAt: r.created_at,
          actor: p ? { id: p.id, username: p.username, displayName: p.display_name, avatarUrl: p.avatar_url } : null,
          card: c ? { id: c.id, name: c.name, imageUrlSmall: c.image_url_small } : null,
          tradeId: r.payload?.trade_id ?? null,
          tradeStatus: r.payload?.status ?? null,
        };
      });
    },
  });
}

/** Count of unread notifications, for the header bell badge. */
export function useUnreadNotificationCount() {
  const { user } = useAuth();
  const meId = user?.id;

  return useQuery({
    queryKey: ['notifications-unread', meId],
    enabled: isSupabaseConfigured && Boolean(meId),
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase!
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', meId!)
        .is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/** Marks all of the current user's unread notifications as read. */
export function useMarkNotificationsRead() {
  const { user } = useAuth();
  const meId = user?.id;
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!supabase || !meId) return;
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', meId)
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', meId] });
      qc.invalidateQueries({ queryKey: ['notifications-unread', meId] });
    },
  });
}
