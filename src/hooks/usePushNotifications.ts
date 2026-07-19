import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase/client';

// Show pushes as banners while the app is foregrounded (chat/trade updates).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Registers this device for push. Asks for permission once (never re-nags a
 * denial), gets the Expo push token, and upserts it into push_tokens — DB
 * triggers (0023) do the sending. Silently no-ops where push can't work:
 * Expo Go, emulators, or Android builds without FCM credentials on EAS.
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const meId = user?.id;

  useEffect(() => {
    if (!meId || !supabase) return;
    (async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }

        const current = await Notifications.getPermissionsAsync();
        let status = current.status;
        if (status !== 'granted' && current.canAskAgain) {
          status = (await Notifications.requestPermissionsAsync()).status;
        }
        if (status !== 'granted') return;

        const projectId: string | undefined = (Constants.expoConfig?.extra as any)?.eas?.projectId;
        const { data: token } = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        if (!token) return;

        await supabase!
          .from('push_tokens')
          .upsert({ token, user_id: meId, platform: Platform.OS, updated_at: new Date().toISOString() });
      } catch {
        // Push registration is best-effort — never let it affect the app.
      }
    })();
  }, [meId]);
}
