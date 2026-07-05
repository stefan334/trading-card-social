import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';

export interface MarketListing {
  userCardId: string;
  cardId: string;
  name: string;
  number: string;
  imageUrlSmall: string | null;
  gameId: string;
  condition: string | null;
  grade: string | null;
  salePrice: number | null; // asking cash price (EUR); null = open to card trades
  owner: { id: string; username: string; displayName: string | null; avatarUrl: string | null } | null;
}

/**
 * Global marketplace: every card listed for trade across all users (excluding
 * your own listings), newest first. Filtered client-side by game + card name.
 */
export function useMarketplace(gameId: string, search: string) {
  const { user } = useAuth();
  const meId = user?.id;
  const q = search.trim().toLowerCase();

  const query = useQuery({
    queryKey: ['marketplace'],
    enabled: isSupabaseConfigured,
    queryFn: async (): Promise<MarketListing[]> => {
      const { data, error } = await supabase!
        .from('user_cards')
        .select(
          'id, condition, grade, sale_price, owner_id, card:cards(id, name, number, image_url_small, game_id), owner:profiles(id, username, display_name, avatar_url)'
        )
        .eq('is_for_trade', true)
        .order('acquired_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? [])
        .filter((r: any) => r.owner_id !== meId && r.card)
        .map((r: any) => ({
          userCardId: r.id,
          cardId: r.card.id,
          name: r.card.name,
          number: r.card.number,
          imageUrlSmall: r.card.image_url_small,
          gameId: r.card.game_id,
          condition: r.condition,
          grade: r.grade,
          salePrice: r.sale_price != null ? Number(r.sale_price) : null,
          owner: r.owner
            ? { id: r.owner.id, username: r.owner.username, displayName: r.owner.display_name, avatarUrl: r.owner.avatar_url }
            : null,
        }));
    },
  });

  const listings = (query.data ?? []).filter(
    (l) => l.gameId === gameId && (!q || l.name.toLowerCase().includes(q))
  );

  return { ...query, listings };
}
