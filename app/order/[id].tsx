import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMarkShipped, useOrder, useReleaseOrder } from '../../src/hooks/useOrders';
import { useTheme } from '../../src/theme';
import { formatPrice } from '../../src/utils/time';

/**
 * Order detail: the shared source of truth for a purchase. Buyer and seller see
 * the same timeline; the available action depends on role + status:
 *   seller & paid     -> mark shipped (+ tracking)
 *   buyer  & shipped  -> confirm received (releases the money)
 *   seller & shipped  -> claim payment, but only after auto_release_at
 */
export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: order, isLoading } = useOrder(id);
  const markShipped = useMarkShipped();
  const release = useReleaseOrder();
  const [tracking, setTracking] = useState('');

  if (isLoading) return <ActivityIndicator style={{ marginTop: 48 }} />;
  if (!order) return <Text style={[styles.center, { color: colors.textMuted }]}>Order not found.</Text>;

  const pastDue = order.autoReleaseAt != null && Date.now() >= new Date(order.autoReleaseAt).getTime();
  const canShip = order.role === 'seller' && order.status === 'paid';
  const canConfirm = order.role === 'buyer' && order.status === 'shipped';
  const canClaim = order.role === 'seller' && order.status === 'shipped' && pastDue;

  const steps = [
    { label: 'Paid', at: order.paidAt },
    { label: 'Shipped', at: order.shippedAt },
    { label: 'Completed', at: order.completedAt },
  ];

  function confirmReceived() {
    Alert.alert(
      'Confirm delivery?',
      `This releases ${formatPrice(order!.itemPrice, 'EUR')} to the seller. Only confirm once the card arrived as described.`,
      [
        { text: 'Not yet', style: 'cancel' },
        { text: 'Confirm', onPress: () => release.mutate({ orderId: order!.id }) },
      ]
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 24 + insets.bottom }]}>
      {/* Card */}
      <View style={[styles.itemRow, { backgroundColor: colors.surface }]}>
        <Image source={{ uri: order.thumb ?? undefined }} style={styles.thumb} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>{order.cardName}</Text>
          {order.setName ? <Text style={[styles.meta, { color: colors.textMuted }]}>{order.setName}</Text> : null}
          <Text style={[styles.role, { color: colors.textMuted }]}>
            {order.role === 'buyer' ? 'You bought this card' : 'You sold this card'}
          </Text>
        </View>
      </View>

      {/* Timeline */}
      <View style={[styles.box, { backgroundColor: colors.surface }]}>
        {steps.map((s, i) => (
          <View key={s.label} style={styles.step}>
            <Ionicons
              name={s.at ? 'checkmark-circle' : 'ellipse-outline'}
              size={18}
              color={s.at ? '#059669' : colors.textFaint}
            />
            <Text style={[styles.stepLabel, { color: s.at ? colors.text : colors.textMuted }]}>{s.label}</Text>
            {s.at ? (
              <Text style={[styles.stepAt, { color: colors.textMuted }]}>{new Date(s.at).toLocaleDateString()}</Text>
            ) : null}
          </View>
        ))}
        {['cancelled', 'refunded', 'disputed'].includes(order.status) ? (
          <Text style={[styles.terminal, { color: '#DC2626' }]}>
            This order is {order.status}.
          </Text>
        ) : null}
        {order.status === 'shipped' && order.autoReleaseAt ? (
          <Text style={[styles.autoNote, { color: colors.textMuted }]}>
            {order.role === 'buyer'
              ? `If you don't confirm, payment auto-releases on ${new Date(order.autoReleaseAt).toLocaleDateString()}.`
              : `Payment releases when the buyer confirms, or automatically on ${new Date(order.autoReleaseAt).toLocaleDateString()}.`}
          </Text>
        ) : null}
      </View>

      {/* Money */}
      <View style={[styles.box, { backgroundColor: colors.surface }]}>
        <Row label="Card" value={formatPrice(order.itemPrice, 'EUR')} colors={colors} />
        {order.role === 'buyer' ? (
          <>
            <Row label="Buyer protection" value={formatPrice(order.buyerFee, 'EUR')} colors={colors} />
            <Row label="Total paid" value={formatPrice(order.total, 'EUR')} colors={colors} bold />
          </>
        ) : (
          <Row label="You receive" value={formatPrice(order.itemPrice, 'EUR')} colors={colors} bold />
        )}
      </View>

      {/* Shipping */}
      {order.shippingAddress ? (
        <View style={[styles.box, { backgroundColor: colors.surface }]}>
          <Text style={[styles.boxTitle, { color: colors.text }]}>
            {order.role === 'seller' ? 'Ship to' : 'Delivery address'}
          </Text>
          <Text style={[styles.addr, { color: colors.textMuted }]}>
            {[
              order.shippingAddress.name,
              order.shippingAddress.line1,
              order.shippingAddress.line2,
              `${order.shippingAddress.postal_code ?? ''} ${order.shippingAddress.city ?? ''}`.trim(),
              order.shippingAddress.county,
              order.shippingAddress.phone,
            ]
              .filter(Boolean)
              .join('\n')}
          </Text>
          {order.trackingRef ? (
            <Text style={[styles.tracking, { color: colors.text }]}>Tracking: {order.trackingRef}</Text>
          ) : null}
        </View>
      ) : null}

      {/* Actions */}
      {canShip ? (
        <View style={styles.actionBlock}>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            placeholder="Tracking number (optional)"
            placeholderTextColor={colors.textFaint}
            value={tracking}
            onChangeText={setTracking}
          />
          <Pressable
            style={[styles.primary, { backgroundColor: colors.primary }, markShipped.isPending && { opacity: 0.6 }]}
            disabled={markShipped.isPending}
            onPress={() => markShipped.mutate({ orderId: order.id, tracking: tracking.trim() || undefined })}
          >
            {markShipped.isPending ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>Mark as shipped</Text>}
          </Pressable>
        </View>
      ) : null}

      {canConfirm ? (
        <Pressable
          style={[styles.primary, { backgroundColor: '#059669' }, release.isPending && { opacity: 0.6 }]}
          disabled={release.isPending}
          onPress={confirmReceived}
        >
          {release.isPending ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>Confirm received</Text>}
        </Pressable>
      ) : null}

      {canClaim ? (
        <Pressable
          style={[styles.primary, { backgroundColor: colors.primary }, release.isPending && { opacity: 0.6 }]}
          disabled={release.isPending}
          onPress={() => release.mutate({ orderId: order.id })}
        >
          {release.isPending ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>Claim payment</Text>}
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function Row({ label, value, colors, bold }: { label: string; value: string; colors: any; bold?: boolean }) {
  return (
    <View style={styles.moneyRow}>
      <Text style={[{ fontSize: 14, color: bold ? colors.text : colors.textMuted }, bold && styles.bold]}>{label}</Text>
      <Text style={[{ fontSize: 14, color: colors.text }, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { marginTop: 64, textAlign: 'center' },
  container: { padding: 16, gap: 12 },
  itemRow: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 12, alignItems: 'center' },
  thumb: { width: 56, height: 78, borderRadius: 8, backgroundColor: '#0002' },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  role: { fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  box: { borderRadius: 12, padding: 14, gap: 8 },
  boxTitle: { fontSize: 14, fontWeight: '700' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepLabel: { fontSize: 14, flex: 1 },
  stepAt: { fontSize: 12 },
  terminal: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  autoNote: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  moneyRow: { flexDirection: 'row', justifyContent: 'space-between' },
  bold: { fontWeight: '700', fontSize: 15 },
  addr: { fontSize: 13, lineHeight: 19 },
  tracking: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  actionBlock: { gap: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  primary: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: 'white', fontSize: 15, fontWeight: '700' },
});
