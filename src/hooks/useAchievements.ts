import { useQuery } from '@tanstack/react-query';
import type { Ionicons } from '@expo/vector-icons';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';

export interface Badge {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  detail: string;
}

interface Tier {
  min: number;
  label: string;
}

// Highest tier reached wins (one badge per category), so profiles stay tidy.
const TRADE_TIERS: Tier[] = [
  { min: 100, label: 'Trade Master' },
  { min: 25, label: 'Deal Maker' },
  { min: 5, label: 'Trader' },
  { min: 1, label: 'First Trade' },
];
const COLLECTION_TIERS: Tier[] = [
  { min: 1000, label: 'Hoarder' },
  { min: 250, label: 'Curator' },
  { min: 50, label: 'Collector' },
  { min: 10, label: 'Starter' },
];
const FOLLOWER_TIERS: Tier[] = [
  { min: 100, label: 'Influencer' },
  { min: 25, label: 'Popular' },
  { min: 5, label: 'Getting Known' },
];

function highest(
  tiers: Tier[],
  n: number,
  key: string,
  icon: keyof typeof Ionicons.glyphMap,
  color: string,
  unit: string
): Badge | null {
  const t = tiers.find((x) => n >= x.min);
  return t ? { key, label: t.label, icon, color, detail: `${n} ${unit}` } : null;
}

/**
 * Gamification: badges derived from a user's public stats (completed trades,
 * collection size, followers). Trade counts come from the public
 * profiles.trades_completed counter (trades themselves aren't publicly readable).
 */
export function useAchievements(userId: string | undefined) {
  return useQuery({
    queryKey: ['achievements', userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    queryFn: async (): Promise<Badge[]> => {
      const [prof, cards, followers] = await Promise.all([
        supabase!.from('profiles').select('trades_completed').eq('id', userId!).maybeSingle(),
        supabase!.from('user_cards').select('*', { count: 'exact', head: true }).eq('owner_id', userId!),
        supabase!.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', userId!),
      ]);
      const trades = (prof.data as any)?.trades_completed ?? 0;
      const cardCount = cards.count ?? 0;
      const followerCount = followers.count ?? 0;

      return [
        highest(TRADE_TIERS, trades, 'trades', 'swap-horizontal', '#059669', 'trades'),
        highest(COLLECTION_TIERS, cardCount, 'collection', 'albums', '#2563EB', 'cards'),
        highest(FOLLOWER_TIERS, followerCount, 'followers', 'people', '#7C3AED', 'followers'),
      ].filter((b): b is Badge => b !== null);
    },
  });
}
