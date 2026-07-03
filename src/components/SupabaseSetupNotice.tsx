import { StyleSheet, Text, View } from 'react-native';

/**
 * Shown by any screen that needs Supabase but .env hasn't been configured yet.
 * See src/services/supabase/client.ts for the isSupabaseConfigured check.
 */
export function SupabaseSetupNotice() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Supabase not configured</Text>
      <Text style={styles.body}>
        Copy .env.example to .env, fill in your Supabase project URL and anon key, then restart the dev
        server (`npx expo start --clear`).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
  },
  title: {
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 4,
    color: '#92400E',
  },
  body: {
    color: '#92400E',
    lineHeight: 20,
  },
});
