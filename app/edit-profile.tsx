import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
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
import { uploadImage } from '../src/services/supabase/storage';
import { listProviders } from '../src/services/tcg-providers';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

/** Edit the signed-in user's profile fields, including avatar photo. */
export default function EditProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const games = listProviders();

  const [username, setUsername] = useState(profile?.username ?? '');
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [favoriteGameId, setFavoriteGameId] = useState(profile?.favoriteGameId ?? games[0]?.gameId ?? 'pokemon');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickAvatar() {
    if (!supabase || !user) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (res.canceled || !res.assets[0]?.base64) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadImage(res.assets[0].base64, user.id, 'avatar');
      const { error: upErr } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
      if (upErr) throw upErr;
      setAvatarUrl(url);
      await refreshProfile();
    } catch (e: any) {
      setError(e?.message ?? 'Could not upload photo.');
    } finally {
      setUploading(false);
    }
  }

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
      <Pressable style={styles.avatarWrap} onPress={pickAvatar} disabled={uploading}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarEmpty]}>
            <Ionicons name="person" size={40} color="#9CA3AF" />
          </View>
        )}
        <View style={styles.avatarBadge}>
          {uploading ? <ActivityIndicator color="white" size="small" /> : <Ionicons name="camera" size={16} color="white" />}
        </View>
      </Pressable>
      <Text style={styles.avatarHint}>Tap to change photo</Text>

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
  avatarWrap: { alignSelf: 'center', marginTop: 4 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarEmpty: { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  avatarBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'white',
  },
  avatarHint: { textAlign: 'center', color: '#6B7280', fontSize: 13, marginTop: 6, marginBottom: 4 },
});
