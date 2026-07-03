import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { PostCard } from '../../src/components/PostCard';
import { SupabaseSetupNotice } from '../../src/components/SupabaseSetupNotice';
import { useAuth } from '../../src/context/AuthContext';
import { useFeed } from '../../src/hooks/useFeed';
import { isSupabaseConfigured } from '../../src/services/supabase/client';

/**
 * Home tab = activity feed of posts from people you follow (+ your own), newest
 * first. Composing posts (sharing a card / status) is CHECKLIST Phase 5; this
 * screen renders whatever posts exist and degrades gracefully before then.
 * Profile is reached via the header avatar (see (tabs)/_layout.tsx), not a tab.
 */
export default function FeedScreen() {
  const { user, loading: authLoading } = useAuth();
  const { data: posts, isLoading, isRefetching, refetch } = useFeed(user?.id);

  if (!isSupabaseConfigured) {
    return (
      <View style={styles.container}>
        <SupabaseSetupNotice />
        <Text style={styles.muted}>Connect Supabase to see your friends' feed.</Text>
      </View>
    );
  }

  if (authLoading) {
    return <ActivityIndicator style={styles.center} />;
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyTitle}>Welcome to CardLink</Text>
        <Text style={styles.muted}>Sign in to see what the collectors you follow are posting. (Auth: CHECKLIST Phase 2.)</Text>
      </View>
    );
  }

  if (isLoading) {
    return <ActivityIndicator style={styles.center} />;
  }

  if (!posts?.length) {
    return (
      <FlatList
        data={[]}
        renderItem={null}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        contentContainerStyle={styles.emptyWrap}
        ListEmptyComponent={
          <View style={styles.container}>
            <Text style={styles.emptyTitle}>Your feed is empty</Text>
            <Text style={styles.muted}>
              Follow other collectors and their card shares and trades will show up here. Posting and
              following are on the way — see CHECKLIST.md Phase 5.
            </Text>
          </View>
        }
      />
    );
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(post) => post.id}
      renderItem={({ item }) => <PostCard post={item} />}
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  center: { flex: 1, marginTop: 40 },
  emptyWrap: { flexGrow: 1, justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  muted: { color: '#6B7280', lineHeight: 20 },
});
