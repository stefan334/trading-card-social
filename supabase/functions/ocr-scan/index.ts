// CardLink — server-side card OCR.
// The app sends a base64 JPEG; we call Google Cloud Vision with a key that lives
// ONLY here (Supabase secret GOOGLE_VISION_API_KEY), so the billable key is never
// embedded in the app binary. JWT verification is ON (default), so only signed-in
// users can spend our Vision quota; text parsing stays client-side.
//
// Deploy:  npx supabase functions deploy ocr-scan --project-ref <ref>
// Secret:  npx supabase secrets set GOOGLE_VISION_API_KEY=<key> --project-ref <ref>

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ~4.5MB of image — far beyond a 0.5-quality phone capture; reject bigger blobs.
const MAX_BASE64_CHARS = 6_000_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return Response.json({ error: 'POST only' }, { status: 405, headers: CORS });
  }

  const key = Deno.env.get('GOOGLE_VISION_API_KEY');
  if (!key) {
    return Response.json({ error: 'OCR is not configured' }, { status: 500, headers: CORS });
  }

  let image: unknown;
  try {
    ({ image } = await req.json());
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS });
  }
  if (typeof image !== 'string' || image.length === 0 || image.length > MAX_BASE64_CHARS) {
    return Response.json({ error: 'Expected { image: <base64 jpeg> }' }, { status: 400, headers: CORS });
  }

  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{ image: { content: image }, features: [{ type: 'TEXT_DETECTION', maxResults: 1 }] }],
    }),
  });
  if (!res.ok) {
    return Response.json({ error: `Vision API ${res.status}` }, { status: 502, headers: CORS });
  }

  const data = await res.json();
  const text: string =
    data?.responses?.[0]?.fullTextAnnotation?.text ??
    data?.responses?.[0]?.textAnnotations?.[0]?.description ??
    '';

  return Response.json({ text }, { headers: CORS });
});
