import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { showToast, toastMessage } from '../src/components/Toast';
import { useAuth } from '../src/context/AuthContext';
import { supabase } from '../src/services/supabase/client';
import { useThemeMode, type ThemeMode } from '../src/theme';

function Row({
  icon,
  label,
  color,
  href,
  onPress,
  right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color?: string;
  href?: string;
  onPress?: () => void;
  right?: React.ReactNode;
}) {
  const { theme } = useThemeMode();
  const c = color ?? theme.colors.text;
  const content = (
    <Pressable
      style={[styles.row, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.borderLight }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={c} />
      <Text style={[styles.rowLabel, { color: c }]}>{label}</Text>
      {right ?? (href || onPress ? <Ionicons name="chevron-forward" size={18} color={theme.colors.textFaint} /> : null)}
    </Pressable>
  );
  return href ? (
    <Link href={href as any} asChild>
      {content}
    </Link>
  ) : (
    content
  );
}

const THEME_MODES: { key: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
];

/** Settings: preferences, support, admin, and the (now tucked-away) sign out. */
export default function SettingsScreen() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const { theme, mode, setMode } = useThemeMode();
  const [deleting, setDeleting] = useState(false);

  function confirmSignOut() {
    Alert.alert('Sign out', 'Sign out of CardLink?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  async function deleteAccount() {
    if (!supabase) return;
    setDeleting(true);
    try {
      const { error } = await supabase.rpc('delete_account');
      if (error) throw error;
      await signOut(); // session is gone server-side; clear local state
    } catch (e) {
      showToast(toastMessage(e));
    } finally {
      setDeleting(false);
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This permanently deletes your account: collection, binders, wishlist, trades, chats, and posts. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Are you absolutely sure?', 'Last chance — everything will be gone for good.', [
              { text: 'Keep my account', style: 'cancel' },
              { text: 'Delete everything', style: 'destructive', onPress: deleteAccount },
            ]),
        },
      ]
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingVertical: 12 }}>
      <Text style={[styles.section, { color: theme.colors.textMuted }]}>Preferences</Text>
      <View style={[styles.group, { borderColor: theme.colors.borderLight }]}>
        <View style={[styles.row, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.borderLight }]}>
          <Ionicons name="moon" size={20} color={theme.colors.text} />
          <Text style={[styles.rowLabel, { color: theme.colors.text }]}>Appearance</Text>
          <View style={styles.modeChips}>
            {THEME_MODES.map((m) => {
              const on = mode === m.key;
              return (
                <Pressable
                  key={m.key}
                  style={[
                    styles.modeChip,
                    { borderColor: on ? theme.colors.primary : theme.colors.border },
                    on && { backgroundColor: theme.colors.primary },
                  ]}
                  onPress={() => setMode(m.key)}
                >
                  <Ionicons name={m.icon} size={14} color={on ? 'white' : theme.colors.textMuted} />
                  <Text style={[styles.modeChipText, { color: on ? 'white' : theme.colors.textMuted }]}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <Text style={[styles.section, { color: theme.colors.textMuted }]}>Support</Text>
      <View style={[styles.group, { borderColor: theme.colors.borderLight }]}>
        <Row icon="chatbox-ellipses" label="Send feedback" href="/feedback" />
        <Row icon="mail" label="Contact us" href="/contact" />
        <Row icon="document-text" label="Terms & Conditions" href="/terms" />
      </View>

      {profile?.isAdmin ? (
        <>
          <Text style={[styles.section, { color: theme.colors.textMuted }]}>Admin</Text>
          <View style={[styles.group, { borderColor: theme.colors.borderLight }]}>
            <Row icon="shield-checkmark" label="Admin console" color={theme.colors.danger} href="/admin" />
          </View>
        </>
      ) : null}

      <Text style={[styles.section, { color: theme.colors.textMuted }]}>Account</Text>
      <View style={[styles.group, { borderColor: theme.colors.borderLight }]}>
        <Row icon="create-outline" label="Edit profile" onPress={() => router.push('/edit-profile')} />
        <Row icon="log-out-outline" label="Sign out" color="#DC2626" onPress={confirmSignOut} />
        <Row
          icon="trash-outline"
          label={deleting ? 'Deleting…' : 'Delete account'}
          color={theme.colors.danger}
          onPress={deleting ? undefined : confirmDeleteAccount}
          right={deleting ? <ActivityIndicator size="small" color={theme.colors.danger} /> : undefined}
        />
      </View>

      <Text style={[styles.version, { color: theme.colors.textFaint }]}>CardLink · v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginHorizontal: 16, marginTop: 18, marginBottom: 6 },
  group: { marginHorizontal: 16, borderRadius: 12, overflow: 'hidden', borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  modeChips: { flexDirection: 'row', gap: 6 },
  modeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  modeChipText: { fontSize: 12, fontWeight: '700' },
  version: { textAlign: 'center', marginTop: 24, fontSize: 13 },
});
