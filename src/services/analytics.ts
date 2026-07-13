import { useEffect } from 'react';
import { supabase } from './supabase/client';

/**
 * Lightweight, self-hosted product analytics: fire-and-forget events into our
 * own `analytics_events` table. Never throws or blocks the UI, and no-ops when
 * Supabase isn't configured or the user isn't signed in (RLS is authenticated-
 * only). Query it in the Supabase SQL editor:
 *
 *   select name, count(*) from analytics_events group by 1 order by 2 desc;
 */
export async function track(name: string, props?: Record<string, unknown>) {
  if (!supabase) return;
  try {
    const { data } = await supabase.auth.getSession(); // local read, no network
    const uid = data.session?.user?.id ?? null;
    await supabase.from('analytics_events').insert({ user_id: uid, name, props: props ?? null });
  } catch {
    // analytics must never affect the app
  }
}

/** Log a screen view once when a screen mounts. */
export function useScreenView(screen: string, extra?: Record<string, unknown>) {
  useEffect(() => {
    track('screen_view', { screen, ...extra });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);
}
