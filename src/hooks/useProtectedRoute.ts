import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { isSupabaseConfigured } from '../services/supabase/client';
import { useAuth } from '../context/AuthContext';

/**
 * Redirects based on auth + onboarding state:
 *   - signed out            -> /(auth)/sign-in
 *   - signed in, no profile onboarding done -> /onboarding
 *   - signed in + onboarded, but sitting on an auth/onboarding screen -> /(tabs)
 *
 * No-ops entirely when Supabase isn't configured, so a fresh clone without .env
 * still boots into the tabs (which render their own "connect Supabase" notices).
 */
export function useProtectedRoute() {
  const { session, isOnboarded, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured || loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session && !isOnboarded && !inOnboarding) {
      router.replace('/onboarding');
    } else if (session && isOnboarded && (inAuthGroup || inOnboarding)) {
      router.replace('/(tabs)');
    }
  }, [session, isOnboarded, loading, segments, router]);
}
