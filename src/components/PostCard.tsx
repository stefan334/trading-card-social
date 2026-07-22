import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { FeedItem } from '../hooks/useFeed';
import { PAYMENTS_ENABLED } from '../config/features';
import { supabase } from '../services/supabase/client';
import { useTheme } from '../theme';
import { formatPrice, formatRelativeTime } from '../utils/time';

/** Headline verb for an activity item. */
function headline(item: FeedItem): string {
  const n = item.cards.length;
  switch (item.type) {
    case 'card_added':
      return n > 1 ? `added ${n} cards` : 'added a card';
    case 'card_listed': {
      const price = item.body ? ` for ${formatPrice(Number(item.body), 'EUR')}` : '';
      return n > 1 ? `listed ${n} cards for trade` : `listed a card for trade${price}`;
    }
    case 'card_wishlisted':
      return n > 1 ? `added ${n} cards to their wishlist` : 'added a card to their wishlist';
    case 'card_showcase':
      return 'shared a card';
    case 'trade_completed':
      return 'completed a trade';
    default:
      return '';
  }
}

const ICON: Partial<Record<FeedItem['type'], { name: keyof typeof Ionicons.glyphMap; color: string }>> = {
  card_added: { name: 'add-circle', color: '#2563EB' },
  card_listed: { name: 'pricetag', color: '#059669' },
  card_wishlisted: { name: 'star', color: '#F59E0B' },
  trade_completed: { name: 'swap-horizontal', color: '#059669' },
};

