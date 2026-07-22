import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useCardPrices } from '../../src/hooks/useCardPrices';
import { useChatActions } from '../../src/hooks/useChatActions';
import { useListing, useSellerListings } from '../../src/hooks/useListing';
import { useTraderRatings } from '../../src/hooks/useTraderRatings';
import { sellerCanCharge } from '../../src/services/payments';
import { useTheme } from '../../src/theme';
import { formatPrice, formatRelativeTime } from '../../src/utils/time';

/**
 * Marketplace listing detail, routed as /listing/[userCardId]. The card page
 * answers "what is this card?" — this answers "what is this OFFER?": price vs
 * market, this copy's condition/finish/grade, when it was listed, who the
 * seller is (trust: rating, trades, distance), plus their other listings.
 */
export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { startThread } = useChatActions();

  const { data: listing, isLoading } = useListing(id);
  const { data: canCharge } = useQuery({
    queryKey: ['seller-can-charge', listing?.owner?.id],
    enabled: Boolean(listing?.owner?.id),
    queryFn: () => sellerCanCharge(listing!.owner!.id),
  });
  const { data: prices } = useCardPrices(listing ? [listing.cardId] : []);
  const { data: ratings } = useTraderRatings(listing?.owner ? [listing.owner.id] : []);
  const { data: more } = useSellerListings(listing?.owner?.id, listing?.userCardId);
  const { width } = useWindowDimensions();
  const pageW = width - 32; // screen minus the ScrollView's 16px side padding
  const [photoIndex, setPhotoIndex] = useState(0);
  const [chooserOpen, setChooserOpen] = useState(false);

  if (isLoading) return <ActivityIndicator style={styles.center} />;
  if (!listing) return <Text style={[styles.center, { color: colors.textMuted }]}>This listing is gone.</Text>;

  const mine = user?.id === listing.owner?.id;
  // Buyable = priced + photographed + the seller finished payout setup.
  const buyable =
    listing.salePrice != null &&
    listing.salePrice > 0 &&
    listing.listingPhotos.length > 0 &&
    canCharge === true;
  const rating = listing.owner ? ratings?.get(listing.owner.id) : undefined;
  const marketAvg = prices?.get(listing.cardId)?.average ?? null;
  const sellerName = listing.owner?.displayName || listing.owner?.username || 'Someone';

  async function message() {
    if (!listing?.owner) return;
    const threadId = await startThread.mutateAsync({ otherId: listing.owner.id, cardId: listing.cardId });
    router.push(`/chat/${threadId}`);
  }

  const chips = [
    listing.grade ? { icon: 'ribbon' as const, label: listing.grade } : null,
    listing.condition ? { icon: 'shield-checkmark' as const, label: listing.condition.replace('_', ' ') } : null,
    listing.finish ? { icon: 'sparkles' as const, label: listing.finish.replace('_', ' ') } : null,
  ].filter(Boolean) as { icon: keyof typeof Ionicons.glyphMap; label: string }[];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }}>
      {/* Hero — seller's photos of the ACTUAL card first (paged), catalog art as
          the last reference slide. Tapping any slide goes to the card page. */}
      {listing.listingPhotos.length > 0 ? (
        <View style={styles.heroWrap}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / pageW))}
          >
            {listing.listingPhotos.map((url) => (
              <Link key={url} href={`/card/${encodeURIComponent(listing.cardId)}`} asChild>
                <Pressable>
                  <Image source={{ uri: url }} style={[styles.heroPhoto, { width: pageW }]} contentFit="cover" />
                </Pressable>
              </Link>
            ))}
            <Link href={`/card/${encodeURIComponent(listing.cardId)}`} asChild>
              <Pressable style={{ width: pageW }}>
                <Image
                  source={{ uri: listing.imageUrlLarge ?? listing.imageUrlSmall ?? undefined }}
                  style={[styles.heroPhoto, { width: pageW }]}
                  contentFit="contain"
                />
                <View style={styles.refBadge}>
                  <Text style={styles.refBadgeText}>Catalog art</Text>
                </View>
              </Pressable>
            </Link>
          </ScrollView>
          <View style={styles.dots}>
            {[...listing.listingPhotos, 'ref'].map((k, i) => (
              <View key={k} style={[styles.dot, i === photoIndex && styles.dotOn]} />
            ))}
          </View>
        </View>
      ) : (
        <Link href={`/card/${encodeURIComponent(listing.cardId)}`} asChild>
          <Pressable style={styles.heroWrap}>
            {listing.imageUrlLarge || listing.imageUrlSmall ? (
              <Image
                source={{ uri: listing.imageUrlLarge ?? listing.imageUrlSmall! }}
                style={styles.hero}
                contentFit="contain"
              />
            ) : (
              <View style={[styles.hero, { backgroundColor: colors.surface }]} />
            )}
          </Pressable>
        </Link>
      )}

      <Text style={[styles.name, { color: colors.text }]}>{listing.name}</Text>
      <Text style={[styles.meta, { color: colors.textMuted }]}>
        #{listing.number}
        {listing.setName ? ` · ${listing.setName}` : ''}
      </Text>

      {listing.listingDescription ? (
        <Text style={[styles.sellerNote, { color: colors.text, backgroundColor: colors.surface }]}>
          {listing.listingDescription}
        </Text>
      ) : null}

      {/* The offer */}
      <View style={[styles.offerBox, { backgroundColor: colors.surface }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.price}>
            {listing.salePrice != null ? formatPrice(listing.salePrice, 'EUR') : 'Open to trades'}
          </Text>
          {marketAvg != null ? (
            <Text style={[styles.mkt, { color: colors.textMuted }]}>market ≈ {formatPrice(marketAvg, 'EUR')}</Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          {listing.listedAt ? (
            <Text style={[styles.listedAt, { color: colors.textMuted }]}>
              Listed {formatRelativeTime(listing.listedAt)}
            </Text>
          ) : null}
          {listing.distanceKm != null ? (
            <Text style={[styles.listedAt, { color: colors.textFaint }]}>~{listing.distanceKm} km away</Text>
          ) : listing.owner?.locationName ? (
            <Text style={[styles.listedAt, { color: colors.textFaint }]}>{listing.owner.locationName}</Text>
          ) : null}
        </View>
      </View>

      {chips.length ? (
        <View style={styles.chips}>
          {chips.map((c) => (
            <View key={c.label} style={[styles.chip, { borderColor: colors.border }]}>
              <Ionicons name={c.icon} size={13} color={colors.textMuted} />
              <Text style={[styles.chipText, { color: colors.textMuted }]}>{c.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Seller trust card */}
      {listing.owner ? (
        <Link href={`/user/${listing.owner.id}`} asChild>
          <Pressable style={StyleSheet.flatten([styles.seller, { backgroundColor: colors.card, borderColor: colors.borderLight }])}>
            {listing.owner.avatarUrl ? (
              <Image source={{ uri: listing.owner.avatarUrl }} style={styles.avatar} />
            ) : (
              <Ionicons name="person-circle" size={44} color={colors.textFaint} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.sellerName, { color: colors.text }]}>{sellerName}</Text>
              <View style={styles.sellerMeta}>
                {rating && rating.count > 0 ? (
                  <>
                    <Ionicons name="star" size={12} color="#F59E0B" />
                    <Text style={[styles.sellerMetaText, { color: colors.textMuted }]}>
                      {rating.avg.toFixed(1)} ({rating.count})
                    </Text>
                  </>
                ) : null}
                <Text style={[styles.sellerMetaText, { color: colors.textMuted }]}>
                  {listing.owner.tradesCompleted} {listing.owner.tradesCompleted === 1 ? 'trade' : 'trades'} completed
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.textFaint} />
          </Pressable>
        </Link>
      ) : null}

      {/* Actions: one primary entry, the chooser splits money vs cards. */}
      {!mine && listing.owner ? (
        <View style={styles.actions}>
          <Pressable style={styles.buyBtn} onPress={() => setChooserOpen(true)}>
            <Ionicons name="bag-check" size={18} color="white" />
            <Text style={styles.offerBtnText}>
              {buyable ? `Buy ${formatPrice(listing.salePrice!, 'EUR')} · or offer` : 'Get this card'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.msgBtn, { borderColor: colors.primary }]}
            onPress={message}
            disabled={startThread.isPending}
          >
            {startThread.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons name="chatbubble-ellipses" size={17} color={colors.primary} />
                <Text style={[styles.msgBtnText, { color: colors.primary }]}>Message</Text>
              </>
            )}
          </Pressable>

          <Modal visible={chooserOpen} transparent animationType="fade" onRequestClose={() => setChooserOpen(false)}>
            <Pressable style={styles.sheetBackdrop} onPress={() => setChooserOpen(false)}>
              <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>How do you want to get this card?</Text>

                <Pressable
                  style={[styles.sheetOption, { borderColor: colors.border }, !buyable && styles.sheetOptionOff]}
                  disabled={!buyable}
                  onPress={() => {
                    setChooserOpen(false);
                    router.push(`/checkout/${listing.userCardId}` as any);
                  }}
                >
                  <Ionicons name="card" size={22} color={buyable ? '#059669' : colors.textFaint} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetOptionTitle, { color: buyable ? colors.text : colors.textMuted }]}>
                      {listing.salePrice != null ? `Buy now — ${formatPrice(listing.salePrice, 'EUR')}` : 'Buy now'}
                    </Text>
                    <Text style={[styles.sheetOptionSub, { color: colors.textMuted }]}>
                      {buyable
                        ? 'Pay by card. Money is held until you confirm delivery.'
                        : listing.salePrice == null
                          ? 'No price set — this seller wants card trades.'
                          : listing.listingPhotos.length === 0
                            ? 'Not buyable yet — the listing has no photos.'
                            : "Seller hasn't enabled purchases yet."}
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  style={[styles.sheetOption, { borderColor: colors.border }]}
                  onPress={() => {
                    setChooserOpen(false);
                    router.push(
                      `/trade/new?with=${listing.owner!.id}&card=${encodeURIComponent(listing.cardId)}` as any
                    );
                  }}
                >
                  <Ionicons name="swap-horizontal" size={22} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetOptionTitle, { color: colors.text }]}>Offer cards in trade</Text>
                    <Text style={[styles.sheetOptionSub, { color: colors.textMuted }]}>
                      Propose a card-for-card swap from your collection.
                    </Text>
                  </View>
                </Pressable>

                <Pressable style={styles.sheetCancel} onPress={() => setChooserOpen(false)}>
                  <Text style={[styles.sheetCancelText, { color: colors.textMuted }]}>Cancel</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>
        </View>
      ) : mine ? (
        <>
          <Text style={[styles.mineNote, { color: colors.textMuted }]}>
            This is your listing — manage it from the card page.
          </Text>
          {listing.salePrice != null && canCharge === false ? (
            <Link href={'/seller-payouts' as any} asChild>
              <Pressable style={styles.payoutNudge}>
                <Ionicons name="alert-circle" size={17} color="#B45309" />
                <Text style={styles.payoutNudgeText}>
                  Buyers can't purchase yet — finish payout setup
                </Text>
                <Ionicons name="chevron-forward" size={15} color="#B45309" />
              </Pressable>
            </Link>
          ) : null}
        </>
      ) : null}

      {/* More from this seller */}
      {more && more.length > 0 ? (
        <>
          <Text style={[styles.moreTitle, { color: colors.text }]}>More from {sellerName}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moreRow}>
            {more.map((m) => (
              <Pressable key={m.userCardId} style={styles.moreTile} onPress={() => router.push(`/listing/${m.userCardId}` as any)}>
                {m.imageUrlSmall ? (
                  <Image source={{ uri: m.imageUrlSmall }} style={styles.moreImg} />
                ) : (
                  <View style={[styles.moreImg, { backgroundColor: colors.surface }]} />
                )}
                {m.salePrice != null ? <Text style={styles.morePrice}>{formatPrice(m.salePrice, 'EUR')}</Text> : null}
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, marginTop: 40, textAlign: 'center' },
  heroWrap: { alignItems: 'center' },
  hero: { width: 230, height: 322, borderRadius: 12 },
  heroPhoto: { height: 322, borderRadius: 12, backgroundColor: '#0002' },
  sellerNote: { fontSize: 13, lineHeight: 19, borderRadius: 10, padding: 12, marginTop: 8 },
  refBadge: {
    position: 'absolute', bottom: 10, alignSelf: 'center', backgroundColor: '#111827CC',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3,
  },
  refBadgeText: { color: 'white', fontSize: 11, fontWeight: '600' },
  dots: { flexDirection: 'row', gap: 5, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#9CA3AF66' },
  dotOn: { backgroundColor: '#2563EB' },
  name: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 12 },
  meta: { textAlign: 'center', marginTop: 2 },
  offerBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, marginTop: 14 },
  price: { fontSize: 22, fontWeight: '800', color: '#059669' },
  mkt: { fontSize: 13, marginTop: 1 },
  listedAt: { fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  seller: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  sellerName: { fontSize: 15, fontWeight: '700' },
  sellerMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  sellerMetaText: { fontSize: 12.5 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  buyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#059669', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16,
    flexGrow: 1, flexBasis: '100%',
  },
  sheetBackdrop: { flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32, gap: 10 },
  sheetTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  sheetOption: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  sheetOptionOff: { opacity: 0.55 },
  sheetOptionTitle: { fontSize: 15, fontWeight: '700' },
  sheetOptionSub: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  sheetCancel: { alignItems: 'center', paddingVertical: 8 },
  sheetCancelText: { fontSize: 14, fontWeight: '600' },
  payoutNudge: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#B4530922',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8,
  },
  payoutNudgeText: { color: '#B45309', fontSize: 13, fontWeight: '600', flex: 1 },
  offerBtn: { flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 14 },
  offerBtnText: { color: 'white', fontWeight: '800', fontSize: 15 },
  msgBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14 },
  msgBtnText: { fontWeight: '800', fontSize: 15 },
  mineNote: { textAlign: 'center', marginTop: 14 },
  moreTitle: { fontSize: 16, fontWeight: '700', marginTop: 22, marginBottom: 8 },
  moreRow: { gap: 10 },
  moreTile: { width: 84 },
  moreImg: { width: 84, height: 117, borderRadius: 6 },
  morePrice: { fontSize: 11, fontWeight: '700', color: '#059669', marginTop: 2 },
});
