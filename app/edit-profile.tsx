import { useRouter } from 'expo-router';
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

/** Edit the signed-in user's profile fields. Avatar image upload is deferred (Phase 2). */
export default function EditProfileScreen() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  const games = listProviders();

  const [username, setUsername] = useState(profile?.username ?? '');
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [favoriteGameId, setFavoriteGameId] = useState(profile?.favoriteGameId ?? games[0]?.gameId ?? 'pokemon');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!supabase || !profile) return;
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
          bio: bio.trim() || null,
          favorite_game_id: favoriteGameId,
        })
        .eq('id', profile.id);

      if (error) {
        if (error.code === '23505') {
          setError('That username is taken — try another.');
          return;
        }
        throw error;
      }
      await refreshProfile();
      router.back();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save changes.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Username</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
      />

      <Text style={styles.label}>Display name</Text>
      <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} />

      <Text style={styles.label}>Bio</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={bio}
        onChangeText={setBio}
        multiline
        numberOfLines={3}
        placeholder="Tell collectors what you're after"
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

      <Pressable style={[styles.button, submitting && styles.buttonDisabled]} onPress={handleSave} disabled={submitting}>
        {submitting ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Save</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 8 },
  label: { fontWeight: '600', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  multiline: { height: 90, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  chipSelected: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { color: '#374151', fontWeight: '600' },
  chipTextSelected: { color: 'white' },
  button: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 16 },
  error: { color: '#DC2626', marginTop: 8 },
});
