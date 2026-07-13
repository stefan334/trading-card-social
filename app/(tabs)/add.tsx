import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useBatch } from '../../src/context/BatchContext';
import { useAuth } from '../../src/context/AuthContext';
import { useCardSearch } from '../../src/hooks/useCardSearch';
import { useCollectionActions } from '../../src/hooks/useCollectionActions';
import { useDebouncedValue } from '../../src/hooks/useDebouncedValue';
import { useScreenView } from '../../src/services/analytics';
import { dbGetSet } from '../../src/services/catalog';
import { getProvider, listProviders } from '../../src/services/tcg-providers';
import type { CardCondition } from '../../src/types/domain';

const CONDITIONS: CardCondition[] = ['mint', 'near_mint', 'excellent', 'good', 'played', 'poor'];
const LABEL: Record<CardCondition, string> = {
  mint: 'Mint', near_mint: 'Near Mint', excellent: 'Excellent', good: 'Good', played: 'Played', poor: 'Poor',
};

/**
 * Add tab (the center "+"): one place to build up a "pack" of cards and add them
 * together. Search or scan to drop cards into a cart; a persistent bar at the
 * bottom shows what you've queued. Review the cart to pick one condition for the
 * lot and add them all at once — the feed groups them into a single post. Adding
 * a single card is just a cart of one, so there's no separate "batch mode".
 */