/** A feed activity item: who did what, with the involved card(s). */
export function PostCard({ item, meId }: { item: FeedItem; meId?: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const name = item.author.displayName || item.author.username;
  const verb = headline(item);
  const icon = ICON[item.type];

  // Card taps on a "listed for trade" post open the LISTING when it's still
  // live (posts only store author+card, so resolve the user_cards row at tap
  // time); anything else — or an unlisted-since card — opens the card page.
  async function openCard(cardId: string) {
    if (item.type === 'card_listed' && supabase) {
      const { data } = await supabase
        .from('user_cards')
        .select('id')
        .eq('owner_id', item.author.id)
        .eq('card_id', cardId)
        .eq('is_for_trade', true)
        .order('listed_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (data?.id) {
        router.push(`/listing/${data.id}` as any);
        return;
      }
    }
    router.push(`/card/${encodeURIComponent(cardId)}` as any);
  }
  // A card someone else listed for trade is actionable — offer them a trade,
  // pre-filling the very card they listed when it's a single-card post.
  const [expanded, setExpanded] = useState(false);
  const canOffer = item.type === 'card_listed' && !!meId && item.author.id !== meId;

  // Buy straight from the feed: resolve the live listing row at tap time and
  // jump into checkout (which re-validates everything server-side anyway).
  // Falls back to the card page if it sold or unlisted since.
  async function buyFromFeed(cardId: string) {
    if (!supabase) return;
    const { data } = await supabase
      .from('user_cards')
      .select('id')
      .eq('owner_id', item.author.id)
      .eq('card_id', cardId)
      .eq('is_for_trade', true)
      .not('sale_price', 'is', null)
      .order('listed_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) router.push(`/checkout/${data.id}` as any);
    else router.push(`/card/${encodeURIComponent(cardId)}` as any);
  }
  const offerHref =
    `/trade/new?with=${item.author.id}` +
    (item.cards.length === 1 ? `&card=${encodeURIComponent(item.cards[0].id)}` : '');

  // Follow the author right from the feed (for suggested/non-followed people).
  const qc = useQueryClient();
  const [followed, setFollowed] = useState(item.authorFollowed);
  const follow = useMutation({
    mutationFn: async () => {
      if (!supabase || !meId) return;
      const { error } = await supabase.from('follows').insert({ follower_id: meId, followee_id: item.author.id });
      if (error) throw error;
    },
    onSuccess: () => {
      setFollowed(true);
      qc.invalidateQueries({ queryKey: ['isFollowing', meId, item.author.id] });
      qc.invalidateQueries({ queryKey: ['profile', item.author.id] });
    },
  });
  const showFollow = !!meId && item.author.id !== meId && !followed;

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        {item.author.avatarUrl ? (
          <Image source={{ uri: item.author.avatarUrl }} style={styles.avatar} />
        ) : (
          <Ionicons name="person-circle" size={36} color="#9CA3AF" />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>
            <Link href={`/user/${item.author.id}`} style={[styles.nameLink, { color: colors.text }]}>{name}</Link>
            {verb ? <Text style={[styles.verb, { color: colors.textMuted }]}> {verb}</Text> : null}
          </Text>
          <Text style={[styles.time, { color: colors.textFaint }]}>{formatRelativeTime(item.createdAt)}</Text>
        </View>
        {showFollow ? (
          <Pressable
            style={[styles.followBtn, { borderColor: colors.primary }]}
            onPress={() => follow.mutate()}
            disabled={follow.isPending}
            hitSlop={6}
          >
            {follow.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons name="person-add" size={13} color={colors.primary} />
                <Text style={[styles.followText, { color: colors.primary }]}>Follow</Text>
              </>
            )}
          </Pressable>
        ) : icon ? (
          <Ionicons name={icon.name} size={18} color={icon.color} />
        ) : null}
      </View>

      {item.body && item.type === 'text' ? (
        <Text style={[styles.textBody, { color: colors.text }]}>{item.body}</Text>
      ) : null}

      {item.cards.length === 1 ? (
        // Single card: a bigger hero image + name — the card is the story.
        <Pressable style={styles.heroWrap} onPress={() => openCard(item.cards[0].id)}>
          {item.cards[0].imageUrlSmall ? (
            <Image source={{ uri: item.cards[0].imageUrlSmall }} style={styles.heroImage} />
          ) : (
            <View style={[styles.heroImage, styles.placeholder]} />
          )}
          <Text style={[styles.heroName, { color: colors.textMuted }]} numberOfLines={1}>
            {item.cards[0].name}
          </Text>
        </Pressable>
      ) : item.cards.length > 0 ? (
        expanded ? (
          // Full burst, laid out as a wrapping grid — every card tappable.
          <>
            <View style={styles.cardWrapGrid}>
              {item.cards.map((c, i) => (
                <Pressable key={`${c.id}-${i}`} onPress={() => openCard(c.id)}>
                  {c.imageUrlSmall ? (
                    <Image source={{ uri: c.imageUrlSmall }} style={styles.cardImage} />
                  ) : (
                    <View style={[styles.cardImage, styles.placeholder]} />
                  )}
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setExpanded(false)} style={styles.showToggle} hitSlop={6}>
              <Ionicons name="chevron-up" size={14} color={colors.primary} />
              <Text style={[styles.showToggleText, { color: colors.primary }]}>Show less</Text>
            </Pressable>
          </>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
            {item.cards.slice(0, 8).map((c, i) => (
              <Pressable key={`${c.id}-${i}`} onPress={() => openCard(c.id)}>
                {c.imageUrlSmall ? (
                  <Image source={{ uri: c.imageUrlSmall }} style={styles.cardImage} />
                ) : (
                  <View style={[styles.cardImage, styles.placeholder]} />
                )}
              </Pressable>
            ))}
            {item.cards.length > 8 ? (
              <Pressable
                style={[styles.cardImage, styles.moreTile, { backgroundColor: colors.surface }]}
                onPress={() => setExpanded(true)}
              >
                <Text style={[styles.moreText, { color: colors.primary }]}>+{item.cards.length - 8}</Text>
                <Text style={[styles.moreHint, { color: colors.textFaint }]}>view all</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        )
      ) : null}

      {canOffer ? (
        <View style={styles.actionRow}>
          {PAYMENTS_ENABLED && item.body && item.cards.length === 1 ? (
            <Pressable style={[styles.offerBtn, styles.buyBtn]} onPress={() => buyFromFeed(item.cards[0].id)}>
              <Ionicons name="bag-check" size={16} color="white" />
              <Text style={styles.offerText}>Buy {formatPrice(Number(item.body), 'EUR')}</Text>
            </Pressable>
          ) : null}
          <Link href={offerHref as any} asChild>
            <Pressable style={[styles.offerBtn, item.body && item.cards.length === 1 && { flex: 1 }]}>
              <Ionicons name="swap-horizontal" size={16} color="white" />
              <Text style={styles.offerText}>Offer cards</Text>
            </Pressable>
          </Link>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'white', padding: 14, marginHorizontal: 12, marginTop: 12, borderRadius: 14 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  buyBtn: { backgroundColor: '#059669', flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  name: { fontSize: 15 },
  nameLink: { fontWeight: '700', color: '#111827' },
  verb: { fontWeight: '400', color: '#6B7280' },
  time: { color: '#9CA3AF', fontSize: 12, marginTop: 1 },
  textBody: { marginTop: 10, lineHeight: 20 },
  cardRow: { gap: 8, paddingTop: 12 },
  cardImage: { width: 74, height: 103, borderRadius: 6 },
  heroWrap: { alignSelf: 'flex-start', paddingTop: 12 },
  heroImage: { width: 148, height: 206, borderRadius: 10 },
  heroName: { fontSize: 12, fontWeight: '600', marginTop: 5, maxWidth: 148 },
  moreTile: { alignItems: 'center', justifyContent: 'center', gap: 1 },
  moreText: { fontWeight: '800', fontSize: 15 },
  moreHint: { fontSize: 10, fontWeight: '600' },
  cardWrapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 12 },
  showToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 10 },
  showToggleText: { fontWeight: '600', fontSize: 13 },
  placeholder: { backgroundColor: '#E5E7EB' },
  offerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 10, flexGrow: 1 },
  offerText: { color: 'white', fontWeight: '700', fontSize: 14 },
  followBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#2563EB', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  followText: { color: '#2563EB', fontWeight: '700', fontSize: 13 },
});
