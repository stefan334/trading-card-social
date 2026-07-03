# CardLink (working title) — Trading Card Social & Trading App

> This README is written for both humans and AI coding assistants. If you are an AI agent
> picking up this project, read this file fully before writing code. It contains the product
> vision, architecture decisions, folder structure, conventions, and the current state of the
> build. Keep it up to date as the project evolves — stale docs are worse than no docs.

## 1. Product Vision

A mobile app (iOS + Android) for trading card game (TCG) collectors, focused on the **social and
trading** side rather than just price tracking (unlike PriceCharting). Core ideas:

- Upload/scan the physical cards you own into a personal **collection**.
- See your collection's **completeness per set** (e.g. "Pokémon — Chaos Rising: 87/100").
- View other users' public collections the same way.
- **Trade** cards with friends or other users on the platform (structured trade offers, not just DMs).
- **Chat** with friends/trade partners, including chat scoped to a specific trade or card.
- **Wishlist**: mark cards you want; get notified when a friend or someone you follow lists/owns
  a card on your wishlist.
- **Follow** other collectors to see their activity (new cards added, trades completed).
- **Scan cards with the camera** to add them to your collection quickly (like PriceCharting).
- Card data comes from **public APIs / existing databases**, not hand-entered.

### Non-goals (for now)

- We are **not** primarily a price-tracking/valuation app. Market price data may be added later
  as a secondary feature, not the core loop.
- We are **not** building our own card image/database from scratch — we lean on public TCG APIs.
- We are **not** handling real-money payment/escrow for trades at launch. Trades are card-for-card
  (optionally + cash mentioned in chat), coordinated by the users themselves, off-platform for any
  money exchange. Revisit this later if there's demand for in-app escrow.

## 2. Tech Stack & Key Decisions

| Layer | Choice | Why |
|---|---|---|
| Mobile client | **React Native + Expo (TypeScript)**, `expo-router` — pinned to **Expo SDK 54** (RN 0.81, React 19.1) | Single codebase for iOS/Android, fast iteration, strong camera/OCR/ML ecosystem, OTA updates via EAS. **Do not bump the SDK without checking that Expo Go on the target device supports it** — this project was intentionally downgraded from SDK 57 to 54 because the App Store Expo Go maxed out at 54. Bump only alongside a dev build, or when the App Store Expo Go supports the newer SDK. |
| Backend | **Supabase** (Postgres + Auth + Realtime + Storage + Edge Functions) | Managed Postgres gives us real SQL for set-completion queries; Realtime powers chat/notifications; Storage holds card scan images; RLS handles per-user data access without a hand-rolled API layer |
| Card data (Phase 1) | **Pokémon TCG API** (`pokemontcg.io`) | Free, well-documented, has card images + set metadata. Good first integration. |
| Card data (later) | Scryfall (Magic: The Gathering), YGOPRODeck (Yu-Gi-Oh!), others | Card data layer is designed as a pluggable "provider" per TCG from day one — see §5. |
| Card scanning | Device camera (`expo-camera`) + on-device/edge OCR, matched against the card DB | Start simple: capture image → let user confirm/search matched card by name/set → refine to automatic recognition later (see Checklist Phase 6). |
| Push notifications | Expo Notifications + Supabase Edge Functions (triggered by DB changes) | Wishlist matches, trade offers, chat messages |
| State/data fetching | TanStack Query (`@tanstack/react-query`) | Caching + sync for Supabase queries and TCG API calls |
| Navigation | `expo-router` (file-based) | Bottom tabs: **Feed** (home), Collection, Wishlist, **Inbox** (trades + DMs merged), **Profile**. Notifications bell + search live top-right on the Feed. Chat is embedded inline in each trade; standalone DMs open `chat/[id]`. |

**Multi-TCG from the start:** even though we launch with Pokémon only, the data model and card
provider interface are game-agnostic (`tcg_games` table, `Card` provider interface). Do not
hardcode "Pokemon" assumptions into shared components — check the checklist/README before adding
game-specific logic outside the provider layer.

## 3. Repo Structure