export default function AddScreen() {
  const router = useRouter();
  const { user } = useAuth();
  useScreenView('add');
  const { items, add: addToCart, removeAt, clear } = useBatch();
  const gameId = listProviders()[0]?.gameId ?? 'pokemon';

  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query);
  const { data: results, isLoading } = useCardSearch(debounced, gameId);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [condition, setCondition] = useState<CardCondition>('near_mint');
  const [adding, setAdding] = useState(false);
  const { add } = useCollectionActions();

  // How many of each card id are already in the cart (for the count badge).
  const countByCard = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.card.id, (m.get(it.card.id) ?? 0) + 1);
    return m;
  }, [items]);

  async function addResult(cardId: string) {
    const card = results?.find((c) => c.id === cardId);
    if (!card) return;
    setBusyId(cardId);
    try {
      // DB-first (instant once catalog is synced); fall back to the live API.
      const set = (await dbGetSet(card.setId)) ?? (await getProvider(card.gameId).getSet(card.setId));
      addToCart(card, set);
    } finally {
      setBusyId(null);
    }
  }

  async function addAll() {
    if (!items.length || !user) return;
    setAdding(true);
    try {
      for (const it of items) {
        await add.mutateAsync({ card: it.card, set: it.set, condition });
      }
      clear();
      setReviewOpen(false);
      router.push('/collection');
    } finally {
      setAdding(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Search + scan */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            style={styles.input}
            placeholder="Search cards by name"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <Pressable hitSlop={8} onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </Pressable>
          )}
        </View>
        <Link href="/scan" asChild>
          <Pressable style={styles.scanBtn}>
            <Ionicons name="camera" size={20} color="white" />
          </Pressable>
        </Link>
      </View>

      {/* Results / empty states */}
      {debounced.trim().length < 2 ? (
        <View style={styles.hintWrap}>
          <Ionicons name="albums-outline" size={40} color="#C7CBD1" />
          <Text style={styles.hintTitle}>Build your pack</Text>
          <Text style={styles.hint}>
            Search for a card by name, or tap the camera to scan. Everything you pick drops into the
            tray below — add them all at once.
          </Text>
        </View>
      ) : isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={results ?? []}
          keyExtractor={(c) => c.id}
          numColumns={3}
          contentContainerStyle={{ padding: 8, paddingBottom: items.length ? 108 : 16 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const count = countByCard.get(item.id) ?? 0;
            return (
              <Pressable style={styles.cell} onPress={() => addResult(item.id)} disabled={busyId === item.id}>
                <View>
                  {item.imageUrlSmall ? (
                    <Image source={{ uri: item.imageUrlSmall }} style={styles.cardImg} />
                  ) : (
                    <View style={[styles.cardImg, styles.placeholder]} />
                  )}
                  {busyId === item.id ? (
                    <View style={styles.overlay}><ActivityIndicator color="white" /></View>
                  ) : count > 0 ? (
                    <View style={styles.countBadge}>
                      <Ionicons name="checkmark" size={13} color="white" />
                      {count > 1 && <Text style={styles.countText}>{count}</Text>}
                    </View>
                  ) : (
                    <View style={styles.plus}><Ionicons name="add" size={16} color="white" /></View>
                  )}
                </View>
                <Text numberOfLines={1} style={styles.cardName}>{item.name}</Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={styles.muted}>No matches — try a different spelling.</Text>}
        />
      )}

      {/* Persistent cart bar */}
      {items.length > 0 && (
        <Pressable style={styles.cartBar} onPress={() => setReviewOpen(true)}>
          <View style={styles.cartThumbs}>
            {items.slice(-4).map((it, i) => (
              <Image
                key={it.key}
                source={{ uri: it.card.imageUrlSmall }}
                style={[styles.cartThumb, { marginLeft: i === 0 ? 0 : -14, zIndex: i }]}
              />
            ))}
          </View>
          <Text style={styles.cartCount}>
            {items.length} {items.length === 1 ? 'card' : 'cards'}
          </Text>
          <View style={styles.cartCta}>
            <Text style={styles.cartCtaText}>Review</Text>
            <Ionicons name="chevron-up" size={16} color="white" />
          </View>
        </Pressable>
      )}

      {/* Review sheet */}
      <Modal visible={reviewOpen} transparent animationType="slide" onRequestClose={() => setReviewOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setReviewOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Your pack · {items.length}</Text>
            {items.length > 0 && (
              <Pressable hitSlop={8} onPress={clear}>
                <Text style={styles.clearLink}>Clear</Text>
              </Pressable>
            )}
          </View>

          {items.length === 0 ? (
            <Text style={styles.muted}>Nothing queued yet.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={styles.sheetGrid}>
              {items.map((it) => (
                <View key={it.key} style={styles.sheetItem}>
                  {it.card.imageUrlSmall ? (
                    <Image source={{ uri: it.card.imageUrlSmall }} style={styles.sheetImg} />
                  ) : (
                    <View style={[styles.sheetImg, styles.placeholder]} />
                  )}
                  <Pressable style={styles.removeBadge} onPress={() => removeAt(it.key)}>
                    <Ionicons name="close" size={13} color="white" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}

          <Text style={styles.label}>Condition (applies to all)</Text>
          <View style={styles.chips}>
            {CONDITIONS.map((c) => (
              <Pressable key={c} style={[styles.chip, c === condition && styles.chipOn]} onPress={() => setCondition(c)}>
                <Text style={[styles.chipText, c === condition && styles.chipTextOn]}>{LABEL[c]}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.addAll, (!items.length || adding) && styles.disabled]}
            onPress={addAll}
            disabled={!items.length || adding}
          >
            {adding ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.addAllText}>Add {items.length} to collection</Text>
            )}
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F3F4F6' },
  input: { flex: 1, fontSize: 15, padding: 0 },
  scanBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },

  hintWrap: { alignItems: 'center', paddingHorizontal: 40, marginTop: 64, gap: 8 },
  hintTitle: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  hint: { color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  muted: { color: '#6B7280', textAlign: 'center', marginTop: 20 },

  cell: { width: '33.33%', padding: 4 },
  cardImg: { width: '100%', aspectRatio: 0.71, borderRadius: 6 },
  placeholder: { backgroundColor: '#E5E7EB' },
  cardName: { fontSize: 12, marginTop: 3 },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00000055', borderRadius: 6 },
  plus: { position: 'absolute', bottom: 6, right: 6, backgroundColor: '#2563EB', borderRadius: 11, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  countBadge: { position: 'absolute', bottom: 6, right: 6, backgroundColor: '#059669', borderRadius: 11, minWidth: 22, height: 22, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 1 },
  countText: { color: 'white', fontWeight: '800', fontSize: 12 },

  cartBar: { position: 'absolute', left: 12, right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#111827', borderRadius: 14, paddingVertical: 10, paddingLeft: 12, paddingRight: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  cartThumbs: { flexDirection: 'row' },
  cartThumb: { width: 34, height: 48, borderRadius: 4, borderWidth: 1.5, borderColor: '#111827' },
  cartCount: { flex: 1, color: 'white', fontWeight: '700', fontSize: 15 },
  cartCta: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#2563EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  cartCtaText: { color: 'white', fontWeight: '800' },

  backdrop: { flex: 1, backgroundColor: '#00000066' },
  sheet: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', marginBottom: 10 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sheetTitle: { fontSize: 17, fontWeight: '800' },
  clearLink: { color: '#DC2626', fontWeight: '700' },
  sheetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 2 },
  sheetItem: { width: 56 },
  sheetImg: { width: 56, height: 78, borderRadius: 5 },
  removeBadge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#DC2626', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },

  label: { fontWeight: '700', marginTop: 16, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { color: '#374151', fontWeight: '600', fontSize: 13 },
  chipTextOn: { color: 'white' },

  addAll: { backgroundColor: '#059669', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 18 },
  disabled: { opacity: 0.5 },
  addAllText: { color: 'white', fontWeight: '800', fontSize: 16 },
});
