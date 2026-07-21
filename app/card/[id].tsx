import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/context/AuthContext';
import { useCardOwnership, type OwnedCopy } from '../../src/hooks/useCardOwnership';
import { useCollectionActions } from '../../src/hooks/useCollectionActions';
import { uploadImage } from '../../src/services/supabase/storage';
import { useIsWishlisted, useWishlistActions } from '../../src/hooks/useWishlistActions';
import { getProvider } from '../../src/services/tcg-providers';
import { useTheme } from '../../src/theme';
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
const GRADERS = ['PSA', 'BGS', 'CGC', 'SGC'];
const GRADE_VALUES = ['10', '9.5', '9', '8.5', '8', '7', '6'];

/** One owned copy: condition + for-trade toggle + (when listed) an asking price + photos. */
function CopyRow({ copy, cardId }: { copy: OwnedCopy; cardId?: string }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { remove, toggleForTrade, setSalePrice, setListingPhotos } = useCollectionActions();
  const [price, setPrice] = useState(copy.salePrice != null ? String(copy.salePrice) : '');
  const [uploading, setUploading] = useState(false);

  // Photos of the physical card: required (>=1) before the copy can be BOUGHT;
  // trade-only listings work without them.
  async function addPhotos() {
    if (!user || uploading) return;
    const remaining = 5 - copy.listingPhotos.length;
    if (remaining <= 0) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.6,
      base64: true,
    });
    if (res.canceled) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const a of res.assets) {
        if (a.base64) urls.push(await uploadImage(a.base64, user.id, 'listing'));
      }
      if (urls.length) {
        setListingPhotos.mutate({ userCardId: copy.id, photos: [...copy.listingPhotos, ...urls], cardId });
      }
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(url: string) {
    setListingPhotos.mutate({
      userCardId: copy.id,
      photos: copy.listingPhotos.filter((p) => p !== url),
      cardId,
    });
  }

  function savePrice() {
    const trimmed = price.trim().replace(',', '.');
    const n = trimmed === '' ? null : Number(trimmed);
    if (n !== null && Number.isNaN(n)) return;
    if (n !== copy.salePrice) setSalePrice.mutate({ userCardId: copy.id, price: n, cardId });
  }

  return (
    <View style={[styles.copyBlock, { borderTopColor: colors.borderLight }]}>
      <View style={styles.copyRow}>
        <View style={styles.copyLabelRow}>
          <Text style={[styles.copyLabel, { color: colors.text }]}>
            {copy.grade ? (
              <Text style={styles.gradeBadge}>{copy.grade}</Text>
            ) : copy.condition ? (
              CONDITION_LABEL[copy.condition]
            ) : (
              'Unspecified'
            )}
          </Text>
          {copy.finish ? (
            <Text style={styles.finishBadge}>{copy.finish.replace(/_/g, ' ')}</Text>
          ) : null}
        </View>
        <View style={styles.tradeToggle}>
          <Text style={[styles.tradeText, { color: colors.textMuted }]}>For trade</Text>
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
        <>
          <View style={styles.priceRow}>
            <Text style={styles.euro}>€</Text>
            <TextInput
              style={[styles.priceInput, { borderColor: colors.border, color: colors.text }]}
              placeholder="Asking price"
              placeholderTextColor={colors.textFaint}
              keyboardType="decimal-pad"
              returnKeyType="done"
              value={price}
              onChangeText={setPrice}
              onBlur={savePrice}
              onSubmitEditing={savePrice}
            />
            <Pressable style={styles.priceSave} onPress={savePrice} disabled={setSalePrice.isPending}>
              {setSalePrice.isPending ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.priceSaveText}>Set</Text>
              )}
            </Pressable>
          </View>
          <Text style={styles.priceHint}>{price.trim() ? `Listed at €${price.trim()}` : 'Leave blank = open to card trades'}</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
            {copy.listingPhotos.map((url) => (
              <View key={url} style={styles.photoWrap}>
                <Image source={{ uri: url }} style={styles.photo} contentFit="cover" />
                <Pressable style={styles.photoRemove} hitSlop={6} onPress={() => removePhoto(url)}>
                  <Ionicons name="close" size={12} color="white" />
                </Pressable>
              </View>
            ))}
            {copy.listingPhotos.length < 5 ? (
              <Pressable
                style={[styles.photoAdd, { borderColor: colors.border }]}
                onPress={addPhotos}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Ionicons name="camera-outline" size={22} color={colors.textMuted} />
                )}
              </Pressable>
            ) : null}
          </ScrollView>
          <Text style={styles.priceHint}>
            {copy.listingPhotos.length === 0
              ? price.trim()
                ? 'Add photos of your actual card — required before buyers can purchase'
                : 'Add photos of your actual card (required if you want to sell)'
              : `${copy.listingPhotos.length}/5 photos — buyers see these first`}
          </Text>
        </>
      )}
    </View>
  );
}

