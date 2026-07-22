import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';
import { refreshSellerStatus, startSellerOnboarding } from '../services/payments';

export interface SellerAccount {
  stripeAccountId: string;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  /** Can SELL (funds land in their balance) — the light, upfront stage. */
  transfersActive: boolean;
}

/** The signed-in user's Stripe Express payout state (null = never started). */
export function useSellerAccount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['seller-account', user?.id],
    enabled: isSupabaseConfigured && Boolean(user?.id),
    queryFn: async (): Promise<SellerAccount | null> => {
      const { data, error } = await supabase!
        .from('seller_accounts')
        .select('stripe_account_id, details_submitted, charges_enabled, payouts_enabled, transfers_active')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        stripeAccountId: data.stripe_account_id,
        detailsSubmitted: data.details_submitted,
        chargesEnabled: data.charges_enabled,
        payoutsEnabled: data.payouts_enabled,
        transfersActive: data.transfers_active || data.charges_enabled,
      };
    },
  });
}

/**
 * Drives the onboarding browser round-trip: opens Stripe, and on return pulls
 * fresh status into the seller-account query.
 */
export function useSellerOnboarding() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function begin() {
    setBusy(true);
    setError(null);
    try {
      await startSellerOnboarding();
      await refreshSellerStatus();
      await queryClient.invalidateQueries({ queryKey: ['seller-account', user?.id] });
    } catch (e: any) {
      setError(e?.message ?? 'Could not open Stripe onboarding');
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      await refreshSellerStatus();
      await queryClient.invalidateQueries({ queryKey: ['seller-account', user?.id] });
    } catch (e: any) {
      setError(e?.message ?? 'Could not refresh status');
    } finally {
      setBusy(false);
    }
  }

  return { begin, refresh, busy, error };
}
