import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { ProfileWithStats } from '../hooks/useProfile';
import { listProviders } from '../services/tcg-providers';
import { useTheme } from '../theme';

function gameLabel(gameId: string | null): string | null {
  if (!gameId) return null;
  return listProviders().find((p) => p.gameId === gameId)?.displayName ?? gameId;
}

function Stat({ value, label, href }: { value: number; label: string; href?: string }) {
  const { colors } = useTheme();
  const inner = (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
  if (!href) return inner;
  return (
    <Link href={href as any} asChild>
      <Pressable>{inner}</Pressable>
    </Link>
  );
}

/** Presentational profile header used by both the self and public profile screens. */
export function ProfileView({ profile, action }: { profile: ProfileWithStats; action?: ReactNode }) {
  const { colors } = useTheme();
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
          <Stat value={profile.followers} label="Followers" href={`/connections?user=${profile.id}&type=followers`} />
          <Stat value={profile.following} label="Following" href={`/connections?user=${profile.id}&type=following`} />
        </View>
      </View>

      <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
      <Text style={[styles.username, { color: colors.textMuted }]}>@{profile.username}</Text>
      {profile.ratingCount > 0 ? (
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={14} color="#F59E0B" />
          <Text style={[styles.rating, { color: colors.text }]}>
            {profile.ratingAvg?.toFixed(1)} · {profile.ratingCount} trade {profile.ratingCount === 1 ? 'review' : 'reviews'}
          </Text>
        </View>
      ) : null}
      {favorite ? <Text style={styles.favorite}>Collects {favorite}</Text> : null}
      {profile.bio ? <Text style={[styles.bio, { color: colors.text }]}>{profile.bio}</Text> : null}

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
