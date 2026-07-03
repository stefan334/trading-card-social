import { Ionicons } from '@expo/vector-icons';
import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useCardSearch } from '../src/hooks/useCardSearch';
import { useDebouncedValue } from '../src/hooks/useDebouncedValue';
import { useUserSearch } from '../src/hooks/useUserSearch';
import { listProviders } from '../src/services/tcg-providers';
import { formatPrice } from '../src/utils/time';

type Mode = 'cards' | 'users';

/**
 * Unified search: cards (via TCG provider API) or users (profiles). Opened from
 * the Feed header search icon and the Collection tab's search bar. `?mode=` sets
 * the initial tab.
 */
export default function SearchScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'users' ? 'users' : 'cards');
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query);
  const gameId = listProviders()[0]?.gameId ?? 'pokemon';

  const cardResults = useCardSearch(mode === 'cards' ? debounced : '', gameId);
  const userResults = useUserSearch(mode === 'users' ? debounced : '');

  const loading = mode === 'cards' ? cardResults.isLoading : userResults.isLoading;
  const showHint = debounced.trim().length < 2;

  return (
    <View style={styles.container}>
      <View style={styles.toggle}>
        {(['cards', 'users'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            style={[styles.toggleBtn, mode === m && styles.toggleActive]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.toggleText, mode === m && styles.toggleTextActive]}>
              {m === 'cards' ? 'Cards' : 'Users'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#9CA3AF" />
        <TextInput
          style={styles.input}
          placeholder={mode === 'cards' ? 'Search cards by name' : 'Search by username'}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : showHint ? (
        <Text style={styles.hint}>Type at least 2 characters.</Text>
      ) : mode === 'cards' ? (
        <FlatList
          key="cards-grid"
          data={cardResults.data ?? []}
          keyExtractor={(c) => c.id}
          numColumns={3}
          columnWrapperStyle={styles.row}
          contentContainerStyle={{ padding: 12 }}
          ListEmptyComponent={<Text style={styles.hint}>No cards found.</Text>}
          renderItem={({ item }) => (
            <Link href={`/card/${encodeURIComponent(item.id)}`} asChild>
              <Pressable style={styles.cell}>
                {item.imageUrlSmall ? (
                  <Image source={{ uri: item.imageUrlSmall }} style={styles.cardImage} />
                ) : (
                  <View style={[styles.cardImage, styles.placeholder]} />
                )}
                <Text numberOfLines={1} style={styles.cardName}>
                  {item.name}
                </Text>
                {item.market?.average != null ? (
                  <Text style={styles.cardPrice}>{formatPrice(item.market.average, item.market.currency)}</Text>
                ) : null}
              </Pressable>
            </Link>
          )}
        />
      ) : (
        <FlatList
          key="users-list"
          data={userResults.data ?? []}
          keyExtractor={(u) => u.id}
          ListEmptyComponent={<Text style={styles.hint}>No users found.</Text>}
          renderItem={({ item }) => (
            <Link href={`/user/${item.id}`} asChild>
              <Pressable style={styles.userRow}>
                {item.avatarUrl ? (
                  <Image source={{ uri: item.avatarUrl }} style={styles.userAvatar} />
                ) : (
                  <Ionicons name="person-circle" size={44} color="#9CA3AF" />
                )}
                <View>
                  <Text style={styles.userName}>{item.displayName || item.username}</Text>
                  <Text style={styles.userHandle}>@{item.username}</Text>
                </View>
              </Pressable>
            </Link>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toggle: { flexDirection: 'row', gap: 8, padding: 12 },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center' },
  toggleActive: { backgroundColor: '#2563EB' },
  toggleText: { fontWeight: '700', color: '#374151' },
  toggleTextActive: { color: 'white' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  input: { flex: 1, paddingVertical: 10, fontSize: 16 },
  hint: { color: '#9CA3AF', textAlign: 'center', marginTop: 24 },
  row: { justifyContent: 'flex-start' },
  cell: { width: '33.33%', padding: 4 },
  cardImage: { width: '100%', aspectRatio: 0.71, borderRadius: 6 },
  placeholder: { backgroundColor: '#E5E7EB' },
  cardName: { fontSize: 12, marginTop: 4 },
  cardPrice: { fontSize: 12, fontWeight: '700', color: '#059669', marginTop: 1 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  userAvatar: { width: 44, height: 44, borderRadius: 22 },
  userName: { fontWeight: '700', fontSize: 15 },
  userHandle: { color: '#6B7280' },
});
