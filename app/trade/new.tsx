import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useOwnedCards, type OwnedCard } from '../../src/hooks/useOwnedCards';
import { useProfile } from '../../src/hooks/useProfile';
import { track } from '../../src/services/analytics';
import { useTheme } from '../../src/theme';
import { useTradeActions } from '../../src/hooks/useTradeActions';
import { useWishlist } from '../../src/hooks/useWishlist';

function SelectableCards({
  cards,
  selected,
  onToggle,
  emptyText,
}: {
  cards: OwnedCard[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  emptyText: string;
}) {
  const { colors } = useTheme();
  if (!cards.length) return <Text style={[styles.muted, { color: colors.textMuted }]}>{emptyText}</Text>;
  // For-trade cards first so they're easy to grab.
  const sorted = [...cards].sort((a, b) => Number(b.isForTrade) - Number(a.isForTrade));
  return (
    <View style={styles.grid}>
      {sorted.map((c) => {
        const isSel = selected.has(c.userCardId);
        return (
          <Pressable key={c.userCardId} style={styles.tile} onPress={() => onToggle(c.userCardId)}>
            {/* Keep the Image's own style constant — toggling a border directly on
                an expo-image can make it blank on re-render (Android). The
                selection ring is a separate overlay instead. */}
            {c.imageUrlSmall ? (
              <Image source={{ uri: c.imageUrlSmall }} style={styles.cardImage} contentFit="cover" recyclingKey={c.userCardId} />
            ) : (
              <View style={[styles.cardImage, styles.placeholder]} />
            )}
            {isSel && <View style={styles.selectedRing} pointerEvents="none" />}
            {c.isForTrade && (
              <View style={styles.tradeBadge}>
                <Text style={styles.tradeBadgeText}>Trade</Text>
              </View>
            )}
            {isSel && (
              <View style={[styles.check, { backgroundColor: colors.card }]}>
                <Ionicons name="checkmark-circle" size={20} color="#2563EB" />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Trade builder, routed as /trade/new?with=<userId>. Pick their cards + yours, add a note, send. */
export default function NewTradeScreen() {
  const { with: withId, card: wantCardId } = useLocalSearchParams<{ with: string; card?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  const { data: theirCards, isLoading: theirLoading } = useOwnedCards(withId);
  const { data: myCards, isLoading: myLoading } = useOwnedCards(user?.id);
  const { data: theirProfile } = useProfile(withId);
  const { data: theirWishlist } = useWishlist(withId);
  const { propose } = useTradeActions();

  const [wantIds, setWantIds] = useState<Set<string>>(new Set());
  const [giveIds, setGiveIds] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Arriving from a listing / feed post ("Make an offer") pre-selects the card
  // they listed, so the offer starts with the thing you actually want.
  useEffect(() => {
    if (!wantCardId || !theirCards) return;
    const matches = theirCards.filter((c) => c.cardId === wantCardId).map((c) => c.userCardId);
    if (matches.length) setWantIds((prev) => (prev.size ? prev : new Set(matches)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantCardId, theirCards]);

  function toggle(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    setter((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function send() {
    if (!withId) return;
    setError(null);
    try {
      const tradeId = await propose.mutateAsync({
        counterpartyId: withId,
        myUserCardIds: [...giveIds],
        theirUserCardIds: [...wantIds],
        note,
      });
      track('trade_proposed', { withId, give: giveIds.size, want: wantIds.size });
      router.replace(`/trade/${tradeId}`);
    } catch (e: any) {
      setError(e?.message ?? 'Could not send the trade.');
    }
  }

  if (theirLoading || myLoading) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const theirName = theirProfile?.displayName || theirProfile?.username || 'them';
  const nothingSelected = wantIds.size === 0 && giveIds.size === 0;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      {theirWishlist && theirWishlist.length > 0 && (
        <View style={styles.wishlistBox}>
          <Text style={styles.wishlistTitle}>💡 {theirName}'s wishlist — great things to offer</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wishlistRow}>
            {theirWishlist.map((w) => (
              <Link key={w.wishlistId} href={`/card/${encodeURIComponent(w.cardId)}`} asChild>
                <Pressable style={styles.wishTile}>
                  {w.imageUrlSmall ? (
                    <Image source={{ uri: w.imageUrlSmall }} style={styles.wishImg} />
                  ) : (
                    <View style={[styles.wishImg, styles.placeholder]} />
                  )}
                </Pressable>
              </Link>
            ))}
          </ScrollView>
        </View>
      )}

      <Text style={[styles.section, { color: colors.text }]}>You want from {theirName}</Text>
      <Text style={[styles.hint, { color: colors.textFaint }]}>Their cards — “Trade” = they've listed it as available.</Text>
      <SelectableCards
        cards={theirCards ?? []}
        selected={wantIds}
        onToggle={(id) => toggle(setWantIds, id)}
        emptyText={`${theirName} has no cards in their collection yet.`}
      />

      <Text style={[styles.section, { color: colors.text }]}>You give</Text>
      <Text style={[styles.hint, { color: colors.textFaint }]}>Any of your cards — “Trade” = you've listed it as available.</Text>
      <SelectableCards
        cards={myCards ?? []}
        selected={giveIds}
        onToggle={(id) => toggle(setGiveIds, id)}
        emptyText="You don't own any cards yet."
      />

      <Text style={[styles.section, { color: colors.text }]}>Note (optional)</Text>
      <TextInput
        style={[styles.note, { borderColor: colors.border, color: colors.text }]}
        placeholder="Add a message, or mention cash on top…"
        placeholderTextColor={colors.textFaint}
        value={note}
        onChangeText={setNote}
        multiline
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.sendButton, (nothingSelected || propose.isPending) && styles.disabled]}
        onPress={send}
        disabled={nothingSelected || propose.isPending}
      >
        {propose.isPending ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.sendText}>Send offer</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 2 },
  hint: { color: '#9CA3AF', fontSize: 12, marginBottom: 10 },
  wishlistBox: { backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12 },
  wishlistTitle: { fontWeight: '700', color: '#92400E', marginBottom: 8 },
  wishlistRow: { gap: 8 },
  wishTile: { width: 60 },
  wishImg: { width: 60, height: 84, borderRadius: 5 },
  muted: { color: '#6B7280' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: 76 },
  cardImage: { width: 76, height: 106, borderRadius: 6 },
  placeholder: { backgroundColor: '#E5E7EB' },
  selectedRing: { position: 'absolute', top: 0, left: 0, width: 76, height: 106, borderRadius: 6, borderWidth: 3, borderColor: '#2563EB' },
  check: { position: 'absolute', top: 2, right: 2, backgroundColor: 'white', borderRadius: 10 },
  tradeBadge: { position: 'absolute', bottom: 2, left: 2, backgroundColor: '#059669', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  tradeBadgeText: { color: 'white', fontSize: 9, fontWeight: '700' },
  note: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 12,
    minHeight: 70,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  error: { color: '#DC2626', marginTop: 12 },
  sendButton: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  disabled: { opacity: 0.5 },
  sendText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
