import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

/**
 * The current user's own profile — opened via the Feed's top-right avatar. Shows
 * profile + stats, edit/scan/sign-out actions, and their own collection.
 */
export default function ProfileScreen() {
  const { user } = useAuth();
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

      <View style={styles.actions}>
        <Link href="/edit-profile" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>Edit profile</Text>
          </Pressable>
        </Link>
        <Link href="/add" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>Add cards</Text>
          </Pressable>
        </Link>
      </View>

      <Text style={styles.sectionTitle}>Your Collection</Text>
      {collectionLoading ? (
        <ActivityIndicator style={{ marginTop: 8 }} />
      ) : !groups?.length ? (
        <Text style={styles.muted}>No cards yet — add some from the Collection tab.</Text>
      ) : (
        <CollectionBySet groups={groups} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 12 },
  center: { flex: 1, marginTop: 40 },
  actions: { paddingHorizontal: 16, gap: 10, marginTop: 8 },
  button: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginHorizontal: 16, marginTop: 24, marginBottom: 10 },
  muted: { color: '#6B7280', marginHorizontal: 16 },
});
