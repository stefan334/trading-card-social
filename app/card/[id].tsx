import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { useCardOwnership, type OwnedCopy } from '../../src/hooks/useCardOwnership';
import { useCollectionActions } from '../../src/hooks/useCollectionActions';
import { useIsWishlisted, useWishlistActions } from '../../src/hooks/useWishlistActions';
import { getProvider } from '../../src/services/tcg-providers';
import type { CardCondition } from '../../src/types/domain';
import { formatPrice } from '../../src/utils/time';

const CONDITIONS: CardCondition[] = ['mint', 'near_mint', 'excellent', 'good', 'played', 'poor'];
const CONDITION_LABEL: Record<CardCondition, string> = {
  mint: 'Mint',
  near_mint: 'Near Mint',
  excellent: 'Excellent',
  good: 'Good',
  played: 'Played',
  poor: 'Poor',
};

/** One owned copy: condition + for-trade toggle + (when listed) an asking price. */
function CopyRow({ copy, cardId }: { copy: OwnedCopy; cardId?: string }) {
  const { remove, toggleForTrade, setSalePrice } = useCollectionActions();
  const [price, setPrice] = useState(copy.salePrice != null ? String(copy.salePrice) : '');

  function savePrice() {
    const trimmed = price.trim().replace(',', '.');
    const n = trimmed === '' ? null : Number(trimmed);
    if (n !== null && Number.isNaN(n)) return;
    if (n !== copy.salePrice) setSalePrice.mutate({ userCardId: copy.id, price: n, cardId });
  }

  return (
    <View style={styles.copyBlock}>
      <View style={styles.copyRow}>
        <Text style={styles.copyLabel}>{copy.condition ? CONDITION_LABEL[copy.condition] : 'Unspecified'}</Text>
        <View style={styles.tradeToggle}>
          <Text style={styles.tradeText}>For trade</Text>
          <Switch
            value={copy.isForTrade}
            onValueChange={(v) => toggleForTrade.mutate({ userCardId: copy.id, isForTrade: v, cardId })}
          />
        </View>
        <Pressable onPress={() => remove.mutate({ userCardId: copy.id, cardId })} hitSlop={8}>
          <Text style={styles.remove}>Remove</Text>
        </Pressable>
      </View>
      {copy.isForTrade && (
        <View style={styles.priceRow}>
          <Text style={styles.euro}>€</Text>
          <TextInput
            style={styles.priceInput}
            placeholder="Asking price"
            keyboardType="decimal-pad"
            value={price}
            onChangeText={setPrice}
            onBlur={savePrice}
          />
          <Text style={styles.priceHint}>{price.trim() ? 'or open to trades' : 'blank = open to card trades'}</Text>
        </View>
      )}
    </View>
  );
}

