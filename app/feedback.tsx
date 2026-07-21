import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/context/AuthContext';
import { useKeyboardHeight } from '../src/hooks/useKeyboardHeight';
import { useTheme } from '../src/theme';
import { track } from '../src/services/analytics';
import { supabase } from '../src/services/supabase/client';

const KINDS = [
  { key: 'feedback', label: 'Feedback' },
  { key: 'bug', label: 'Bug' },
  { key: 'idea', label: 'Idea' },
  { key: 'other', label: 'Other' },
] as const;

/** Let users send feedback / bug reports / ideas — stored in the feedback table (admin-readable). */
export default function FeedbackScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const keyboardHeight = useKeyboardHeight(); // keep the Send button reachable
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<(typeof KINDS)[number]['key']>('feedback');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!message.trim() || !supabase) return;
    setSending(true);
    setError(null);
    try {
      const { error } = await supabase.from('feedback').insert({
        user_id: user?.id ?? null,
        kind,
        message: message.trim(),
      });
      if (error) throw error;
      track('feedback_submitted', { kind });
      setSent(true);
    } catch (e: any) {
      setError(e?.message ?? 'Could not send. Please try again.');
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <View style={styles.doneWrap}>
        <Ionicons name="checkmark-circle" size={56} color="#059669" />
        <Text style={[styles.doneTitle, { color: colors.text }]}>Thanks for the feedback!</Text>
        <Text style={[styles.doneText, { color: colors.textMuted }]}>We read every message — it really helps shape the app.</Text>
        <Pressable style={styles.primary} onPress={() => router.back()}>
          <Text style={styles.primaryText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 16 + Math.max(insets.bottom, keyboardHeight) }]} keyboardShouldPersistTaps="handled">
      <Text style={[styles.label, { color: colors.text }]}>What's this about?</Text>
      <View style={styles.chips}>
        {KINDS.map((k) => (
          <Pressable key={k.key} style={[styles.chip, { borderColor: colors.border }, kind === k.key && styles.chipOn]} onPress={() => setKind(k.key)}>
            <Text style={[styles.chipText, { color: colors.textMuted }, kind === k.key && styles.chipTextOn]}>{k.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Your message</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.text }]}
        placeholder="Tell us what you think, what broke, or what you'd love to see…"
        placeholderTextColor={colors.textFaint}
        value={message}
        onChangeText={setMessage}
        multiline
        autoFocus
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={[styles.primary, (!message.trim() || sending) && styles.disabled]} onPress={send} disabled={!message.trim() || sending}>
        {sending ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>Send</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  label: { fontWeight: '700', fontSize: 15, marginTop: 12, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  chipOn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { color: '#374151', fontWeight: '600' },
  chipTextOn: { color: 'white' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 12, minHeight: 140, textAlignVertical: 'top', fontSize: 15 },
  error: { color: '#DC2626', marginTop: 12 },
  primary: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  primaryText: { color: 'white', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.5 },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  doneTitle: { fontSize: 20, fontWeight: '800' },
  doneText: { color: '#6B7280', textAlign: 'center', lineHeight: 20 },
});
