import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { DraggableGrid } from 'react-native-draggable-grid';
import { useAuth } from '../../../src/context/AuthContext';
import { useBinder } from '../../../src/hooks/useBinder';
import { useBinderActions } from '../../../src/hooks/useBinderActions';
import { useOwnedCards } from '../../../src/hooks/useOwnedCards';
import { useTheme } from '../../../src/theme';

/** Binder editor, routed as /binder/edit/[id]: rename, add cards you own, reorder, remove, delete. */
export default function BinderEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data: binder, isLoading } = useBinder(id);
  const { data: owned } = useOwnedCards(user?.id);
  const { rename, remove, addOwnedCard, removeCard, reorder, setCover } = useBinderActions();
  const { colors } = useTheme();

  const [name, setName] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (binder && !name) setName(binder.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binder]);

  if (isLoading || !binder) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const inBinder = new Set(binder.cards.map((c) => c.cardId));

  async function addOwned(cardId: string) {
    if (!id) return;
    setAddingId(cardId);
    try {
      await addOwnedCard.mutateAsync({ binderId: id, cardId, position: binder!.cards.length });
    } finally {
      setAddingId(null);
    }
  }

  async function deleteBinder() {
    if (!id) return;
    await remove.mutateAsync(id);
    router.back();
  }

  // DraggableGrid needs each item to carry a stable `key`.
  const gridData = binder.cards.map((c) => ({ ...c, key: c.binderCardId }));

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <Text style={[styles.label, { color: colors.text }]}>Binder name</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.text }]}
        value={name}
        onChangeText={setName}
        onBlur={() => name.trim() && name !== binder.name && rename.mutate({ binderId: binder.id, name })}
      />

      <Text style={[styles.label, { color: colors.text }]}>Cards in this binder ({binder.cards.length})</Text>
      <Text style={[styles.hint, { color: colors.textFaint }]}>Hold and drag to reorder · ★ sets the cover</Text>
      {binder.cards.length === 0 ? (
        <Text style={[styles.muted, { color: colors.textMuted }]}>Search below to add cards from any set.</Text>
      ) : (
        <View style={styles.gridWrap}>
          <DraggableGrid
            numColumns={3}
            itemHeight={150}
            data={gridData}
            onDragRelease={(newData) =>
              reorder.mutate({ binderId: binder.id, orderedIds: newData.map((d) => d.binderCardId) })
            }
            renderItem={(item) => {
              const isCover = binder.coverCardId ? binder.coverCardId === item.cardId : item.position === 0;
              return (
                <View style={styles.tile} key={item.key}>
                  {item.imageUrlSmall ? (
                    <Image source={{ uri: item.imageUrlSmall }} style={styles.tileImg} />
                  ) : (
                    <View style={[styles.tileImg, { backgroundColor: colors.surface }]} />
                  )}
                  <Pressable
                    style={styles.coverBadge}
                    hitSlop={6}
                    onPress={() => setCover.mutate({ binderId: binder.id, cardId: item.cardId })}
                  >
                    <Ionicons name={isCover ? 'star' : 'star-outline'} size={16} color={isCover ? '#F59E0B' : 'white'} />
                  </Pressable>
                  <Pressable
                    style={styles.removeBadge}
                    hitSlop={6}
                    onPress={() => removeCard.mutate({ binderCardId: item.binderCardId, binderId: binder.id })}
                  >
                    <Ionicons name="close" size={14} color="white" />
                  </Pressable>
                </View>
              );
            }}
          />
        </View>
      )}

      <Text style={[styles.label, { color: colors.text }]}>Add from your collection</Text>
      <Text style={[styles.hint, { color: colors.textFaint }]}>Tap a card to add it. Cards already in the binder show a ✓.</Text>
      {!owned?.length ? (
        <Text style={[styles.muted, { color: colors.textMuted }]}>You don't own any cards yet — add some from the Collection tab first.</Text>
      ) : (
        <View style={styles.collectionGrid}>
          {owned.map((item) => {
            const already = inBinder.has(item.cardId);
            return (
              <Pressable key={item.userCardId} style={styles.result} onPress={() => !already && addOwned(item.cardId)} disabled={already}>
                {item.imageUrlSmall ? (
                  <Image source={{ uri: item.imageUrlSmall }} style={[styles.cardImg, already && styles.dim]} recyclingKey={item.userCardId} />
                ) : (
                  <View style={[styles.cardImg, { backgroundColor: colors.surface }]} />
                )}
                {addingId === item.cardId ? (
                  <View style={styles.addOverlay}><ActivityIndicator color="white" /></View>
                ) : already ? (
                  <View style={styles.addOverlay}><Ionicons name="checkmark-circle" size={22} color="#059669" /></View>
                ) : (
                  <View style={styles.plusBadge}><Ionicons name="add" size={16} color="white" /></View>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      <Pressable style={styles.doneBtn} onPress={() => router.replace(`/binder/${binder.id}`)}>
        <Ionicons name="checkmark" size={18} color="white" />
        <Text style={styles.doneText}>Done</Text>
      </Pressable>

      <Pressable style={styles.deleteBtn} onPress={deleteBinder} disabled={remove.isPending}>
        <Text style={styles.deleteText}>Delete binder</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 15, fontWeight: '700', marginHorizontal: 16, marginTop: 20, marginBottom: 4 },
  hint: { color: '#9CA3AF', fontSize: 12, marginHorizontal: 16, marginBottom: 8 },
  muted: { color: '#6B7280', marginHorizontal: 16 },
  input: {
    marginHorizontal: 16, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  gridWrap: { paddingHorizontal: 12 },
  tile: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 5 },
  tileImg: { width: '92%', aspectRatio: 0.71, borderRadius: 6 },
  coverBadge: { position: 'absolute', top: 8, left: 10, backgroundColor: '#00000066', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  removeBadge: { position: 'absolute', top: 8, right: 10, backgroundColor: '#DC2626', borderRadius: 12, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  cardImg: { width: 70, height: 98, borderRadius: 6 },
  placeholder: { backgroundColor: '#E5E7EB' },
  dim: { opacity: 0.4 },
  collectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  result: { width: 70 },
  plusBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: '#2563EB', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  addOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  doneBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#059669', marginHorizontal: 16, marginTop: 28, borderRadius: 10, paddingVertical: 14 },
  doneText: { color: 'white', fontWeight: '800', fontSize: 16 },
  deleteBtn: { margin: 16, marginTop: 12, borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  deleteText: { color: '#DC2626', fontWeight: '700' },
});
