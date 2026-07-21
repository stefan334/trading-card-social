import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import {
  useMarkNotificationsRead,
  useNotifications,
  type NotificationItem,
} from '../src/hooks/useNotifications';
import { useTheme } from '../src/theme';
import { formatRelativeTime } from '../src/utils/time';

const TRADE_VERB: Record<string, string> = {
  proposed: 'sent you a trade offer',
  accepted: 'accepted your offer — confirm the swap',
  confirmed: 'confirmed the trade — your turn',
  completed: 'completed the trade with you',
  declined: 'declined your trade',
  cancelled: 'cancelled a trade',
};

// Leading icon + accent colour per notification type (tile bg = accent @ 15%).
const ICON: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  wishlist_match: { name: 'star', color: '#F59E0B' },
  wishlist_listed: { name: 'pricetag', color: '#8B5CF6' },
  new_follower: { name: 'person-add', color: '#3B82F6' },
  trade_update: { name: 'swap-horizontal', color: '#10B981' },
};

function NotificationRow({ item }: { item: NotificationItem }) {
  const { colors } = useTheme();
  const name = item.actor?.displayName || item.actor?.username || 'Someone';

  const isWishlist = item.type === 'wishlist_match' || item.type === 'wishlist_listed';
  const label = isWishlist
    ? item.card?.name ?? 'a card'
    : item.type === 'new_follower'
      ? 'started following you'
      : TRADE_VERB[item.tradeStatus ?? ''] ?? 'updated a trade';

  const suffix = isWishlist ? ' — on your wishlist' : '';

  const href =
    isWishlist && item.card
      ? `/card/${encodeURIComponent(item.card.id)}`
      : item.type === 'trade_update' && item.tradeId
        ? `/trade/${item.tradeId}`
        : item.actor
          ? `/user/${item.actor.id}`
          : '/notifications';

  const icon = ICON[item.type] ?? { name: 'notifications' as const, color: '#6B7280' };
  const unread = !item.readAt;

  return (
    <Link href={href as any} asChild>
      {/* NOTE: style must be a plain array here — Link asChild array-wraps the
          child's style, and a function style inside an array silently breaks
          the whole row layout. */}
      <Pressable
        style={[styles.row, unread && { backgroundColor: colors.primary + '0D' }]}
        android_ripple={{ color: colors.border }}
      >
        {/* Type-tinted icon tile (accent at low alpha — works in both themes). */}
        <View style={[styles.iconTile, { backgroundColor: icon.color + '26' }]}>
          <Ionicons name={icon.name} size={17} color={icon.color} />
        </View>
        <View style={styles.middle}>
          <Text style={[styles.body, { color: colors.textMuted }]} numberOfLines={2}>
            <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
            {isWishlist ? (item.type === 'wishlist_listed' ? ' listed ' : ' added ') : ` ${label}`}
            {isWishlist ? (
              <>
                <Text style={[styles.name, { color: colors.text }]}>{label}</Text>
                {suffix}
              </>
            ) : null}
          </Text>
          <View style={styles.metaRow}>
            {unread ? <View style={styles.unreadDot} /> : null}
            <Text style={[styles.time, { color: colors.textFaint }]}>{formatRelativeTime(item.createdAt)}</Text>
          </View>
        </View>
        {item.card?.imageUrlSmall ? (
          <Image source={{ uri: item.card.imageUrlSmall }} style={[styles.cardThumb, { borderColor: colors.borderLight }]} />
        ) : (
          <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
        )}
      </Pressable>
    </Link>
  );
}

/** Notifications list (opened from the Feed's header bell). Marks everything read on open. */
export default function NotificationsScreen() {
  const { colors } = useTheme();
  const { data: items, isLoading } = useNotifications();
  const markRead = useMarkNotificationsRead();

  useEffect(() => {
    markRead.mutate();
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) return <ActivityIndicator style={styles.center} />;

  if (!items?.length) {
    return (
      <View style={styles.center}>
        <View style={[styles.emptyBell, { backgroundColor: colors.surface }]}>
          <Ionicons name="notifications-outline" size={30} color={colors.textFaint} />
        </View>
        <Text style={[styles.empty, { color: colors.text }]}>No notifications yet</Text>
        <Text style={[styles.emptyMuted, { color: colors.textMuted }]}>
          Follow collectors and wishlist cards — you’ll hear about it when they list one.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(n) => n.id}
      renderItem={({ item }) => <NotificationRow item={item} />}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: colors.borderLight }]} />}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { fontSize: 16, fontWeight: '700' },
  emptyBell: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyMuted: { color: '#6B7280', textAlign: 'center', marginTop: 6, lineHeight: 20 },
  listContent: { paddingVertical: 4 },
  // Flat rows with hairline separators — same visual language as Settings/Inbox.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  iconTile: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  middle: { flex: 1, gap: 3 },
  body: { fontSize: 15, lineHeight: 20 },
  name: { fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  time: { fontSize: 12 },
  cardThumb: { width: 42, height: 59, borderRadius: 5, borderWidth: StyleSheet.hairlineWidth },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2563EB' },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 66 },
});
