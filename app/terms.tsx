import { StyleSheet, Text, ScrollView } from 'react-native';

/**
 * Terms & Conditions. This is a plain-language starter template — have it
 * reviewed by a lawyer before any public launch, especially the trading/meetup
 * safety and liability sections.
 */
const SECTIONS: { h: string; b: string }[] = [
  {
    h: '1. Acceptance',
    b: 'By creating an account or using CardLink ("the app"), you agree to these Terms & Conditions. If you do not agree, please do not use the app. You must be at least 13 years old (or the minimum age required in your country) to use CardLink.',
  },
  {
    h: '2. Your account',
    b: 'You are responsible for your account and for keeping your login secure. You agree to provide accurate information and not to impersonate others. We may suspend or remove accounts that violate these terms.',
  },
  {
    h: '3. Your content',
    b: 'You keep ownership of the photos, listings, and messages you post, but you grant CardLink a licence to display them within the app so the service can function. Do not post anything unlawful, offensive, infringing, or that you do not have the right to share.',
  },
  {
    h: '4. Trading & in-person meetups',
    b: 'CardLink is a place to discover collectors and arrange trades. Trades, payments, and delivery happen directly between users — CardLink is not a party to any trade and does not process payments. When meeting in person, use common sense: meet in public places, verify cards before exchanging, and never share sensitive personal or financial details. You trade at your own risk.',
  },
  {
    h: '5. Card prices',
    b: 'Prices shown are estimates aggregated from third-party sources and are for reference only. They may be inaccurate or out of date and do not constitute an offer, appraisal, or guarantee of value.',
  },
  {
    h: '6. Prohibited conduct',
    b: 'Do not use CardLink to harass, scam, or defraud others; to sell counterfeit or stolen goods; to spam; or to break any law. Report bad behaviour using the in-app report tools.',
  },
  {
    h: '7. No warranties & limitation of liability',
    b: 'The app is provided "as is" without warranties of any kind. To the fullest extent permitted by law, CardLink is not liable for losses arising from trades between users, inaccurate prices, downtime, or data loss.',
  },
  {
    h: '8. Changes & termination',
    b: 'We may update these terms or the app at any time. Continued use after changes means you accept the updated terms. You may stop using CardLink and delete your account at any time.',
  },
  {
    h: '9. Contact',
    b: 'Questions about these terms? Reach us via the Contact screen in the app.',
  },
];

export default function TermsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Terms & Conditions</Text>
      <Text style={styles.updated}>Last updated: this is a starter template — review before launch.</Text>
      {SECTIONS.map((s) => (
        <Text key={s.h} style={styles.block}>
          <Text style={styles.h}>{s.h}</Text>
          {'\n'}
          <Text style={styles.body}>{s.b}</Text>
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '800' },
  updated: { color: '#9CA3AF', fontStyle: 'italic', marginTop: 4, marginBottom: 16 },
  block: { marginBottom: 16 },
  h: { fontWeight: '700', fontSize: 15 },
  body: { color: '#374151', lineHeight: 21 },
});
