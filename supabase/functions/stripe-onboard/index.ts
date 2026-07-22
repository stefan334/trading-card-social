// CardLink — Stripe Connect Express onboarding for sellers.
//
// POST {action:"start"}  -> creates (or reuses) the caller's Express account and
//                           returns an AccountLink URL to finish onboarding in
//                           the browser. Return/refresh bounce through the
//                           stripe-redirect function (Stripe requires https).
// POST {action:"status"} -> re-reads the Stripe account, mirrors the flags into
//                           seller_accounts, and returns them (the app calls
//                           this when the browser flow returns).
//
// Deploy:  npx supabase functions deploy stripe-onboard --project-ref <ref>
// Secrets: npx supabase secrets set STRIPE_SECRET_KEY=sk_test_... --project-ref <ref>
//
// JWT verification is ON (default): only signed-in users reach this.

import Stripe from 'npm:stripe@18';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return Response.json({ error: 'POST only' }, { status: 405, headers: CORS });
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) {
    return Response.json({ error: 'Payments are not configured' }, { status: 500, headers: CORS });
  }
  const stripe = new Stripe(stripeKey, { apiVersion: '2025-06-30.basil' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  // Caller-scoped client resolves the user from the JWT…
  const authed = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  // …service client writes seller_accounts (no client-side write policies).
  const service = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: userData, error: userError } = await authed.auth.getUser();
  if (userError || !userData.user) {
    return Response.json({ error: 'Not signed in' }, { status: 401, headers: CORS });
  }
  const user = userData.user;

  let action: unknown;
  try {
    ({ action } = await req.json());
  } catch {
    return Response.json({ error: 'Bad JSON' }, { status: 400, headers: CORS });
  }

  const { data: existing } = await service
    .from('seller_accounts')
    .select('stripe_account_id')
    .eq('user_id', user.id)
    .maybeSingle();

  try {
    if (action === 'start') {
      let accountId = existing?.stripe_account_id;

      if (!accountId) {
        const account = await stripe.accounts.create({
          type: 'express',
          country: 'RO',
          email: user.email ?? undefined,
          business_type: 'individual',
          capabilities: { transfers: { requested: true } },
          // Sellers only RECEIVE transfers (the platform charges buyers), so the
          // 'recipient' agreement applies — it drops the merchant questionnaire
          // (website, product description, MCC) from onboarding entirely.
          tos_acceptance: { service_agreement: 'recipient' },
          metadata: { cardlink_user_id: user.id },
        });
        accountId = account.id;
        const { error } = await service.from('seller_accounts').insert({
          user_id: user.id,
          stripe_account_id: accountId,
        });
        if (error) {
          // Unwind so a DB hiccup doesn't strand an orphan Stripe account.
          await stripe.accounts.del(accountId).catch(() => {});
          throw error;
        }
      }

      const redirectBase = `${supabaseUrl}/functions/v1/stripe-redirect`;
      const link = await stripe.accountLinks.create({
        account: accountId,
        type: 'account_onboarding',
        return_url: `${redirectBase}?to=return`,
        refresh_url: `${redirectBase}?to=refresh`,
        // Ask only what's required RIGHT NOW (identity basics); bank details
        // and any documents are deferred until the seller wants to withdraw.
        collection_options: { fields: 'currently_due' },
      });
      return Response.json({ url: link.url }, { headers: CORS });
    }

    if (action === 'status') {
      if (!existing?.stripe_account_id) {
        return Response.json({ onboarded: false }, { headers: CORS });
      }
      const account = await stripe.accounts.retrieve(existing.stripe_account_id);
      const flags = {
        details_submitted: account.details_submitted ?? false,
        charges_enabled: account.charges_enabled ?? false,
        payouts_enabled: account.payouts_enabled ?? false,
        // Vinted-style staging: transfers active = can SELL (money lands in
        // their balance); payouts_enabled = can WITHDRAW (bank + full KYC).
        transfers_active: account.capabilities?.transfers === 'active',
      };
      await service
        .from('seller_accounts')
        .update({ ...flags, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      return Response.json({ onboarded: true, ...flags }, { headers: CORS });
    }

    if (action === 'reset') {
      // Recreate a STUCK onboarding (e.g. an account made under the old 'full'
      // service agreement). Only allowed while nothing financial ever happened.
      if (!existing?.stripe_account_id) {
        return Response.json({ reset: true }, { headers: CORS });
      }
      const account = await stripe.accounts.retrieve(existing.stripe_account_id);
      if (account.charges_enabled || account.payouts_enabled) {
        return Response.json(
          { error: 'This account is active and cannot be reset' },
          { status: 400, headers: CORS }
        );
      }
      const { data: hasOrders } = await service
        .from('orders')
        .select('id')
        .eq('seller_id', user.id)
        .limit(1);
      if (hasOrders && hasOrders.length > 0) {
        return Response.json(
          { error: 'Accounts with orders cannot be reset' },
          { status: 400, headers: CORS }
        );
      }
      await stripe.accounts.del(existing.stripe_account_id).catch(() => {});
      await service.from('seller_accounts').delete().eq('user_id', user.id);
      return Response.json({ reset: true }, { headers: CORS });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400, headers: CORS });
  } catch (e) {
    console.error('stripe-onboard failure', e);
    // Stripe's message is user-safe and names the actual problem (e.g. Connect
    // not yet enabled on the platform account).
    const msg = (e as any)?.raw?.message ?? (e as any)?.message ?? 'Stripe request failed';
    return Response.json({ error: msg }, { status: 502, headers: CORS });
  }
});
