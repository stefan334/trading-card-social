import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SupabaseSetupNotice } from '../../src/components/SupabaseSetupNotice';
import { useAuth } from '../../src/context/AuthContext';
import { useInbox, type InboxItem } from '../../src/hooks/useInbox';
import { isSupabaseConfigured } from '../../src/services/supabase/client';
import { useTheme } from '../../src/theme';
import type { TradeStatus } from '../../src/types/domain';
import { formatRelativeTime } from '../../src/utils/time';

const STATUS_COLOR: Record<TradeStatus, string> = {
  proposed: '#2563EB', countered: '#B45309', accepted: '#0891B2',
  completed: '#059669', declined: '#6B7280', cancelled: '#6B7280',
};

function Row({ item }: { item: InboxItem }) {
  const { colors } = useTheme();
  return (
    <Link href={item.href as any} asChild>
      <Pressable style={styles.row}>
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
        ) : (
          <Ionicons name="person-circle" size={46} color="#9CA3AF" />
        )}
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Ionicons
              name={item.kind === 'trade' ? 'swap-horizontal' : 'chatbubble-ellipses'}
              size={14}
              color="#9CA3AF"
            />
            <Text style={[styles.name, { color: colors.text }]}>{item.title}</Text>
          </View>
          <Text style={[styles.sub, { color: item.unread > 0 ? colors.text : colors.textMuted }]} numberOfLines={1}>
            {item.subtitle}
          </Text>
        </View>
        <View style={styles.meta}>
          {item.timestamp ? <Text style={[styles.time, { color: colors.textFaint }]}>{formatRelativeTime(item.timestamp)}</Text> : null}
          {item.kind === 'trade' && item.status ? (
            <Text style={[styles.status, { color: STATUS_COLOR[item.status] }]}>{item.status}</Text>
          ) : null}
          {item.needsAction ? <View style={styles.actionDot} /> : null}
          {item.unread > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.unread > 9 ? '9+' : item.unread}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}

type InboxFilter = 'all' | 'dm' | 'trade';
const FILTERS: { key: InboxFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'dm', label: 'Chats' },
  { key: 'trade', label: 'Trades' },
];

/** Inbox tab: trades + direct messages in one place (see useInbox). */
export default function InboxScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { items, isLoading } = useInbox();
  const [filter, setFilter] = useState<InboxFilter>('all');

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => i.kind === filter)),
    [items, filter]
  );

  if (!isSupabaseConfigured) {
    return (
      <View style={styles.container}>
        <SupabaseSetupNotice />
      </View>
    );
  }
  if (!user) return <Text style={[styles.muted, { color: colors.textMuted }]}>Sign in to see your trades and messages.</Text>;
  if (isLoading) return <ActivityIndicator style={{ marginTop: 24 }} />;

  if (!items.length) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing here yet</Text>
        <Text style={[styles.muted, { color: colors.textMuted }]}>
          Open a collector's profile to propose a trade or send a message — they'll show up here.
        </Text>
        <Link href="/search?mode=users" asChild>
          <Pressable style={styles.findButton}>
            <Text style={styles.findText}>Find collectors</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Chats / trades filter — the inbox mixes both, let people split them. */}
      <View style={[styles.filterBar, { backgroundColor: colors.surface }]}>
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <Pressable
              key={f.key}
              style={[styles.filterBtn, on && { backgroundColor: colors.card }]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterText, { color: on ? colors.text : colors.textMuted }]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.key}
        renderItem={({ item }) => <Row item={item} />}
        ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: colors.borderLight }]} />}
        ListEmptyComponent={
          <Text style={[styles.muted, { color: colors.textMuted, marginTop: 24 }]}>
            {filter === 'dm' ? 'No chats yet.' : 'No trades yet.'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  muted: { color: '#6B7280', textAlign: 'center', lineHeight: 20, marginHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontSize: 15, fontWeight: '700' },
  sub: { color: '#6B7280', marginTop: 2 },
  subUnread: { color: '#111827', fontWeight: '600' },
  meta: { alignItems: 'flex-end', gap: 3 },
  time: { color: '#9CA3AF', fontSize: 12 },
  status: { fontWeight: '700', fontSize: 11, textTransform: 'capitalize' },
  actionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC2626' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: 'white', fontSize: 11, fontWeight: '700' },
  sep: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 72 },
  filterBar: { flexDirection: 'row', margin: 12, marginBottom: 4, borderRadius: 10, padding: 3, gap: 3 },
  filterBtn: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
  filterText: { fontWeight: '700', fontSize: 13 },
  findButton: { marginTop: 20, backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  findText: { color: 'white', fontWeight: '700' },
});
