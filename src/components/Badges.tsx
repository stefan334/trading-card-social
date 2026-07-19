import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useAchievements } from '../hooks/useAchievements';
import { useTheme } from '../theme';

/**
 * Achievement badges on a profile — earned from trades, collection size, and
 * followers. Pass showEmpty on your own profile to nudge you toward earning some.
 */
export function Badges({ userId, showEmpty }: { userId: string; showEmpty?: boolean }) {
  const { colors } = useTheme();
  const { data: badges } = useAchievements(userId);

  if (!badges?.length) {
    if (!showEmpty) return null;
    return (
      <View>
        <Text style={[styles.title, { color: colors.text }]}>Achievements</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>Complete trades and grow your collection to earn badges.</Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={[styles.title, { color: colors.text }]}>Achievements</Text>
      <View style={styles.row}>
        {badges.map((b) => (
          <View key={b.key} style={[styles.badge, { borderColor: b.color, backgroundColor: colors.card }]}>
            <Ionicons name={b.icon} size={16} color={b.color} />
            <View>
              <Text style={[styles.badgeLabel, { color: b.color }]}>{b.label}</Text>
              <Text style={[styles.badgeDetail, { color: colors.textFaint }]}>{b.detail}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginHorizontal: 16, marginTop: 18, marginBottom: 8 },
  hint: { color: '#6B7280', marginHorizontal: 16, lineHeight: 20 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'white' },
  badgeLabel: { fontWeight: '800', fontSize: 14 },
  badgeDetail: { color: '#9CA3AF', fontSize: 11 },
});
