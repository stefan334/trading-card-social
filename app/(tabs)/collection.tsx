import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { CollectionBySet } from '../../src/components/CollectionBySet';
import { SupabaseSetupNotice } from '../../src/components/SupabaseSetupNotice';
import { useAuth } from '../../src/context/AuthContext';
import { useCollectionBySet } from '../../src/hooks/useCollectionBySet';
import { useSets } from '../../src/hooks/useSets';
import { isSupabaseConfigured } from '../../src/services/supabase/client';
import { listProviders } from '../../src/services/tcg-providers';
import { useTheme } from '../../src/theme';

/**
 * Collection tab:
 * - "Your Collection": owned cards grouped by set with completion bars (Supabase).
 * - "Browse Sets": live Pokémon TCG API set list for discovery → set completion screen.
 * Filterable by game (only Pokémon for now, but structurally multi-game).
 */
export default function CollectionScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const games = listProviders();
  const [gameId, setGameId] = useState(games[0]?.gameId ?? 'pokemon');

  const [setQuery, setSetQuery] = useState('');
  const { data: groups, isLoading } = useCollectionBySet(user?.id, gameId);
  const { data: sets, isLoading: setsLoading } = useSets(gameId);

  return (
    <ScrollView contentContainerStyle={{ paddingVertical: 12 }}>
      {!isSupabaseConfigured && <SupabaseSetupNotice />}

      <Link href="/search?mode=cards" asChild>
        <Pressable style={[styles.searchBar, { backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={17} color={colors.textFaint} />
          <Text style={[styles.searchText, { color: colors.textFaint }]}>Search cards by name</Text>
        </Pressable>
      </Link>

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

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Collection</Text>
      {!user ? (
        <Text style={[styles.muted, { color: colors.textMuted }]}>Sign in to track your collection.</Text>
      ) : isLoading ? (
        <ActivityIndicator style={{ marginTop: 8 }} />
      ) : !groups?.length ? (
        <Text style={[styles.muted, { color: colors.textMuted }]}>No cards yet — browse a set below and add your first card.</Text>
      ) : (
        <CollectionBySet groups={groups} />
      )}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Browse Sets</Text>
      <View style={[styles.setSearch, { backgroundColor: colors.surface }]}>
        <Ionicons name="search" size={16} color={colors.textFaint} />
        <TextInput
          style={[styles.setSearchInput, { color: colors.text }]}
          placeholder="Filter sets by name"
          placeholderTextColor={colors.textFaint}
          value={setQuery}
          onChangeText={setSetQuery}
          autoCapitalize="none"
        />
        {setQuery.length > 0 && (
          <Pressable hitSlop={8} onPress={() => setSetQuery('')}>
            <Ionicons name="close-circle" size={16} color={colors.textFaint} />
          </Pressable>
        )}
      </View>
      {setsLoading ? (
        <ActivityIndicator style={{ marginTop: 8 }} />
      ) : (
        (sets ?? []).filter((it) => it.name.toLowerCase().includes(setQuery.trim().toLowerCase())).map((item) => (
          <Link key={item.id} href={`/set/${encodeURIComponent(item.id)}`} asChild>
            <Pressable style={styles.setRow}>
              {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.setLogo} contentFit="contain" />}
              <View style={{ flex: 1 }}>
                <Text style={[styles.setName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.muted, { color: colors.textMuted }]}>
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
  searchBar: {
    // Left-aligned like every other search field in the app.
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    marginHorizontal: 16,
    marginTop: 2,
    marginBottom: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  searchText: { fontSize: 15, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  chip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  chipSelected: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { color: '#374151', fontWeight: '600' },
  chipTextSelected: { color: 'white' },
  setSearch: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 6, paddingHorizontal: 12, height: 38, borderRadius: 10 },
  setSearchInput: { flex: 1, fontSize: 14, padding: 0 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  setLogo: { width: 48, height: 32 },
  setName: { fontSize: 15, fontWeight: '600' },
});
