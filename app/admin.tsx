import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { supabase } from '../src/services/supabase/client';
import { useTheme } from '../src/theme';
import { formatRelativeTime } from '../src/utils/time';

function useOpenReports(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'reports'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('reports')
        .select(
          'id, reason, details, status, created_at, reporter:profiles!reports_reporter_id_fkey(username), reported:profiles!reports_reported_profile_id_fkey(id, username, display_name, is_banned)'
        )
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

function useRecentFeedback(enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'feedback'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('feedback')
        .select('id, kind, message, created_at, user:profiles(username)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

/** Admin-only moderation console: review reports (ban/dismiss) + read feedback. */
export default function AdminScreen() {
  const { profile } = useAuth();
  const isAdmin = !!profile?.isAdmin;
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { data: reports, isLoading: reportsLoading } = useOpenReports(isAdmin);
  const { data: feedback } = useRecentFeedback(isAdmin);
  const [busy, setBusy] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <View style={styles.denied}>
        <Ionicons name="lock-closed" size={40} color="#9CA3AF" />
        <Text style={[styles.deniedText, { color: colors.textMuted }]}>This area is for admins only.</Text>
      </View>
    );
  }

  async function setStatus(reportId: string, status: 'dismissed' | 'actioned') {
    await supabase!.from('reports').update({ status }).eq('id', reportId);
    qc.invalidateQueries({ queryKey: ['admin', 'reports'] });
  }

  async function ban(reportId: string, userId: string, username: string) {
    Alert.alert('Ban user', `Ban @${username}? Their content will be hidden from the app.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Ban',
        style: 'destructive',
        onPress: async () => {
          setBusy(reportId);
          try {
            const { error } = await supabase!.rpc('admin_set_banned', { p_user: userId, p_banned: true });
            if (error) throw error;
            await setStatus(reportId, 'actioned');
          } catch (e: any) {
            Alert.alert('Could not ban', e?.message ?? 'Try again.');
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={[styles.h, { color: colors.text }]}>Open reports {reports?.length ? `(${reports.length})` : ''}</Text>
      {reportsLoading ? (
        <ActivityIndicator style={{ marginTop: 12 }} />
      ) : !reports?.length ? (
        <Text style={[styles.muted, { color: colors.textMuted }]}>Nothing to review — the queue is clear. 🎉</Text>
      ) : (
        reports.map((r) => (
          <View key={r.id} style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.cardHead}>
              <Text style={styles.reason}>{r.reason}</Text>
              <Text style={styles.time}>{formatRelativeTime(r.created_at)}</Text>
            </View>
            <Text style={[styles.line, { color: colors.text }]}>
              Reported:{' '}
              <Link href={`/user/${r.reported?.id}`} style={styles.link}>
                @{r.reported?.username}
              </Link>
              {r.reported?.is_banned ? '  · already banned' : ''}
            </Text>
            <Text style={[styles.line, { color: colors.text }]}>By: @{r.reporter?.username}</Text>
            {r.details ? <Text style={[styles.details, { color: colors.textMuted }]}>“{r.details}”</Text> : null}
            <View style={styles.actions}>
              <Pressable style={[styles.btn, { backgroundColor: colors.surface }]} onPress={() => setStatus(r.id, 'dismissed')} disabled={busy === r.id}>
                <Text style={[styles.dismissText, { color: colors.text }]}>Dismiss</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.banBtn]}
                onPress={() => ban(r.id, r.reported?.id, r.reported?.username)}
                disabled={busy === r.id || r.reported?.is_banned}
              >
                {busy === r.id ? <ActivityIndicator color="white" /> : <Text style={styles.banText}>Ban user</Text>}
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Text style={[styles.h, { marginTop: 28, color: colors.text }]}>Recent feedback</Text>
      {!feedback?.length ? (
        <Text style={[styles.muted, { color: colors.textMuted }]}>No feedback yet.</Text>
      ) : (
        feedback.map((f) => (
          <View key={f.id} style={[styles.fbCard, { backgroundColor: colors.card, borderColor: colors.borderLight }]}>
            <View style={styles.cardHead}>
              <Text style={styles.kind}>{f.kind}</Text>
              <Text style={styles.time}>{formatRelativeTime(f.created_at)}</Text>
            </View>
            <Text style={[styles.fbMsg, { color: colors.text }]}>{f.message}</Text>
            <Text style={styles.fbBy}>{f.user?.username ? `@${f.user.username}` : 'anonymous'}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  denied: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  deniedText: { color: '#6B7280', fontSize: 15 },
  h: { fontSize: 18, fontWeight: '800', marginBottom: 10 },
  muted: { color: '#6B7280' },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#FEE2E2' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  reason: { fontWeight: '800', color: '#DC2626' },
  time: { color: '#9CA3AF', fontSize: 12 },
  line: { color: '#374151', marginTop: 2 },
  link: { color: '#2563EB', fontWeight: '700' },
  details: { color: '#6B7280', fontStyle: 'italic', marginTop: 6, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { flex: 1, borderRadius: 9, paddingVertical: 10, alignItems: 'center' },
  dismiss: { backgroundColor: '#F3F4F6' },
  dismissText: { color: '#374151', fontWeight: '700' },
  banBtn: { backgroundColor: '#DC2626' },
  banText: { color: 'white', fontWeight: '700' },
  fbCard: { backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  kind: { fontWeight: '800', color: '#2563EB', textTransform: 'capitalize' },
  fbMsg: { color: '#374151', lineHeight: 20 },
  fbBy: { color: '#9CA3AF', fontSize: 12, marginTop: 6 },
});
