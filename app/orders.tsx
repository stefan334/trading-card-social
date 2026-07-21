import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useOrders, type OrderDetail, type OrderStatus } from '../src/hooks/useOrders';
import { useTheme } from '../src/theme';
import { formatPrice, formatRelativeTime } from '../src/utils/time';

const STATUS_META: Record<OrderStatus, { label: string; color: string }> = {
  pending_payment: { label: 'Pending', color: '#9CA3AF' },
  paid: { label: 'To ship', color: '#D97706' },
  shipped: { label: 'Shipped', color: '#2563EB' },
  completed: { label: 'Completed', color: '#059669' },
  cancelled: { label: 'Cancelled', color: '#9CA3AF' },
  refunded: { label: 'Refunded', color: '#DC2626' },
  disputed: { label: 'Problem', color: '#DC2626' },
};

/** My orders — purchases and sales in one list with a role filter. */
export default function OrdersScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { data: orders, isLoading } = useOrders();
  const [filter, setFilter] = useState<'all' | 'buyer' | 'seller'>('all');

  const visible = (orders ?? []).filter((o) => filter === 'all' || o.role === filter);

  if (isLoading) return <ActivityIndicator style={{ marginTop: 48 }} />;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.filters}>
        {(['all', 'buyer', 'seller'] as const).map((f) => (
          <Pressable
            key={f}
            style={[styles.chip, { borderColor: colors.border }, filter === f && { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.chipText, { color: filter === f ? 'white' : colors.textMuted }]}>
              {f === 'all' ? 'All' : f === 'buyer' ? 'Purchases' : 'Sales'}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={40} color={colors.textFaint} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {filter === 'seller'
                ? 'No sales yet — list a priced card with photos to sell.'
                : 'No orders yet — buy a card from the marketplace and it shows up here.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => <OrderRow order={item} onPress={() => router.push(`/order/${item.id}` as any)} />}
      />
    </View>
  );
}

function OrderRow({ order, onPress }: { order: OrderDetail; onPress: () => void }) {
  const { colors } = useTheme();
  const meta = STATUS_META[order.status];
  return (
    <Pressable style={[styles.row, { backgroundColor: colors.surface }]} onPress={onPress}>
      <Image source={{ uri: order.thumb ?? undefined }} style={styles.thumb} contentFit="cover" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{order.cardName}</Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {order.role === 'buyer' ? 'Bought' : 'Sold'} {formatRelativeTime(order.createdAt)}
          {order.setName ? ` · ${order.setName}` : ''}
        </Text>
        <Text style={[styles.price, { color: colors.text }]}>
          {formatPrice(order.role === 'buyer' ? order.total : order.itemPrice, 'EUR')}
        </Text>
      </View>
      <View style={[styles.status, { backgroundColor: meta.color + '22' }]}>
        <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 },
  chipText: { fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 12, alignItems: 'center' },
  thumb: { width: 44, height: 60, borderRadius: 6, backgroundColor: '#0002' },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12 },
  price: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  status: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 10, marginTop: 64, paddingHorizontal: 32 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