/** Card detail + collection management, routed as /card/[id] (id like "pokemon:base1-4"). */
export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = id?.split(':')[0];
  const { user } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets(); // ownership controls end at the screen bottom

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
  const [graded, setGraded] = useState(false);
  const [grader, setGrader] = useState('PSA');
  const [gradeValue, setGradeValue] = useState('10');

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
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 24 + insets.bottom }]}>
      {card.imageUrlLarge && <Image source={{ uri: card.imageUrlLarge }} style={styles.image} contentFit="contain" />}
      <Text style={[styles.name, { color: colors.text }]}>{card.name}</Text>
      <Text style={[styles.meta, { color: colors.textMuted }]}>
        #{card.number}
        {card.rarity ? ` · ${card.rarity}` : ''}
        {set ? ` · ${set.name}` : ''}
      </Text>

      {card.market?.average != null && (
        <View style={[styles.priceBox, { backgroundColor: colors.surface }]}>
          <Text style={styles.priceValue}>{formatPrice(card.market.average, card.market.currency)}</Text>
          <Text style={[styles.priceLabel, { color: colors.textMuted }]}>
            {card.market.source === 'cardmarket' ? 'Cardmarket avg' : 'TCGplayer market'}
            {card.market.trend != null ? ` · trend ${formatPrice(card.market.trend, card.market.currency)}` : ''}
          </Text>
        </View>
      )}

      {user && (
        <Pressable
          style={[styles.wishlistButton, { borderColor: colors.border }, wishlisted && styles.wishlistActive]}
          onPress={toggleWishlist}
          disabled={!canAdd || wishlistBusy}
        >
          <Ionicons
            name={wishlisted ? 'star' : 'star-outline'}
            size={18}
            color={wishlisted ? '#B45309' : colors.text}
          />
          <Text style={[styles.wishlistText, { color: colors.text }, wishlisted && styles.wishlistTextActive]}>
            {wishlisted ? 'On your wishlist' : 'Add to wishlist'}
          </Text>
        </Pressable>
      )}

      {!user ? (
        <Text style={[styles.muted, { color: colors.textMuted }]}>Sign in to add this card to your collection.</Text>
      ) : (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Add to collection</Text>

          <View style={styles.segment}>
            <Pressable style={[styles.segBtn, { backgroundColor: colors.surface }, !graded && styles.segOn]} onPress={() => setGraded(false)}>
              <Text style={[styles.segText, { color: colors.textMuted }, !graded && styles.segTextOn]}>Raw</Text>
            </Pressable>
            <Pressable style={[styles.segBtn, { backgroundColor: colors.surface }, graded && styles.segOn]} onPress={() => setGraded(true)}>
              <Text style={[styles.segText, { color: colors.textMuted }, graded && styles.segTextOn]}>Graded</Text>
            </Pressable>
          </View>

          {graded ? (
            <>
              <View style={styles.chips}>
                {GRADERS.map((g) => (
                  <Pressable key={g} style={[styles.chip, { borderColor: colors.border }, g === grader && styles.chipSelected]} onPress={() => setGrader(g)}>
                    <Text style={[styles.chipText, { color: colors.textMuted }, g === grader && styles.chipTextSelected]}>{g}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.chips}>
                {GRADE_VALUES.map((v) => (
                  <Pressable key={v} style={[styles.chip, { borderColor: colors.border }, v === gradeValue && styles.chipSelected]} onPress={() => setGradeValue(v)}>
                    <Text style={[styles.chipText, { color: colors.textMuted }, v === gradeValue && styles.chipTextSelected]}>{v}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.chips}>
              {CONDITIONS.map((c) => {
                const selected = c === condition;
                return (
                  <Pressable key={c} style={[styles.chip, { borderColor: colors.border }, selected && styles.chipSelected]} onPress={() => setCondition(c)}>
                    <Text style={[styles.chipText, { color: colors.textMuted }, selected && styles.chipTextSelected]}>{CONDITION_LABEL[c]}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Pressable
            style={[styles.addButton, (!canAdd || add.isPending) && styles.disabled]}
            disabled={!canAdd || add.isPending}
            onPress={() => set && add.mutate({ card, set, condition, grade: graded ? `${grader} ${gradeValue}` : null })}
          >
            {add.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.addButtonText}>Add {graded ? `${grader} ${gradeValue}` : CONDITION_LABEL[condition]} copy</Text>
            )}
          </Pressable>
        </View>
      )}

      {owned && owned.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>You own {owned.length} {owned.length === 1 ? 'copy' : 'copies'}</Text>
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
  segment: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center' },
  segOn: { backgroundColor: '#2563EB' },
  segText: { fontWeight: '700', color: '#374151' },
  segTextOn: { color: 'white' },
  gradeBadge: { fontWeight: '800', color: '#B45309' },
  copyLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  finishBadge: { fontSize: 12, fontWeight: '700', color: '#6D28D9', backgroundColor: '#EDE9FE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, textTransform: 'capitalize' },
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
  priceInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, width: 100, fontSize: 15, color: '#111827' },
  priceSave: { backgroundColor: '#059669', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, minWidth: 52, alignItems: 'center' },
  priceSaveText: { color: 'white', fontWeight: '700' },
  priceHint: { color: '#9CA3AF', fontSize: 11, marginBottom: 4 },
  photoStrip: { gap: 8, paddingVertical: 6 },
  photoWrap: { position: 'relative' },
  photo: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#0002' },
  photoRemove: {
    position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#111827CC', alignItems: 'center', justifyContent: 'center',
  },
  photoAdd: {
    width: 64, height: 64, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
});
