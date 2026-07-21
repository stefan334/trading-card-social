// CardLink — Stripe webhook: the only writer of payment-driven order states.
//
// payment_intent.succeeded        -> order paid, listing unlisted, seller notified
// payment_intent.payment_failed   |
// payment_intent.canceled         -> pending order deleted (listing freed)
// account.updated                 -> seller_accounts capability flags mirrored
//
// Deploy (Stripe cannot send a Supabase JWT — signature IS the auth):
//   npx supabase functions deploy stripe-webhook --no-verify-jwt --project-ref <ref>
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (from the Stripe dashboard
// after registering  https://<ref>.supabase.co/functions/v1/stripe-webhook )

import Stripe from 'npm:stripe@18';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!stripeKey || !webhookSecret) return new Response('Not configured', { status: 500 });

  const stripe = new Stripe(stripeKey, { apiVersion: '2025-06-30.basil' });
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), signature, webhookSecret);
  } catch (e) {
    console.error('signature verification failed', e);
    return new Response('Bad signature', { status: 400 });
  }

  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object as Stripe.PaymentIntent;
      // Guarded transition: only pending_payment moves to paid (idempotent on retries).
      const { data: order } = await service
        .from('orders')
        .update({ status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('stripe_payment_intent_id', intent.id)
        .eq('status', 'pending_payment')
        .select('id, listing_id, buyer_id, seller_id, card_name')
        .maybeSingle();
      if (!order) break; // replay or unknown intent — nothing to do

      // The copy is sold: pull it off the marketplace (order snapshot has the rest).
      if (order.listing_id) {
        await service
          .from('user_cards')
          .update({ is_for_trade: false, sale_price: null })
          .eq('id', order.listing_id);
      }

      await service.from('notifications').insert({
        user_id: order.seller_id,
        type: 'order_update',
        payload: {
          order_id: order.id,
          status: 'paid',
          role: 'seller',
          card_name: order.card_name,
        },
      });
      break;
    }

    case 'payment_intent.payment_failed':
    case 'payment_intent.canceled': {
      const intent = event.data.object as Stripe.PaymentIntent;
      // A dead checkout should not hold the listing hostage.
      await service
        .from('orders')
        .delete()
        .eq('stripe_payment_intent_id', intent.id)
        .eq('status', 'pending_payment');
      break;
    }

    case 'account.updated': {
      const account = event.data.object as Stripe.Account;
      await service
        .from('seller_accounts')
        .update({
          details_submitted: account.details_submitted ?? false,
          charges_enabled: account.charges_enabled ?? false,
          payouts_enabled: account.payouts_enabled ?? false,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_account_id', account.id);
      break;
    }

    default:
      break; // unsubscribed event types are fine to ignore
  }

  return Response.json({ received: true });
});
