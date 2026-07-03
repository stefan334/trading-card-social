import { useQuery } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';
import type { TradeStatus } from '../types/domain';

export interface TradeParty {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface TradeItemView {
  userCardId: string;
  cardId: string;
  name: string;
  number: string;
  imageUrlSmall: string | null;
  fromUserId: string;
}

export interface TradeDetail {
  id: string;
  status: TradeStatus;
  note: string | null;
  createdAt: string;
  initiatorConfirmedAt: string | null;
  counterpartyConfirmedAt: string | null;
  initiator: TradeParty;
  counterparty: TradeParty;
  offeredByInitiator: TradeItemView[];
  offeredByCounterparty: TradeItemView[];
}

function mapParty(p: any): TradeParty {
  return { id: p.id, username: p.username, displayName: p.display_name, avatarUrl: p.avatar_url };
}

/** A single trade with both sides' offered cards, hydrated for the detail screen. */
export function useTrade(tradeId: string | undefined) {
  return useQuery({
    queryKey: ['trade', tradeId],
    enabled: isSupabaseConfigured && Boolean(tradeId),
    queryFn: async (): Promise<TradeDetail> => {
      const { data: t, error: tErr } = await supabase!
        .from('trades')
        .select(
          'id, status, note, created_at, initiator_confirmed_at, counterparty_confirmed_at, initiator_id, counterparty_id, initiator:profiles!trades_initiator_id_fkey(id, username, display_name, avatar_url), counterparty:profiles!trades_counterparty_id_fkey(id, username, display_name, avatar_url)'
        )
        .eq('id', tradeId!)
        .single();
      if (tErr) throw tErr;

      const { data: items, error: iErr } = await supabase!
        .from('trade_items')
        .select('user_card_id, from_user_id, user_card:user_cards(card:cards(id, name, number, image_url_small))')
        .eq('trade_id', tradeId!);
      if (iErr) throw iErr;

      const views: TradeItemView[] = (items ?? []).map((it: any) => ({
        userCardId: it.user_card_id,
        cardId: it.user_card?.card?.id ?? '',
        name: it.user_card?.card?.name ?? 'Unknown card',
        number: it.user_card?.card?.number ?? '',
        imageUrlSmall: it.user_card?.card?.image_url_small ?? null,
        fromUserId: it.from_user_id,
      }));

      return {
        id: t.id,
        status: t.status,
        note: t.note,
        createdAt: t.created_at,
        initiatorConfirmedAt: t.initiator_confirmed_at,
        counterpartyConfirmedAt: t.counterparty_confirmed_at,
        initiator: mapParty(t.initiator),
        counterparty: mapParty(t.counterparty),
        offeredByInitiator: views.filter((v) => v.fromUserId === t.initiator_id),
        offeredByCounterparty: views.filter((v) => v.fromUserId === t.counterparty_id),
      };
    },
  });
}
