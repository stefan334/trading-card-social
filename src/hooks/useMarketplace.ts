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
  ownerLocation: string | null;
  distanceKm: number | null; // from the current user, if both have location
}

const NEAR_RADIUS_KM = 60;

function distanceKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Global marketplace: every card listed for trade across all users (excluding
 * your own), with distance from you. `nearMe` (default on) restricts to local
 * listings and sorts by distance; turn it off to see everywhere.
 */
export function useMarketplace(gameId: string, search: string, nearMe: boolean) {
  const { user, profile } = useAuth();
  const meId = user?.id;
  const q = search.trim().toLowerCase();
  const myCoords: [number, number] | null =
    profile?.latitude != null && profile?.longitude != null ? [profile.latitude, profile.longitude] : null;

  const query = useQuery({
    queryKey: ['marketplace'],
    enabled: isSupabaseConfigured,
    queryFn: async (): Promise<MarketListing[]> => {
      const { data, error } = await supabase!
        .from('user_cards')
        .select(
          'id, condition, grade, sale_price, owner_id, card:cards(id, name, number, image_url_small, game_id), owner:profiles(id, username, display_name, avatar_url, latitude, longitude, location_name)'
        )
        .eq('is_for_trade', true)
        .order('acquired_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? [])
        .filter((r: any) => r.owner_id !== meId && r.card)
        .map((r: any) => {
          const oLat = r.owner?.latitude != null ? Number(r.owner.latitude) : null;
          const oLng = r.owner?.longitude != null ? Number(r.owner.longitude) : null;
          return {
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
            ownerLocation: r.owner?.location_name ?? null,
            distanceKm: myCoords && oLat != null && oLng != null ? Math.round(distanceKm(myCoords, [oLat, oLng])) : null,
          };
        });
    },
  });

  let listings = (query.data ?? []).filter((l) => l.gameId === gameId && (!q || l.name.toLowerCase().includes(q)));

  const canFilterNear = Boolean(myCoords);
  if (nearMe && canFilterNear) {
    listings = listings
      .filter((l) => l.distanceKm != null && l.distanceKm <= NEAR_RADIUS_KM)
      .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
  }

  return { ...query, listings, canFilterNear };
}
