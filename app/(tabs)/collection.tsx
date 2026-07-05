import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { CollectionBySet } from '../../src/components/CollectionBySet';
import { SupabaseSetupNotice } from '../../src/components/SupabaseSetupNotice';
import { useAuth } from '../../src/context/AuthContext';
import { useCollectionBySet } from '../../src/hooks/useCollectionBySet';
import { useSets } from '../../src/hooks/useSets';
import { isSupabaseConfigured } from '../../src/services/supabase/client';
import { listProviders } from '../../src/services/tcg-providers';

/**
 * Collection tab:
 * - "Your Collection": owned cards grouped by set with completion bars (Supabase).
 * - "Browse Sets": live Pokémon TCG API set list for discovery → set completion screen.
 * Filterable by game (only Pokémon for now, but structurally multi-game).
 */
export default function CollectionScreen() {
  const { user } = useAuth();
  const games = listProviders();
  const [gameId, setGameId] = useState(games[0]?.gameId ?? 'pokemon');

  const { data: groups, isLoading } = useCollectionBySet(user?.id, gameId);
  const { data: sets, isLoading: setsLoading } = useSets(gameId);

  return (
    <ScrollView contentContainerStyle={{ paddingVertical: 12 }}>
      {!isSupabaseConfigured && <SupabaseSetupNotice />}

      <View style={styles.topRow}>
        <Link href="/search?mode=cards" asChild>
          <Pressable style={[styles.searchBar, { flex: 1 }]}>
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <Text style={styles.searchText}>Search cards by name</Text>
          </Pressable>
        </Link>
        <Link href="/wishlist" asChild>
          <Pressable style={styles.wishBtn}>
            <Ionicons name="star" size={18} color="#F59E0B" />
            <Text style={styles.wishText}>Wishlist</Text>
          </Pressable>
        </Link>
      </View>

      {games.length > 1 && (
        <View style={styles.chips}>
          {games.map((g) => {
            const selected = g.gameId === gameId;
            return (
              <Pressable
                key={g.gameId}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => setGameId(g.gameId)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{g.displayName}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Text style={styles.sectionTitle}>Your Collection</Text>
      {!user ? (
        <Text style={styles.muted}>Sign in to track your collection.</Text>
      ) : isLoading ? (
        <ActivityIndicator style={{ marginTop: 8 }} />
      ) : !groups?.length ? (
        <Text style={styles.muted}>No cards yet — browse a set below and add your first card.</Text>
      ) : (
        <CollectionBySet groups={groups} />
      )}

      <Text style={styles.sectionTitle}>Browse Sets</Text>
      {setsLoading ? (
        <ActivityIndicator style={{ marginTop: 8 }} />
      ) : (
        sets?.map((item) => (
          <Link key={item.id} href={`/set/${encodeURIComponent(item.id)}`} asChild>
            <Pressable style={styles.setRow}>
              {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.setLogo} contentFit="contain" />}
              <View style={{ flex: 1 }}>
                <Text style={styles.setName}>{item.name}</Text>
                <Text style={styles.muted}>
                  {item.series} · {item.totalCards} cards
                </Text>
              </View>
            </Pressable>
          </Link>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 18, fontWeight: '700', marginHorizontal: 16, marginTop: 20, marginBottom: 10 },
  muted: { color: '#6B7280', marginHorizontal: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 4 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  searchText: { color: '#9CA3AF', fontSize: 15 },
  wishBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#F59E0B', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  wishText: { color: '#B45309', fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  chip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  chipSelected: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { color: '#374151', fontWeight: '600' },
  chipTextSelected: { color: 'white' },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  setLogo: { width: 48, height: 32 },
  setName: { fontSize: 15, fontWeight: '600' },
});
