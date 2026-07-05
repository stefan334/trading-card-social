import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useBatch } from '../src/context/BatchContext';
import { useCardSearch } from '../src/hooks/useCardSearch';
import { useCollectionActions } from '../src/hooks/useCollectionActions';
import { useDebouncedValue } from '../src/hooks/useDebouncedValue';
import { getProvider, listProviders } from '../src/services/tcg-providers';
import type { CardCondition } from '../src/types/domain';

const CONDITIONS: CardCondition[] = ['mint', 'near_mint', 'excellent', 'good', 'played', 'poor'];
const LABEL: Record<CardCondition, string> = {
  mint: 'Mint', near_mint: 'Near Mint', excellent: 'Excellent', good: 'Good', played: 'Played', poor: 'Poor',
};

/**
 * Batch add — queue a bunch of cards (scan or search), pick one condition for the
 * lot, and add them all at once. The feed groups them into a single "added N
 * cards" post (like adding a whole pack).
 */
export default function BatchAddScreen() {
  const router = useRouter();
  const { items, add: addToTray, removeAt, clear } = useBatch();
  const gameId = listProviders()[0]?.gameId ?? 'pokemon';
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query);
  const { data: results, isLoading } = useCardSearch(debounced, gameId);
  const [condition, setCondition] = useState<CardCondition>('near_mint');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const { add } = useCollectionActions();

  async function addResult(cardId: string) {
    const card = results?.find((c) => c.id === cardId);
    if (!card) return;
    setBusyId(cardId);
    try {
      const set = await getProvider(card.gameId).getSet(card.setId);
      addToTray(card, set);
    } finally {
      setBusyId(null);
    }
  }

  async function addAll() {
    if (!items.length) return;
    setAdding(true);
    try {
      for (const it of items) {
        await add.mutateAsync({ card: it.card, set: it.set, condition });
      }
      clear();
      router.back();
    } finally {
      setAdding(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.trayTitle}>To add ({items.length})</Text>
      {items.length === 0 ? (
        <Text style={styles.muted}>Scan or search below to build up a batch — great for a fresh pack.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tray}>
          {items.map((it) => (
            <View key={it.key} style={styles.trayItem}>
              {it.card.imageUrlSmall ? (
                <Image source={{ uri: it.card.imageUrlSmall }} style={styles.trayImg} />
              ) : (
                <View style={[styles.trayImg, styles.placeholder]} />
              )}
              <Pressable style={styles.removeBadge} onPress={() => removeAt(it.key)}>
                <Ionicons name="close" size={13} color="white" />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.actionsRow}>
        <Link href="/scan?batch=1" asChild>
          <Pressable style={styles.scanBtn}>
            <Ionicons name="camera" size={18} color="white" />
            <Text style={styles.scanText}>Scan</Text>
          </Pressable>
        </Link>
      </View>

      <Text style={styles.label}>Condition for this batch</Text>
      <View style={styles.chips}>
        {CONDITIONS.map((c) => (
          <Pressable key={c} style={[styles.chip, c === condition && styles.chipOn]} onPress={() => setCondition(c)}>
            <Text style={[styles.chipText, c === condition && styles.chipTextOn]}>{LABEL[c]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#9CA3AF" />
        <TextInput style={styles.input} placeholder="Search cards to add" autoCapitalize="none" value={query} onChangeText={setQuery} />
      </View>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 12 }} />
      ) : (
        <FlatList
          data={results ?? []}
          keyExtractor={(c) => c.id}
          numColumns={3}
          columnWrapperStyle={{ paddingHorizontal: 8 }}
          renderItem={({ item }) => (
            <Pressable style={styles.cell} onPress={() => addResult(item.id)} disabled={busyId === item.id}>
              {item.imageUrlSmall ? (
                <Image source={{ uri: item.imageUrlSmall }} style={styles.cardImg} />
              ) : (
                <View style={[styles.cardImg, styles.placeholder]} />
              )}
              {busyId === item.id ? (
                <View style={styles.addOverlay}><ActivityIndicator color="white" /></View>
              ) : (
                <View style={styles.plus}><Ionicons name="add" size={16} color="white" /></View>
              )}
            </Pressable>
          )}
        />
      )}

      <Pressable style={[styles.addAll, (!items.length || adding) && styles.disabled]} onPress={addAll} disabled={!items.length || adding}>
        {adding ? <ActivityIndicator color="white" /> : <Text style={styles.addAllText}>Add all {items.length} cards</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 12 },
  trayTitle: { fontWeight: '700', fontSize: 15, marginHorizontal: 16 },
  muted: { color: '#6B7280', marginHorizontal: 16, marginTop: 8 },
  tray: { paddingHorizontal: 16, gap: 8, paddingVertical: 10 },
  trayItem: { width: 58 },
  trayImg: { width: 58, height: 81, borderRadius: 5 },
  removeBadge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#DC2626', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  actionsRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 4 },
  scanBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#111827', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  scanText: { color: 'white', fontWeight: '700' },
  label: { fontWeight: '700', marginHorizontal: 16, marginTop: 16, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16 },
  chip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  chipOn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { color: '#374151', fontWeight: '600', fontSize: 13 },
  chipTextOn: { color: 'white' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 14, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#D1D5DB' },
  input: { flex: 1, paddingVertical: 9, fontSize: 15 },
  cell: { width: '33.33%', padding: 4 },
  cardImg: { width: '100%', aspectRatio: 0.71, borderRadius: 6 },
  placeholder: { backgroundColor: '#E5E7EB' },
  addOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  plus: { position: 'absolute', bottom: 8, right: 8, backgroundColor: '#2563EB', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  addAll: { backgroundColor: '#059669', margin: 16, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  disabled: { opacity: 0.5 },
  addAllText: { color: 'white', fontWeight: '800', fontSize: 16 },
});
