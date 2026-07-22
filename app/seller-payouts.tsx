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

  // Staged: selling unlocks with the light identity pass (transfers); bank +
  // remaining KYC only gate WITHDRAWING, once money is already waiting.
  const state: 'none' | 'pending' | 'active' = !account
    ? 'none'
    : account.transfersActive
      ? 'active'
      : 'pending';

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 24 + insets.bottom }]}>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 48 }} />
      ) : state === 'active' ? (
        <View style={styles.centerWrap}>
          <Ionicons name="checkmark-circle" size={56} color="#059669" />
          <Text style={[styles.title, { color: colors.text }]}>You can sell!</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>
            Your priced listings are now buyable. When a buyer confirms delivery, the money
            lands in your seller balance.
          </Text>
          {!account?.payoutsEnabled ? (
            <>
              <View style={styles.stageBox}>
                <Ionicons name="cash-outline" size={18} color="#B45309" />
                <Text style={styles.stageText}>
                  To move money from your balance to your bank, add your bank details when
                  you're ready — takes a minute, once.
                </Text>
              </View>
              <Pressable
                style={[styles.primary, { backgroundColor: colors.primary }, busy && { opacity: 0.6 }]}
                disabled={busy}
                onPress={() => {
                  track('seller_withdrawal_setup_started', {});
                  begin();
                }}
              >
                {busy ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>Add bank details for withdrawals</Text>}
              </Pressable>
            </>
          ) : (
            <Text style={[styles.body, { color: '#059669' }]}>
              Withdrawals are set up — Stripe pays your balance out to your bank automatically.
            </Text>
          )}
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
            <Point icon="flash-outline" text="Quick start: just name, birth date and address — no bank account needed to begin selling." colors={colors} />
            <Point icon="shield-checkmark-outline" text="Checks are handled by Stripe (required by EU law for receiving money) — CardLink never sees your documents." colors={colors} />
            <Point icon="cash-outline" text="You receive the full asking price into your seller balance; add bank details whenever you want to withdraw." colors={colors} />
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
  stageBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#B4530922',
    borderRadius: 10, padding: 12, marginTop: 8,
  },
  stageText: { flex: 1, color: '#B45309', fontSize: 13, lineHeight: 18 },
});
