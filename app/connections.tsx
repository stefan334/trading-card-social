import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useConnections, type ConnectionType } from '../src/hooks/useConnections';
import { useTheme } from '../src/theme';

/** Followers / following list, routed as /connections?user=<id>&type=followers|following. */
export default function ConnectionsScreen() {
  const { colors } = useTheme();
  const { user, type } = useLocalSearchParams<{ user: string; type: ConnectionType }>();
  const kind: ConnectionType = type === 'following' ? 'following' : 'followers';
  const { data: users, isLoading } = useConnections(user, kind);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: kind === 'following' ? 'Following' : 'Followers' }} />
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={users ?? []}
          keyExtractor={(u) => u.id}
          ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: colors.borderLight }]} />}
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item }) => (
            <Link href={`/user/${item.id}`} asChild>
              <Pressable style={styles.row}>
                {item.avatarUrl ? (
                  <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                ) : (
                  <Ionicons name="person-circle" size={44} color="#9CA3AF" />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: colors.text }]}>{item.displayName || item.username}</Text>
                  <Text style={[styles.username, { color: colors.textMuted }]}>@{item.username}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </Pressable>
            </Link>
          )}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {kind === 'following' ? 'Not following anyone yet.' : 'No followers yet.'}
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  name: { fontSize: 15, fontWeight: '700' },
  username: { color: '#6B7280', fontSize: 13, marginTop: 1 },
  sep: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 72 },
  empty: { color: '#6B7280', textAlign: 'center', marginTop: 40 },
});
