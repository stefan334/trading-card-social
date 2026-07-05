/**
 * Card OCR for the scanner. Reads the printed card name + collector number from a
 * captured photo so the scan can auto-match instead of making the user type.
 *
 * Supports two providers, picked by whichever env key is set:
 *  - Google Cloud Vision  (EXPO_PUBLIC_GOOGLE_VISION_API_KEY) — most accurate
 *  - OCR.space            (EXPO_PUBLIC_OCRSPACE_API_KEY)       — free instant key
 * If neither is set, ocrAvailable() is false and the scanner falls back to manual.
 */

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_VISION_API_KEY;
const OCRSPACE_KEY = process.env.EXPO_PUBLIC_OCRSPACE_API_KEY;

export function ocrAvailable(): boolean {
  return Boolean(GOOGLE_KEY || OCRSPACE_KEY);
}

export interface CardOcr {
  name: string | null; // best-guess card name
  number: string | null; // collector number, e.g. "4" from "4/102"
  raw: string;
}

const KEYWORDS = /^(hp|basic|stage\s?\d|trainer|energy|item|supporter|stadium|weakness|resistance|retreat|ex|gx|vmax|vstar|illus|©|pok[eé]mon)$/i;

/** Pull a card name + collector number out of a raw OCR text blob (heuristic). */
function parseCard(raw: string): CardOcr {
  const numMatch = raw.match(/\b(\d{1,3})\s*\/\s*\d{1,3}\b/);
  const number = numMatch ? String(parseInt(numMatch[1], 10)) : null;

  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // The name is usually one of the first prominent lines: mostly letters, a few
  // words, and not a game keyword or a pure number.
  let name: string | null = null;
  for (const line of lines) {
    const cleaned = line.replace(/[^A-Za-z '.\-é]/g, '').trim();
    if (cleaned.length < 3) continue;
    if (KEYWORDS.test(cleaned)) continue;
    if (/^\d+$/.test(line)) continue;
    name = cleaned;
    break;
  }

  return { name, number, raw };
}

async function googleVision(base64: string): Promise<string> {
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{ image: { content: base64 }, features: [{ type: 'TEXT_DETECTION', maxResults: 1 }] }],
    }),
  });
  if (!res.ok) throw new Error(`Vision API ${res.status}`);
  const data = await res.json();
  return data?.responses?.[0]?.fullTextAnnotation?.text ?? data?.responses?.[0]?.textAnnotations?.[0]?.description ?? '';
}

async function ocrSpace(base64: string): Promise<string> {
  const form = new FormData();
  form.append('apikey', OCRSPACE_KEY!);
  form.append('base64Image', `data:image/jpeg;base64,${base64}`);
  form.append('OCREngine', '2');
  const res = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: form as any });
  if (!res.ok) throw new Error(`OCR.space ${res.status}`);
  const data = await res.json();
  return data?.ParsedResults?.[0]?.ParsedText ?? '';
}

/** Run OCR on a base64 JPEG and return the parsed card name/number, or null. */
export async function recognizeCard(base64: string): Promise<CardOcr | null> {
  try {
    const raw = GOOGLE_KEY ? await googleVision(base64) : OCRSPACE_KEY ? await ocrSpace(base64) : '';
    if (!raw) return null;
    return parseCard(raw);
  } catch {
    return null;
  }
}
