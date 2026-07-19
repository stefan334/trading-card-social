import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SupabaseSetupNotice } from '../../src/components/SupabaseSetupNotice';
import { useAuth } from '../../src/context/AuthContext';
import { useCardPrices } from '../../src/hooks/useCardPrices';
import { useWishlist } from '../../src/hooks/useWishlist';
import { isSupabaseConfigured } from '../../src/services/supabase/client';
import { listProviders } from '../../src/services/tcg-providers';
import { useTheme } from '../../src/theme';
import { formatPrice } from '../../src/utils/time';

/**
 * Wishlist tab: cards the user wants. Adding a wishlisted card is done from the
 * card detail screen. When someone you follow adds one of these to their
 * collection, a wishlist_match notification is created (DB trigger, Phase 4).
 */
export default function WishlistScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const games = listProviders();
  const [gameId, setGameId] = useState(games[0]?.gameId ?? 'pokemon');
  const { data: cards, isLoading } = useWishlist(user?.id, gameId);
  const { data: prices } = useCardPrices((cards ?? []).map((c) => c.cardId));

  if (!isSupabaseConfigured) {
    return (
      <View style={styles.container}>
        <SupabaseSetupNotice />
      </View>
    );
  }

  return (
    <View style={styles.container}>
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

      {!user ? (
        <Text style={[styles.muted, { color: colors.textMuted }]}>Sign in to build your wishlist.</Text>
      ) : isLoading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : !cards?.length ? (
        <Text style={[styles.muted, { color: colors.textMuted }]}>
          Your wishlist is empty. Open any card and tap “Add to wishlist” — you’ll be notified when
          someone you follow lists it.
        </Text>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(c) => c.wishlistId}
          numColumns={3}
          columnWrapperStyle={styles.row}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => {
            const price = prices?.get(item.cardId);
            return (
              <Link href={`/card/${encodeURIComponent(item.cardId)}`} asChild>
                <Pressable style={styles.cell}>
                  {item.imageUrlSmall ? (
                    <Image source={{ uri: item.imageUrlSmall }} style={styles.cardImage} />
                  ) : (
                    <View style={[styles.cardImage, styles.placeholder]} />
                  )}
                  <Text numberOfLines={1} style={[styles.cardName, { color: colors.text }]}>
                    {item.name}
                  </Text>
                  {price?.average != null ? (
                    <Text style={styles.cardPrice}>{formatPrice(price.average, price.currency)}</Text>
                  ) : null}
                </Pressable>
              </Link>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 12 },
  muted: { color: '#6B7280', marginHorizontal: 16, marginTop: 16, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  chip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  chipSelected: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { color: '#374151', fontWeight: '600' },
  chipTextSelected: { color: 'white' },
  row: { justifyContent: 'flex-start' },
  cell: { width: '33.33%', padding: 4 },
  cardImage: { width: '100%', aspectRatio: 0.71, borderRadius: 6 },
  placeholder: { backgroundColor: '#E5E7EB' },
  cardName: { fontSize: 12, marginTop: 4 },
  cardPrice: { fontSize: 12, fontWeight: '700', color: '#059669', marginTop: 1 },
});
