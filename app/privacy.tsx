import { ScrollView, StyleSheet, Text } from 'react-native';
import { useTheme } from '../src/theme';

/**
 * Privacy Policy, in-app copy. The canonical version lives on the website
 * (docs/privacy.html → GitHub Pages); keep the two in sync when it changes.
 */
const SECTIONS: { h: string; b: string }[] = [
  {
    h: '1. What we collect',
    b: 'Your account details (email, username, display name, optional bio and avatar); your content (collection, binders, wishlist, trades, reviews, chat messages, and photos you upload); with your permission, your approximate location (rounded to ~1 km plus a city name) to power nearby trading — your rounded area is visible on your public profile, your precise location is never stored; a push token so notifications can reach your device; basic in-app usage events stored in our own database (no third-party analytics trackers); and anything you send via the feedback or report forms.',
  },
  {
    h: '2. Advertising',
    b: 'The app shows ads served by Google AdMob, which may collect device identifiers (such as the advertising ID) to serve and measure ads under Google’s privacy policy. Where required by law, you’ll be asked for consent before personalised ads are shown.',
  },
  {
    h: '3. Card scanning',
    b: 'When you scan a card, the photo is sent to our server, which uses Google Cloud Vision to read the card’s name and number for matching. Photos you explicitly attach to your collection or chats are stored with your account.',
  },
  {
    h: '4. Who processes your data',
    b: 'Supabase (database, authentication, storage), Expo (push notification delivery), Google (AdMob ads, Cloud Vision scanning), and Resend (account emails). Card catalogue data and images come from public sources; your personal data is not sent to them. We never sell your personal information.',
  },
  {
    h: '5. Your rights & deletion',
    b: 'You can access, correct, export, or delete your data, and withdraw consent (location, notifications) in your device settings at any time. Delete your account instantly in Settings → Delete account — it permanently removes your profile, content, photos, and tokens. EU/EEA users can also lodge a complaint with their local supervisory authority.',
  },
  {
    h: '6. Retention & security',
    b: 'Data is kept while your account exists and removed when you delete it (backup copies purge on a rolling basis). Data is encrypted in transit and database access is enforced row-by-row.',
  },
  {
    h: '7. Children',
    b: 'CardLink is not directed at children under 13 (or the higher minimum age in your country).',
  },
  {
    h: '8. Contact & changes',
    b: 'Questions or requests: use the Contact screen in the app. If this policy changes materially we’ll update it here and note it in the app. Effective date: 21 July 2026.',
  },
];

export default function PrivacyScreen() {
  const { colors } = useTheme();
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>Privacy Policy</Text>
      <Text style={[styles.updated, { color: colors.textFaint }]}>
        The short version: we collect what the app needs to work, we don't sell your data, and you can
        delete everything at any time.
      </Text>
      {SECTIONS.map((s) => (
        <Text key={s.h} style={styles.block}>
          <Text style={[styles.h, { color: colors.text }]}>{s.h}</Text>
          {'\n'}
          <Text style={[styles.body, { color: colors.textMuted }]}>{s.b}</Text>
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '800' },
  updated: { marginTop: 4, marginBottom: 16, lineHeight: 19 },
  block: { marginBottom: 16 },
  h: { fontWeight: '700', fontSize: 15 },
  body: { lineHeight: 21 },
});
