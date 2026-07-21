import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBlockedIds } from './useBlocks';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';

export interface MarketListing {
  userCardId: string;
  cardId: string;
  name: string;
  number: string;
  imageUrlSmall: string | null;
  gameId: string;
  setId: string | null;
  condition: string | null;
  grade: string | null;
  salePrice: number | null; // asking cash price (EUR); null = open to card trades
  owner: { id: string; username: string; displayName: string | null; avatarUrl: string | null; tradesCompleted: number } | null;
  ownerLocation: string | null;
  distanceKm: number | null; // from the current user, if both have location
}

const NEAR_RADIUS_KM = 60;

/** Haversine distance (km) — shared with the listing detail screen. */
export function distanceKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const PAGE_SIZE = 100;

/**
 * Global marketplace: every card listed for trade across all users (excluding
 * your own and banned users), with distance from you. `nearMe` (default on)
 * restricts to local listings and sorts by distance; turn it off to see
 * everywhere. Paginated by listing recency (infinite scroll); search/near
 * filters apply to everything loaded so far.
 */
export function useMarketplace(gameId: string, search: string, nearMe: boolean, setId?: string | null) {
  const { user, profile } = useAuth();
  const blocked = useBlockedIds();
  const meId = user?.id;
  const q = search.trim().toLowerCase();
  const myCoords: [number, number] | null =
    profile?.latitude != null && profile?.longitude != null ? [profile.latitude, profile.longitude] : null;

  const query = useInfiniteQuery({
    queryKey: ['marketplace'],
    enabled: isSupabaseConfigured,
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<any[]> => {
      const { data, error } = await supabase!
        .from('user_cards')
        .select(
          'id, condition, grade, sale_price, owner_id, card:cards(id, name, number, image_url_small, game_id, set_id), owner:profiles(id, username, display_name, avatar_url, latitude, longitude, location_name, is_banned, trades_completed)'
        )
        .eq('is_for_trade', true)
        .order('acquired_at', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);
      if (error) throw error;
      return data ?? [];
    },
    getNextPageParam: (lastPage, _all, lastPageParam) =>
      lastPage.length === PAGE_SIZE ? lastPageParam + PAGE_SIZE : undefined,
  });

  const all = useMemo<MarketListing[]>(() => {
    const raw = (query.data?.pages ?? []).flat();
    return raw
      .filter((r: any) => r.owner_id !== meId && r.card && !r.owner?.is_banned && !blocked.has(r.owner_id))
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
          setId: r.card.set_id ?? null,
          condition: r.condition,
          grade: r.grade,
          salePrice: r.sale_price != null ? Number(r.sale_price) : null,
          owner: r.owner
            ? { id: r.owner.id, username: r.owner.username, displayName: r.owner.display_name, avatarUrl: r.owner.avatar_url, tradesCompleted: r.owner.trades_completed ?? 0 }
            : null,
          ownerLocation: r.owner?.location_name ?? null,
          distanceKm: myCoords && oLat != null && oLng != null ? Math.round(distanceKm(myCoords, [oLat, oLng])) : null,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, meId, profile?.latitude, profile?.longitude]);

  let listings = all.filter(
    (l) => l.gameId === gameId && (!q || l.name.toLowerCase().includes(q)) && (!setId || l.setId === setId)
  );

  const canFilterNear = Boolean(myCoords);
  if (nearMe && canFilterNear) {
    listings = listings
      .filter((l) => l.distanceKm != null && l.distanceKm <= NEAR_RADIUS_KM)
      .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
  }

  return {
    listings,
    canFilterNear,
    isLoading: query.isLoading,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}
