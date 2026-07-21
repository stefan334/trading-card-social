import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListing } from '../../src/hooks/useListing';
import { useKeyboardHeight } from '../../src/hooks/useKeyboardHeight';
import { buyerFee, createCheckout, type ShippingAddress } from '../../src/services/payments';
import { track } from '../../src/services/analytics';
import { useTheme } from '../../src/theme';
import { formatPrice } from '../../src/utils/time';

// Native module guard: binaries built without Stripe just can't check out.
let useStripeSheet: null | (() => {
  initPaymentSheet: (opts: any) => Promise<{ error?: any }>;
  presentPaymentSheet: () => Promise<{ error?: any }>;
}) = null;
try {
  const stripe = require('@stripe/stripe-react-native');
  useStripeSheet = () => {
    const { initPaymentSheet, presentPaymentSheet } = stripe.useStripe();
    return { initPaymentSheet, presentPaymentSheet };
  };
} catch {
  /* checkout disabled in this binary */
}

/**
 * Checkout for one listing: delivery address + price breakdown + PaymentSheet.
 * The stripe-checkout edge function re-validates everything server-side; this
 * screen's job is honest numbers and a clean handoff to Stripe's UI.
 */
export default function CheckoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const { data: listing, isLoading } = useListing(id);
  const sheet = useStripeSheet?.();

  const [addr, setAddr] = useState({
    name: '', line1: '', line2: '', city: '', county: '', postal_code: '', phone: '',
  });
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (isLoading) return <ActivityIndicator style={styles.center} />;
  if (!listing || listing.salePrice == null) {
    return <Text style={[styles.center, { color: colors.textMuted }]}>This listing is gone.</Text>;
  }

  const item = listing.salePrice;
  const fee = buyerFee(item);
  const total = Math.round((item + fee) * 100) / 100;
  const required: (keyof typeof addr)[] = ['name', 'line1', 'city', 'postal_code'];
  const addressOk = required.every((k) => addr[k].trim().length > 0);

  async function pay() {
    if (!sheet) {
      setError('This build does not support payments yet — update the app.');
      return;
    }
    setPaying(true);
    setError(null);
    try {
      const address: ShippingAddress = {
        name: addr.name.trim(),
        line1: addr.line1.trim(),
        line2: addr.line2.trim() || undefined,
        city: addr.city.trim(),
        county: addr.county.trim() || undefined,
        postal_code: addr.postal_code.trim(),
        phone: addr.phone.trim() || undefined,
      };
      const session = await createCheckout(listing!.userCardId, address);

      const init = await sheet.initPaymentSheet({
        paymentIntentClientSecret: session.client_secret,
        merchantDisplayName: 'CardLink',
      });
      if (init.error) throw new Error(init.error.message ?? 'Payment setup failed');

      const result = await sheet.presentPaymentSheet();
      if (result.error) {
        // Canceled is a normal outcome, not an error banner.
        if (result.error.code !== 'Canceled') {
          throw new Error(result.error.message ?? 'Payment failed');
        }
        return;
      }
      track('order_paid', { listingId: listing!.userCardId, total });
      setDone(true);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong');
    } finally {
      setPaying(false);
    }
  }

  if (done) {
    return (
      <View style={styles.doneWrap}>
        <Ionicons name="checkmark-circle" size={64} color="#059669" />
        <Text style={[styles.doneTitle, { color: colors.text }]}>Payment complete!</Text>
        <Text style={[styles.doneText, { color: colors.textMuted }]}>
          {`The seller has been notified to ship ${listing.name}. Your money is held safely and only released after you confirm delivery.`}
        </Text>
        <Pressable style={[styles.payBtn, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
          <Text style={styles.payText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  const input = (key: keyof typeof addr, placeholder: string, opts: object = {}) => (
    <TextInput
      style={[styles.input, { borderColor: colors.border, color: colors.text }]}
      placeholder={placeholder}
      placeholderTextColor={colors.textFaint}
      value={addr[key]}
      onChangeText={(v) => setAddr((p) => ({ ...p, [key]: v }))}
      {...opts}
    />
  );

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: 24 + Math.max(insets.bottom, keyboardHeight) }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* What you're buying */}
      <View style={[styles.itemRow, { backgroundColor: colors.surface }]}>
        <Image
          source={{ uri: listing.listingPhotos[0] ?? listing.imageUrlSmall ?? undefined }}
          style={styles.itemThumb}
          contentFit="cover"
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={2}>{listing.name}</Text>
          {listing.setName ? (
            <Text style={[styles.itemMeta, { color: colors.textMuted }]}>{listing.setName}</Text>
          ) : null}
        </View>
      </View>

      {/* Delivery address (seller ships to this; shipping included in price v1) */}
      <Text style={[styles.section, { color: colors.text }]}>Delivery address</Text>
      {input('name', 'Full name')}
      {input('line1', 'Street + number')}
      {input('line2', 'Apartment, floor (optional)')}
      <View style={styles.row2}>
        <View style={{ flex: 2 }}>{input('city', 'City')}</View>
        <View style={{ flex: 1 }}>{input('postal_code', 'Postal code', { keyboardType: 'number-pad' })}</View>
      </View>
      {input('county', 'County (optional)')}
      {input('phone', 'Phone (optional, for the courier)', { keyboardType: 'phone-pad' })}

      {/* The honest math */}
      <Text style={[styles.section, { color: colors.text }]}>Summary</Text>
      <View style={[styles.summary, { backgroundColor: colors.surface }]}>
        <SummaryRow label="Card" value={formatPrice(item, 'EUR')} colors={colors} />
        <SummaryRow label="Buyer protection" value={formatPrice(fee, 'EUR')} colors={colors} />
        <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
        <SummaryRow label="Total" value={formatPrice(total, 'EUR')} colors={colors} bold />
      </View>
      <Text style={[styles.protectNote, { color: colors.textMuted }]}>
        Buyer protection holds your payment until you confirm the card arrived as described.
        Shipping is arranged by the seller and included in the price.
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable
        style={[styles.payBtn, { backgroundColor: colors.primary }, (!addressOk || paying) && { opacity: 0.5 }]}
        disabled={!addressOk || paying}
        onPress={pay}
      >
        {paying ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.payText}>Pay {formatPrice(total, 'EUR')}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function SummaryRow({ label, value, colors, bold }: { label: string; value: string; colors: any; bold?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: bold ? colors.text : colors.textMuted }, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: colors.text }, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { marginTop: 64, textAlign: 'center' },
  container: { padding: 16, gap: 10 },
  itemRow: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 12, alignItems: 'center' },
  itemThumb: { width: 48, height: 66, borderRadius: 6, backgroundColor: '#0002' },
  itemName: { fontSize: 15, fontWeight: '600' },
  itemMeta: { fontSize: 12, marginTop: 2 },
  section: { fontSize: 15, fontWeight: '700', marginTop: 10 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  row2: { flexDirection: 'row', gap: 10 },
  summary: { borderRadius: 12, padding: 14, gap: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14 },
  bold: { fontWeight: '700', fontSize: 15 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  protectNote: { fontSize: 12, lineHeight: 17 },
  errorText: { color: '#DC2626', fontSize: 13, textAlign: 'center', marginTop: 4 },
  payBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  payText: { color: 'white', fontSize: 16, fontWeight: '700' },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  doneTitle: { fontSize: 22, fontWeight: '700' },
  doneText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
