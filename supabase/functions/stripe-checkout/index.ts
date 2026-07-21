// CardLink — checkout: turn a listing into a pending order + PaymentIntent.
//
// POST { listing_id, shipping_address: {name, line1, line2?, city, county?,
//        postal_code, phone?} }
// -> { client_secret, order_id, item_price, buyer_fee, total }
//
// Money model: separate charges & transfers. The buyer pays item + protection
// fee to the PLATFORM balance; the seller's share (full item price) is
// Transferred on buyer confirmation / auto-release (stripe-release). The fee
// math here is the source of truth — src/services/payments.ts mirrors it for
// display only.
//
// Deploy:  npx supabase functions deploy stripe-checkout --project-ref <ref>
// Secrets: STRIPE_SECRET_KEY (shared with stripe-onboard)

import Stripe from 'npm:stripe@18';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FEE_PERCENT = 0.05;
const FEE_FIXED_EUR = 0.5;
// Stale pending checkouts stop blocking the listing after this long.
const PENDING_TTL_MS = 30 * 60 * 1000;

const round2 = (n: number) => Math.round(n * 100) / 100;

function badRequest(msg: string) {
  return Response.json({ error: msg }, { status: 400, headers: CORS });
}

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
  const authed = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const service = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: userData, error: userError } = await authed.auth.getUser();
  if (userError || !userData.user) {
    return Response.json({ error: 'Not signed in' }, { status: 401, headers: CORS });
  }
  const buyerId = userData.user.id;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return badRequest('Bad JSON');
  }
  const listingId = body?.listing_id;
  const addr = body?.shipping_address;
  if (typeof listingId !== 'string') return badRequest('listing_id required');
  for (const field of ['name', 'line1', 'city', 'postal_code']) {
    if (typeof addr?.[field] !== 'string' || !addr[field].trim()) {
      return badRequest(`shipping_address.${field} required`);
    }
  }
  const shippingAddress = {
    name: String(addr.name).trim().slice(0, 120),
    line1: String(addr.line1).trim().slice(0, 200),
    line2: addr.line2 ? String(addr.line2).trim().slice(0, 200) : null,
    city: String(addr.city).trim().slice(0, 80),
    county: addr.county ? String(addr.county).trim().slice(0, 80) : null,
    postal_code: String(addr.postal_code).trim().slice(0, 20),
    phone: addr.phone ? String(addr.phone).trim().slice(0, 30) : null,
  };

  // ------------------------------------------------------- load + validate ----
  const { data: listing, error: listingErr } = await service
    .from('user_cards')
    .select(
      'id, owner_id, sale_price, is_for_trade, listing_photos, card:cards(id, name, image_url_large, image_url_small, set:card_sets(name)), owner:profiles(id, is_banned)'
    )
    .eq('id', listingId)
    .maybeSingle();
  if (listingErr) {
    console.error('listing load failed', listingErr);
    return Response.json({ error: 'Lookup failed' }, { status: 500, headers: CORS });
  }
  const l = listing as any;
  if (!l || !l.is_for_trade || l.sale_price == null || Number(l.sale_price) <= 0 || !l.card) {
    return badRequest('This listing is not for sale');
  }
  if (l.owner_id === buyerId) return badRequest('You cannot buy your own listing');
  if (l.owner?.is_banned) return badRequest('This listing is not available');
  if (!Array.isArray(l.listing_photos) || l.listing_photos.length === 0) {
    return badRequest('This listing has no photos of the actual card yet');
  }

  const { data: canCharge } = await service
    .from('seller_accounts')
    .select('charges_enabled')
    .eq('user_id', l.owner_id)
    .maybeSingle();
  if (!canCharge?.charges_enabled) {
    return badRequest('This seller has not finished payout setup');
  }

  const { data: blocked } = await service
    .from('blocks')
    .select('blocker_id')
    .or(
      `and(blocker_id.eq.${buyerId},blocked_id.eq.${l.owner_id}),and(blocker_id.eq.${l.owner_id},blocked_id.eq.${buyerId})`
    )
    .limit(1);
  if (blocked && blocked.length > 0) return badRequest('This listing is not available');

  // ------------------------------------- clear stale / own pending checkouts ----
  const { data: active } = await service
    .from('orders')
    .select('id, buyer_id, status, created_at, stripe_payment_intent_id')
    .eq('listing_id', listingId)
    .in('status', ['pending_payment', 'paid', 'shipped', 'disputed']);
  for (const o of active ?? []) {
    const stale = Date.now() - new Date(o.created_at).getTime() > PENDING_TTL_MS;
    if (o.status === 'pending_payment' && (o.buyer_id === buyerId || stale)) {
      // Abandoned sheet: cancel its intent and free the slot.
      if (o.stripe_payment_intent_id) {
        await stripe.paymentIntents.cancel(o.stripe_payment_intent_id).catch(() => {});
      }
      await service.from('orders').delete().eq('id', o.id).eq('status', 'pending_payment');
    } else {
      return badRequest('This card is already being bought');
    }
  }

  // ------------------------------------------------------------ create order ----
  const itemPrice = round2(Number(l.sale_price));
  const buyerFee = round2(itemPrice * FEE_PERCENT + FEE_FIXED_EUR);
  const total = round2(itemPrice + buyerFee);

  const { data: order, error: orderErr } = await service
    .from('orders')
    .insert({
      listing_id: listingId,
      buyer_id: buyerId,
      seller_id: l.owner_id,
      card_id: l.card.id,
      card_name: l.card.name,
      card_image: l.card.image_url_large ?? l.card.image_url_small ?? null,
      set_name: l.card.set?.name ?? null,
      card_photos: l.listing_photos,
      item_price: itemPrice,
      buyer_fee: buyerFee,
      total,
      shipping_address: shippingAddress,
    })
    .select('id')
    .single();
  if (orderErr || !order) {
    // 23505 = someone else won the race for the partial unique index.
    if ((orderErr as any)?.code === '23505') {
      return badRequest('This card is already being bought');
    }
    console.error('order insert failed', orderErr);
    return Response.json({ error: 'Could not start checkout' }, { status: 500, headers: CORS });
  }

  try {
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100),
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      transfer_group: order.id,
      metadata: {
        order_id: order.id,
        listing_id: listingId,
        buyer_id: buyerId,
        seller_id: l.owner_id,
      },
    });
    await service
      .from('orders')
      .update({ stripe_payment_intent_id: intent.id, updated_at: new Date().toISOString() })
      .eq('id', order.id);

    return Response.json(
      {
        client_secret: intent.client_secret,
        order_id: order.id,
        item_price: itemPrice,
        buyer_fee: buyerFee,
        total,
      },
      { headers: CORS }
    );
  } catch (e) {
    console.error('payment intent failed', e);
    await service.from('orders').delete().eq('id', order.id).eq('status', 'pending_payment');
    return Response.json({ error: 'Could not start payment' }, { status: 502, headers: CORS });
  }
});
