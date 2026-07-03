import { Ionicons } from '@expo/vector-icons';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BindersRow } from '../../src/components/BindersRow';
import { CollectionBySet } from '../../src/components/CollectionBySet';
import { ProfileView } from '../../src/components/ProfileView';
import { useChatActions } from '../../src/hooks/useChatActions';
import { useCollectionBySet } from '../../src/hooks/useCollectionBySet';
import { useFollow } from '../../src/hooks/useFollow';
import { useProfile } from '../../src/hooks/useProfile';

/** Another user's public profile, routed as /user/[id]. Read-only + follow/unfollow + their collection. */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: profile, isLoading, error } = useProfile(id);
  const { canFollow, isFollowing, toggling, toggle } = useFollow(id);
  const { data: groups, isLoading: collectionLoading } = useCollectionBySet(id);
  const { startThread } = useChatActions();

  if (isLoading) return <ActivityIndicator style={styles.center} />;
  if (error || !profile) return <Text style={styles.center}>Profile not found.</Text>;

  async function message() {
    if (!id) return;
    const threadId = await startThread.mutateAsync({ otherId: id });
    router.push(`/chat/${threadId}`);
  }

  const actions = canFollow ? (
    <View style={{ gap: 10 }}>
      <View style={styles.actionRow}>
        <Pressable
          style={[styles.button, styles.flex, isFollowing ? styles.following : styles.followBtn]}
          onPress={toggle}
          disabled={toggling}
        >
          <Ionicons name={isFollowing ? 'checkmark' : 'person-add'} size={16} color={isFollowing ? '#374151' : 'white'} />
          <Text style={[styles.buttonText, isFollowing && styles.followingText]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </Pressable>
        <Pressable style={[styles.button, styles.flex, styles.messageButton]} onPress={message} disabled={startThread.isPending}>
          <Ionicons name="chatbubble-ellipses" size={16} color="#2563EB" />
          <Text style={[styles.buttonText, styles.messageText]}>Message</Text>
        </Pressable>
      </View>
      <Link href={`/trade/new?with=${id}`} asChild>
        <Pressable style={[styles.button, styles.tradeButton]}>
          <Ionicons name="swap-horizontal" size={18} color="white" />
          <Text style={styles.buttonText}>Propose Trade</Text>
        </Pressable>
      </Link>
    </View>
  ) : undefined;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
      <ProfileView profile={profile} action={actions} />

      {id ? <BindersRow userId={id} isOwner={false} /> : null}

      <Text style={styles.sectionTitle}>Collection</Text>
      {collectionLoading ? (
        <ActivityIndicator style={{ marginTop: 8 }} />
      ) : !groups?.length ? (
        <Text style={styles.muted}>No cards in their collection yet.</Text>
      ) : (
        <View style={{ marginTop: 4 }}>
          <CollectionBySet groups={groups} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, marginTop: 40, textAlign: 'center' },
  button: {
    flexDirection: 'row',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  followBtn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  following: { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 15 },
  followingText: { color: '#374151' },
  actionRow: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  tradeButton: { backgroundColor: '#059669', borderColor: '#047857' },
  messageButton: { backgroundColor: 'white', borderColor: '#2563EB' },
  messageText: { color: '#2563EB' },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginHorizontal: 16, marginTop: 20, marginBottom: 4 },
  muted: { color: '#6B7280', marginHorizontal: 16, marginTop: 8 },
});

