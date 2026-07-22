/**
 * Feature flags baked at build time.
 *
 * PAYMENTS_ENABLED — the in-app marketplace money layer (buy buttons, checkout,
 * seller payouts, orders). Parked 2026-07-22 pending a payment-provider deal
 * (Stripe legally can't onboard RO private sellers; Trustap/MangoPay tracked in
 * the launch docs). All payment code stays in the tree — flip this to true,
 * wire the chosen provider's edge functions, rebuild.
 */
export const PAYMENTS_ENABLED = false;
