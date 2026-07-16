# CardLink — Build Checklist

Phased plan. Check items off as completed. Add new items as scope is discovered — keep this file
honest and current rather than aspirational. See `README.md` for architecture/context behind these
decisions.

---

## UX & Structure (cross-cutting)
- [x] **Bottom tabs: Feed · Collection · Wishlist · Inbox · Profile.** Chat + Trades merged into one
      **Inbox** tab (`useInbox` = trades + non-trade DM threads, activity-sorted); chat is embedded
      inline in the trade detail. Profile is a bottom tab; notifications bell + search live top-right
      on the Feed.
- [x] **Binders** (`0011_binders.sql`): curated, ordered card showcases on a profile — Instagram-
      highlights-style covers (`BindersRow`) → swipeable full-card viewer (`app/binder/[id]`) + editor
      (`app/binder/edit/[id]`: rename, add cards from search, **drag-and-drop reorder** on a grid
      (`react-native-draggable-grid`, pure JS → works in Expo Go), **pick cover (★)**, remove, delete).
      Public read, owner write. Verified e2e incl. RLS + reorder + cover.
- [x] **Dev build config**: `expo-dev-client` + `eas.json` (development/preview/production profiles) +
      `com.cardlink.app` bundle IDs. See `DEV_BUILD.md` for build/install steps (Android free; iPhone
      needs a $99 Apple Developer account). Actual `eas build` requires the user's Expo/Apple login.

---

## Phase 0 — Project Setup
- [x] Define product vision & tech stack (README.md)
- [x] Create this checklist
- [x] Scaffold Expo + TypeScript app (`expo-router`, base tab navigation) — SDK 57, React 19, RN 0.86
- [ ] Set up ESLint + Prettier (TS strict mode is already on via `tsconfig.json`)
- [x] Create a Supabase project (cloud) — project `iwpwmqgvfhrjipypvhhj`, `.env` populated,
      `0001_init.sql` + `seed.sql` applied via `supabase db push` / `supabase db query` against the
      direct connection (CLI isn't `supabase link`-ed since that needs an interactive `supabase login`
      tied to the user's account — re-run `supabase link --project-ref iwpwmqgvfhrjipypvhhj` after
      logging in if you want the CLI fully linked for `supabase db diff` etc.)
- [x] Set up `.env.example` and env var loading (`src/services/supabase/client.ts` degrades gracefully
      with an in-app "connect Supabase" notice until `.env` is filled in)
- [ ] Set up EAS (Expo Application Services) project for future builds — needs an Expo account
- [ ] Decide on app name / branding (placeholder: "CardLink")

## Phase 1 — Data Model & Card Data Ingestion
- [x] Write SQL migrations: `profiles`, `tcg_games`, `card_sets`, `cards`
- [x] Write SQL migrations: `user_cards`, `wishlists`, `follows`
- [x] Write SQL migrations: `trades`, `trade_items`, `chat_threads`, `chat_messages`, `notifications`
- [x] Set up Row Level Security policies for all tables (`supabase/migrations/0001_init.sql`)
- [x] Build Pokémon TCG API provider (`src/services/tcg-providers/pokemon.ts`) — verified live against
      `api.pokemontcg.io` and wired into the Collection tab's "Browse Sets" list
- [ ] Build a sync job (Edge Function or script) to cache Pokémon sets/cards into `cards`/`card_sets`
      (currently the Collection tab calls the live API directly for browsing; the local `cards` table
      needs to be populated before `user_cards` rows can reference real card ids)
- [x] Define shared `Card`/`CardSet` TS types used across the app (`src/types/card.ts`, `src/types/domain.ts`)

## Phase 2 — Auth & Profile
- [x] Supabase email/password sign-in + sign-up (`(auth)/` group, shared `AuthForm`)
- [x] Auth context (`AuthProvider`/`useAuth`) + route protection (`useProtectedRoute`):
      signed-out → auth, signed-in-not-onboarded → onboarding, else tabs
- [x] Onboarding flow: username (unique, validated), display name, favorite TCG → stamps
      `onboarded_at` (`app/onboarding.tsx`)
- [x] Public profile screen — self (`app/profile.tsx`) + others (`app/user/[id].tsx`) via shared
      `ProfileView`, with follower/following/card stats (`useProfile`)
