import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SupabaseSetupNotice } from './SupabaseSetupNotice';
import { isSupabaseConfigured, supabase } from '../services/supabase/client';
import { signInWithProvider } from '../services/supabase/oauth';
import { useTheme } from '../theme';

type Mode = 'sign-in' | 'sign-up';

/**
 * Shared email/password auth form for the sign-in and sign-up screens.
 * On success the AuthProvider's onAuthStateChange fires and useProtectedRoute
 * routes the user onward (to onboarding or the tabs), so this component doesn't
 * navigate itself. OAuth (Google/Apple) is not wired yet — it needs provider
 * client IDs configured in the Supabase dashboard (CHECKLIST Phase 2).
 */
export function AuthForm({ mode }: { mode: Mode }) {
  const { colors } = useTheme();
  const isSignUp = mode === 'sign-up';
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleGoogle() {
    setError(null);
    setInfo(null);
    setGoogleLoading(true);
    try {
      await signInWithProvider('google');
      // On success the auth listener + route guard take over; nothing to do here.
    } catch (e: any) {
      setError(e?.message ?? 'Google sign-in failed.');
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleSubmit() {
    if (!supabase) return;
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      if (isSignUp) {
        const trimmedEmail = email.trim();
        const { data, error } = await supabase.auth.signUp({ email: trimmedEmail, password });
        if (error) throw error;
        // If email confirmation is enabled in the Supabase dashboard, no session
        // is returned — send the user to the OTP screen to enter the emailed code.
        // If confirmation is off, a session is returned and useProtectedRoute
        // moves them straight into onboarding.
        if (!data.session) {
          router.push({ pathname: '/(auth)/verify-otp', params: { email: trimmedEmail } });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <View style={styles.container}>
        <SupabaseSetupNotice />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.brand}>CardLink</Text>
      <Text style={[styles.title, { color: colors.text }]}>{isSignUp ? 'Create your account' : 'Welcome back'}</Text>

      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.text }]}
        placeholder="Email"
        placeholderTextColor="#9CA3AF"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <View style={styles.passwordRow}>
        <TextInput
          style={[styles.input, styles.passwordInput, { borderColor: colors.border, color: colors.text }]}
          placeholder="Password"
          placeholderTextColor="#9CA3AF"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
        />
        <Pressable style={styles.eye} onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
          <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6B7280" />
        </Pressable>
      </View>

      {!isSignUp && (
        <Pressable onPress={() => router.push('/(auth)/forgot-password' as any)} hitSlop={6} style={styles.forgotWrap}>
          <Text style={[styles.link, { color: colors.primary }]}>Forgot password?</Text>
        </Pressable>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}

      <Pressable
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={submitting || !email || !password}
      >
        {submitting ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>{isSignUp ? 'Sign up' : 'Sign in'}</Text>
        )}
      </Pressable>

      <View style={styles.switchRow}>
        <Text style={[styles.muted, { color: colors.textMuted }]}>{isSignUp ? 'Already have an account?' : "Don't have an account?"}</Text>
        <Link href={isSignUp ? '/(auth)/sign-in' : '/(auth)/sign-up'} style={styles.link}>
          {isSignUp ? 'Sign in' : 'Sign up'}
        </Link>
      </View>

      <View style={styles.divider}>
        <View style={[styles.line, { backgroundColor: colors.borderLight }]} />
        <Text style={styles.dividerText}>or</Text>
        <View style={[styles.line, { backgroundColor: colors.borderLight }]} />
      </View>

      <Pressable style={[styles.googleButton, { borderColor: colors.border }]} onPress={handleGoogle} disabled={googleLoading || submitting}>
        {googleLoading ? (
          <ActivityIndicator color="#374151" />
        ) : (
          <>
            <Ionicons name="logo-google" size={18} color="#374151" />
            <Text style={[styles.googleText, { color: colors.text }]}>Continue with Google</Text>
          </>
        )}
      </Pressable>

      <Text style={styles.oauthNote}>Apple sign-in coming soon.</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  brand: { fontSize: 28, fontWeight: '800', color: '#2563EB', textAlign: 'center' },
  title: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  passwordRow: { justifyContent: 'center' },
  passwordInput: { paddingRight: 46 },
  eye: { position: 'absolute', right: 12, padding: 4 },
  button: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 16 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 },
  muted: { color: '#6B7280' },
  link: { color: '#2563EB', fontWeight: '600' },
  forgotWrap: { alignSelf: 'flex-end', marginTop: -4 },
  error: { color: '#DC2626' },
  info: { color: '#059669' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  line: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { color: '#9CA3AF' },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingVertical: 13,
    marginTop: 12,
  },
  googleText: { fontWeight: '600', fontSize: 15, color: '#374151' },
  oauthNote: { color: '#9CA3AF', textAlign: 'center', marginTop: 16, fontSize: 13 },
});