/** Card detail + collection management, routed as /card/[id] (id like "pokemon:base1-4"). */
export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = id?.split(':')[0];
  const { user } = useAuth();

  const { data: card, isLoading, error } = useQuery({
    queryKey: ['card', id],
    enabled: Boolean(id && gameId),
    queryFn: () => getProvider(gameId!).getCard(id!),
  });

  const { data: set } = useQuery({
    queryKey: ['set', card?.setId],
    enabled: Boolean(card?.setId && gameId),
    queryFn: () => getProvider(gameId!).getSet(card!.setId),
  });

  const { data: owned } = useCardOwnership(id);
  const { add } = useCollectionActions();
  const { data: wishlisted } = useIsWishlisted(id);
  const { addToWishlist, removeFromWishlist } = useWishlistActions();
  const [condition, setCondition] = useState<CardCondition>('near_mint');

  if (isLoading) return <ActivityIndicator style={styles.center} />;
  if (error || !card) return <Text style={styles.center}>Failed to load card.</Text>;

  const canAdd = Boolean(user && set);
  const wishlistBusy = addToWishlist.isPending || removeFromWishlist.isPending;

  function toggleWishlist() {
    if (!card) return;
    if (wishlisted) removeFromWishlist.mutate({ cardId: card.id });
    else if (set) addToWishlist.mutate({ card, set });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {card.imageUrlLarge && <Image source={{ uri: card.imageUrlLarge }} style={styles.image} contentFit="contain" />}
      <Text style={styles.name}>{card.name}</Text>
      <Text style={styles.meta}>
        #{card.number}
        {card.rarity ? ` · ${card.rarity}` : ''}
        {set ? ` · ${set.name}` : ''}
      </Text>

      {card.market?.average != null && (
        <View style={styles.priceBox}>
          <Text style={styles.priceValue}>{formatPrice(card.market.average, card.market.currency)}</Text>
          <Text style={styles.priceLabel}>
            {card.market.source === 'cardmarket' ? 'Cardmarket avg' : 'TCGplayer market'}
            {card.market.trend != null ? ` · trend ${formatPrice(card.market.trend, card.market.currency)}` : ''}
          </Text>
        </View>
      )}

      {user && (
        <Pressable
          style={[styles.wishlistButton, wishlisted && styles.wishlistActive]}
          onPress={toggleWishlist}
          disabled={!canAdd || wishlistBusy}
        >
          <Ionicons
            name={wishlisted ? 'star' : 'star-outline'}
            size={18}
            color={wishlisted ? '#B45309' : '#374151'}
          />
          <Text style={[styles.wishlistText, wishlisted && styles.wishlistTextActive]}>
            {wishlisted ? 'On your wishlist' : 'Add to wishlist'}
          </Text>
        </Pressable>
      )}

      {!user ? (
        <Text style={styles.muted}>Sign in to add this card to your collection.</Text>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add to collection</Text>
          <View style={styles.chips}>
            {CONDITIONS.map((c) => {
              const selected = c === condition;
              return (
                <Pressable
                  key={c}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setCondition(c)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{CONDITION_LABEL[c]}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            style={[styles.addButton, (!canAdd || add.isPending) && styles.disabled]}
            disabled={!canAdd || add.isPending}
            onPress={() => set && add.mutate({ card, set, condition })}
          >
            {add.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.addButtonText}>Add copy ({CONDITION_LABEL[condition]})</Text>
            )}
          </Pressable>
        </View>
      )}

      {owned && owned.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>You own {owned.length} {owned.length === 1 ? 'copy' : 'copies'}</Text>
          {owned.map((copy) => (
            <CopyRow key={copy.id} copy={copy} cardId={id} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, alignItems: 'center' },
  center: { flex: 1, marginTop: 40, textAlign: 'center' },
  image: { width: 260, height: 360, marginBottom: 16 },
  name: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  meta: { color: '#6B7280', marginTop: 4, textAlign: 'center' },
  priceBox: { alignItems: 'center', marginTop: 14, backgroundColor: '#F0FDF4', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  priceValue: { fontSize: 22, fontWeight: '800', color: '#059669' },
  priceLabel: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  muted: { color: '#6B7280', marginTop: 20 },
  wishlistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 14,
  },
  wishlistActive: { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' },
  wishlistText: { fontWeight: '600', color: '#374151' },
  wishlistTextActive: { color: '#B45309' },
  section: { width: '100%', marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipSelected: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { color: '#374151', fontWeight: '600', fontSize: 13 },
  chipTextSelected: { color: 'white' },
  addButton: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  addButtonText: { color: 'white', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.5 },
  copyBlock: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingVertical: 6 },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  copyLabel: { fontWeight: '600', flex: 1 },
  tradeToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tradeText: { color: '#6B7280', fontSize: 13 },
  remove: { color: '#DC2626', fontWeight: '600', marginLeft: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 6 },
  euro: { fontSize: 16, fontWeight: '700', color: '#059669' },
  priceInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, width: 100, fontSize: 15 },
  priceHint: { color: '#9CA3AF', fontSize: 11, flex: 1 },
});
