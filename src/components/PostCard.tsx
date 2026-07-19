import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { FeedItem } from '../hooks/useFeed';
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
  const name = item.author.displayName || item.author.username;
  const verb = headline(item);
  const icon = ICON[item.type];
  // A card someone else listed for trade is actionable — offer them a trade,
  // pre-filling the very card they listed when it's a single-card post.
  const canOffer = item.type === 'card_listed' && !!meId && item.author.id !== meId;
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

      {item.cards.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
          {item.cards.map((c, i) => (
            <Link key={`${c.id}-${i}`} href={`/card/${encodeURIComponent(c.id)}`} asChild>
              <Pressable>
                {c.imageUrlSmall ? (
                  <Image source={{ uri: c.imageUrlSmall }} style={styles.cardImage} />
                ) : (
                  <View style={[styles.cardImage, styles.placeholder]} />
                )}
              </Pressable>
            </Link>
          ))}
        </ScrollView>
      ) : null}

      {canOffer ? (
        <Link href={offerHref as any} asChild>
          <Pressable style={styles.offerBtn}>
            <Ionicons name="swap-horizontal" size={16} color="white" />
            <Text style={styles.offerText}>Make an offer</Text>
          </Pressable>
        </Link>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'white', padding: 14, marginHorizontal: 12, marginTop: 12, borderRadius: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  name: { fontSize: 15 },
  nameLink: { fontWeight: '700', color: '#111827' },
  verb: { fontWeight: '400', color: '#6B7280' },
  time: { color: '#9CA3AF', fontSize: 12, marginTop: 1 },
  textBody: { marginTop: 10, lineHeight: 20 },
  cardRow: { gap: 8, paddingTop: 12 },
  cardImage: { width: 74, height: 103, borderRadius: 6 },
  placeholder: { backgroundColor: '#E5E7EB' },
  offerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#059669', borderRadius: 10, paddingVertical: 10, marginTop: 12 },
  offerText: { color: 'white', fontWeight: '700', fontSize: 14 },
  followBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#2563EB', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  followText: { color: '#2563EB', fontWeight: '700', fontSize: 13 },
});
