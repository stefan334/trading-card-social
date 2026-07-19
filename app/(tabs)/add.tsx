import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
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
import { dbGetSet, dbGetSetCards, dbGetSets } from '../../src/services/catalog';
import { getProvider, listProviders } from '../../src/services/tcg-providers';
import type { Card } from '../../src/types/card';
import type { CardCondition } from '../../src/types/domain';
import { useTheme } from '../../src/theme';

const CONDITIONS: CardCondition[] = ['mint', 'near_mint', 'excellent', 'good', 'played', 'poor'];
const LABEL: Record<CardCondition, string> = {
  mint: 'Mint', near_mint: 'Near Mint', excellent: 'Excellent', good: 'Good', played: 'Played', poor: 'Poor',
};
const FINISHES = [
  { key: 'normal', label: 'Normal' },
  { key: 'holo', label: 'Holo' },
  { key: 'reverse_holo', label: 'Reverse Holo' },
  { key: 'foil', label: 'Foil' },
] as const;
type Finish = (typeof FINISHES)[number]['key'];

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
  const { colors } = useTheme();
  useScreenView('add');
  const { items, add: addToCart, removeAt, removeOne, clear } = useBatch();
  const gameId = listProviders()[0]?.gameId ?? 'pokemon';

  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query);
  const { data: results, isLoading } = useCardSearch(debounced, gameId);

  // Browse-by-set: pick a set and add straight from its full card pool.
  const [browseSet, setBrowseSet] = useState<{ id: string; name: string } | null>(null);
  const [setPickerOpen, setSetPickerOpen] = useState(false);
  const [setSearch, setSetSearch] = useState('');
  const { data: allSets } = useQuery({ queryKey: ['add-sets', gameId], queryFn: () => dbGetSets(gameId) });
  const { data: setCards, isLoading: setCardsLoading } = useQuery({
    queryKey: ['add-set-cards', browseSet?.id],
    enabled: !!browseSet,
    queryFn: () => dbGetSetCards(browseSet!.id),
  });

  const browsing = !!browseSet;
  const displayCards: Card[] = browsing ? setCards ?? [] : results ?? [];
  const displayLoading = browsing ? setCardsLoading : isLoading;
  const showGrid = browsing || debounced.trim().length >= 2;
  const filteredSets = (allSets ?? []).filter((s) => s.name.toLowerCase().includes(setSearch.trim().toLowerCase()));

  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [condition, setCondition] = useState<CardCondition>('near_mint');
  const [finish, setFinish] = useState<Finish>('normal');
  const [adding, setAdding] = useState(false);
  const { add } = useCollectionActions();

  // How many of each card id are already in the cart (for the count badge).
  const countByCard = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.card.id, (m.get(it.card.id) ?? 0) + 1);
    return m;
  }, [items]);

  async function addResult(card: Card) {
    setBusyId(card.id);
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
        await add.mutateAsync({ card: it.card, set: it.set, condition, finish: finish === 'normal' ? null : finish });
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
        <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            style={[styles.input, { color: colors.text }]}
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
        <Pressable style={styles.setsBtn} onPress={() => setSetPickerOpen(true)}>
          <Ionicons name="albums" size={18} color="#2563EB" />
          <Text style={styles.setsBtnText}>Sets</Text>
        </Pressable>
        <Link href="/scan" asChild>
          <Pressable style={styles.scanBtn}>
            <Ionicons name="camera" size={20} color="white" />
          </Pressable>
        </Link>
      </View>

      {browsing ? (
        <View style={styles.browseBanner}>
          <Ionicons name="albums" size={16} color="#2563EB" />
          <Text style={styles.browseText} numberOfLines={1}>{browseSet!.name}</Text>
          <Pressable onPress={() => setBrowseSet(null)} hitSlop={14} style={styles.browseClose}>
            <Ionicons name="close-circle" size={20} color="#2563EB" />
            <Text style={styles.browseCloseText}>Clear</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Results / empty states */}
      {!showGrid ? (
        <View style={styles.hintWrap}>
          <Ionicons name="albums-outline" size={40} color="#C7CBD1" />
          <Text style={[styles.hintTitle, { color: colors.text }]}>Build your pack</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Search by name, tap <Text style={{ fontWeight: '700' }}>Sets</Text> to browse a whole set, or
            scan. Everything you pick drops into the tray below — add them all at once.
          </Text>
        </View>
      ) : displayLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={displayCards}
          keyExtractor={(c) => c.id}
          numColumns={3}
          contentContainerStyle={{ padding: 8, paddingBottom: items.length ? 108 : 16 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const count = countByCard.get(item.id) ?? 0;
            const busy = busyId === item.id;
            return (
              <View style={styles.cell}>
                <View>
                  {item.imageUrlSmall ? (
                    <Image source={{ uri: item.imageUrlSmall }} style={styles.cardImg} recyclingKey={item.id} />
                  ) : (
                    <View style={[styles.cardImg, styles.placeholder]} />
                  )}
                  {busy ? (
                    <View style={styles.overlay}><ActivityIndicator color="white" /></View>
                  ) : count > 0 ? (
                    <View style={styles.stepper}>
                      <Pressable hitSlop={6} style={styles.stepBtn} onPress={() => removeOne(item.id)}>
                        <Ionicons name="remove" size={16} color="white" />
                      </Pressable>
                      <Text style={styles.stepCount}>{count}</Text>
                      <Pressable hitSlop={6} style={styles.stepBtn} onPress={() => addResult(item)}>
                        <Ionicons name="add" size={16} color="white" />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable style={styles.plus} onPress={() => addResult(item)}>
                      <Ionicons name="add" size={16} color="white" />
                    </Pressable>
                  )}
                </View>
                <Text numberOfLines={1} style={[styles.cardName, { color: colors.text }]}>{item.name}</Text>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={[styles.muted, { color: colors.textMuted }]}>No matches — try a different spelling.</Text>}
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
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Your pack · {items.length}</Text>
            {items.length > 0 && (
              <Pressable hitSlop={8} onPress={clear}>
                <Text style={styles.clearLink}>Clear</Text>
              </Pressable>
            )}
          </View>

          {items.length === 0 ? (
            <Text style={[styles.muted, { color: colors.textMuted }]}>Nothing queued yet.</Text>
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

          <Text style={[styles.label, { color: colors.text }]}>Condition (applies to all)</Text>
          <View style={styles.chips}>
            {CONDITIONS.map((c) => (
              <Pressable key={c} style={[styles.chip, c === condition && styles.chipOn]} onPress={() => setCondition(c)}>
                <Text style={[styles.chipText, c === condition && styles.chipTextOn]}>{LABEL[c]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Finish</Text>
          <View style={styles.chips}>
            {FINISHES.map((f) => (
              <Pressable key={f.key} style={[styles.chip, f.key === finish && styles.chipOn]} onPress={() => setFinish(f.key)}>
                <Text style={[styles.chipText, f.key === finish && styles.chipTextOn]}>{f.label}</Text>
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

      {/* Set picker */}
      <Modal visible={setPickerOpen} animationType="slide" onRequestClose={() => setSetPickerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={styles.pickerHeader}>
          <Text style={[styles.pickerTitle, { color: colors.text }]}>Browse a set</Text>
          <Pressable hitSlop={8} onPress={() => setSetPickerOpen(false)}>
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
        </View>
        <View style={[styles.pickerSearch, { backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Find a set"
            placeholderTextColor="#9CA3AF"
            value={setSearch}
            onChangeText={setSetSearch}
            autoCapitalize="none"
          />
        </View>
        <FlatList
          data={filteredSets}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <Pressable
              style={styles.setRow}
              onPress={() => {
                setBrowseSet({ id: item.id, name: item.name });
                setSetPickerOpen(false);
                setSetSearch('');
              }}
            >
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.setLogo} contentFit="contain" />
              ) : (
                <View style={styles.setLogo} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.setName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.setMeta, { color: colors.textMuted }]}>{item.series ? `${item.series} · ` : ''}{item.totalCards} cards</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </Pressable>
          )}
          ListEmptyComponent={<Text style={[styles.muted, { color: colors.textMuted }]}>No sets found.</Text>}
        />
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
  setsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#2563EB' },
  setsBtnText: { color: '#2563EB', fontWeight: '700' },
  browseBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 4, paddingLeft: 12, paddingRight: 6, paddingVertical: 8, borderRadius: 8, backgroundColor: '#EFF6FF' },
  browseText: { color: '#2563EB', fontWeight: '700', flex: 1 },
  browseClose: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  browseCloseText: { color: '#2563EB', fontWeight: '700', fontSize: 13 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  pickerTitle: { fontSize: 20, fontWeight: '800' },
  pickerSearch: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F3F4F6' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  setLogo: { width: 46, height: 30 },
  setName: { fontSize: 15, fontWeight: '600' },
  setMeta: { color: '#6B7280', fontSize: 13, marginTop: 1 },

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
  stepper: { position: 'absolute', bottom: 6, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: '#059669', borderRadius: 13, paddingHorizontal: 2 },
  stepBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  stepCount: { color: 'white', fontWeight: '800', fontSize: 13, minWidth: 16, textAlign: 'center' },

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
