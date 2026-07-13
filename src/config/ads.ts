import { Platform } from 'react-native';

/**
 * AdMob IDs.
 *
 * These are PUBLIC — they ship inside the app binary, so committing them is fine
 * (they are not secrets like an API key). To go live with real ads:
 *
 *   1. Create an app + ad units at https://admob.google.com
 *   2. Paste your real **App IDs** into app.json → plugins →
 *      "react-native-google-mobile-ads" (androidAppId / iosAppId).
 *   3. Paste your real **banner ad-unit IDs** into REAL_BANNER below.
 *   4. Rebuild with EAS (`eas build --profile preview --platform android`).
 *
 * Until REAL_BANNER is filled in — and ALWAYS in development — the app serves
 * Google's official TEST ads, so you never risk your AdMob account by generating
 * "invalid traffic" (e.g. tapping your own live ads).
 */

// Google's official TEST banner units (safe to tap; never earn/charge anyone).
const TEST_BANNER = Platform.select({
  android: 'ca-app-pub-3940256099942544/6300978111',
  ios: 'ca-app-pub-3940256099942544/2934735716',
})!;

// Real banner ad-unit IDs (format: ca-app-pub-XXXXXXXX/YYYYYYYY). Android is live;
// add an iOS unit here if/when you ship an iOS build.
const REAL_BANNER = Platform.select({
  android: 'ca-app-pub-4081444945442418/4137440146',
  ios: '',
});

/** The banner unit to actually load: real in production once set, test otherwise. */
export const BANNER_UNIT_ID = __DEV__ || !REAL_BANNER ? TEST_BANNER : REAL_BANNER;

/** True once you've supplied at least one real unit (used only for logging/debug). */
export const ADS_LIVE = !__DEV__ && !!REAL_BANNER;
