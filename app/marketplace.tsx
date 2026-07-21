import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SetPickerModal } from '../src/components/SetPickerModal';
import { SupabaseSetupNotice } from '../src/components/SupabaseSetupNotice';
import { useCardPrices } from '../src/hooks/useCardPrices';
import { useDebouncedValue } from '../src/hooks/useDebouncedValue';
import { useMarketplace, type MarketListing } from '../src/hooks/useMarketplace';
import { useTraderRatings, type TraderRating } from '../src/hooks/useTraderRatings';
import { useScreenView } from '../src/services/analytics';
import { isSupabaseConfigured } from '../src/services/supabase/client';
import { listProviders } from '../src/services/tcg-providers';
import { useTheme } from '../src/theme';
import { formatPrice } from '../src/utils/time';

function ListingRow({ item, marketAvg, rating }: { item: MarketListing; marketAvg?: number; rating?: TraderRating }) {
  const { colors } = useTheme();
  const ownerName = item.owner?.displayName || item.owner?.username || 'Someone';
  return (
    <View style={styles.row}>
      <Link href={`/card/${encodeURIComponent(item.cardId)}`} asChild>
        <Pressable style={styles.rowMain}>
          {item.imageUrlSmall ? (
            <Image source={{ uri: item.imageUrlSmall }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.placeholder]} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.sub, { color: colors.textMuted }]}>
              #{item.number}
              {item.grade ? ` · ${item.grade}` : item.condition ? ` · ${item.condition.replace('_', ' ')}` : ''}
            </Text>
            {/* Seller chip: tap = their profile (nested Pressable wins the touch). */}
            {item.owner ? (
              <Link href={`/user/${item.owner.id}`} asChild>
                <Pressable style={styles.ownerChip} hitSlop={4}>
                  {item.owner.avatarUrl ? (
                    <Image source={{ uri: item.owner.avatarUrl }} style={styles.ownerAvatar} />
                  ) : (
                    <Ionicons name="person-circle" size={16} color={colors.textFaint} />
                  )}
                  <Text style={[styles.owner, { color: colors.textMuted }]} numberOfLines={1}>
                    {ownerName}
                  </Text>
                  {rating && rating.count > 0 ? (
                    <View style={styles.ratingChip}>
                      <Ionicons name="star" size={10} color="#F59E0B" />
                      <Text style={styles.ratingText}>
                        {rating.avg.toFixed(1)} ({rating.count})
                      </Text>
                    </View>
                  ) : null}
                  <Text style={[styles.owner, { color: colors.textFaint }]} numberOfLines={1}>
                    {item.distanceKm != null ? `· ~${item.distanceKm} km` : item.ownerLocation ? `· ${item.ownerLocation}` : ''}
                  </Text>
                </Pressable>
              </Link>
            ) : null}
          </View>
        </Pressable>
      </Link>
      <View style={styles.priceCol}>
        <Text style={styles.price}>
          {item.salePrice != null ? formatPrice(item.salePrice, 'EUR') : 'Open to trades'}
        </Text>
        {marketAvg != null ? <Text style={styles.mkt}>mkt {formatPrice(marketAvg, 'EUR')}</Text> : null}
        <Link href={`/trade/new?with=${item.owner?.id}&card=${encodeURIComponent(item.cardId)}` as any} asChild>
          <Pressable style={styles.offerBtn}>
            <Ionicons name="swap-horizontal" size={14} color="white" />
            <Text style={styles.offerText}>Offer</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

/** Global marketplace: browse every card listed for trade, opened from the Feed header. */
export default function MarketplaceScreen() {
  const games = listProviders();
  const { colors } = useTheme();
  useScreenView('marketplace');
  const [gameId, setGameId] = useState(games[0]?.gameId ?? 'pokemon');
  const [query, setQuery] = useState('');
  const [nearMe, setNearMe] = useState(true);
  const [filterSet, setFilterSet] = useState<{ id: string; name: string } | null>(null);
  const [setPickerOpen, setSetPickerOpen] = useState(false);
  const debounced = useDebouncedValue(query);
  const { listings, isLoading, canFilterNear, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMarketplace(gameId, debounced, nearMe, filterSet?.id ?? null);
  const { data: prices } = useCardPrices(listings.map((l) => l.cardId));
  const { data: ratings } = useTraderRatings(listings.map((l) => l.owner?.id).filter(Boolean) as string[]);

  if (!isSupabaseConfigured) {
    return (
      <View style={styles.container}>
        <SupabaseSetupNotice />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Search listings by card name"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            value={query}
            onChangeText={setQuery}
          />
        </View>
        <Pressable
          style={[styles.setBtn, filterSet && styles.setBtnOn]}
          onPress={() => (filterSet ? setFilterSet(null) : setSetPickerOpen(true))}
        >
          <Ionicons name={filterSet ? 'close-circle' : 'albums'} size={16} color={filterSet ? 'white' : '#2563EB'} />
          <Text style={[styles.setBtnText, filterSet && { color: 'white' }]} numberOfLines={1}>
            {filterSet ? filterSet.name : 'Set'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.nearRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="location" size={16} color={nearMe && canFilterNear ? '#2563EB' : '#9CA3AF'} />
          <Text style={[styles.nearLabel, { color: colors.text }]}>Near me only</Text>
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
          renderItem={({ item }) => (
            <ListingRow
              item={item}
              marketAvg={prices?.get(item.cardId)?.average}
              rating={item.owner ? ratings?.get(item.owner.id) : undefined}
            />
          )}
          onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 14 }} /> : null}
          ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: colors.borderLight }]} />}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {query || filterSet
                ? 'No listings match your filters.'
                : 'No cards are listed for trade yet. List some from your collection!'}
            </Text>
          }
        />
      )}

      <SetPickerModal
        visible={setPickerOpen}
        gameId={gameId}
        onClose={() => setSetPickerOpen(false)}
        onSelect={(s) => setFilterSet({ id: s.id, name: s.name })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 8 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginBottom: 8 },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#D1D5DB',
  },
  setBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 150,
    borderWidth: 1, borderColor: '#2563EB', borderRadius: 10, paddingHorizontal: 10, height: 42,
  },
  setBtnOn: { backgroundColor: '#2563EB' },
  setBtnText: { color: '#2563EB', fontWeight: '700', fontSize: 13, flexShrink: 1 },
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
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 48, height: 67, borderRadius: 5 },
  placeholder: { backgroundColor: '#E5E7EB' },
  name: { fontSize: 15, fontWeight: '700' },
  sub: { color: '#6B7280', fontSize: 13, marginTop: 1, textTransform: 'capitalize' },
  owner: { color: '#6B7280', fontSize: 13 },
  ownerChip: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3, alignSelf: 'flex-start' },
  ownerAvatar: { width: 16, height: 16, borderRadius: 8 },
  ratingChip: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  ratingText: { color: '#B45309', fontSize: 11, fontWeight: '700' },
  priceCol: { alignItems: 'flex-end', gap: 4 },
  price: { fontWeight: '800', color: '#059669', fontSize: 15 },
  mkt: { color: '#9CA3AF', fontSize: 11 },
  offerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2563EB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, marginTop: 2 },
  offerText: { color: 'white', fontWeight: '700', fontSize: 13 },
  sep: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 74 },
  empty: { color: '#6B7280', textAlign: 'center', marginTop: 40, marginHorizontal: 24, lineHeight: 20 },
});
