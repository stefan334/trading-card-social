import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useAuth } from '../src/context/AuthContext';

function Row({
  icon,
  label,
  color = '#111827',
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
  const content = (
    <Pressable style={styles.row} onPress={onPress}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.rowLabel, { color }]}>{label}</Text>
      {right ?? (href || onPress ? <Ionicons name="chevron-forward" size={18} color="#9CA3AF" /> : null)}
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

/** Settings: preferences, support, admin, and the (now tucked-away) sign out. */
export default function SettingsScreen() {
  const { profile, signOut } = useAuth();
  const router = useRouter();

  function confirmSignOut() {
    Alert.alert('Sign out', 'Sign out of CardLink?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={{ paddingVertical: 12 }}>
      <Text style={styles.section}>Preferences</Text>
      <View style={styles.group}>
        <View style={styles.row}>
          <Ionicons name="moon" size={20} color="#111827" />
          <Text style={styles.rowLabel}>Dark mode</Text>
          <View style={styles.soonWrap}>
            <Text style={styles.soon}>Coming soon</Text>
            <Switch value={false} disabled />
          </View>
        </View>
      </View>

      <Text style={styles.section}>Support</Text>
      <View style={styles.group}>
        <Row icon="chatbox-ellipses" label="Send feedback" href="/feedback" />
        <Row icon="mail" label="Contact us" href="/contact" />
        <Row icon="document-text" label="Terms & Conditions" href="/terms" />
      </View>

      {profile?.isAdmin ? (
        <>
          <Text style={styles.section}>Admin</Text>
          <View style={styles.group}>
            <Row icon="shield-checkmark" label="Admin console" color="#DC2626" href="/admin" />
          </View>
        </>
      ) : null}

      <Text style={styles.section}>Account</Text>
      <View style={styles.group}>
        <Row icon="create-outline" label="Edit profile" onPress={() => router.push('/edit-profile')} />
        <Row icon="log-out-outline" label="Sign out" color="#DC2626" onPress={confirmSignOut} />
      </View>

      <Text style={styles.version}>CardLink · v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', marginHorizontal: 16, marginTop: 18, marginBottom: 6 },
  group: { marginHorizontal: 16, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#F3F4F6' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'white', paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  soonWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  soon: { color: '#9CA3AF', fontSize: 12, fontStyle: 'italic' },
  version: { textAlign: 'center', color: '#9CA3AF', marginTop: 24, fontSize: 13 },
});
