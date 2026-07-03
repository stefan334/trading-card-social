import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useOwnedCardIds } from '../../src/hooks/useOwnedCardIds';
import { getProvider } from '../../src/services/tcg-providers';
import { formatPrice } from '../../src/utils/time';

/**
 * Set completion screen, routed as /set/[id]. Shows every card in the set (live
 * API) with owned cards in full colour and missing ones dimmed, plus an
 * owned/total progress bar — the "what do I still need for this set" view.
 */
export default function SetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = id?.split(':')[0];

  const { data: set } = useQuery({
    queryKey: ['set', id],
    enabled: Boolean(id && gameId),
    queryFn: () => getProvider(gameId!).getSet(id!),
  });

  const { data: cardPage, isLoading } = useQuery({
    queryKey: ['set-cards', id],
    enabled: Boolean(id && gameId),
    queryFn: () => getProvider(gameId!).searchCards({ setId: id!, pageSize: 250 }),
  });

  const { data: ownedIds } = useOwnedCardIds(id);

  const cards = cardPage?.cards ?? [];
  const total = set?.totalCards || cardPage?.totalCount || cards.length;
  const ownedCount = ownedIds?.size ?? 0;
  const pct = total > 0 ? Math.round((ownedCount / total) * 100) : 0;

  return (
    <FlatList
      data={cards}
      keyExtractor={(c) => c.id}
      numColumns={3}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <View style={styles.header}>
          {set?.imageUrl && <Image source={{ uri: set.imageUrl }} style={styles.logo} contentFit="contain" />}
          <Text style={styles.setName}>{set?.name ?? 'Set'}</Text>
          {set?.series ? <Text style={styles.series}>{set.series}</Text> : null}
          <Text style={styles.count}>
            {ownedCount}/{total} collected · {pct}%
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
        </View>
      }
      ListEmptyComponent={isLoading ? <ActivityIndicator style={{ marginTop: 40 }} /> : null}
      renderItem={({ item }) => {
        const owned = ownedIds?.has(item.id);
        return (
          <Link href={`/card/${encodeURIComponent(item.id)}`} asChild>
            <Pressable style={styles.cell}>
              {item.imageUrlSmall ? (
                <Image source={{ uri: item.imageUrlSmall }} style={[styles.cardImage, !owned && styles.dimmed]} />
              ) : (
                <View style={[styles.cardImage, styles.placeholder]} />
              )}
              <Text style={styles.cardNumber}>#{item.number}</Text>
              {item.market?.average != null ? (
                <Text style={styles.cardPrice}>{formatPrice(item.market.average, item.market.currency)}</Text>
              ) : null}
            </Pressable>
          </Link>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 12 },
  header: { alignItems: 'center', paddingVertical: 16 },
  logo: { width: 120, height: 48, marginBottom: 8 },
  setName: { fontSize: 20, fontWeight: '800' },
  series: { color: '#6B7280', marginTop: 2 },
  count: { fontWeight: '700', color: '#2563EB', marginTop: 10 },
  progressTrack: { height: 8, width: '80%', backgroundColor: '#E5E7EB', borderRadius: 4, marginTop: 8 },
  progressFill: { height: 8, backgroundColor: '#2563EB', borderRadius: 4 },
  row: { justifyContent: 'flex-start' },
  cell: { width: '33.33%', padding: 4, alignItems: 'center' },
  cardImage: { width: '100%', aspectRatio: 0.71, borderRadius: 6 },
  dimmed: { opacity: 0.25 },
  placeholder: { backgroundColor: '#E5E7EB' },
  cardNumber: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  cardPrice: { fontSize: 11, fontWeight: '700', color: '#059669' },
});
