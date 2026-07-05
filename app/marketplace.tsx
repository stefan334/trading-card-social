import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SupabaseSetupNotice } from '../src/components/SupabaseSetupNotice';
import { useCardPrices } from '../src/hooks/useCardPrices';
import { useDebouncedValue } from '../src/hooks/useDebouncedValue';
import { useMarketplace, type MarketListing } from '../src/hooks/useMarketplace';
import { isSupabaseConfigured } from '../src/services/supabase/client';
import { listProviders } from '../src/services/tcg-providers';
import { formatPrice } from '../src/utils/time';

function ListingRow({ item, marketAvg }: { item: MarketListing; marketAvg?: number }) {
  const ownerName = item.owner?.displayName || item.owner?.username || 'Someone';
  return (
    <Link href={`/card/${encodeURIComponent(item.cardId)}`} asChild>
      <Pressable style={styles.row}>
        {item.imageUrlSmall ? (
          <Image source={{ uri: item.imageUrlSmall }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.placeholder]} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.sub}>
            #{item.number}
            {item.grade ? ` · ${item.grade}` : item.condition ? ` · ${item.condition.replace('_', ' ')}` : ''}
          </Text>
          <Link href={`/user/${item.owner?.id}`} style={styles.owner}>
            by {ownerName}
            {item.distanceKm != null ? ` · ~${item.distanceKm} km` : item.ownerLocation ? ` · ${item.ownerLocation}` : ''}
          </Link>
        </View>
        <View style={styles.priceCol}>
          <Text style={styles.price}>
            {item.salePrice != null ? formatPrice(item.salePrice, 'EUR') : 'Open to trades'}
          </Text>
          {marketAvg != null ? <Text style={styles.mkt}>mkt {formatPrice(marketAvg, 'EUR')}</Text> : null}
        </View>
      </Pressable>
    </Link>
  );
}

/** Global marketplace: browse every card listed for trade, opened from the Feed header. */
export default function MarketplaceScreen() {
  const games = listProviders();
  const [gameId, setGameId] = useState(games[0]?.gameId ?? 'pokemon');
  const [query, setQuery] = useState('');
  const [nearMe, setNearMe] = useState(true);
  const debounced = useDebouncedValue(query);
  const { listings, isLoading, canFilterNear } = useMarketplace(gameId, debounced, nearMe);
  const { data: prices } = useCardPrices(listings.map((l) => l.cardId));

  if (!isSupabaseConfigured) {
    return (
      <View style={styles.container}>
        <SupabaseSetupNotice />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#9CA3AF" />
        <TextInput
          style={styles.input}
          placeholder="Search listings by card name"
          autoCapitalize="none"
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <View style={styles.nearRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="location" size={16} color={nearMe && canFilterNear ? '#2563EB' : '#9CA3AF'} />
          <Text style={styles.nearLabel}>Near me only</Text>
        </View>
        <Switch value={nearMe} onValueChange={setNearMe} />
      </View>
      {nearMe && !canFilterNear ? (
        <Link href="/edit-profile" style={styles.nearHint}>
          Set your location in your profile to see local traders →
        </Link>
      ) : null}

      {games.length > 1 && (
        <View style={styles.chips}>
          {games.map((g) => {
            const sel = g.gameId === gameId;
            return (
              <Pressable key={g.gameId} style={[styles.chip, sel && styles.chipOn]} onPress={() => setGameId(g.gameId)}>
                <Text style={[styles.chipText, sel && styles.chipTextOn]}>{g.displayName}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(l) => l.userCardId}
          renderItem={({ item }) => <ListingRow item={item} marketAvg={prices?.get(item.cardId)?.average} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {query ? 'No listings match your search.' : 'No cards are listed for trade yet. List some from your collection!'}
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 8 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginBottom: 8,
    paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#D1D5DB',
  },
  input: { flex: 1, paddingVertical: 10, fontSize: 16 },
  nearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 4 },
  nearLabel: { fontWeight: '600', color: '#374151' },
  nearHint: { color: '#2563EB', paddingHorizontal: 14, paddingBottom: 6, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, marginBottom: 4 },
  chip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  chipOn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { color: '#374151', fontWeight: '600' },
  chipTextOn: { color: 'white' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  thumb: { width: 48, height: 67, borderRadius: 5 },
  placeholder: { backgroundColor: '#E5E7EB' },
  name: { fontSize: 15, fontWeight: '700' },
  sub: { color: '#6B7280', fontSize: 13, marginTop: 1, textTransform: 'capitalize' },
  owner: { color: '#2563EB', fontSize: 13, marginTop: 2 },
  priceCol: { alignItems: 'flex-end' },
  price: { fontWeight: '800', color: '#059669', fontSize: 15 },
  mkt: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
  sep: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 74 },
  empty: { color: '#6B7280', textAlign: 'center', marginTop: 40, marginHorizontal: 24, lineHeight: 20 },
});
