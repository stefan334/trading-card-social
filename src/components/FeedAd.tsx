import { Platform, StyleSheet, View } from 'react-native';

// AdMob is a native module — it isn't present in Expo Go, so require it
// defensively. In Expo Go (or if the module fails to load) FeedAd renders null
// instead of crashing; it works in EAS/dev builds where the native module ships.
let BannerAd: any;
let BannerAdSize: any;
let TestIds: any;
try {
  const ads = require('react-native-google-mobile-ads');
  BannerAd = ads.BannerAd;
  BannerAdSize = ads.BannerAdSize;
  TestIds = ads.TestIds;
  // Initialise the SDK once on module load (safe to call repeatedly).
  ads.default?.().initialize?.();
} catch {
  // not available in this runtime
}

// Your real AdMob ad-unit IDs go in env (EXPO_PUBLIC_ADMOB_BANNER_*). Until then
// — and always in dev — we serve Google's official TEST ad so there are no
// invalid-traffic issues. Swapping in the real unit is just setting the env var.
const REAL_UNIT = Platform.select({
  android: process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID,
  ios: process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS,
});
const UNIT_ID = !__DEV__ && REAL_UNIT ? REAL_UNIT : TestIds?.BANNER;

/** A sponsored slot rendered between feed posts. Renders nothing if ads are unavailable. */
export function FeedAd() {
  if (!BannerAd || !UNIT_ID) return null;
  return (
    <View style={styles.wrap}>
      <BannerAd unitId={UNIT_ID} size={BannerAdSize.MEDIUM_RECTANGLE} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: 'white',
    borderRadius: 14,
    paddingVertical: 10,
    minHeight: 60,
  },
});
