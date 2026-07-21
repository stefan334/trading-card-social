import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../../src/services/supabase/client';
import { useTheme } from '../../src/theme';

/**
 * Email confirmation via 6-digit OTP code (mobile-friendly, no deep link needed —
 * works in Expo Go). Reached from the sign-up flow when Supabase returns no
 * session (i.e. "Confirm email" is enabled). On success the session is set and
 * AuthProvider/useProtectedRoute route the user into onboarding.
 *
 * Dashboard requirement: the "Confirm signup" email template must include the
 * code token `{{ .Token }}` (not just the confirmation link) for the code to
 * arrive in the email.
 */
export default function VerifyOtpScreen() {
  const { colors } = useTheme();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleVerify() {
    if (!supabase || !email) return;
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: 'signup',
      });
      if (error) throw error;
      // Success sets the session; the root navigator takes over from here.
    } catch (e: any) {
      setError(e?.message ?? 'Could not verify that code.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!supabase || !email) return;
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw error;
      setInfo('A new code is on its way.');
    } catch (e: any) {
      setError(e?.message ?? 'Could not resend the code.');
    } finally {
      setResending(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>Check your email</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        We sent a 6-digit code to {email ?? 'your email'}. Enter it below to confirm your account.
      </Text>

      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.text }]}
        placeholder="123456"
        placeholderTextColor={colors.textFaint}
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={setCode}
        textAlign="center"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}

      <Pressable
        style={[styles.button, (submitting || code.length < 6) && styles.buttonDisabled]}
        onPress={handleVerify}
        disabled={submitting || code.length < 6}
      >
        {submitting ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Confirm</Text>}
      </Pressable>

      <Pressable onPress={handleResend} disabled={resending} style={styles.resend}>
        <Text style={styles.resendText}>{resending ? 'Sending…' : "Didn't get it? Resend code"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 24,
    letterSpacing: 8,
  },
  button: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 16 },
  resend: { alignItems: 'center', marginTop: 8 },
  resendText: { color: '#2563EB', fontWeight: '600' },
  error: { color: '#DC2626', textAlign: 'center' },
  info: { color: '#059669', textAlign: 'center' },
});
