import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badges } from '../../src/components/Badges';
import { BindersRow } from '../../src/components/BindersRow';
import { CollectionBySet } from '../../src/components/CollectionBySet';
import { ForTradeShowcase } from '../../src/components/ForTradeShowcase';
import { SupabaseSetupNotice } from '../../src/components/SupabaseSetupNotice';
import { ProfileView } from '../../src/components/ProfileView';
import { useAuth } from '../../src/context/AuthContext';
import { useCollectionBySet } from '../../src/hooks/useCollectionBySet';
import { useProfile } from '../../src/hooks/useProfile';
import { isSupabaseConfigured } from '../../src/services/supabase/client';
import { useTheme } from '../../src/theme';

/**
 * The current user's own profile — opened via the Feed's top-right avatar. Shows
 * profile + stats, edit/scan/sign-out actions, and their own collection.
 */
export default function ProfileScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { data: profile, isLoading } = useProfile(user?.id);
  const { data: groups, isLoading: collectionLoading } = useCollectionBySet(user?.id);

  if (!isSupabaseConfigured) {
    return (
      <View style={styles.container}>
        <SupabaseSetupNotice />
      </View>
    );
  }

  if (isLoading || !profile) {
    return <ActivityIndicator style={styles.center} />;
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
      <ProfileView profile={profile} />

      <Badges userId={profile.id} showEmpty />
      <BindersRow userId={profile.id} isOwner />
      <ForTradeShowcase userId={profile.id} />

      <View style={[styles.dividerLine, { borderTopColor: colors.borderLight }]} />
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Collection</Text>
      {collectionLoading ? (
        <ActivityIndicator style={{ marginTop: 8 }} />
      ) : !groups?.length ? (
        <Text style={[styles.muted, { color: colors.textMuted }]}>No cards yet — tap the + button to add some.</Text>
      ) : (
        <CollectionBySet groups={groups} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 12 },
  center: { flex: 1, marginTop: 40 },
  dividerLine: { borderTopWidth: 1, marginTop: 18 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginHorizontal: 16, marginTop: 14, marginBottom: 10 },
  muted: { color: '#6B7280', marginHorizontal: 16 },
});
