import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  useMarkNotificationsRead,
  useNotifications,
  type NotificationItem,
} from '../src/hooks/useNotifications';
import { formatRelativeTime } from '../src/utils/time';

const TRADE_VERB: Record<string, string> = {
  proposed: 'sent you a trade offer',
  accepted: 'accepted your offer — confirm the swap',
  confirmed: 'confirmed the trade — your turn',
  completed: 'completed the trade with you',
  declined: 'declined your trade',
  cancelled: 'cancelled a trade',
};

// Leading icon + accent colour per notification type.
const ICON: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  wishlist_match: { name: 'star', color: '#B45309', bg: '#FEF3C7' },
  new_follower: { name: 'person-add', color: '#2563EB', bg: '#DBEAFE' },
  trade_update: { name: 'swap-horizontal', color: '#059669', bg: '#D1FAE5' },
};

function NotificationRow({ item }: { item: NotificationItem }) {
  const name = item.actor?.displayName || item.actor?.username || 'Someone';

  const label =
    item.type === 'wishlist_match'
      ? item.card?.name ?? 'a card'
      : item.type === 'new_follower'
        ? 'started following you'
        : TRADE_VERB[item.tradeStatus ?? ''] ?? 'updated a trade';

  const suffix = item.type === 'wishlist_match' ? ' — on your wishlist' : '';

  const href =
    item.type === 'wishlist_match' && item.card
      ? `/card/${encodeURIComponent(item.card.id)}`
      : item.type === 'trade_update' && item.tradeId
        ? `/trade/${item.tradeId}`
        : item.actor
          ? `/user/${item.actor.id}`
          : '/notifications';

  const icon = ICON[item.type] ?? { name: 'notifications', color: '#6B7280', bg: '#F3F4F6' };

  return (
    <Link href={href as any} asChild>
      <Pressable style={[styles.row, !item.readAt && styles.unread]}>
        <View style={[styles.iconCircle, { backgroundColor: icon.bg }]}>
          <Ionicons name={icon.name} size={18} color={icon.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.body}>
            <Text style={styles.name}>{name}</Text>
            {item.type === 'wishlist_match' ? ` added ${label}${suffix}` : ` ${label}`}
          </Text>
          <Text style={styles.time}>{formatRelativeTime(item.createdAt)}</Text>
        </View>
        {item.card?.imageUrlSmall ? (
          <Image source={{ uri: item.card.imageUrlSmall }} style={styles.cardThumb} />
        ) : !item.readAt ? (
          <View style={styles.unreadDot} />
        ) : null}
      </Pressable>
    </Link>
  );
}

/** Notifications list (opened from the Feed's header bell). Marks everything read on open. */
export default function NotificationsScreen() {
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
        <Text style={styles.empty}>No notifications yet.</Text>
        <Text style={styles.emptyMuted}>
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
      ItemSeparatorComponent={() => <View style={styles.sep} />}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { fontSize: 16, fontWeight: '700' },
  emptyMuted: { color: '#6B7280', textAlign: 'center', marginTop: 6, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  unread: { backgroundColor: '#EFF6FF' },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  body: { fontSize: 15, lineHeight: 21, color: '#374151' },
  name: { fontWeight: '700', color: '#111827' },
  time: { color: '#9CA3AF', fontSize: 12, marginTop: 3 },
  cardThumb: { width: 38, height: 53, borderRadius: 4 },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#2563EB' },
  sep: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 68 },
});
