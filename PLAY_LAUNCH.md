# CardLink — Play Store launch runbook

Everything needed to publish to Google Play, with the parts that only you can do
(accounts/dashboards) clearly marked. Code-side items are already done unless noted.

---

## 1. Make the compliance site live (2 min) — DO FIRST

The `docs/` folder is a ready static site. Enable it:

1. GitHub → repo **Settings → Pages**
2. **Source:** Deploy from a branch → Branch **`master`**, folder **`/docs`** → Save
3. Wait ~1 min. Your URLs become:
   - Home: `https://stefan334.github.io/trading-card-social/`
   - **Privacy Policy:** `https://stefan334.github.io/trading-card-social/privacy.html`
   - **Terms:** `https://stefan334.github.io/trading-card-social/terms.html`
   - **Delete account:** `https://stefan334.github.io/trading-card-social/delete-account.html`
   - **app-ads.txt:** `https://stefan334.github.io/trading-card-social/app-ads.txt`

> If you later buy a real domain (for the final app name), point it at these and update
> the links — but github.io URLs are fully accepted by Google Play and AdMob.

---

## 2. Play Console → Data Safety form (answer sheet)

Based on exactly what the app collects. Play asks per data type: *collected? shared?
processed ephemerally? required or optional? purpose?* (We **share** only with ad/
infra processors, which Google counts as "collected", not "shared to third parties for
their own use" — answer **"No"** to *shared* everywhere below.)

| Data type | Collected | Optional? | Purposes |
|---|---|---|---|
| **Email address** | Yes | Required | Account management |
| **Name** (username / display name) | Yes | Required (username) / Optional (display) | Account management, App functionality |
| **User photos** (avatar, card scans, chat images) | Yes | Optional | App functionality |
| **Approximate location** | Yes | Optional | App functionality (nearby trading) |
| **Messages** (in-app chat) | Yes | Optional | App functionality |
| **Other user-generated content** (collection, binders, wishlist, trades, reviews, posts) | Yes | Optional | App functionality |
| **App interactions** (analytics events) | Yes | — | Analytics |
| **Device or other IDs** (advertising ID via AdMob) | Yes | — | Advertising or marketing |
| **Crash logs / diagnostics** | Only if you add Sentry | — | Analytics |

Additional required answers:
- **Is all collected data encrypted in transit?** → **Yes** (HTTPS everywhere).
- **Do you provide a way to request data deletion?** → **Yes**, and give the delete-account URL from step 1.
- **Precise location?** → **No** (we round to ~1 km; declare **Approximate** only).
- **Financial info / health / contacts / SMS / calendar / files?** → **No.**

Privacy policy URL for the form + listing: the `privacy.html` URL from step 1.

---

## 3. Other Play listing requirements (yours to do)

- [ ] Google Play developer account (one-time $25).
- [ ] **App name** — decide the final name (marketing; "CardLink" has trademark collisions).
- [ ] **App icon** — replace the scaffold art in `assets/` with the real brand icon.
- [ ] Screenshots (phone) — feed, collection, a trade, a binder, dark mode looks great here.
- [ ] Short + full description (pull from the marketing brief).
- [ ] Content rating questionnaire (social app, user communication → likely Teen).
- [ ] Category: **Lifestyle** or **Social**.

---

## 4. Email delivery — REQUIRED before real signups work

Signup confirmation and password reset currently only deliver to your own inbox
(`onboarding@resend.dev`). Before external users:

1. **Resend:** verify a sending domain, switch the "from" address to it.
2. **Supabase → Auth → Providers → Email:** turn **Confirm email ON**.
3. **Supabase → Auth → Email Templates:**
   - *Confirm signup* and *Reset Password* templates must each contain the code token
     **`{{ .Token }}`** (the app uses 6-digit codes, not links).

---

## 5. Android push notifications (FCM) — for pushes to actually arrive

1. Create a Firebase project for package **`com.cardlink.app`**, download `google-services.json`.
2. Add to `app.json`: `"android": { "googleServicesFile": "./google-services.json", ... }`.
3. `eas credentials` → Android → Push Notifications → upload the FCM **V1** service-account key.
4. Rebuild. (Until then, push registration silently no-ops — nothing breaks.)

---

## 6. AdMob payout

- Complete **payment + tax** info in AdMob.
- `app-ads.txt` is already hosted (step 1); in AdMob, verify the app once the store listing exists.
- **Do not tap your own live ads** (invalidates the account).

---

## 7. Recommended before/at launch

- [ ] **Crash reporting** (Sentry `@sentry/react-native`) — needs a DSN from your Sentry account; ask and I'll wire it in.
- [ ] **Rotate the DB password** in Supabase (it's been shared in chat/scripts); update `.env` + the GitHub `DATABASE_URL` secret afterwards.
- [ ] **Legal review** of Privacy Policy + Terms.
- [ ] Full **two-account E2E** pass on the fresh APK: trade lifecycle, chat sync, scan (OCR now via the deployed Edge Function), forgot-password (to your own email), dark mode.

---

## Already done ✅
OCR Edge Function deployed · catalog sync + GitHub cron · admin access · in-app
account deletion · moderation/reports/ban · self-hosted analytics · error toasts ·
feed + marketplace pagination · `allowBackup=false` · real AdMob unit wired · full
dark mode · compliance site + in-app Privacy Policy · location permission rationale.
