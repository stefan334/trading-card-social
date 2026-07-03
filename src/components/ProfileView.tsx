import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { ProfileWithStats } from '../hooks/useProfile';
import { listProviders } from '../services/tcg-providers';

function gameLabel(gameId: string | null): string | null {
  if (!gameId) return null;
  return listProviders().find((p) => p.gameId === gameId)?.displayName ?? gameId;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** Presentational profile header used by both the self and public profile screens. */
export function ProfileView({ profile, action }: { profile: ProfileWithStats; action?: ReactNode }) {
  const name = profile.displayName || profile.username;
  const favorite = gameLabel(profile.favoriteGameId);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {profile.avatarUrl ? (
          <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
        ) : (
          <Ionicons name="person-circle" size={72} color="#9CA3AF" />
        )}
        <View style={styles.stats}>
          <Stat value={profile.cardCount} label="Cards" />
          <Stat value={profile.followers} label="Followers" />
          <Stat value={profile.following} label="Following" />
        </View>
      </View>

      <Text style={styles.name}>{name}</Text>
      <Text style={styles.username}>@{profile.username}</Text>
      {profile.ratingCount > 0 ? (
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={14} color="#F59E0B" />
          <Text style={styles.rating}>
            {profile.ratingAvg?.toFixed(1)} · {profile.ratingCount} trade {profile.ratingCount === 1 ? 'review' : 'reviews'}
          </Text>
        </View>
      ) : null}
      {favorite ? <Text style={styles.favorite}>Collects {favorite}</Text> : null}
      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700' },
  statLabel: { color: '#6B7280', fontSize: 13 },
  name: { fontSize: 20, fontWeight: '700', marginTop: 14 },
  username: { color: '#6B7280', marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  rating: { color: '#374151', fontWeight: '600' },
  favorite: { color: '#2563EB', marginTop: 6, fontWeight: '600' },
  bio: { marginTop: 10, lineHeight: 20 },
  action: { marginTop: 16 },
});
