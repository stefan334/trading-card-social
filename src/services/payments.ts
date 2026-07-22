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

/** Non-2xx edge responses carry the reason in the body — surface it. */
async function unwrapFunctionError(error: unknown): Promise<Error> {
  const ctx = (error as any)?.context;
  if (ctx?.json) {
    const body = await ctx.json().catch(() => null);
    if (body?.error) return new Error(body.error);
  }
  return error instanceof Error ? error : new Error('Request failed');
}

/**
 * Open (or resume) Stripe Express onboarding in an in-app browser tab.
 * Resolves when the tab closes; callers should then refreshSellerStatus().
 */
export async function startSellerOnboarding(): Promise<void> {
  if (!supabase) throw new Error('Not configured');
  const { data, error } = await supabase.functions.invoke('stripe-onboard', {
    body: { action: 'start' },
  });
  if (error) throw await unwrapFunctionError(error);
  if (!data?.url) throw new Error('No onboarding link returned');
  await WebBrowser.openAuthSessionAsync(data.url, RETURN_URL);
}

/** Re-sync seller_accounts flags from Stripe; returns the fresh status. */
export async function refreshSellerStatus(): Promise<SellerStatus> {
  if (!supabase) throw new Error('Not configured');
  const { data, error } = await supabase.functions.invoke('stripe-onboard', {
    body: { action: 'status' },
  });
  if (error) throw await unwrapFunctionError(error);
  return data as SellerStatus;
}

export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  county?: string;
  postal_code: string;
  phone?: string;
}

export interface CheckoutSession {
  client_secret: string;
  order_id: string;
  item_price: number;
  buyer_fee: number;
  total: number;
}

/** Server-validated checkout: creates the pending order + PaymentIntent. */
export async function createCheckout(
  listingId: string,
  address: ShippingAddress
): Promise<CheckoutSession> {
  if (!supabase) throw new Error('Not configured');
  const { data, error } = await supabase.functions.invoke('stripe-checkout', {
    body: { listing_id: listingId, shipping_address: address },
  });
  if (error) throw await unwrapFunctionError(error);
  return data as CheckoutSession;
}

/** Delete a stuck (never-active) seller account so onboarding starts fresh. */
export async function resetSellerAccount(): Promise<void> {
  if (!supabase) throw new Error('Not configured');
  const { error } = await supabase.functions.invoke('stripe-onboard', {
    body: { action: 'reset' },
  });
  if (error) throw await unwrapFunctionError(error);
}

/** Whether a seller's listings can currently be bought (payout setup done). */
export async function sellerCanCharge(userId: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('seller_can_charge', { p_user: userId });
  if (error) return false;
  return Boolean(data);
}
