import { useQuery } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';

export interface BinderSummary {
  id: string;
  name: string;
  cardCount: number;
  coverImageUrl: string | null;
}

/** A user's binders with a cover image + card count, for the profile highlights row. */
export function useBinders(userId: string | undefined) {
  return useQuery({
    queryKey: ['binders', userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    queryFn: async (): Promise<BinderSummary[]> => {
      const { data, error } = await supabase!
        .from('binders')
        .select('id, name, cover:cards!binders_cover_card_id_fkey(image_url_small), binder_cards(card_id, position, card:cards(image_url_small))')
        .eq('owner_id', userId!)
        .order('position', { ascending: true });
      if (error) throw error;

      return (data ?? []).map((b: any) => {
        const cards = (b.binder_cards ?? []).sort((x: any, y: any) => x.position - y.position);
        const cover = b.cover?.image_url_small ?? cards[0]?.card?.image_url_small ?? null;
        return { id: b.id, name: b.name, cardCount: cards.length, coverImageUrl: cover };
      });
    },
  });
}
