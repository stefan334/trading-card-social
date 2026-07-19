import { Link } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { CardMarketPrice } from '../types/card';
import { useCardPrices } from '../hooks/useCardPrices';
import type { CollectionSetGroup } from '../hooks/useCollectionBySet';
import { useTheme } from '../theme';
import { formatPrice } from '../utils/time';

function SetGroup({ group, prices }: { group: CollectionSetGroup; prices?: Map<string, CardMarketPrice> }) {
  const { colors } = useTheme();
  const pct = group.totalCards > 0 ? Math.round((group.ownedDistinct / group.totalCards) * 100) : 0;

  return (
    <View style={styles.group}>
      <Link href={`/set/${encodeURIComponent(group.setId)}`} asChild>
        <Pressable style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.setName, { color: colors.text }]}>{group.setName}</Text>
            {group.series ? <Text style={[styles.series, { color: colors.textMuted }]}>{group.series}</Text> : null}
          </View>
          <Text style={styles.count}>
            {group.ownedDistinct}/{group.totalCards || '?'}
          </Text>
        </Pressable>
      </Link>

      <View style={[styles.progressTrack, { backgroundColor: colors.surface }]}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>

      <FlatList
        data={group.cards}
        keyExtractor={(c) => c.userCardId}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardRow}
        renderItem={({ item }) => {
          const price = prices?.get(item.cardId);
          return (
            <Link href={`/card/${encodeURIComponent(item.cardId)}`} asChild>
              <Pressable style={styles.cardTile}>
                {item.imageUrlSmall ? (
                  <Image source={{ uri: item.imageUrlSmall }} style={styles.cardImage} />
                ) : (
                  <View style={[styles.cardImage, styles.cardPlaceholder]} />
                )}
                {item.isForTrade ? (
                  <View style={styles.tradeBadge}>
                    <Text style={styles.tradeBadgeText}>Trade</Text>
                  </View>
                ) : null}
                {price?.average != null ? (
                  <Text style={styles.price}>{formatPrice(price.average, price.currency)}</Text>
                ) : null}
              </Pressable>
            </Link>
          );
        }}
      />
    </View>
  );
}

/** Renders a collection grouped by set with completion bars + live prices. Taps navigate to detail. */
export function CollectionBySet({ groups }: { groups: CollectionSetGroup[] }) {
  const cardIds = groups.flatMap((g) => g.cards.map((c) => c.cardId));
  const { data: prices } = useCardPrices(cardIds);
  return (
    <View>
      {groups.map((g) => (
        <SetGroup key={g.setId} group={g} prices={prices} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 6 },
  setName: { fontSize: 16, fontWeight: '700' },
  series: { color: '#6B7280', fontSize: 13 },
  count: { fontWeight: '700', color: '#2563EB' },
  progressTrack: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, marginHorizontal: 16 },
  progressFill: { height: 6, backgroundColor: '#2563EB', borderRadius: 3 },
  cardRow: { paddingHorizontal: 16, paddingTop: 10, gap: 10 },
  cardTile: { width: 80 },
  cardImage: { width: 80, height: 112, borderRadius: 6 },
  cardPlaceholder: { backgroundColor: '#E5E7EB' },
  tradeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#059669',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  tradeBadgeText: { color: 'white', fontSize: 10, fontWeight: '700' },
  price: { fontSize: 11, fontWeight: '700', color: '#059669', marginTop: 2 },
});
