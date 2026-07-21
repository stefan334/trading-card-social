import { Ionicons } from '@expo/vector-icons';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badges } from '../../src/components/Badges';
import { BindersRow } from '../../src/components/BindersRow';
import { CollectionBySet } from '../../src/components/CollectionBySet';
import { ForTradeShowcase } from '../../src/components/ForTradeShowcase';
import { ProfileView } from '../../src/components/ProfileView';
import { WishlistShowcase } from '../../src/components/WishlistShowcase';
import { useChatActions } from '../../src/hooks/useChatActions';
import { useCollectionBySet } from '../../src/hooks/useCollectionBySet';
import { useFollow } from '../../src/hooks/useFollow';
import { useProfile } from '../../src/hooks/useProfile';
import { useTheme } from '../../src/theme';

/** Another user's public profile, routed as /user/[id]. Read-only + follow/unfollow + their collection. */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
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
      <Link href={`/trade/new?with=${id}`} asChild>
        <Pressable style={styles.tradeButton}>
          <Ionicons name="swap-horizontal" size={18} color="white" />
          <Text style={styles.tradeText}>Propose a trade</Text>
        </Pressable>
      </Link>
      <View style={styles.actionRow}>
        <Pressable
          style={[
            styles.button,
            styles.flex,
            isFollowing
              ? { backgroundColor: colors.surface, borderColor: colors.border }
              : { backgroundColor: colors.primary, borderColor: colors.primary },
          ]}
          onPress={toggle}
          disabled={toggling}
        >
          <Ionicons name={isFollowing ? 'checkmark' : 'person-add'} size={16} color={isFollowing ? colors.text : 'white'} />
          <Text style={[styles.buttonText, isFollowing && { color: colors.text }]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.flex, { backgroundColor: 'transparent', borderColor: colors.primary }]}
          onPress={message}
          disabled={startThread.isPending}
        >
          <Ionicons name="chatbubble-ellipses" size={16} color={colors.primary} />
          <Text style={[styles.buttonText, { color: colors.primary }]}>Message</Text>
        </Pressable>
      </View>
      <Link href={`/report?profile=${id}&name=${encodeURIComponent(profile.username)}` as any} asChild>
        <Pressable style={styles.reportBtn} hitSlop={6}>
          <Ionicons name="flag-outline" size={13} color="#9CA3AF" />
          <Text style={styles.reportText}>Report user</Text>
        </Pressable>
      </Link>
    </View>
  ) : undefined;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
      <ProfileView profile={profile} action={actions} />

      {id ? <Badges userId={id} /> : null}
      {id ? <BindersRow userId={id} isOwner={false} /> : null}
      {id ? <ForTradeShowcase userId={id} /> : null}
      {id ? <WishlistShowcase userId={id} /> : null}

      <View style={[styles.divider, { borderTopColor: colors.borderLight }]} />
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Collection</Text>
      {collectionLoading ? (
        <ActivityIndicator style={{ marginTop: 8 }} />
      ) : !groups?.length ? (
        <Text style={[styles.muted, { color: colors.textMuted }]}>No cards in their collection yet.</Text>
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
  tradeButton: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tradeText: { color: 'white', fontWeight: '800', fontSize: 16 },
  messageButton: { backgroundColor: 'white', borderColor: '#2563EB' },
  messageText: { color: '#2563EB' },
  reportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 6 },
  reportText: { color: '#9CA3AF', fontSize: 13, fontWeight: '600' },
  divider: { borderTopWidth: 1, marginTop: 18 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginHorizontal: 16, marginTop: 14, marginBottom: 4 },
  muted: { color: '#6B7280', marginHorizontal: 16, marginTop: 8 },
});

