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

## 5. Push notifications — for pushes to actually arrive

The whole pipeline is built (registration hook + Android channel + brand notification
icon; DB triggers `notifications_push` / `chat_messages_push` → `send_expo_push()` →
Expo Push API). What's missing is the platform credentials Expo relays through. Until
then, registration silently no-ops — nothing breaks.

### Android (needed for the "share the APK" case)
1. **Firebase project** → Add an **Android app** with package **`com.cardlink.app`** →
   download **`google-services.json`** → put it in the repo root (next to `app.json`).
2. **Add ONE line** to `app.json` under `"android"` (do this *with* step 1 — referencing
   a missing file breaks the build, so don't add it early):
   ```json
   "android": {
     "googleServicesFile": "./google-services.json",
     "allowBackup": false,
     ...
   }
   ```
3. **Upload the FCM V1 key to EAS:** in Firebase → Project settings → Service accounts →
   *Generate new private key* (downloads a JSON). Then run `eas credentials` →
   **Android → Push Notifications: Manage → Upload FCM V1 service account key** → pick
   that JSON. (Google killed the legacy FCM server key in 2024 — it must be **V1**.)
4. Rebuild the Android app. Install on a device, open it (grants notification permission),
   then have a **second account** message or propose a trade to that user → push arrives.

### iOS (already partly working — your device registered a token)
- Delivery needs an **APNs key**. EAS auto-provisions it during an iOS build **if** you're
  enrolled in the Apple Developer Program ($99/yr). Run `eas credentials` → iOS →
  *Push Notifications Key* to confirm one exists. No `google-services.json` needed on iOS.
- Test with **two accounts** — the triggers only fire on a message/notification *to* you
  *from someone else*, so solo testing shows nothing.

> Already done for you: `expo-notifications` config plugin (brand small-icon
> `android-icon-monochrome.png` + accent `#2563EB`), the Android notification channel,
> permission handling, token upsert, and all server-side sending.

---

## 6. AdMob payout

- Complete **payment + tax** info in AdMob.
- `app-ads.txt` is already hosted (step 1); in AdMob, verify the app once the store listing exists.
- **Do not tap your own live ads** (invalidates the account).

---

## 6b. Local Android builds (free — no EAS quota)

One-time setup already done on this PC: Android SDK at `D:\Android`
(cmdline-tools + platform-tools, licenses accepted), `ANDROID_HOME=D:\Android`
and `GRADLE_USER_HOME=D:\gradle-home` (keep build tooling off the full C:
drive), `android/` generated via prebuild (gitignored),
`android/local.properties` → `sdk.dir=D:/Android` (forward slashes required).

Build a shareable APK any time:

```powershell
cd D:\Projects\trading-card-social
npx expo prebuild -p android      # only after native config changes (app.json plugins, new native deps)
cd android
.\gradlew assembleRelease
# → android\app\build\outputs\apk\release\app-release.apk
```

Dev client: `.\gradlew assembleDebug` (→ `...\apk\debug\app-debug.apk`).

Notes:
- Local APKs are **debug-signed** → different signature from EAS builds:
  testers must uninstall the old app ONCE, then local builds update over
  each other fine. To match the EAS signature instead: `eas credentials`
  → Android → credentials.json → download, then wire the keystore into
  `android/app/build.gradle` signingConfigs.
- Prebuild flips `package.json` scripts to `expo run:*` — flip back to
  `expo start --*`.
- EAS cloud quota resets monthly (this month: Aug 1) — keep cloud builds
  for store-ready signed releases.

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
