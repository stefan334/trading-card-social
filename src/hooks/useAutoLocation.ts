import * as Location from 'expo-location';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase/client';

/**
 * Keeps the signed-in user's location fresh automatically. On entering the app
 * it asks for location permission once (if not already decided); when granted it
 * reads the current position, rounds it to ~1km for privacy (profiles are
 * public), reverse-geocodes the city, and saves it — but only if it actually
 * changed, to avoid needless writes. Users can still set/refresh it manually in
 * Edit Profile. If permission is denied we never nag; the manual button remains.
 */
export function useAutoLocation() {
  const { user, profile, refreshProfile } = useAuth();
  const meId = user?.id;

  useEffect(() => {
    if (!meId || !supabase) return;
    let cancelled = false;

    (async () => {
      try {
        // Use an already-granted permission silently; only prompt if undecided.
        const current = await Location.getForegroundPermissionsAsync();
        let granted = current.status === 'granted';
        if (!granted && current.canAskAgain && current.status !== 'denied') {
          const req = await Location.requestForegroundPermissionsAsync();
          granted = req.status === 'granted';
        }
        if (!granted || cancelled) return;

        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        const lat = Math.round(pos.coords.latitude * 100) / 100;
        const lng = Math.round(pos.coords.longitude * 100) / 100;

        // Nothing to do if we're still in the same ~1km cell.
        if (profile && profile.latitude === lat && profile.longitude === lng) return;

        let city: string | null = null;
        try {
          const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
          city = geo[0] ? [geo[0].city ?? geo[0].subregion, geo[0].region].filter(Boolean).join(', ') || null : null;
        } catch {
          city = null;
        }
        if (cancelled) return;

        await supabase!.from('profiles').update({ latitude: lat, longitude: lng, location_name: city }).eq('id', meId);
        await refreshProfile();
      } catch {
        // Location is best-effort — never let it break the app.
      }
    })();

    return () => {
      cancelled = true;
    };
    // Run once per session (and when the signed-in user changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId]);
}
