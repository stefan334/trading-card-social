import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/context/AuthContext';
import { useKeyboardHeight } from '../src/hooks/useKeyboardHeight';
import { supabase } from '../src/services/supabase/client';
import { uploadImage } from '../src/services/supabase/storage';
import { listProviders } from '../src/services/tcg-providers';
import { useTheme } from '../src/theme';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

/** Edit the signed-in user's profile fields, including avatar photo. */
export default function EditProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const { colors } = useTheme();
  const games = listProviders();

  // Refresh both the auth-context profile and the react-query profile cache that
  // the profile screens actually render from (otherwise edits don't show up).
  async function syncProfile() {
    await refreshProfile();
    const pid = profile?.id ?? user?.id;
    if (pid) qc.invalidateQueries({ queryKey: ['profile', pid] });
  }

  const keyboardHeight = useKeyboardHeight(); // bio/save stay visible while typing
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState(profile?.username ?? '');
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [favoriteGameId, setFavoriteGameId] = useState(profile?.favoriteGameId ?? games[0]?.gameId ?? 'pokemon');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? null);
  const [locationName, setLocationName] = useState(profile?.locationName ?? null);
  const [uploading, setUploading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setLocation() {
    if (!supabase || !user) return;
    setError(null);
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setError('Location permission is needed to find local traders.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      // Round to ~1km for privacy (profiles are public).
      const lat = Math.round(pos.coords.latitude * 100) / 100;
      const lng = Math.round(pos.coords.longitude * 100) / 100;
      let city: string | null = null;
      try {
        const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        city = geo[0] ? [geo[0].city ?? geo[0].subregion, geo[0].region].filter(Boolean).join(', ') || null : null;
      } catch {
        city = null;
      }
      const { error: upErr } = await supabase
        .from('profiles')
        .update({ latitude: lat, longitude: lng, location_name: city })
        .eq('id', user.id);
      if (upErr) throw upErr;
      setLocationName(city ?? 'Location set');
      await syncProfile();
    } catch (e: any) {
      setError(e?.message ?? 'Could not get your location.');
    } finally {
      setLocating(false);
    }
  }

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
      await syncProfile();
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
      await syncProfile();
      router.back();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save changes.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: 32 + Math.max(insets.bottom, keyboardHeight) }]}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable style={styles.avatarWrap} onPress={pickAvatar} disabled={uploading}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarEmpty, { backgroundColor: colors.surface }]}>
            <Ionicons name="person" size={40} color="#9CA3AF" />
          </View>
        )}
        <View style={styles.avatarBadge}>
          {uploading ? <ActivityIndicator color="white" size="small" /> : <Ionicons name="camera" size={16} color="white" />}
        </View>
      </Pressable>
      <Text style={[styles.avatarHint, { color: colors.textMuted }]}>Tap to change photo</Text>

      <Text style={[styles.label, { color: colors.text }]}>Username</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.text }]}
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
      />

      <Text style={[styles.label, { color: colors.text }]}>Display name</Text>
      <TextInput style={[styles.input, { borderColor: colors.border, color: colors.text }]} value={displayName} onChangeText={setDisplayName} />

      <Text style={[styles.label, { color: colors.text }]}>Bio</Text>
      <TextInput
        style={[styles.input, styles.multiline, { borderColor: colors.border, color: colors.text }]}
        placeholderTextColor={colors.textFaint}
        value={bio}
        onChangeText={setBio}
        multiline
        numberOfLines={3}
        placeholder="Tell collectors what you're after"
      />

      <Text style={[styles.label, { color: colors.text }]}>Location</Text>
      <Pressable style={[styles.locationBtn, { borderColor: colors.border }]} onPress={setLocation} disabled={locating}>
        <Ionicons name="location" size={18} color="#2563EB" />
        {locating ? (
          <ActivityIndicator />
        ) : (
          <Text style={[styles.locationText, { color: colors.text }]}>{locationName ?? 'Set my location'}</Text>
        )}
      </Pressable>
      <Text style={[styles.locationHint, { color: colors.textFaint }]}>Used to find local traders. Stored roughly (~1km) and shown as your area.</Text>

      <Text style={[styles.label, { color: colors.text }]}>Favorite TCG</Text>
      <View style={styles.chips}>
        {games.map((g) => {
          const selected = g.gameId === favoriteGameId;
          return (
            <Pressable
              key={g.gameId}
              style={[styles.chip, { borderColor: colors.border }, selected && styles.chipSelected]}
              onPress={() => setFavoriteGameId(g.gameId)}
            >
              <Text style={[styles.chipText, { color: colors.textMuted }, selected && styles.chipTextSelected]}>{g.displayName}</Text>
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
  locationBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  locationText: { fontSize: 16, fontWeight: '600', color: '#111827' },
  locationHint: { color: '#9CA3AF', fontSize: 12, marginTop: 6 },
});
