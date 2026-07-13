import { StyleSheet, View } from 'react-native';
import { BANNER_UNIT_ID } from '../config/ads';

// AdMob is a native module — it isn't present in Expo Go, so require it
// defensively. In Expo Go (or if the module fails to load) FeedAd renders null
// instead of crashing; it works in EAS/dev builds where the native module ships.
let BannerAd: any;
let BannerAdSize: any;
try {
  const ads = require('react-native-google-mobile-ads');
  BannerAd = ads.BannerAd;
  BannerAdSize = ads.BannerAdSize;
  // Initialise the SDK once on module load (safe to call repeatedly).
  ads.default?.().initialize?.();
} catch {
  // not available in this runtime
}

/** A sponsored slot rendered between feed posts. Renders nothing if ads are unavailable. */
export function FeedAd() {
  if (!BannerAd || !BANNER_UNIT_ID) return null;
  return (
    <View style={styles.wrap}>
      <BannerAd unitId={BANNER_UNIT_ID} size={BannerAdSize.MEDIUM_RECTANGLE} />
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
