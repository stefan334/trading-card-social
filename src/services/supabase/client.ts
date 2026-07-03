import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * True once .env has real Supabase project values. Until then `supabase` is
 * null and any screen touching the DB should render a "connect Supabase"
 * placeholder instead of querying — see src/hooks/useIsSupabaseReady.ts.
 * This lets the app run (navigation, Pokemon TCG API screens) before a
 * Supabase project has been created, which no AI agent can do on its own
 * since it requires the user's Supabase account.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        // PKCE is the recommended, more secure flow for mobile OAuth: the browser
        // redirect returns a short-lived `code` that we exchange for a session
        // (see src/services/supabase/oauth.ts). Does not affect password or OTP auth.
        flowType: 'pkce',
      },
    })
  : null;

if (!isSupabaseConfigured) {
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY not set — copy .env.example to .env and fill in your Supabase project values. DB-backed screens will show a setup placeholder until then.'
  );
}