- [x] Follow / unfollow from a user's profile (`useFollow`) — moved up from Phase 5, needed here
- [x] Edit profile screen (`app/edit-profile.tsx`): username, display name, bio, favorite TCG
- [x] Verified end-to-end against live DB: sign-up → `handle_new_user` trigger creates placeholder
      profile → onboarding write passes RLS. Test user cleaned up.
- [x] Email confirmation via **OTP code** (`app/(auth)/verify-otp.tsx`, `verifyOtp type:'signup'` +
      resend). Sign-up with no session routes here instead of showing a static message. Works in Expo Go.
- [x] **Google OAuth** (browser redirect, PKCE): `src/services/supabase/oauth.ts`
      (`signInWithProvider` + `createSessionFromUrl` via `exchangeCodeForSession`), client `flowType:'pkce'`,
      "Continue with Google" button in `AuthForm`. Client ID/secret live in the Supabase dashboard only.
- [ ] Apple OAuth — required by App Store once any social login ships; needs an Apple Developer account
      + a dev build (native `expo-apple-authentication`, doesn't run in Expo Go).
- [ ] Avatar **image upload** — deferred; needs a Storage bucket + `expo-image-picker`. The
      `avatar_url` field is already displayed everywhere once set.
- [ ] Username availability check while typing (currently validated on submit via unique-violation)

> **Required dashboard config for OTP:** the "Confirm email" toggle must be **ON**
> (Authentication → Sign In / Providers → Email), and the **Confirm signup** email template
> (Authentication → Email Templates) must include the code token `{{ .Token }}` so the 6-digit code
> arrives in the email (the default template only has the `{{ .ConfirmationURL }}` link). If you'd
> rather skip confirmation entirely for dev, turn "Confirm email" off — sign-up then goes straight to
> onboarding and the OTP screen is bypassed.

> **Google OAuth + Expo Go caveat:** the redirect uses the `cardlink://` scheme, which only a
> **development build** handles. In Expo Go the redirect resolves to a network-dependent `exp://` URL
> that's awkward to whitelist, so validate Google sign-in in a dev build. OTP needs none of this.
> Add `cardlink://` to Authentication → URL Configuration → Redirect URLs.

## Phase 3 — Collection Tab
> Catalog is **lazy-cached**: no giant up-front sync. Adding a card calls the `cache_card` RPC
> (`0004_cache_card.sql`, SECURITY DEFINER) to upsert just that card + set into `cards`/`card_sets`
> (RLS stays service-role-only for direct writes), then inserts the `user_cards` row. Set totals come
> from set metadata; the "missing cards" grid comes from the live API. Verified end-to-end vs live DB.
- [x] "My Collection": owned cards grouped by set with completion bars (`useCollectionBySet`,
      `CollectionBySet`, Collection tab)
- [x] Add card to collection from card detail — pick condition, add copies (`useCollectionActions`,
      `cache_card` RPC)
- [x] Filter collection by game (chips; structurally multi-game, Pokémon-only for now). Per-set
      grouping gives the by-set view.
- [x] Set completion screen (`app/set/[id].tsx`): owned/total + % progress bar, full set grid with
      owned cards in colour and **missing cards dimmed** — the "what do I still need" view
- [x] Mark cards "available to trade" (per-copy `is_for_trade` toggle on card detail; trade badge in
      collection grid)
- [x] View another user's public collection (read-only `CollectionBySet` on `app/user/[id].tsx`)
- [x] Card detail (`app/card/[id].tsx`): image, set/number/rarity, owned copies list, add/remove
- [x] Search cards by name across the API (`useCardSearch`, `/search` Cards tab; also a search bar
      atop the Collection tab). Verified vs live API.
- [ ] Quantity stepper on add (currently one copy per add; multiple adds = multiple copies)
- [x] Market price on card detail: Cardmarket average (EUR) + trend, from the card API response (no
      extra call), normalized onto `Card.market` in the provider; falls back to TCGplayer market (USD)

## Phase 4 — Wishlist & Notifications
> Matching is a **DB trigger**, not a job/Edge Function (`0005_notification_triggers.sql`,
> SECURITY DEFINER so it can read others' wishlists + insert notifications past RLS). Verified e2e:
> A follows B + wishlists a card → B adds it → A gets a `wishlist_match`; following B notifies B.
- [x] Add/remove cards to wishlist (star toggle on card detail; `useWishlistActions` + `cache_card`)
- [x] Wishlist tab: grid filtered by game (`useWishlist`, `app/(tabs)/wishlist.tsx`)
- [x] Matching trigger: someone you follow adds a card you wishlisted → `wishlist_match` notification
      (dedups on the owner's first copy so duplicate adds don't spam)
- [x] Bonus: `new_follower` notification when someone follows you
- [x] In-app notifications list (`app/notifications.tsx`, `useNotifications`) hydrated with actor +
      card; **bell + unread badge** in the Feed header (headerLeft), marks all read on open
- [ ] Push notifications (Expo push) — needs a **dev build** (remote push doesn't work in Expo Go)
      plus a sender (Edge Function on notification insert, or DB webhook). Deferred.
- [ ] Notification preferences (mute per type)
- [ ] Realtime badge updates (currently refetches on focus; could subscribe via Supabase Realtime)

## Phase 5 — Social Graph & Feed
> The **Feed is the home tab** (first thing users see), not an optional extra — it's what makes the
> app social-first. Schema + read path are built; the write paths (composing posts, following) remain.
- [x] Feed data model: `posts` table + `get_feed(page_limit, page_offset)` RPC (`0002_feed.sql`)
- [x] Home Feed screen renders posts from self + followed users (`useFeed`, `PostCard`), with
      empty/loading/signed-out states and pull-to-refresh
- [x] **Activity feed is auto-generated** (`0013_feed_activity.sql`), no manual posting: triggers create
      a `card_added` post when a card is added and a `card_listed` post (with price) when one is listed
      for trade. `useFeed` **groups a burst** of the same activity by one user ("added 12 cards"), and
      `PostCard` renders it with card thumbnails. Verified e2e.
- [ ] `trade_completed` feed event on trade completion (optional; add to `confirm_trade`)
- [ ] Compose a manual post (text/showcase) — deliberately dropped; the feed is activity-driven
- [x] Follow / unfollow users (`useFollow`, on public profiles — built in Phase 2)
- [x] Search/discover users by username/display name (`useUserSearch`, `/search` Users tab, reachable
      from the Feed header search icon). Verified vs live DB.
- [ ] Friends vs. "following" distinction (mutual follow = friend, or explicit friend request — decide)
- [ ] Likes / comments on posts (later)

## Phase 6 — Trading
> All status changes go through SECURITY DEFINER RPCs (`0006_trades.sql`); the broad "participants can
> UPDATE trades" RLS policy was dropped so status can't be set directly (no marking 'completed' without
> the transfer). Verified e2e incl. the guard that the initiator can't accept their own trade.
- [x] Trade offer flow: propose their for-trade cards + yours (`app/trade/new.tsx`, `useForTradeCards`,
      `useTradeActions.propose`); "Propose Trade" button on `app/user/[id].tsx`
- [x] Trade detail (`app/trade/[id].tsx`): both sides' cards, note, accept/decline/cancel by role
- [x] Two-step lifecycle (`0009`): proposed → **accepted** (agree, no transfer) → both **confirm** the
      physical swap → **completed** (ownership transfers then) / declined / cancelled. Confirm buttons +
      "waiting for X" on the trade detail. Verified e2e (one confirm ≠ transfer; both = transfer).
- [x] **Reviews**: after a completed trade each party rates the other 1–5 + comment (`trade_reviews`,
      `useTradeReviews`/`useSubmitReview`); one review per (trade, reviewer); avg rating shown on profiles
- [x] On completion: atomic ownership transfer with still-owned validation + `is_for_trade` reset
      (`confirm_trade`), plus `trade_update` notifications on every transition
- [x] Trade history: the Trade tab lists all trades (incoming/outgoing) with status (`useTrades`)
- [x] "Cash on top" handled via the free-text note field (informational, no in-app payment)
- [x] Chat about a trade before/after accepting ("Message about this trade" → trade-scoped thread)
- [x] Schema: `trades`/`trade_items`/`chat_*` FKs to `profiles` now have `ON DELETE CASCADE` (`0008`),
      so account deletion cascades cleanly — verified a user with trades/chats/reviews can be deleted
- [x] **Marketplace / listings** (`0012_marketplace.sql`): per-copy asking price (`user_cards.sale_price`,
      EUR, informational — no in-app payment) set on card detail; a **"For Trade" showcase**
      (`ForTradeShowcase`) on profiles with price / "open to trades"; **wishlists are now public** so
      profiles + the trade builder show what someone wants. Trade builder shows the counterpart's
      wishlist. Verified e2e (cross-user price + wishlist read).
- [x] Global **Marketplace** (`app/marketplace.tsx`, `useMarketplace`): browse every card listed for
      trade across all users (excludes your own), with asking price / "open to trades", the market avg
      reference (`useCardPrices`), seller, name search + game filter. Storefront icon in the Feed header.
- [x] **Location-based** (`0016`): profiles store rounded (~1km, private) coords + city (`expo-location`,
      set in edit-profile). "Near me" toggle (default on) filters + sorts by distance (60km) and shows
      distance/city; toggle off for everywhere. Traders settle payment/delivery among themselves.
- [x] **Card grading** (`0015`): raw (condition) or graded (PSA/BGS/CGC/SGC + grade), shown on copies,
      For-Trade showcase, and marketplace listings.
- [x] **Add cards ("cart" model)** — center **"+" tab** (`app/(tabs)/add.tsx`) reachable from anywhere:
      search or scan to drop cards into a shared cart (`BatchProvider`), a pinned bottom bar shows the
      pack, a review sheet picks one condition for the lot and "Add all N" → single grouped feed post.
      Scanner (`app/scan.tsx`) always feeds the same cart (capture → confirm → next). Single-add is just
      a cart of one — no separate batch mode. Wishlist moved off the tab bar (Collection → star button).
- [x] **Catalog Sync** (`0017`, `scripts/sync-catalog.mjs`, `.github/workflows/catalog-sync.yml`):
      a daily GitHub Actions cron sweeps the provider and upserts the full catalog + prices into our
      DB over a direct service connection (bypasses RLS). Adds `cards.price_*` columns, a `pg_trgm`
      name index, and a `catalog_sync_runs` log. App reads are **DB-first** (`src/services/catalog.ts`):
      browse sets, card search, set completion, and collection/wishlist prices come from our DB
      instantly; the live API stays a per-card fallback for anything not yet synced.
      **Setup:** add repo secrets `DATABASE_URL` + `POKEMON_TCG_API_KEY`; run `npm run sync:catalog`
      (needs `DATABASE_URL`) or trigger the workflow once to backfill.
- [x] **Analytics** (`0018`, `src/services/analytics.ts`): self-hosted `analytics_events` + `track()` /
      `useScreenView()` (no SDK). Query in SQL. Admin-readable only.
- [x] **Moderation** (`0018`): `reports` table + `/report`; `/admin` console (gated by `profiles.is_admin`)
      to review reports (ban via `admin_set_banned` RPC / dismiss) and read feedback. Report link on profiles.
      → **manual step:** grant yourself admin: `update profiles set is_admin=true where id='<your-uid>';`
- [x] **Feedback / Contact / Terms** screens (`/feedback`, `/contact`, `/terms`) linked from a profile
      About/Support list. **Terms is a starter template — have a lawyer review before public launch.**
- [x] **Open feed** (`useFeed`): shows posts from everyone (no more empty feed for new users), ranked
      you+followed → local (same city) → recent; banned users hidden.
- [x] **Ads** (`react-native-google-mobile-ads`): banner every 5 feed posts, Google **test** ad IDs.
      → **manual step for revenue:** create an AdMob account, put real App IDs in `app.json` plugin and
      real ad-unit IDs in `EXPO_PUBLIC_ADMOB_BANNER_ANDROID/IOS` (EAS secrets), then rebuild. Ads only
      run in EAS/dev builds, not Expo Go.
- [x] **Server-side OCR** (`supabase/functions/ocr-scan`): the billable Google Vision key moves out of
      the app binary into a Supabase Edge Function (JWT-gated, key in a Supabase secret). Client calls
      it via `functions.invoke`; direct env keys remain a dev-only fallback.
      → **deploy (one-time):** `npx supabase login` →
      `npx supabase secrets set GOOGLE_VISION_API_KEY=<key> --project-ref iwpwmqgvfhrjipypvhhj` →
      `npx supabase functions deploy ocr-scan --project-ref iwpwmqgvfhrjipypvhhj`.
      Then delete the EAS secret `EXPO_PUBLIC_GOOGLE_VISION_API_KEY` (if created) so builds stop
      embedding the key, and restrict the key to the Vision API in Google Cloud.
- [x] **Launch hardening** (`0022`): self-service **account deletion** (delete_account RPC + Settings
      danger row, double-confirm); **global error toasts** (ToastHost + MutationCache onError — failed
      mutations always surface); **feed + marketplace infinite pagination** (no more hard caps); banned
      users' marketplace listings hidden.
      → **manual step:** re-enable "Confirm email" in Supabase Auth settings before launch (OTP screen
      already built), and verify a real sending domain in Resend (onboarding@resend.dev only delivers
      to your own inbox).
- [ ] In-app payments (Stripe) — deliberately out of scope; pricing is informational only
- [ ] True in-place **counter** (edit the offer) — for now, decline + propose a new trade
- [ ] Trade only 1 of N copies (currently transfers the whole `user_cards` row)

## Phase 7 — Chat
> Threads found/created via null-safe `get_or_create_thread` RPC (`0007_chat.sql`); list + unread via
> `my_chat_threads`. Realtime enabled on `chat_messages` (RLS scopes the stream). Verified e2e:
> idempotent thread creation, two-way messaging, unread count + mark-read, and outsider RLS isolation.
- [x] Direct message threads (1:1) — Chat tab list (`useChatThreads`) + `app/chat/[id].tsx`
- [x] Realtime message delivery (Supabase Realtime subscription in `useThreadMessages`)
- [x] Chat scoped to a trade ("Message about this trade" on trade detail); general DM from a profile's
      "Message" button. (Card-scoped threads supported by the schema/RPC; card-detail entry point TBD.)
- [x] Unread counts: per-thread badges in the list + total badge on the Chat tab (`thread_reads`,
      mark-read on open)
- [ ] Read receipts (seen ticks) — unread tracking exists; per-message "seen" not shown yet
- [ ] Image sharing in chat — deferred (needs a Storage bucket + `expo-image-picker`, like avatars)
- [ ] "Discuss this card" entry point from a card in someone's collection

## Phase 8 — Camera Card Scanning
> Works in Expo Go (camera capture + Storage upload, no native ML). `card-scans` bucket + owner-folder
> RLS (`0010_storage_scans.sql`). Verified e2e: upload to own folder OK, public read 200, other-folder
> write blocked, and a scanned `user_cards` row stores the photo's public URL.
- [x] Camera capture screen (`expo-camera`, base64 capture) — `app/scan.tsx`
- [x] MVP: capture → search/confirm match against card DB → add to collection (condition picker)
- [x] Store scan image in Supabase Storage (`uploadScan`), linked via `user_cards.image_url`
      (best-effort — adding the card never blocks on the upload)
- [x] Batch-ish: "Scan another" after adding resets to the camera
- [ ] V2: OCR card name/set number from the photo to pre-fill search (needs a vision API; better in a
      dev build). Would remove the manual-type step.
- [ ] V3 (stretch): visual card recognition (match by image, not just OCR)
- [ ] Show the user's own scan photo on the card detail's owned-copies list

## Phase 9 — Multi-TCG Expansion
- [ ] Add Magic: The Gathering via Scryfall provider
- [ ] Add Yu-Gi-Oh! via YGOPRODeck provider
- [ ] Verify shared UI (collection, wishlist, trade) remains game-agnostic — no Pokémon-only assumptions
- [ ] Per-game set/completion filtering UI polish

## Phase 10 — Polish & Launch Prep
- [ ] Empty states, loading states, error handling pass across all screens
- [ ] Offline handling (cached collection view at minimum)
- [ ] Accessibility pass
- [ ] App icons, splash screen, store listing assets
- [ ] Privacy policy / terms (needed for App Store / Play Store submission)
- [ ] TestFlight / internal testing track
- [ ] Analytics (basic, privacy-respecting) to see which features are used

---

## Open Product Decisions (revisit as needed)
- Friend model: mutual-follow vs. explicit friend request?
- How much of a user's collection/wishlist is public vs. friends-only by default?
- Do we ever add real-money trade/escrow, or stay card-for-card only?
- Sports cards / other non-API-friendly TCGs — revisit once core Pokémon flow is solid.
