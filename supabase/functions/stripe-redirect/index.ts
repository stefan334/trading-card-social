// CardLink — https→app-scheme bounce for Stripe hosted flows.
//
// Stripe AccountLinks only accept https return/refresh URLs; the app lives at
// cardlink://. This function is that https hop: GET ?to=return|refresh 302s to
// the matching deep link, which expo-web-browser's auth session catches.
//
// Deploy WITHOUT JWT verification (the browser hits it unauthenticated):
//   npx supabase functions deploy stripe-redirect --no-verify-jwt --project-ref <ref>
// Nothing sensitive happens here: no secrets read, fixed destinations only.

const DESTINATIONS: Record<string, string> = {
  return: 'cardlink://stripe-onboard?result=return',
  refresh: 'cardlink://stripe-onboard?result=refresh',
};

Deno.serve((req) => {
  const to = new URL(req.url).searchParams.get('to') ?? '';
  const target = DESTINATIONS[to];
  if (!target) return new Response('Not found', { status: 404 });
  return new Response(null, { status: 302, headers: { Location: target } });
});
