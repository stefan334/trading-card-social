import { useQuery } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';

export interface BinderCard {
  binderCardId: string;
  cardId: string;
  name: string;
  number: string;
  imageUrlSmall: string | null;
  imageUrlLarge: string | null;
  position: number;
}

export interface BinderDetail {
  id: string;
  ownerId: string;
  name: string;
  coverCardId: string | null;
  cards: BinderCard[];
}

/** A single binder with its ordered cards (for the viewer/editor). */
export function useBinder(binderId: string | undefined) {
  return useQuery({
    queryKey: ['binder', binderId],
    enabled: isSupabaseConfigured && Boolean(binderId),
    queryFn: async (): Promise<BinderDetail> => {
      const { data: b, error: bErr } = await supabase!
        .from('binders')
        .select('id, owner_id, name, cover_card_id')
        .eq('id', binderId!)
        .single();
      if (bErr) throw bErr;

      const { data: cards, error: cErr } = await supabase!
        .from('binder_cards')
        .select('id, position, card:cards(id, name, number, image_url_small, image_url_large)')
        .eq('binder_id', binderId!)
        .order('position', { ascending: true });
      if (cErr) throw cErr;

      return {
        id: b.id,
        ownerId: b.owner_id,
        name: b.name,
        coverCardId: b.cover_card_id,
        cards: (cards ?? []).map((r: any) => ({
          binderCardId: r.id,
          cardId: r.card.id,
          name: r.card.name,
          number: r.card.number,
          imageUrlSmall: r.card.image_url_small,
          imageUrlLarge: r.card.image_url_large,
          position: r.position,
        })),
      };
    },
  });
}
