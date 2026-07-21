import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useCardPrices } from '../hooks/useCardPrices';
import { useForTradeCards } from '../hooks/useForTradeCards';
import { useTheme } from '../theme';
import { formatPrice } from '../utils/time';

/**
 * Horizontal showcase of a user's cards listed for trade, with asking price or
 * "open to trades" plus the market average for reference. When you're viewing
 * someone else's showcase, each card gets an "Offer" button that opens the trade
 * builder pre-selecting that card.
 */
export function ForTradeShowcase({ userId }: { userId: string }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { data: cards } = useForTradeCards(userId);
  const { data: prices } = useCardPrices((cards ?? []).map((c) => c.cardId));
  if (!cards?.length) return null;

  const canOffer = !!user && user.id !== userId;

  return (
    <View style={[styles.section, { borderTopColor: colors.borderLight }]}>
      <View style={styles.titleRow}>
        <Ionicons name="swap-horizontal" size={16} color="#059669" />
        <Text style={[styles.title, { color: colors.text }]}>For Trade ({cards.length})</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {cards.map((c) => (
          <View key={c.userCardId} style={styles.tile}>
            {/* A for-trade card is an offer — open its listing, not the card page. */}
            <Link href={`/listing/${c.userCardId}` as any} asChild>
              <Pressable>
                {c.imageUrlSmall ? (
                  <Image source={{ uri: c.imageUrlSmall }} style={styles.img} />
                ) : (
                  <View style={[styles.img, styles.placeholder]} />
                )}
                {c.grade ? (
                  <View style={styles.gradeBadge}>
                    <Text style={styles.gradeText}>{c.grade}</Text>
                  </View>
                ) : null}
                <Text style={styles.price} numberOfLines={1}>
                  {c.salePrice != null ? formatPrice(c.salePrice, 'EUR') : 'Open to trades'}
                </Text>
                {prices?.get(c.cardId)?.average != null ? (
                  <Text style={styles.mkt} numberOfLines={1}>mkt {formatPrice(prices.get(c.cardId)!.average!, 'EUR')}</Text>
                ) : null}
              </Pressable>
            </Link>
            {canOffer ? (
              <Link href={`/trade/new?with=${userId}&card=${encodeURIComponent(c.cardId)}` as any} asChild>
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
  tile: { width: 88 },
  img: { width: 88, height: 123, borderRadius: 6 },
  placeholder: { backgroundColor: '#E5E7EB' },
  price: { fontSize: 12, fontWeight: '700', color: '#059669', marginTop: 3 },
  mkt: { fontSize: 10, color: '#9CA3AF' },
  gradeBadge: { position: 'absolute', top: 4, left: 4, backgroundColor: '#B45309', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  gradeText: { color: 'white', fontSize: 10, fontWeight: '800' },
  offerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 6, marginTop: 6 },
  offerText: { color: 'white', fontWeight: '700', fontSize: 12 },
});
