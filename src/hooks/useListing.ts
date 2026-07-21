import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';
import { distanceKm } from './useMarketplace';

export interface ListingDetail {
  userCardId: string;
  cardId: string;
  name: string;
  number: string;
  setId: string | null;
  setName: string | null;
  imageUrlLarge: string | null;
  imageUrlSmall: string | null;
  condition: string | null;
  grade: string | null;
  finish: string | null;
  salePrice: number | null;
  listedAt: string | null;
  isForTrade: boolean;
  listingPhotos: string[];
  owner: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    tradesCompleted: number;
    locationName: string | null;
  } | null;
  distanceKm: number | null;
}

/** One marketplace listing (a specific user_cards row), fully hydrated. */
export function useListing(userCardId: string | undefined) {
  const { profile } = useAuth();
  const myCoords: [number, number] | null =
    profile?.latitude != null && profile?.longitude != null ? [profile.latitude, profile.longitude] : null;

  return useQuery({
    queryKey: ['listing', userCardId],
    enabled: isSupabaseConfigured && Boolean(userCardId),
    queryFn: async (): Promise<ListingDetail | null> => {
      const { data, error } = await supabase!
        .from('user_cards')
        .select(
          'id, condition, grade, finish, sale_price, listed_at, is_for_trade, listing_photos, card:cards(id, name, number, image_url_small, image_url_large, set_id, set:card_sets(name)), owner:profiles(id, username, display_name, avatar_url, latitude, longitude, location_name, trades_completed, is_banned)'
        )
        .eq('id', userCardId!)
        .maybeSingle();
      if (error) throw error;
      if (!data || !(data as any).card || (data as any).owner?.is_banned) return null;
      const r = data as any;
      const oLat = r.owner?.latitude != null ? Number(r.owner.latitude) : null;
      const oLng = r.owner?.longitude != null ? Number(r.owner.longitude) : null;
      return {
        userCardId: r.id,
        cardId: r.card.id,
        name: r.card.name,
        number: r.card.number,
        setId: r.card.set_id ?? null,
        setName: r.card.set?.name ?? null,
        imageUrlLarge: r.card.image_url_large,
        imageUrlSmall: r.card.image_url_small,
        condition: r.condition,
        grade: r.grade,
        finish: r.finish,
        salePrice: r.sale_price != null ? Number(r.sale_price) : null,
        listedAt: r.listed_at,
        isForTrade: r.is_for_trade,
        listingPhotos: r.listing_photos ?? [],
        owner: r.owner
          ? {
              id: r.owner.id,
              username: r.owner.username,
              displayName: r.owner.display_name,
              avatarUrl: r.owner.avatar_url,
              tradesCompleted: r.owner.trades_completed ?? 0,
              locationName: r.owner.location_name ?? null,
            }
          : null,
        distanceKm:
          myCoords && oLat != null && oLng != null ? Math.round(distanceKm(myCoords, [oLat, oLng])) : null,
      };
    },
  });
}

/** The seller's other active listings (for the "More from" strip). */
export function useSellerListings(ownerId: string | undefined, excludeUserCardId?: string) {
  return useQuery({
    queryKey: ['seller-listings', ownerId, excludeUserCardId],
    enabled: isSupabaseConfigured && Boolean(ownerId),
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('user_cards')
        .select('id, sale_price, card:cards(id, name, image_url_small)')
        .eq('owner_id', ownerId!)
        .eq('is_for_trade', true)
        .order('listed_at', { ascending: false, nullsFirst: false })
        .limit(12);
      if (error) throw error;
      return (data ?? [])
        .filter((r: any) => r.id !== excludeUserCardId && r.card)
        .map((r: any) => ({
          userCardId: r.id as string,
          cardId: r.card.id as string,
          name: r.card.name as string,
          imageUrlSmall: r.card.image_url_small as string | null,
          salePrice: r.sale_price != null ? Number(r.sale_price) : null,
        }));
    },
  });
}