```
trading-card-social/
├── README.md                 ← you are here
├── CHECKLIST.md               ← phased build plan, check items off as completed
├── app/                       ← Expo Router app (screens, file-based routing)
│   ├── (tabs)/                ← bottom tabs: index (Feed/home), collection, wishlist, trade, chat
│   ├── profile.tsx            ← Profile (stack route, opened via Feed's top-right avatar)
│   ├── scan.tsx               ← camera card-scan modal
│   ├── card/[id].tsx          ← card detail screen
│   ├── trade/[id].tsx         ← trade detail/offer screen
│   └── _layout.tsx            ← root stack (wraps tabs + detail/modal routes)
├── src/
│   ├── components/            ← shared UI components
│   ├── services/
│   │   ├── supabase/          ← supabase client + typed query helpers
│   │   └── tcg-providers/     ← pluggable card-data providers (pokemon.ts, magic.ts, ...)
│   ├── hooks/                 ← react-query hooks (useCollection, useWishlist, useTrades...)
│   ├── types/                 ← shared TS types (Card, Trade, Profile, ...)
│   └── utils/
├── supabase/
│   ├── migrations/            ← SQL migration files (source of truth for DB schema)
│   └── functions/             ← Edge Functions (notification triggers, etc.)
└── assets/
```

## 4. Data Model (summary — full SQL in `supabase/migrations/`)

- `profiles` — one row per user (extends `auth.users`)
- `tcg_games` — Pokémon, Magic, Yu-Gi-Oh, etc.
- `card_sets` — a set/expansion within a game (e.g. "Chaos Rising")
- `cards` — canonical card catalog, sourced from provider APIs, cached locally
- `user_cards` — a user's owned copies of a card (condition, quantity, acquired_at, is_for_trade)
- `wishlists` — a user's wanted cards
- `follows` — user-to-user follow graph
- `posts` — feed items (card shares, text updates, and later auto-events like card_added /
  trade_completed). The home Feed = your posts + posts by everyone you follow (RPC `get_feed`).
- `trades` / `trade_items` — structured trade offers between two users and the cards each side offers
- `chat_threads` / `chat_messages` — direct messages, optionally linked to a `trade_id` or `card_id`
- `notifications` — wishlist matches, trade updates, chat unread, etc.

Set completeness = `count(user_cards where set_id = X) / count(cards where set_id = X)`.

## 5. Card Data Provider Interface

Every TCG data source implements the same shape (see `src/services/tcg-providers/`):

```ts
interface TcgProvider {
  gameId: string; // 'pokemon' | 'mtg' | 'yugioh' | ...
  searchSets(query?: string): Promise<CardSet[]>;
  getSet(setId: string): Promise<CardSet>;
  searchCards(params: { setId?: string; name?: string; page?: number }): Promise<Card[]>;
  getCard(cardId: string): Promise<Card>;
}
```

Adding a new TCG = add a new provider file + register it. Shared UI (collection grid, set
completion view, wishlist) must stay game-agnostic and consume `Card`/`CardSet` types, not
provider-specific shapes.

## 6. Conventions

- TypeScript strict mode everywhere. No `any` unless justified with a comment.
- Prefer Supabase RLS for access control over hand-written auth checks in app code.
- All DB schema changes go through a new file in `supabase/migrations/`, never edited in place
  after being applied.
- Screens are thin; business logic lives in `src/hooks/` and `src/services/`.
- Keep `CHECKLIST.md` in sync — check items off as they're completed, add new items as scope is
  discovered.

## 7. Getting Started (dev environment)

```bash
cd trading-card-social
npm install
npx expo start
```

Requires a `.env` (see `.env.example`) with:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_POKEMON_TCG_API_KEY` (optional — the Pokémon TCG API works without a key at lower rate limits)

## 8. Current Status

See `CHECKLIST.md` for the live phased plan. As of the initial build:

- Expo Router app scaffolded with 5 bottom tabs (Feed/home, Collection, Wishlist, Trade, Chat) +
  Profile (avatar-opened stack route) + card/trade detail routes + a camera scan modal.
  `npx expo export --platform android` bundles cleanly.
- Home Feed is built: renders posts from you + people you follow (`posts` table + `get_feed` RPC,
  `useFeed` hook, `PostCard` component). Composing posts is still stubbed (Phase 5), so the feed
  shows an empty state until users can post.
- **Auth & profiles are built (Phase 2):** email/password sign-up/in, an `AuthProvider` + route
  protection (`useProtectedRoute`) that gates the app and routes new users through onboarding,
  onboarding (username/display name/favorite TCG), self + public profile screens with stats, follow/
  unfollow, and edit-profile. Verified end-to-end against the live DB.
- **Email confirmation via OTP code** (`app/(auth)/verify-otp.tsx`) and **Google OAuth** (browser
  redirect / PKCE, `src/services/supabase/oauth.ts`) are wired in. Two dashboard requirements:
  the "Confirm signup" email template must include `{{ .Token }}` for the OTP code, and Google's
  redirect (`cardlink://`) only works in a **dev build** (not Expo Go) — see `CHECKLIST.md` Phase 2.
  Apple OAuth and avatar image upload remain deferred.
