// CardLink — escrow release: Transfer the seller's share and complete the order.
//
// POST { order_id }
// Allowed callers, in the spirit of "buyer holds the keys until the timer runs out":
//   - the BUYER, any time the order is shipped ("confirm received")
//   - the SELLER, only once auto_release_at has passed (buyer went silent)
//   - the service role key (future pg_cron auto-release sweep)
//
// The Transfer moves the FULL item price from the platform balance to the
// seller's Express account (the buyer fee stays as platform revenue).
// transfer_group ties it to the original PaymentIntent for reconciliation.
//
// Deploy:  npx supabase functions deploy stripe-release --project-ref <ref>

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
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const service = createClient(supabaseUrl, serviceKey);

  // Who's calling? A user JWT resolves to a user; the raw service key resolves
  // to the cron/admin path.
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const isServiceCall = bearer === serviceKey;
  let callerId: string | null = null;
  if (!isServiceCall) {
    const authed = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data, error } = await authed.auth.getUser();
    if (error || !data.user) {
      return Response.json({ error: 'Not signed in' }, { status: 401, headers: CORS });
    }
    callerId = data.user.id;
  }

  let orderId: unknown;
  try {
    ({ order_id: orderId } = await req.json());
  } catch {
    return Response.json({ error: 'Bad JSON' }, { status: 400, headers: CORS });
  }
  if (typeof orderId !== 'string') {
    return Response.json({ error: 'order_id required' }, { status: 400, headers: CORS });
  }

  const { data: order } = await service
    .from('orders')
    .select('id, status, buyer_id, seller_id, item_price, card_name, auto_release_at, stripe_transfer_id')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return Response.json({ error: 'Order not found' }, { status: 404, headers: CORS });
  if (order.status !== 'shipped') {
    return Response.json({ error: `Order is not releasable (${order.status})` }, { status: 400, headers: CORS });
  }

  const pastDue = order.auto_release_at != null && Date.now() >= new Date(order.auto_release_at).getTime();
  const isBuyer = callerId != null && callerId === order.buyer_id;
  const isSeller = callerId != null && callerId === order.seller_id;
  if (!isServiceCall && !isBuyer && !(isSeller && pastDue)) {
    return Response.json(
      { error: isSeller ? 'Payment auto-releases 14 days after shipping' : 'Not allowed' },
      { status: 403, headers: CORS }
    );
  }

  const { data: seller } = await service
    .from('seller_accounts')
    .select('stripe_account_id')
    .eq('user_id', order.seller_id)
    .maybeSingle();
  if (!seller?.stripe_account_id) {
    return Response.json({ error: 'Seller payout account missing' }, { status: 500, headers: CORS });
  }

  try {
    // Idempotency key = order id: Stripe dedupes retries, so a double-tap or a
    // cron+buyer race can never produce two transfers.
    const transfer = await stripe.transfers.create(
      {
        amount: Math.round(Number(order.item_price) * 100),
        currency: 'eur',
        destination: seller.stripe_account_id,
        transfer_group: order.id,
        metadata: { order_id: order.id },
      },
      { idempotencyKey: `release-${order.id}` }
    );

    const { data: updated } = await service
      .from('orders')
      .update({
        status: 'completed',
        stripe_transfer_id: transfer.id,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .eq('status', 'shipped')
      .select('id')
      .maybeSingle();

    if (updated) {
      await service.from('notifications').insert([
        {
          user_id: order.seller_id,
          type: 'order_update',
          payload: { order_id: order.id, status: 'completed', role: 'seller', card_name: order.card_name },
        },
        {
          user_id: order.buyer_id,
          type: 'order_update',
          payload: { order_id: order.id, status: 'completed', role: 'buyer', card_name: order.card_name },
        },
      ]);
    }

    return Response.json({ released: true }, { headers: CORS });
  } catch (e) {
    console.error('transfer failed', e);
    return Response.json({ error: 'Payout transfer failed' }, { status: 502, headers: CORS });
  }
});
