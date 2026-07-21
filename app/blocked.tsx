import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useBlockActions, useBlockedList } from '../src/hooks/useBlocks';
import { useTheme } from '../src/theme';

/** Settings → Blocked users: who you've blocked, with one-tap unblock. */
export default function BlockedUsersScreen() {
  const { colors } = useTheme();
  const { data: blocked, isLoading } = useBlockedList();
  const { unblock } = useBlockActions();

  if (isLoading) return <ActivityIndicator style={styles.center} />;

  if (!blocked?.length) {
    return (
      <View style={styles.center}>
        <Ionicons name="ban-outline" size={40} color={colors.textFaint} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No blocked users</Text>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          Block someone from their profile — you'll stop seeing each other's activity, listings, and messages.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={blocked}
      keyExtractor={(u) => u.id}
      contentContainerStyle={{ paddingVertical: 4 }}
      ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: colors.borderLight }]} />}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Link href={`/user/${item.id}`} asChild>
            <Pressable style={styles.userArea}>
              {item.avatarUrl ? (
                <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
              ) : (
                <Ionicons name="person-circle" size={40} color={colors.textFaint} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.text }]}>{item.displayName || item.username}</Text>
                <Text style={[styles.username, { color: colors.textMuted }]}>@{item.username}</Text>
              </View>
            </Pressable>
          </Link>
          <Pressable
            style={[styles.unblockBtn, { borderColor: colors.primary }]}
            onPress={() => unblock.mutate(item.id)}
            disabled={unblock.isPending}
          >
            <Text style={[styles.unblockText, { color: colors.primary }]}>Unblock</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 6 },
  emptyText: { textAlign: 'center', lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  userArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  name: { fontSize: 15, fontWeight: '700' },
  username: { fontSize: 13, marginTop: 1 },
  unblockBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  unblockText: { fontWeight: '700', fontSize: 13 },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 68 },
});