- Full DB schema + RLS policies written (`supabase/migrations/0001_init.sql`) and **applied to a real
  Supabase project** (`iwpwmqgvfhrjipypvhhj`); `.env` is populated and the app connects. The CLI was
  never `supabase link`-ed (that needs an interactive `supabase login`) — migrations were pushed via
  `supabase db push --db-url ...` directly, so run `supabase link` yourself if you want `supabase db
  diff`/local dev parity later.
- Pokémon TCG provider is live and verified against `api.pokemontcg.io`; the Collection tab's
  "Browse Sets" list uses it directly, so the app is testable before Supabase is wired up.
- **Collection is built (Phase 3):** add cards to your collection from card detail (condition +
  for-trade), see them grouped by set with completion bars, a per-set completion screen with the
  missing-cards grid, and read-only public collections on other users' profiles. Catalog is
  lazy-cached via the `cache_card` RPC (no full sync) — see `CHECKLIST.md` Phase 3. Verified
  end-to-end against the live DB.
- **Wishlist & notifications are built (Phase 4):** wishlist toggle on card detail + a Wishlist tab,
  a DB trigger that creates a `wishlist_match` notification when someone you follow adds a card you
  wishlisted (plus `new_follower`), and an in-app notifications list with a bell + unread badge in
  the Feed header. Matching is entirely trigger-based (`0005_notification_triggers.sql`) — no Edge
  Function. Verified end-to-end. Push (Expo Push) is deferred to a dev build.
- **Trading is built (Phase 6):** propose a trade from a user's profile (pick their for-trade cards +
  yours), a Trade tab listing incoming/outgoing trades, and a detail screen with accept/decline/cancel.
  Accepting runs an atomic `accept_trade` RPC that transfers card ownership and validates the cards are
  still held; all status changes go through SECURITY DEFINER RPCs (`0006_trades.sql`) with RLS locked
  so status can't be forged. Verified end-to-end including the initiator-can't-accept guard.
- **Chat is built (Phase 7):** 1:1 threads with **Supabase Realtime** message delivery, unread counts
  (per-thread + a Chat tab badge), and threads scoped to a trade ("Message about this trade") or a
  general DM ("Message" on a profile). Threads are found/created via the null-safe `get_or_create_thread`
  RPC (`0007_chat.sql`); RLS scopes both queries and the realtime stream. Verified end-to-end incl.
  outsider isolation. Image-sharing in chat is deferred (Storage bucket dependency).
- **Camera scanning is built (Phase 8):** capture a card photo → search/confirm the match → add to
  your collection, with the scan photo uploaded to the `card-scans` Storage bucket (`0010`,
  owner-folder RLS) and linked via `user_cards.image_url`. Works in Expo Go. Automatic OCR/visual
  recognition (V2/V3) is future work — better in a dev build with a vision API.
- Supabase Storage is now set up (`card-scans` public bucket), which also unblocks avatar image upload.
- **Chat + Trades merged into one Inbox tab** and the chat is embedded inline in each trade (discuss a
  deal without leaving it). Profile moved to a bottom tab; notifications + search sit top-right on the Feed.
- **Binders** (`0011`): curated Instagram-highlights-style card showcases on profiles — a covers row →
  swipeable full-card viewer + an editor (add from search / remove / rename / delete). Public read,
  owner-only write (RLS-verified).
- Trades use a **two-step completion** (`0009`): accept = agree, then both parties **confirm** the
  physical swap, and only then does card ownership transfer in-app and the trade complete. After that,
  each party can leave a **1–5 star review** of the other; average rating shows on profiles. Profiles
  (own + others') show the user's collection grouped by set.
- FKs from `trades`/`trade_items`/`chat_*` to `profiles` now have `ON DELETE CASCADE` (`0008`), so a
  user with trade/chat/review history can be deleted cleanly (account-deletion ready).

### Gotcha: typed routes

`app.json` enables `experiments.typedRoutes`, so `expo-router` generates `.expo/types/router.d.ts`
from the route tree. **`tsc` depends on this file, but only the dev server regenerates it** —
`expo export` does not. After adding/moving/removing a route, run `npx expo start` (a few seconds is
enough to regenerate) before `tsc`, or you'll see bogus "path is not assignable" / "no overlap"
errors on `router.replace(...)` and `<Link href=...>`. `.expo/` is gitignored, so this regen step is
expected on a fresh clone too.
