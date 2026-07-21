import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase/client';

/**
 * Marketplace payments (Stripe Connect) — client glue.
 * All money logic lives in edge functions; the app only opens Stripe-hosted
 * flows and mirrors status. Fees (5% + €0.50 buyer protection) are computed
 * server-side; FEE_* constants here are display-only and must match
 * supabase/functions/stripe-checkout.
 */
export const BUYER_FEE_PERCENT = 0.05;
export const BUYER_FEE_FIXED_EUR = 0.5;

export function buyerFee(itemPrice: number): number {
  return Math.round((itemPrice * BUYER_FEE_PERCENT + BUYER_FEE_FIXED_EUR) * 100) / 100;
}

export interface SellerStatus {
  onboarded: boolean;
  details_submitted?: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
}

/** The URL the Stripe browser flow bounces back to (via stripe-redirect). */
const RETURN_URL = 'cardlink://stripe-onboard';

/**
 * Open (or resume) Stripe Express onboarding in an in-app browser tab.
 * Resolves when the tab closes; callers should then refreshSellerStatus().
 */
export async function startSellerOnboarding(): Promise<void> {
  if (!supabase) throw new Error('Not configured');
  const { data, error } = await supabase.functions.invoke('stripe-onboard', {
    body: { action: 'start' },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('No onboarding link returned');
  await WebBrowser.openAuthSessionAsync(data.url, RETURN_URL);
}

/** Re-sync seller_accounts flags from Stripe; returns the fresh status. */
export async function refreshSellerStatus(): Promise<SellerStatus> {
  if (!supabase) throw new Error('Not configured');
  const { data, error } = await supabase.functions.invoke('stripe-onboard', {
    body: { action: 'status' },
  });
  if (error) throw error;
  return data as SellerStatus;
}
