import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { track } from '../src/services/analytics';
import { useTheme } from '../src/theme';
import { supabase } from '../src/services/supabase/client';

const REASONS = ['Spam', 'Scam or fraud', 'Harassment', 'Inappropriate content', 'Counterfeit cards', 'Other'];

/** Report a profile, routed as /report?profile=<userId>&name=<name>. Files a row in `reports`. */
export default function ReportScreen() {
  const { profile: reportedId, name } = useLocalSearchParams<{ profile: string; name?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason || !reportedId || !user || !supabase) return;
    setSending(true);
    setError(null);
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        reported_profile_id: reportedId,
        reason,
        details: details.trim() || null,
      });
      if (error) throw error;
      track('report_submitted', { reason });
      setSent(true);
    } catch (e: any) {
      setError(e?.message ?? 'Could not send the report. Please try again.');
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <View style={styles.doneWrap}>
        <Ionicons name="shield-checkmark" size={56} color="#059669" />
        <Text style={[styles.doneTitle, { color: colors.text }]}>Report sent</Text>
        <Text style={[styles.doneText, { color: colors.textMuted }]}>Thanks — our team will review it. You won't hear back on every report, but we look at all of them.</Text>
        <Pressable style={styles.primary} onPress={() => router.back()}>
          <Text style={styles.primaryText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={[styles.title, { color: colors.text }]}>Report {name ? `@${name}` : 'this profile'}</Text>
      <Text style={[styles.sub, { color: colors.textMuted }]}>Tell us what's wrong. Reports are confidential.</Text>

      <Text style={[styles.label, { color: colors.text }]}>Reason</Text>
      <View style={styles.chips}>
        {REASONS.map((r) => (
          <Pressable key={r} style={[styles.chip, { borderColor: colors.border }, reason === r && styles.chipOn]} onPress={() => setReason(r)}>
            <Text style={[styles.chipText, { color: colors.textMuted }, reason === r && styles.chipTextOn]}>{r}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, { color: colors.text }]}>Details (optional)</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.text }]}
        placeholder="Anything that helps us understand…"
        placeholderTextColor={colors.textFaint}
        value={details}
        onChangeText={setDetails}
        multiline
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={[styles.primary, (!reason || sending) && styles.disabled]} onPress={submit} disabled={!reason || sending}>
        {sending ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>Submit report</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 20, fontWeight: '800' },
  sub: { color: '#6B7280', marginTop: 4, marginBottom: 8 },
  label: { fontWeight: '700', fontSize: 15, marginTop: 16, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  chipOn: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  chipText: { color: '#374151', fontWeight: '600' },
  chipTextOn: { color: 'white' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 12, minHeight: 110, textAlignVertical: 'top', fontSize: 15 },
  error: { color: '#DC2626', marginTop: 12 },
  primary: { backgroundColor: '#DC2626', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  primaryText: { color: 'white', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.5 },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  doneTitle: { fontSize: 20, fontWeight: '800' },
  doneText: { color: '#6B7280', textAlign: 'center', lineHeight: 20 },
});
