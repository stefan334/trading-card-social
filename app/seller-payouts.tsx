import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSellerAccount, useSellerOnboarding } from '../src/hooks/useSellerAccount';
import { useTheme } from '../src/theme';
import { track } from '../src/services/analytics';

/**
 * Seller payouts: set up / resume / inspect the Stripe Express account that
 * receives marketplace sale money. Buyers can only buy from sellers whose
 * charges are enabled, so this is the gate to "sellable" listings.
 */
export default function SellerPayoutsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: account, isLoading } = useSellerAccount();
  const { begin, refresh, busy, error } = useSellerOnboarding();

  const state: 'none' | 'pending' | 'active' = !account
    ? 'none'
    : account.chargesEnabled
      ? 'active'
      : 'pending';

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 24 + insets.bottom }]}>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 48 }} />
      ) : state === 'active' ? (
        <View style={styles.centerWrap}>
          <Ionicons name="checkmark-circle" size={56} color="#059669" />
          <Text style={[styles.title, { color: colors.text }]}>Payouts active</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>
            Your listings with a price can now be bought in the app. When a buyer confirms
            delivery, the sale amount is sent to your bank account by Stripe.
          </Text>
          {!account?.payoutsEnabled ? (
            <Text style={[styles.body, styles.warn]}>
              Stripe is still verifying your bank details — sales work, but payouts start
              once verification finishes.
            </Text>
          ) : null}
          <Pressable
            style={[styles.secondary, { borderColor: colors.border }]}
            onPress={refresh}
            disabled={busy}
          >
            <Text style={[styles.secondaryText, { color: colors.text }]}>
              {busy ? 'Refreshing…' : 'Refresh status'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="wallet-outline" size={40} color={colors.primary} />
            <Text style={[styles.title, { color: colors.text }]}>
              {state === 'none' ? 'Get paid for your cards' : 'Finish payout setup'}
            </Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>
              {state === 'none'
                ? 'Set up payouts once and buyers can purchase your listed cards directly in CardLink. Payments are held safely and released to your bank when the buyer confirms delivery.'
                : 'Stripe still needs a few details before your listings become buyable. Pick up where you left off — it takes a couple of minutes.'}
            </Text>
          </View>

          <View style={styles.points}>
            <Point icon="shield-checkmark-outline" text="Identity + bank checks are handled by Stripe — CardLink never sees your documents or card numbers." colors={colors} />
            <Point icon="cash-outline" text="You receive the full asking price. The buyer pays a small protection fee on top." colors={colors} />
            <Point icon="time-outline" text="Money is released when the buyer confirms delivery, or automatically 14 days after you ship." colors={colors} />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            style={[styles.primary, { backgroundColor: colors.primary }, busy && { opacity: 0.6 }]}
            disabled={busy}
            onPress={() => {
              track('seller_onboarding_started', { resume: state === 'pending' });
              begin();
            }}
          >
            {busy ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.primaryText}>
                {state === 'none' ? 'Set up payouts' : 'Continue setup'}
              </Text>
            )}
          </Pressable>

          {state === 'pending' ? (
            <Pressable style={styles.linkBtn} onPress={refresh} disabled={busy}>
              <Text style={[styles.linkText, { color: colors.primary }]}>I already finished — refresh status</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function Point({ icon, text, colors }: { icon: any; text: string; colors: any }) {
  return (
    <View style={styles.point}>
      <Ionicons name={icon} size={20} color={colors.textMuted} style={{ marginTop: 1 }} />
      <Text style={[styles.pointText, { color: colors.textMuted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  hero: { alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 24 },
  centerWrap: { alignItems: 'center', gap: 12, marginTop: 40, paddingHorizontal: 8 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  warn: { color: '#B45309' },
  points: { gap: 12, paddingHorizontal: 4 },
  point: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  pointText: { flex: 1, fontSize: 13, lineHeight: 18 },
  primary: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: 'white', fontSize: 16, fontWeight: '600' },
  secondary: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 8 },
  secondaryText: { fontSize: 14, fontWeight: '600' },
  linkBtn: { alignItems: 'center', paddingVertical: 4 },
  linkText: { fontSize: 14, fontWeight: '500' },
  errorText: { color: '#DC2626', fontSize: 13, textAlign: 'center' },
});
