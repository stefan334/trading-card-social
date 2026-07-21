// CardLink — Catalog Sync job
//
// Sweeps the Pokémon TCG API and upserts the full catalog (sets + cards) plus
// market prices into our Postgres, so the app can browse/search/price from our
// own DB instead of hitting the live API on every screen.
//
// Runs on a schedule via .github/workflows/catalog-sync.yml (and can be run
// locally). Connects directly to Postgres with a service connection string, so
// it bypasses RLS — never expose DATABASE_URL to the client.
//
//   DATABASE_URL          postgres connection string (service / db owner)
//   POKEMON_TCG_API_KEY   optional; raises the provider rate limit
//
//   node scripts/sync-catalog.mjs            # sets + cards + prices
//   node scripts/sync-catalog.mjs --prices   # cards + prices only (skip sets sweep)

import pg from 'pg';

const API = 'https://api.pokemontcg.io/v2';
const GAME_ID = 'pokemon';
const GAME_NAME = 'Pokémon';
const PAGE_SIZE = 250;

const API_KEY = process.env.POKEMON_TCG_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const PRICES_ONLY = process.argv.includes('--prices');

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const ns = (id) => `${GAME_ID}:${id}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function apiFetch(path, params) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  // The API has flaky days (504s, hangs): retry hard with exponential backoff
  // and a per-request timeout so a hung socket can't stall the whole sweep.
  for (let attempt = 0; attempt < 7; attempt++) {
    try {
      const res = await fetch(url, {
        headers: API_KEY ? { 'X-Api-Key': API_KEY } : undefined,
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) return res.json();
      if (res.status !== 429 && res.status < 500) {
        throw Object.assign(new Error(`API ${res.status}: ${await res.text()}`), { fatal: true });
      }
      // 429/5xx → fall through to backoff.
    } catch (e) {
      if (e?.fatal) throw e;
      // timeout / network error / retryable status → backoff below.
    }
    await sleep(Math.min(60_000, 2_000 * 2 ** attempt));
  }
  throw new Error(`API failed after retries: ${url}`);
}

// Prefer Cardmarket (EUR averageSellPrice), fall back to a TCGplayer variant's
// market (USD) — mirrors the app's mapMarket so prices are consistent.
function mapMarket(raw) {
  const cm = raw.cardmarket?.prices;
  if (cm && (cm.averageSellPrice != null || cm.trendPrice != null)) {
    return {
      source: 'cardmarket',
      currency: 'EUR',
      market: cm.averageSellPrice ?? cm.trendPrice ?? null,
      low: cm.lowPrice ?? null,
      updatedAt: raw.cardmarket?.updatedAt ?? null,
    };
  }
  const variants = raw.tcgplayer?.prices;
  const first = variants ? Object.values(variants)[0] : undefined;
  if (first) {
    return {
      source: 'tcgplayer',
      currency: 'USD',
      market: first.market ?? first.mid ?? null,
      low: first.low ?? null,
      updatedAt: raw.tcgplayer?.updatedAt ?? null,
    };
  }
  return null;
}

async function logRun(client, kind, patch = {}) {
  if (patch.id) {
    await client.query(
      `update catalog_sync_runs set finished_at=now(), ok=$2, error=$3, sets_upserted=$4, cards_upserted=$5 where id=$1`,
      [patch.id, patch.ok ?? null, patch.error ?? null, patch.sets ?? null, patch.cards ?? null]
    );
    return patch.id;
  }
  const { rows } = await client.query(
    `insert into catalog_sync_runs (game_id, kind) values ($1, $2) returning id`,
    [GAME_ID, kind]
  );
  return rows[0].id;
}

async function syncSets(client) {
  const res = await apiFetch('/sets', {
    pageSize: PAGE_SIZE,
    select: 'id,name,series,releaseDate,total,images',
  });
  const sets = res.data ?? [];
  for (const s of sets) {
    await client.query(
      `insert into card_sets (id, game_id, name, series, release_date, total_cards, image_url)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (id) do update set
         name=excluded.name, series=excluded.series, release_date=excluded.release_date,
         total_cards=excluded.total_cards, image_url=excluded.image_url`,
      [ns(s.id), GAME_ID, s.name, s.series ?? null, s.releaseDate ?? null, s.total ?? 0, s.images?.logo ?? null]
    );
  }
  console.log(`sets upserted: ${sets.length}`);
  return sets.length;
}

async function upsertCards(client, cards) {
  const cols = [
    'id', 'game_id', 'set_id', 'name', 'number', 'rarity',
    'image_url_small', 'image_url_large',
    'price_market', 'price_low', 'price_currency', 'price_source', 'price_updated_at',
  ];
  const rowsSql = [];
  const params = [];
  let i = 1;
  for (const c of cards) {
    const m = mapMarket(c);
    params.push(
      ns(c.id), GAME_ID, ns(c.set.id), c.name, c.number, c.rarity ?? null,
      c.images?.small ?? null, c.images?.large ?? null,
      m?.market ?? null, m?.low ?? null, m?.currency ?? null, m?.source ?? null, m?.updatedAt ?? null
    );
    rowsSql.push('(' + cols.map(() => `$${i++}`).join(',') + ', now())');
  }
  const sql = `insert into cards (${cols.join(',')}, prices_synced_at) values ${rowsSql.join(',')}
    on conflict (id) do update set
      set_id=excluded.set_id, name=excluded.name, number=excluded.number, rarity=excluded.rarity,
      image_url_small=excluded.image_url_small, image_url_large=excluded.image_url_large,
      price_market=excluded.price_market, price_low=excluded.price_low,
      price_currency=excluded.price_currency, price_source=excluded.price_source,
      price_updated_at=excluded.price_updated_at, prices_synced_at=excluded.prices_synced_at`;
  await client.query(sql, params);
}

async function syncCards(client) {
  let page = 1;
  let total = 0;
  let skipped = 0;
  let totalCount = Infinity;
  for (;;) {
    try {
      const res = await apiFetch('/cards', {
        page,
        pageSize: PAGE_SIZE,
        orderBy: 'set.releaseDate,number',
        select: 'id,name,number,rarity,images,set,cardmarket,tcgplayer',
      });
      const cards = res.data ?? [];
      totalCount = res.totalCount ?? totalCount;
      if (!cards.length) break;
      await upsertCards(client, cards);
      total += cards.length;
      console.log(`cards page ${page}: +${cards.length} (total ${total}/${totalCount})`);
    } catch (e) {
      // A page that fails even after retries shouldn't kill the sweep — upserts
      // are idempotent, so tomorrow's run (or the next) fills the hole.
      skipped++;
      console.log(`cards page ${page}: SKIPPED (${e?.message ?? e})`);
      if (skipped > 10) throw new Error(`too many skipped pages (${skipped}) — aborting`);
    }
    if (page * PAGE_SIZE >= totalCount) break;
    page++;
  }
  console.log(`cards upserted: ${total}${skipped ? ` (${skipped} pages skipped)` : ''}`);
  return total;
}

async function main() {
  const started = Date.now();
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  const runId = await logRun(client, PRICES_ONLY ? 'cards' : 'sets');
  try {
    await client.query(`insert into tcg_games (id, name) values ($1,$2) on conflict (id) do nothing`, [GAME_ID, GAME_NAME]);
    const sets = PRICES_ONLY ? 0 : await syncSets(client);
    const cards = await syncCards(client);
    await logRun(client, 'cards', { id: runId, ok: true, sets, cards });
    console.log(`done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  } catch (e) {
    await logRun(client, 'cards', { id: runId, ok: false, error: String(e?.message ?? e) });
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
