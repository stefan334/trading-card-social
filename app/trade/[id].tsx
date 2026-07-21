import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useAuth } from '../../src/context/AuthContext';
import { useChatActions } from '../../src/hooks/useChatActions';
import { useThreadMessages } from '../../src/hooks/useThreadMessages';
import { useTrade, type TradeItemView } from '../../src/hooks/useTrade';
import { useTradeActions } from '../../src/hooks/useTradeActions';
import { useSubmitReview, useTradeReviews } from '../../src/hooks/useTradeReviews';
import { supabase } from '../../src/services/supabase/client';
import { useTheme } from '../../src/theme';

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={onChange ? () => onChange(n) : undefined} hitSlop={4} disabled={!onChange}>
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={onChange ? 30 : 15} color="#F59E0B" />
        </Pressable>
      ))}
    </View>
  );
}

function CardStrip({ items }: { items: TradeItemView[] }) {
  const { colors } = useTheme();
  if (!items.length) return <Text style={[styles.muted, { color: colors.textMuted }]}>Nothing</Text>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {items.map((it) => (
        <Link key={it.userCardId} href={`/card/${encodeURIComponent(it.cardId)}`} asChild>
          <Pressable style={styles.tile}>
            {it.imageUrlSmall ? (
              <Image source={{ uri: it.imageUrlSmall }} style={styles.cardImage} />
            ) : (
              <View style={[styles.cardImage, styles.placeholder]} />
            )}
            <Text numberOfLines={1} style={[styles.cardName, { color: colors.text }]}>
              {it.name}
            </Text>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

/** Trade detail, routed as /trade/[id]. Shows both sides + actions per role/status. */
export default function TradeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { data: trade, isLoading, error } = useTrade(id);
  const { accept, confirm, decline, cancel } = useTradeActions();
  const { sendMessage, markRead } = useChatActions();
  const { data: reviews } = useTradeReviews(id);
  const submitReview = useSubmitReview();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [msg, setMsg] = useState('');

  const otherId = trade ? (user?.id === trade.initiator.id ? trade.counterparty.id : trade.initiator.id) : undefined;

  // Find/create this trade's chat thread so the discussion lives inline.
  const { data: threadId } = useQuery({
    queryKey: ['trade-thread', trade?.id],
    enabled: Boolean(trade && otherId && supabase),
    queryFn: async () => {
      const { data, error } = await supabase!.rpc('get_or_create_thread', {
        p_other: otherId,
        p_card_id: null,
        p_trade_id: trade!.id,
      });
      if (error) throw error;
      return data as string;
    },
  });
  const { data: messages } = useThreadMessages(threadId ?? undefined);

  useEffect(() => {
    if (threadId) markRead.mutate(threadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, messages?.length]);

  if (isLoading) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (error || !trade) return <Text style={styles.center}>Trade not found.</Text>;

  const meIsInitiator = user?.id === trade.initiator.id;
  const meIsCounterparty = user?.id === trade.counterparty.id;
  const isOpen = trade.status === 'proposed';
  const busy = accept.isPending || decline.isPending || cancel.isPending || confirm.isPending;

  const other = meIsInitiator ? trade.counterparty : trade.initiator;
  const otherName = other.displayName || other.username;

  const myConfirmed = meIsInitiator ? trade.initiatorConfirmedAt : trade.counterpartyConfirmedAt;
  const otherConfirmed = meIsInitiator ? trade.counterpartyConfirmedAt : trade.initiatorConfirmedAt;
  const myReview = reviews?.find((r) => r.reviewerId === user?.id);

  function sendChat() {
    if (!threadId || !msg.trim()) return;
    sendMessage.mutate({ threadId, body: msg });
    setMsg('');
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <View style={styles.statusRow}>
        <Text style={styles.statusText}>{trade.status.toUpperCase()}</Text>
        <Link href={`/user/${other.id}`} style={styles.link}>
          with {otherName}
        </Link>
      </View>

      <Text style={[styles.section, { color: colors.text }]}>{meIsInitiator ? 'You give' : `${trade.initiator.username} gives`}</Text>
      <CardStrip items={trade.offeredByInitiator} />

      <Text style={[styles.section, { color: colors.text }]}>{meIsInitiator ? 'You receive' : `${trade.counterparty.username} gives`}</Text>
      <CardStrip items={trade.offeredByCounterparty} />

      {trade.note ? (
        <>
          <Text style={[styles.section, { color: colors.text }]}>Note</Text>
          <Text style={[styles.note, { color: colors.text }]}>{trade.note}</Text>
        </>
      ) : null}

      {isOpen && meIsCounterparty && (
        <View style={styles.actions}>
          <Pressable style={[styles.btn, styles.accept]} disabled={busy} onPress={() => accept.mutate(trade.id)}>
            {accept.isPending ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Accept</Text>}
          </Pressable>
          <Pressable style={[styles.btn, styles.decline]} disabled={busy} onPress={() => decline.mutate(trade.id)}>
            <Text style={[styles.btnText, styles.declineText]}>Decline</Text>
          </Pressable>
        </View>
      )}

      {isOpen && meIsInitiator && (
        <Pressable style={[styles.btn, styles.cancel]} disabled={busy} onPress={() => cancel.mutate(trade.id)}>
          <Text style={[styles.btnText, styles.declineText]}>Cancel offer</Text>
        </Pressable>
      )}

      {trade.status === 'accepted' && (
        <View style={[styles.panel, { backgroundColor: colors.surface }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>Deal agreed 🤝</Text>
          <Text style={[styles.panelBody, { color: colors.textMuted }]}>
            Once you've swapped the cards in person or by mail, both of you confirm here. The cards move
            into your collections when you both confirm.
          </Text>
          {myConfirmed ? (
            <Text style={styles.confirmedNote}>
              ✓ You confirmed.{otherConfirmed ? '' : ` Waiting for ${otherName} to confirm.`}
            </Text>
          ) : (
            <Pressable style={[styles.btn, styles.accept]} disabled={busy} onPress={() => confirm.mutate(trade.id)}>
              {confirm.isPending ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>I've received my cards — confirm</Text>}
            </Pressable>
          )}
        </View>
      )}

      {trade.status === 'completed' && (
        <>
          <Text style={styles.doneNote}>Trade completed — the cards are now in your collections.</Text>

          <Text style={[styles.section, { color: colors.text }]}>Reviews</Text>
          {reviews?.map((r) => (
            <View key={r.id} style={[styles.reviewCard, { borderColor: colors.borderLight }]}>
              <View style={styles.reviewHead}>
                <Text style={[styles.reviewName, { color: colors.text }]}>{r.reviewer?.displayName || r.reviewer?.username || 'User'}</Text>
                <StarRating value={r.rating} />
              </View>
              {r.comment ? <Text style={[styles.reviewComment, { color: colors.text }]}>{r.comment}</Text> : null}
            </View>
          ))}

          {!myReview && (meIsInitiator || meIsCounterparty) && (
            <View style={[styles.panel, { backgroundColor: colors.surface }]}>
              <Text style={[styles.panelTitle, { color: colors.text }]}>Rate {otherName}</Text>
              <StarRating value={rating} onChange={setRating} />
              <TextInput
                style={[styles.reviewInput, { borderColor: colors.border, color: colors.text }]}
                placeholder="How did the trade go? (optional)"
                placeholderTextColor={colors.textFaint}
                value={comment}
                onChangeText={setComment}
                multiline
              />
              <Pressable
                style={[styles.btn, styles.accept]}
                disabled={submitReview.isPending}
                onPress={() => submitReview.mutate({ tradeId: trade.id, revieweeId: other.id, rating, comment })}
              >
                {submitReview.isPending ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Submit review</Text>}
              </Pressable>
            </View>
          )}
        </>
      )}

      <Text style={[styles.section, { color: colors.text }]}>Discussion</Text>
      <View style={styles.chat}>
        {messages?.length ? (
          messages.map((m) => {
            const mine = m.senderId === user?.id;
            return (
              <View key={m.id} style={[styles.bubbleRow, mine ? styles.bubbleMineRow : styles.bubbleTheirsRow]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : { backgroundColor: colors.card, borderBottomLeftRadius: 4 }]}>
                  <Text style={mine ? styles.bubbleMineText : { color: colors.text }}>{m.body}</Text>
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.chatEmpty}>No messages yet — say hi or ask about the cards.</Text>
        )}
      </View>
      <View style={styles.inputBar}>
        <TextInput style={[styles.chatInput, { borderColor: colors.border, color: colors.text }]} placeholder={`Message ${otherName}…`} placeholderTextColor={colors.textFaint} value={msg} onChangeText={setMsg} multiline />
        <Pressable style={[styles.sendBtn, !msg.trim() && styles.disabled]} onPress={sendChat} disabled={!msg.trim()}>
          <Ionicons name="send" size={18} color="white" />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, marginTop: 40, textAlign: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  statusText: { fontWeight: '800', color: '#2563EB' },
  link: { color: '#6B7280' },
  section: { fontSize: 16, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  muted: { color: '#6B7280' },
  strip: { gap: 10, paddingVertical: 2 },
  tile: { width: 84 },
  cardImage: { width: 84, height: 117, borderRadius: 6 },
  placeholder: { backgroundColor: '#E5E7EB' },
  cardName: { fontSize: 11, marginTop: 3 },
  note: { color: '#374151', lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  accept: { backgroundColor: '#059669', marginTop: 0 },
  decline: { backgroundColor: '#FEE2E2', marginTop: 0 },
  cancel: { backgroundColor: '#FEE2E2' },
  btnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  declineText: { color: '#DC2626' },
  doneNote: { color: '#059669', marginTop: 24, textAlign: 'center', fontWeight: '600' },
  chat: { marginTop: 8, gap: 6 },
  chatEmpty: { color: '#9CA3AF', paddingVertical: 8 },
  bubbleRow: { flexDirection: 'row' },
  bubbleMineRow: { justifyContent: 'flex-end' },
  bubbleTheirsRow: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { backgroundColor: '#2563EB', borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#F3F4F6', borderBottomLeftRadius: 4 },
  bubbleMineText: { color: 'white' },
  bubbleTheirsText: { color: '#111827' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 10 },
  chatInput: { flex: 1, maxHeight: 100, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  sendBtn: { backgroundColor: '#2563EB', width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  panel: { marginTop: 20, padding: 16, backgroundColor: '#F9FAFB', borderRadius: 12, gap: 12 },
  panelTitle: { fontSize: 16, fontWeight: '700' },
  panelBody: { color: '#6B7280', lineHeight: 20 },
  confirmedNote: { color: '#059669', fontWeight: '600' },
  reviewInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 12, minHeight: 60, textAlignVertical: 'top' },
  reviewCard: { padding: 12, borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 10, marginBottom: 8, gap: 6 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewName: { fontWeight: '700' },
  reviewComment: { color: '#374151', lineHeight: 19 },
});
