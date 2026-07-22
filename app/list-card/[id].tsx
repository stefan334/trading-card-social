import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useCollectionActions } from '../../src/hooks/useCollectionActions';
import { useKeyboardHeight } from '../../src/hooks/useKeyboardHeight';
import { useSellerAccount } from '../../src/hooks/useSellerAccount';
import { isSupabaseConfigured, supabase } from '../../src/services/supabase/client';
import { uploadImage } from '../../src/services/supabase/storage';
import { useTheme } from '../../src/theme';

/**
 * Listing composer, routed as /list-card/[userCardId]. Listing is a deliberate
 * act now: real photos are mandatory (they're what buyers buy and what dispute
 * evidence is made of), a description is welcome, a price is optional —
 * blank price = open to card-for-card trades.
 */
export default function ListCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const { publishListing, toggleForTrade } = useCollectionActions();
  const { data: sellerAccount } = useSellerAccount();

  const { data: copy, isLoading } = useQuery({
    queryKey: ['list-card', id],
    enabled: isSupabaseConfigured && Boolean(id) && Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('user_cards')
        .select('id, owner_id, card_id, is_for_trade, sale_price, listing_photos, listing_description, condition, grade, finish, card:cards(name, image_url_small)')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const [photos, setPhotos] = useState<string[]>([]);
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Pre-fill once when editing an existing listing.
  useEffect(() => {
    if (copy && !hydrated) {
      setPhotos(copy.listing_photos ?? []);
      setPrice(copy.sale_price != null ? String(copy.sale_price) : '');
      setDescription(copy.listing_description ?? '');
      setHydrated(true);
    }
  }, [copy, hydrated]);

  if (isLoading || !hydrated) return <ActivityIndicator style={{ marginTop: 48 }} />;
  if (!copy || copy.owner_id !== user?.id) {
    return <Text style={[styles.center, { color: colors.textMuted }]}>Card not found.</Text>;
  }

  const editing = copy.is_for_trade;
  const parsedPrice = price.trim() === '' ? null : Number(price.trim().replace(',', '.'));
  const priceValid = parsedPrice === null || (!Number.isNaN(parsedPrice) && parsedPrice > 0);
  const canPublish = photos.length > 0 && priceValid && !uploading && !publishListing.isPending;

  async function addPhotos() {
    if (uploading) return;
    const remaining = 5 - photos.length;
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
        if (a.base64) urls.push(await uploadImage(a.base64, user!.id, 'listing'));
      }
      setPhotos((p) => [...p, ...urls].slice(0, 5));
    } finally {
      setUploading(false);
    }
  }

  function publish() {
    publishListing.mutate(
      {
        userCardId: copy.id,
        cardId: copy.card_id,
        photos,
        price: parsedPrice,
        description: description || null,
      },
      {
        onSuccess: () => {
          // Priced listing but payouts not set up -> the listing exists but
          // nobody can buy it. Walk the seller to the missing step now.
          if (parsedPrice != null && !sellerAccount?.chargesEnabled) {
            Alert.alert(
              'Listed! One step left to sell',
              'Buyers can purchase this card once you set up payouts (2 minutes, done once).',
              [
                { text: 'Later', style: 'cancel', onPress: () => router.back() },
                {
                  text: 'Set up payouts',
                  onPress: () => router.replace('/seller-payouts' as any),
                },
              ]
            );
          } else {
            router.back();
          }
        },
      }
    );
  }

  function unlist() {
    Alert.alert('Remove listing?', 'The card stays in your collection; it just stops being offered.', [
      { text: 'Keep listed', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          toggleForTrade.mutate(
            { userCardId: copy.id, isForTrade: false, cardId: copy.card_id },
            { onSuccess: () => router.back() }
          ),
      },
    ]);
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: 24 + Math.max(insets.bottom, keyboardHeight) }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Which copy */}
      <View style={[styles.cardRow, { backgroundColor: colors.surface }]}>
        <Image source={{ uri: copy.card?.image_url_small ?? undefined }} style={styles.cardThumb} contentFit="contain" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={2}>{copy.card?.name}</Text>
          <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
            {[copy.grade, copy.condition?.replace('_', ' '), copy.finish?.replace(/_/g, ' ')].filter(Boolean).join(' · ') || 'Unspecified condition'}
          </Text>
        </View>
      </View>

      {/* Photos — the heart of the listing */}
      <Text style={[styles.label, { color: colors.text }]}>
        Photos of your card <Text style={styles.required}>(required)</Text>
      </Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        Real photos build trust and are your proof of condition — front and back at minimum is ideal.
      </Text>
      <View style={styles.photoGrid}>
        {photos.map((url) => (
          <View key={url} style={styles.photoWrap}>
            <Image source={{ uri: url }} style={styles.photo} contentFit="cover" />
            <Pressable style={styles.photoRemove} hitSlop={6} onPress={() => setPhotos((p) => p.filter((x) => x !== url))}>
              <Ionicons name="close" size={13} color="white" />
            </Pressable>
          </View>
        ))}
        {photos.length < 5 ? (
          <Pressable style={[styles.photoAdd, { borderColor: colors.border }]} onPress={addPhotos} disabled={uploading}>
            {uploading ? <ActivityIndicator size="small" /> : <Ionicons name="camera-outline" size={26} color={colors.textMuted} />}
          </Pressable>
        ) : null}
      </View>

      {/* Price — optional, keeps the trade door open */}
      <Text style={[styles.label, { color: colors.text }]}>Asking price</Text>
      <View style={styles.priceRow}>
        <Text style={[styles.euro, { color: colors.textMuted }]}>€</Text>
        <TextInput
          style={[styles.priceInput, { borderColor: colors.border, color: colors.text }]}
          placeholder="Leave blank if you only want card trades"
          placeholderTextColor={colors.textFaint}
          keyboardType="decimal-pad"
          value={price}
          onChangeText={setPrice}
        />
      </View>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {parsedPrice != null && priceValid
          ? `Buyers pay €${(Math.round((parsedPrice * 1.05 + 0.5) * 100) / 100).toFixed(2)} with buyer protection — you receive the full €${parsedPrice.toFixed(2)} (shipping included).`
          : 'With a price, collectors can buy instantly. Either way, card-for-card offers stay open.'}
      </Text>

      {/* Description — optional */}
      <Text style={[styles.label, { color: colors.text }]}>Description</Text>
      <TextInput
        style={[styles.description, { borderColor: colors.border, color: colors.text }]}
        placeholder="Centering, whitening, storage… anything a buyer or trader should know (optional)"
        placeholderTextColor={colors.textFaint}
        multiline
        maxLength={500}
        value={description}
        onChangeText={setDescription}
      />

      {publishListing.isError ? (
        <Text style={styles.errorText}>{(publishListing.error as any)?.message ?? 'Could not publish'}</Text>
      ) : null}

      <Pressable
        style={[styles.primary, { backgroundColor: colors.primary }, !canPublish && { opacity: 0.5 }]}
        disabled={!canPublish}
        onPress={publish}
      >
        {publishListing.isPending ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.primaryText}>{editing ? 'Save listing' : 'List for trade'}</Text>
        )}
      </Pressable>
      {photos.length === 0 ? (
        <Text style={[styles.gateNote, { color: colors.textMuted }]}>Add at least one photo to list this card.</Text>
      ) : null}

      {editing ? (
        <Pressable style={styles.unlistBtn} onPress={unlist}>
          <Text style={styles.unlistText}>Remove listing</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { marginTop: 64, textAlign: 'center' },
  container: { padding: 16, gap: 8 },
  cardRow: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 12, alignItems: 'center' },
  cardThumb: { width: 44, height: 62, borderRadius: 4 },
  cardName: { fontSize: 15, fontWeight: '700' },
  cardMeta: { fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  label: { fontSize: 15, fontWeight: '700', marginTop: 12 },
  required: { color: '#D97706', fontSize: 12, fontWeight: '600' },
  hint: { fontSize: 12, lineHeight: 17 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  photoWrap: { position: 'relative' },
  photo: { width: 84, height: 84, borderRadius: 10, backgroundColor: '#0002' },
  photoRemove: {
    position: 'absolute', top: -5, right: -5, width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#111827CC', alignItems: 'center', justifyContent: 'center',
  },
  photoAdd: {
    width: 84, height: 84, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  euro: { fontSize: 18, fontWeight: '700' },
  priceInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  description: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, minHeight: 90, textAlignVertical: 'top' },
  errorText: { color: '#DC2626', fontSize: 13, textAlign: 'center', marginTop: 6 },
  primary: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  primaryText: { color: 'white', fontSize: 16, fontWeight: '700' },
  gateNote: { fontSize: 12, textAlign: 'center' },
  unlistBtn: { alignItems: 'center', paddingVertical: 12 },
  unlistText: { color: '#DC2626', fontSize: 14, fontWeight: '600' },
});
