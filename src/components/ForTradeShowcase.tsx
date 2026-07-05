import { Link } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useForTradeCards } from '../hooks/useForTradeCards';
import { formatPrice } from '../utils/time';

/**
 * Horizontal showcase of a user's cards listed for trade, with asking price or
 * "open to trades". Shown on profiles so people see what's available at a glance.
 */
export function ForTradeShowcase({ userId }: { userId: string }) {
  const { data: cards } = useForTradeCards(userId);
  if (!cards?.length) return null;

  return (
    <View>
      <Text style={styles.title}>For Trade ({cards.length})</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {cards.map((c) => (
          <Link key={c.userCardId} href={`/card/${encodeURIComponent(c.cardId)}`} asChild>
            <Pressable style={styles.tile}>
              {c.imageUrlSmall ? (
                <Image source={{ uri: c.imageUrlSmall }} style={styles.img} />
              ) : (
                <View style={[styles.img, styles.placeholder]} />
              )}
              <Text style={styles.price} numberOfLines={1}>
                {c.salePrice != null ? formatPrice(c.salePrice, 'EUR') : 'Open to trades'}
              </Text>
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginHorizontal: 16, marginTop: 16, marginBottom: 4 },
  row: { paddingHorizontal: 16, gap: 10, paddingVertical: 4 },
  tile: { width: 88 },
  img: { width: 88, height: 123, borderRadius: 6 },
  placeholder: { backgroundColor: '#E5E7EB' },
  price: { fontSize: 12, fontWeight: '700', color: '#059669', marginTop: 3 },
});
