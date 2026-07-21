import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { supabase } from '../../src/services/supabase/client';
import { useTheme } from '../../src/theme';

/**
 * Forgot-password flow, all in one screen:
 *  1. Enter your email → Supabase emails a 6-digit recovery code.
 *  2. Enter the code + a new password → verifyOtp(type 'recovery') signs you in,
 *     then updateUser sets the new password. The route guard takes over from there.
 * (The Supabase "Reset Password" email template must include {{ .Token }}.)
 */
export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    if (!supabase || !email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      setStep('reset');
    } catch (e: any) {
      setError(e?.message ?? 'Could not send the code. Check the email address.');
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!supabase || code.trim().length < 6 || password.length < 6) return;
    setBusy(true);
    setError(null);
    try {
      const { error: otpErr } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'recovery',
      });
      if (otpErr) throw otpErr;
      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) throw pwErr;
      // Signed in with the new password — the route guard sends us into the app.
    } catch (e: any) {
      setError(e?.message ?? 'Invalid or expired code. Request a new one.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={[styles.brand, { color: colors.primary }]}>CardLink</Text>
      <Text style={[styles.title, { color: colors.text }]}>
        {step === 'email' ? 'Reset your password' : 'Check your email'}
      </Text>

      {step === 'email' ? (
        <>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Enter your account email and we'll send you a 6-digit reset code.
          </Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            placeholder="Email"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Pressable
            style={[styles.button, { backgroundColor: colors.primary }, (busy || !email.trim()) && styles.disabled]}
            onPress={sendCode}
            disabled={busy || !email.trim()}
          >
            {busy ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Send reset code</Text>}
          </Pressable>
        </>
      ) : (
        <>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            We sent a 6-digit code to {email.trim()}. Enter it below with your new password.
          </Text>
          <TextInput
            style={[styles.input, styles.codeInput, { borderColor: colors.border, color: colors.text }]}
            placeholder="6-digit code"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            maxLength={8}
            value={code}
            onChangeText={setCode}
          />
          <Pressable style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput, { borderColor: colors.border, color: colors.text }]}
              placeholder="New password (min 6 characters)"
              placeholderTextColor={colors.textFaint}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable style={styles.eye} onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
            </Pressable>
          </Pressable>
          <Pressable
            style={[
              styles.button,
              { backgroundColor: colors.primary },
              (busy || code.trim().length < 6 || password.length < 6) && styles.disabled,
            ]}
            onPress={resetPassword}
            disabled={busy || code.trim().length < 6 || password.length < 6}
          >
            {busy ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Set new password</Text>}
          </Pressable>
          <Pressable onPress={sendCode} disabled={busy} hitSlop={6}>
            <Text style={[styles.link, { color: colors.primary }]}>Resend code</Text>
          </Pressable>
        </>
      )}

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      <Pressable onPress={() => router.back()} hitSlop={6}>
        <Text style={[styles.link, { color: colors.textMuted }]}>Back to sign in</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  brand: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  title: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  hint: { textAlign: 'center', lineHeight: 20, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  codeInput: { textAlign: 'center', letterSpacing: 6, fontSize: 18, fontWeight: '700' },
  passwordRow: { justifyContent: 'center' },
  passwordInput: { paddingRight: 46 },
  eye: { position: 'absolute', right: 12, padding: 4 },
  button: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  disabled: { opacity: 0.5 },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 16 },
  link: { textAlign: 'center', fontWeight: '600', marginTop: 10 },
  error: { textAlign: 'center' },
});
