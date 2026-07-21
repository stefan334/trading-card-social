import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showToast, toastMessage } from '../src/components/Toast';
import { useAuth } from '../src/context/AuthContext';
import { supabase } from '../src/services/supabase/client';
import { useThemeMode, type ThemeMode } from '../src/theme';

/**
 * One settings row, iOS-style: a fixed-size tinted icon tile (keeps labels
 * optically aligned across different glyphs), label, chevron/right accessory,
 * pressed feedback, and a hairline separator inset to the label (none on the
 * last row, so the rounded group edge stays clean).
 */
function Row({
  icon,
  label,
  tint,
  labelColor,
  onPress,
  right,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint?: string;
  labelColor?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  last?: boolean;
}) {
  const { theme } = useThemeMode();
  const iconColor = tint ?? theme.colors.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed && onPress ? theme.colors.surface : theme.colors.card },
      ]}
    >
      <View style={[styles.iconTile, { backgroundColor: theme.colors.surface }]}>
        <Ionicons name={icon} size={17} color={iconColor} />
      </View>
      <View style={[styles.rowBody, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.rowLabel, { color: labelColor ?? theme.colors.text }]}>{label}</Text>
        {right ?? (onPress ? <Ionicons name="chevron-forward" size={17} color={theme.colors.textFaint} /> : null)}
      </View>
    </Pressable>
  );
}

const THEME_MODES: { key: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
];

/** Settings: preferences, support, admin, and account actions. */
export default function SettingsScreen() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const { theme, mode, setMode } = useThemeMode();
  const insets = useSafeAreaInsets();
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

  const groupStyle = [styles.group, { backgroundColor: theme.colors.card, borderColor: theme.colors.borderLight }];

  return (
    <ScrollView contentContainerStyle={{ paddingVertical: 12, paddingBottom: 40 + insets.bottom }}>
      <Text style={[styles.section, { color: theme.colors.textMuted }]}>Preferences</Text>
      <View style={groupStyle}>
        <View style={styles.appearanceBlock}>
          <View style={styles.appearanceHead}>
            <View style={[styles.iconTile, { backgroundColor: theme.colors.surface }]}>
              <Ionicons name="moon" size={17} color={theme.colors.primary} />
            </View>
            <Text style={[styles.rowLabel, { color: theme.colors.text }]}>Appearance</Text>
          </View>
          <View style={[styles.segment, { backgroundColor: theme.colors.surface }]}>
            {THEME_MODES.map((m) => {
              const on = mode === m.key;
              return (
                <Pressable
                  key={m.key}
                  style={[styles.segmentBtn, on && { backgroundColor: theme.colors.primary }]}
                  onPress={() => setMode(m.key)}
                >
                  <Ionicons name={m.icon} size={15} color={on ? 'white' : theme.colors.textMuted} />
                  <Text style={[styles.segmentText, { color: on ? 'white' : theme.colors.textMuted }]}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <Text style={[styles.section, { color: theme.colors.textMuted }]}>Support</Text>
      <View style={groupStyle}>
        <Row icon="chatbox-ellipses" label="Send feedback" onPress={() => router.push('/feedback')} />
        <Row icon="mail" label="Contact us" onPress={() => router.push('/contact')} />
        <Row icon="document-text" label="Terms & Conditions" onPress={() => router.push('/terms')} />
        <Row icon="lock-closed-outline" label="Privacy Policy" onPress={() => router.push('/privacy' as any)} last />
      </View>

      {profile?.isAdmin ? (
        <>
          <Text style={[styles.section, { color: theme.colors.textMuted }]}>Admin</Text>
          <View style={groupStyle}>
            <Row icon="shield-checkmark" label="Admin console" tint={theme.colors.danger} onPress={() => router.push('/admin')} last />
          </View>
        </>
      ) : null}

      <Text style={[styles.section, { color: theme.colors.textMuted }]}>Account</Text>
      <View style={groupStyle}>
        <Row icon="create-outline" label="Edit profile" onPress={() => router.push('/edit-profile')} />
        <Row icon="ban-outline" label="Blocked users" onPress={() => router.push('/blocked' as any)} />
        <Row icon="log-out-outline" label="Sign out" tint={theme.colors.danger} labelColor={theme.colors.danger} onPress={confirmSignOut} />
        <Row
          icon="trash-outline"
          label={deleting ? 'Deleting…' : 'Delete account'}
          tint={theme.colors.danger}
          labelColor={theme.colors.danger}
          onPress={deleting ? undefined : confirmDeleteAccount}
          right={deleting ? <ActivityIndicator size="small" color={theme.colors.danger} /> : undefined}
          last
        />
      </View>

      <Text style={[styles.version, { color: theme.colors.textFaint }]}>CardLink · v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginHorizontal: 20, marginTop: 20, marginBottom: 8 },
  group: { marginHorizontal: 16, borderRadius: 14, overflow: 'hidden', borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14 },
  iconTile: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingRight: 14 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  appearanceBlock: { paddingHorizontal: 14, paddingVertical: 14, gap: 12 },
  appearanceHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 3, gap: 3 },
  segmentBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 8, paddingVertical: 8 },
  segmentText: { fontSize: 13, fontWeight: '700' },
  version: { textAlign: 'center', marginTop: 28, fontSize: 13 },
});
