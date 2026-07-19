import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useCardPrices } from '../hooks/useCardPrices';
import { useWishlist } from '../hooks/useWishlist';
import { useTheme } from '../theme';
import { formatPrice } from '../utils/time';

/**
 * A user's public wishlist shown on their profile — what they're chasing. When
 * viewing someone else, each card gets an "Offer" button that opens the trade
 * builder with them (you might own something they want).
 */
export function WishlistShowcase({ userId }: { userId: string }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { data: cards } = useWishlist(userId);
  const { data: prices } = useCardPrices((cards ?? []).map((c) => c.cardId));
  if (!cards?.length) return null;

  const canOffer = !!user && user.id !== userId;

  return (
    <View style={[styles.section, { borderTopColor: colors.borderLight }]}>
      <View style={styles.titleRow}>
        <Ionicons name="star" size={16} color="#F59E0B" />
        <Text style={[styles.title, { color: colors.text }]}>Wishlist ({cards.length})</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {cards.map((c) => (
          <View key={c.wishlistId} style={styles.tile}>
            <Link href={`/card/${encodeURIComponent(c.cardId)}`} asChild>
              <Pressable>
                {c.imageUrlSmall ? (
                  <Image source={{ uri: c.imageUrlSmall }} style={styles.img} contentFit="cover" recyclingKey={c.cardId} />
                ) : (
                  <View style={[styles.img, styles.placeholder]} />
                )}
                <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{c.name}</Text>
                {prices?.get(c.cardId)?.average != null ? (
                  <Text style={styles.mkt} numberOfLines={1}>{formatPrice(prices.get(c.cardId)!.average!, 'EUR')}</Text>
                ) : null}
              </Pressable>
            </Link>
            {canOffer ? (
              <Link href={`/trade/new?with=${userId}` as any} asChild>
                <Pressable style={styles.offerBtn}>
                  <Ionicons name="swap-horizontal" size={13} color="white" />
                  <Text style={styles.offerText}>Offer</Text>
                </Pressable>
              </Link>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 18, borderTopWidth: 1, paddingTop: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginBottom: 4 },
  title: { fontSize: 18, fontWeight: '700' },
  row: { paddingHorizontal: 16, gap: 10, paddingVertical: 4 },
  tile: { width: 84 },
  img: { width: 84, height: 117, borderRadius: 6 },
  placeholder: { backgroundColor: '#E5E7EB' },
  name: { fontSize: 11, marginTop: 3 },
  mkt: { fontSize: 11, fontWeight: '700', color: '#059669' },
  offerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 6, marginTop: 6 },
  offerText: { color: 'white', fontWeight: '700', fontSize: 12 },
});
