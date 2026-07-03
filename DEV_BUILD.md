# Development builds (EAS)

A **development build** is your own installable app (all native features working: camera, Google/Apple
sign-in, push) that loads your JS with fast-refresh like Expo Go. Use it once you outgrow Expo Go —
which for this project means: Google sign-in (`cardlink://` redirect), push notifications, and the best
camera-scan experience.

Config is already in place: `expo-dev-client` is installed, `eas.json` has build profiles, and
`app.json` sets `ios.bundleIdentifier` / `android.package` to `com.cardlink.app`.

## One-time setup

```bash
npm i -g eas-cli        # or use: npx eas-cli@latest
eas login               # create a free Expo account if you don't have one
eas init                # links this project to your Expo account (writes the projectId)
```

## Android (free, easiest — recommended first)

If you have any Android phone or emulator, this needs **no paid account**:

```bash
eas build --profile development --platform android
```

EAS builds an `.apk` in the cloud (~10–20 min) and gives you a URL/QR. Download it to the Android
device and install (allow "install from unknown sources"). Then start the dev server and open the app:

```bash
npx expo start --dev-client
```

The app connects to your machine (same Wi‑Fi) and loads the code, just like Expo Go but with everything
working.

## iPhone via a Mac (free — recommended if you have a MacBook)

With a Mac you can build locally with Xcode and install on your own iPhone using just a **free Apple
ID** (no $99 needed):

```bash
# on the Mac, in the project folder
npm install
# recreate .env (Supabase URL + publishable key) — it's gitignored, so copy it over
npx expo run:ios --device      # generates the ios/ project via prebuild, builds, installs
npx expo start --dev-client    # load your JS into the installed app (fast refresh)
```

First run, Xcode prompts you to sign in with your Apple ID and pick a **Personal Team** (that's the
free signing). Requirements: **Xcode** (Mac App Store, ~15 GB), iPhone connected by USB with "trust
this computer" + **Developer Mode** on (Settings → Privacy & Security → Developer Mode, iOS 16+).

Two catches of the free path:
- **7-day expiry** — free-signed apps stop launching after a week; just re-run `expo run:ios` to renew.
- **Push notifications still require the paid Apple Developer account** even on a Mac. Everything else
  (camera, Google sign-in, the whole app) works on the free path.

## iPhone via EAS (Windows, or no Mac) — needs a paid Apple Developer account

Apple requires apps on a physical iPhone to be **code-signed**, so a device build needs an
**Apple Developer Program membership ($99/year)**. Since you're on Windows (no Xcode), the build runs in
the cloud via EAS.

```bash
eas build --profile development --platform ios
```

EAS will prompt you to log in with your Apple ID and will handle certificates/provisioning for you. It
registers your iPhone's UDID (it walks you through this) for internal distribution. When the build
finishes you install it via the link/QR, then:

```bash
npx expo start --dev-client
```

Without the $99 Apple account there is **no way to install a custom build on a physical iPhone** (the
only free iOS path is building locally on a Mac with Xcode + a free Apple ID, 7‑day expiry — not
possible on Windows). The iOS Simulator build (`"simulator": true`) is also Mac-only.

## After the dev build is installed

- **Google sign-in**: add `cardlink://` to Supabase → Authentication → URL Configuration → Redirect URLs
  (already noted in CHECKLIST Phase 2). The button will then complete the flow.
- **Push notifications**: wire up `expo-notifications` + a sender (Edge Function on `notifications`
  insert). The in-app bell already works without this.
- **Camera scanning**: works in Expo Go too, but is smoother here; a future OCR step would live here.

## Preview & production

- `eas build --profile preview --platform android` → a shareable standalone APK (no dev server needed)
  for testers.
- `eas build --profile production` → store-ready builds. Submitting to the App Store needs the Apple
  Developer account; Google Play needs a one-time $25 developer account.

## Note on secrets

`eas.json` embeds `EXPO_PUBLIC_SUPABASE_URL` and the Supabase **publishable** key. These are meant to
ship in the client (same trust level as the old anon key — RLS still protects data), so committing them
is fine. Never put the Supabase **service-role** key or the DB password in the app or `eas.json`.
