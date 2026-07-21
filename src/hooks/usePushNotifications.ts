import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
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

/** Query prefixes behind every unread badge / inbox row — refreshed on resume or push. */
const BADGE_QUERY_KEYS = [
  ['chat-threads'],
  ['thread-messages'],
  ['notifications'],
  ['notifications-unread'],
  ['trades'],
  ['trade'],
] as const;

/** A cold-start notification tap is delivered once per process (see below). */
let consumedLaunchNotification = false;

/**
 * Push plumbing for the signed-in app:
 * 1. Registers this device's Expo token into push_tokens (DB triggers send).
 * 2. Refreshes unread badges when the app returns from background — realtime
 *    sockets drop while backgrounded and missed events are never replayed, and
 *    react-query can't know we were away (no window focus on native), so the
 *    inbox/bell counts would otherwise sit stale for up to staleTime.
 * 3. Same refresh when a push lands while the app is open.
 * 4. Tapping a push deep-links: chat messages open the thread, everything else
 *    opens the notifications screen.
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const meId = user?.id;
  const queryClient = useQueryClient();
  const router = useRouter();

  // --- 1. Token registration -------------------------------------------------
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

  // --- 2–4. Badge refresh + deep links ---------------------------------------
  useEffect(() => {
    if (!meId) return;

    const refreshBadges = () => {
      for (const key of BADGE_QUERY_KEYS) queryClient.invalidateQueries({ queryKey: [...key] });
    };

    const openFromNotification = (data: Record<string, unknown> | undefined) => {
      if (data?.type === 'chat_message' && typeof data.thread_id === 'string') {
        router.push(`/chat/${data.thread_id}`);
      } else if (data?.type) {
        router.push('/notifications');
      }
    };

    // App came back to the foreground → counts may have moved while we were away.
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshBadges();
    });

    // Push landed while the app is open → update badges live.
    const received = Notifications.addNotificationReceivedListener(refreshBadges);

    // User tapped a push (app was running or backgrounded).
    const tapped = Notifications.addNotificationResponseReceivedListener((response) => {
      refreshBadges();
      openFromNotification(response.notification.request.content.data as any);
    });

    // App was cold-started by tapping a push — the listener above never fires
    // for that one, so fetch and honor it exactly once per process.
    if (!consumedLaunchNotification) {
      consumedLaunchNotification = true;
      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) openFromNotification(response.notification.request.content.data as any);
      });
    }

    return () => {
      appState.remove();
      received.remove();
      tapped.remove();
    };
  }, [meId, queryClient, router]);
}
