import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import type { Provider } from '@supabase/supabase-js';
import { supabase } from './client';

// Required so the auth browser tab dismisses and returns control to the app.
WebBrowser.maybeCompleteAuthSession();

/**
 * Redirect target the OAuth provider sends the user back to.
 * - Dev build / production: the app's custom scheme, e.g. `cardlink://` — add this
 *   to Supabase → Authentication → URL Configuration → Redirect URLs.
 * - Expo Go: resolves to an `exp://<host>:<port>` URL that changes with your
 *   network, which is awkward to whitelist — so Google sign-in is best validated
 *   in a dev build. OTP email confirmation works in Expo Go without any of this.
 */
export const oauthRedirectTo = makeRedirectUri({ scheme: 'cardlink' });

/**
 * Turn the provider's post-consent redirect URL into a Supabase session.
 * PKCE returns `?code=...` which we exchange; we also handle the implicit
 * `access_token`/`refresh_token` shape as a fallback.
 */
export async function createSessionFromUrl(url: string) {
  if (!supabase) return null;
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const { code, access_token, refresh_token } = params;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data.session;
  }
  if (access_token) {
    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
    return data.session;
  }
  return null;
}

/**
 * Kicks off a provider OAuth sign-in via an in-app browser tab. On success the
 * session is established (AuthProvider's listener + useProtectedRoute take over).
 * Returns true if a session was created.
 */
export async function signInWithProvider(provider: Provider): Promise<boolean> {
  if (!supabase) return false;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: oauthRedirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) return false;

  const result = await WebBrowser.openAuthSessionAsync(data.url, oauthRedirectTo);
  if (result.type === 'success') {
    const session = await createSessionFromUrl(result.url);
    return Boolean(session);
  }
  return false;
}
