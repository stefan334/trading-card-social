import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { SetPickerModal } from '../src/components/SetPickerModal';
import { useCardSearch } from '../src/hooks/useCardSearch';
import { useDebouncedValue } from '../src/hooks/useDebouncedValue';
import { useUserSearch } from '../src/hooks/useUserSearch';
import { dbGetSetCards } from '../src/services/catalog';
import { listProviders } from '../src/services/tcg-providers';
import { useTheme } from '../src/theme';
import { formatPrice } from '../src/utils/time';

type Mode = 'cards' | 'users';

/**
 * Unified search: cards (via TCG provider API) or users (profiles). Opened from
 * the Feed header search icon and the Collection tab's search bar. `?mode=` sets
 * the initial tab.
 */
export default function SearchScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'users' ? 'users' : 'cards');
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query);
  const gameId = listProviders()[0]?.gameId ?? 'pokemon';

  // Optional set filter for card search ("emma 76" style queries also work).
  const [setFilter, setSetFilter] = useState<{ id: string; name: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const cardResults = useCardSearch(mode === 'cards' ? debounced : '', gameId, setFilter?.id);
  const userResults = useUserSearch(mode === 'users' ? debounced : '');

  // With a set selected and no query yet, show the whole set to browse.
  const browsingSet = mode === 'cards' && !!setFilter && debounced.trim().length < 2;
  const setCards = useQuery({
    queryKey: ['search-set-cards', setFilter?.id],
    enabled: browsingSet,
    queryFn: () => dbGetSetCards(setFilter!.id),
  });

  const cardData = browsingSet ? setCards.data ?? [] : cardResults.data ?? [];
  const loading = mode === 'cards' ? (browsingSet ? setCards.isLoading : cardResults.isLoading) : userResults.isLoading;
  const showHint = debounced.trim().length < 2 && !browsingSet;

  return (
    <View style={styles.container}>
      <View style={styles.toggle}>
        {(['cards', 'users'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            style={[styles.toggleBtn, { backgroundColor: colors.surface }, mode === m && styles.toggleActive]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.toggleText, { color: colors.textMuted }, mode === m && styles.toggleTextActive]}>
              {m === 'cards' ? 'Cards' : 'Users'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.searchBar, { borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color="#9CA3AF" />
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder={mode === 'cards' ? 'Search cards by name' : 'Search by username'}
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {mode === 'cards' && (
        <View style={styles.filterRow}>
          <Pressable
            style={[styles.setChip, { borderColor: setFilter ? colors.primary : colors.border }]}
            onPress={() => setPickerOpen(true)}
          >
            <Ionicons name="albums-outline" size={15} color={setFilter ? colors.primary : colors.textMuted} />
            <Text style={[styles.setChipText, { color: setFilter ? colors.primary : colors.textMuted }]} numberOfLines={1}>
              {setFilter ? setFilter.name : 'All sets'}
            </Text>
          </Pressable>
          {setFilter ? (
            <Pressable hitSlop={10} onPress={() => setSetFilter(null)}>
              <Ionicons name="close-circle" size={20} color={colors.textFaint} />
            </Pressable>
          ) : null}
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : showHint ? (
        <Text style={[styles.hint, { color: colors.textFaint }]}>
          Type a name — or a name + number like “Emma 76”. Pick a set to browse or narrow results.
        </Text>
      ) : mode === 'cards' ? (
        <FlatList
          key="cards-grid"
          data={cardData}
          keyExtractor={(c) => c.id}
          numColumns={3}
          columnWrapperStyle={styles.row}
          contentContainerStyle={{ padding: 12 }}
          ListEmptyComponent={<Text style={[styles.hint, { color: colors.textFaint }]}>No cards found.</Text>}
          renderItem={({ item }) => (
            <Link href={`/card/${encodeURIComponent(item.id)}`} asChild>
              <Pressable style={styles.cell}>
                {item.imageUrlSmall ? (
                  <Image source={{ uri: item.imageUrlSmall }} style={styles.cardImage} />
                ) : (
                  <View style={[styles.cardImage, { backgroundColor: colors.surface }]} />
                )}
                <Text numberOfLines={1} style={[styles.cardName, { color: colors.text }]}>
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
          ListEmptyComponent={<Text style={[styles.hint, { color: colors.textFaint }]}>No users found.</Text>}
          renderItem={({ item }) => (
            <Link href={`/user/${item.id}`} asChild>
              <Pressable style={styles.userRow}>
                {item.avatarUrl ? (
                  <Image source={{ uri: item.avatarUrl }} style={styles.userAvatar} />
                ) : (
                  <Ionicons name="person-circle" size={44} color="#9CA3AF" />
                )}
                <View>
                  <Text style={[styles.userName, { color: colors.text }]}>{item.displayName || item.username}</Text>
                  <Text style={[styles.userHandle, { color: colors.textMuted }]}>@{item.username}</Text>
                </View>
              </Pressable>
            </Link>
          )}
        />
      )}

      <SetPickerModal
        visible={pickerOpen}
        gameId={gameId}
        onClose={() => setPickerOpen(false)}
        onSelect={(s) => setSetFilter({ id: s.id, name: s.name })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toggle: { flexDirection: 'row', gap: 8, padding: 12 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  setChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, maxWidth: '80%' },
  setChipText: { fontWeight: '600', fontSize: 13 },
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
