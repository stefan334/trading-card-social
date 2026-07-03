import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { supabase } from '../src/services/supabase/client';
import { listProviders } from '../src/services/tcg-providers';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

/**
 * First-run profile setup. Shown to any signed-in user whose profile has no
 * onboarded_at (see useProtectedRoute). On success it stamps onboarded_at, which
 * flips isOnboarded and lets the router move on to the tabs.
 * Avatar image upload is deferred (needs a storage bucket) — CHECKLIST Phase 2.
 */
export default function OnboardingScreen() {
  const { user, refreshProfile } = useAuth();
  const games = listProviders();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [favoriteGameId, setFavoriteGameId] = useState<string>(games[0]?.gameId ?? 'pokemon');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!supabase || !user) return;
    const handle = username.trim();
    if (!USERNAME_RE.test(handle)) {
      setError('Username must be 3–20 characters: letters, numbers, or underscores.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: handle,
          display_name: displayName.trim() || null,
          favorite_game_id: favoriteGameId,
          onboarded_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        // 23505 = unique_violation on the username constraint.
        if (error.code === '23505') {
          setError('That username is taken — try another.');
          return;
        }
        throw error;
      }
      await refreshProfile();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save your profile.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Set up your profile</Text>
      <Text style={styles.subtitle}>This is how other collectors will find and recognize you.</Text>

      <Text style={styles.label}>Username</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. charizard_fan"
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
      />

      <Text style={styles.label}>Display name (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Alex R."
        value={displayName}
        onChangeText={setDisplayName}
      />

      <Text style={styles.label}>Favorite TCG</Text>
      <View style={styles.chips}>
        {games.map((g) => {
          const selected = g.gameId === favoriteGameId;
          return (
            <Pressable
              key={g.gameId}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => setFavoriteGameId(g.gameId)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{g.displayName}</Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={submitting || !username}
      >
        {submitting ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Continue</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 8, flexGrow: 1, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#6B7280', marginBottom: 12, lineHeight: 20 },
  label: { fontWeight: '600', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  chipSelected: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { color: '#374151', fontWeight: '600' },
  chipTextSelected: { color: 'white' },
  button: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 16 },
  error: { color: '#DC2626', marginTop: 8 },
});
