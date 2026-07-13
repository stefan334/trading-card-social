import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const SUPPORT_EMAIL = 'stefan.ivan334@gmail.com';

/** Static "Contact us" screen — email support + pointers to feedback / terms. */
export default function ContactScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Get in touch</Text>
      <Text style={styles.body}>
        Questions, partnership ideas, or something not working? We'd love to hear from you.
      </Text>

      <Pressable style={styles.row} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
        <Ionicons name="mail" size={22} color="#2563EB" />
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>Email us</Text>
          <Text style={styles.rowSub}>{SUPPORT_EMAIL}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </Pressable>

      <Link href="/feedback" asChild>
        <Pressable style={styles.row}>
          <Ionicons name="chatbox-ellipses" size={22} color="#2563EB" />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Send in-app feedback</Text>
            <Text style={styles.rowSub}>Report a bug or suggest a feature</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </Pressable>
      </Link>

      <Link href="/terms" asChild>
        <Pressable style={styles.row}>
          <Ionicons name="document-text" size={22} color="#2563EB" />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Terms & Conditions</Text>
            <Text style={styles.rowSub}>How the app and trades work</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </Pressable>
      </Link>

      <Text style={styles.footer}>We usually reply within a couple of days.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 22, fontWeight: '800' },
  body: { color: '#6B7280', marginTop: 6, marginBottom: 16, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  rowTitle: { fontWeight: '700', fontSize: 15 },
  rowSub: { color: '#6B7280', fontSize: 13, marginTop: 1 },
  footer: { color: '#9CA3AF', textAlign: 'center', marginTop: 12 },
});
