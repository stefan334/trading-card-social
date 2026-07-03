import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useAuth } from '../src/context/AuthContext';
import { useCardSearch } from '../src/hooks/useCardSearch';
import { useCollectionActions } from '../src/hooks/useCollectionActions';
import { useDebouncedValue } from '../src/hooks/useDebouncedValue';
import { getProvider, listProviders } from '../src/services/tcg-providers';
import { uploadScan } from '../src/services/supabase/storage';
import type { Card } from '../src/types/card';
import type { CardCondition } from '../src/types/domain';

const CONDITIONS: CardCondition[] = ['mint', 'near_mint', 'excellent', 'good', 'played', 'poor'];
const LABEL: Record<CardCondition, string> = {
  mint: 'Mint', near_mint: 'Near Mint', excellent: 'Excellent', good: 'Good', played: 'Played', poor: 'Poor',
};

interface Captured {
  uri: string;
  base64: string | null;
}

/**
 * Camera scan flow (Phase 8 MVP): capture a photo → search/confirm the matching
 * card in the DB → add to collection with the scan photo saved to Storage.
 * Automatic OCR/visual recognition is a future step (V2 — best in a dev build).
 */
export default function ScanScreen() {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const gameId = listProviders()[0]?.gameId ?? 'pokemon';

  const [photo, setPhoto] = useState<Captured | null>(null);
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query);
  const [selected, setSelected] = useState<Card | null>(null);
  const [condition, setCondition] = useState<CardCondition>('near_mint');
  const [added, setAdded] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [addError, setAddError] = useState<string | null>(null);

  const { data: results, isLoading: searching } = useCardSearch(selected ? '' : debounced, gameId);
  const { data: set, isLoading: setLoading } = useQuery({
    queryKey: ['set', selected?.setId],
    enabled: Boolean(selected?.setId),
    queryFn: () => getProvider(gameId).getSet(selected!.setId),
  });
  const { add } = useCollectionActions();

  function reset() {
    setPhoto(null);
    setQuery('');
    setSelected(null);
    setAdded(false);
    setAddError(null);
  }

  async function capture() {
    const shot = await cameraRef.current?.takePictureAsync({ base64: true, quality: 0.5 });
    if (shot) setPhoto({ uri: shot.uri, base64: shot.base64 ?? null });
  }

  async function confirmAdd() {
    if (!selected || !set || !user) return;
    setAddError(null);
    try {
      let imageUrl: string | undefined;
      // Saving the scan photo is best-effort — never block adding the card on it.
      if (photo?.base64) {
        try {
          imageUrl = await uploadScan(photo.base64, user.id);
        } catch {
          imageUrl = undefined;
        }
      }
      await add.mutateAsync({ card: selected, set, condition, imageUrl });
      setAdded(true);
    } catch (e: any) {
      setAddError(e?.message ?? 'Could not add the card. Please try again.');
    }
  }

  // --- Permission gate ---
  if (!permission) return <View style={styles.container} />;
  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Camera access is needed to scan cards.</Text>
        <Pressable style={styles.primary} onPress={requestPermission}>
          <Text style={styles.primaryText}>Grant permission</Text>
        </Pressable>
      </View>
    );
  }

  // --- Added confirmation ---
  if (added && selected) {
    return (
      <View style={styles.centered}>
        <Text style={styles.successTitle}>Added {selected.name} ✓</Text>
        <Text style={styles.muted}>It's in your collection.</Text>
        <Pressable style={styles.primary} onPress={reset}>
          <Text style={styles.primaryText}>Scan another</Text>
        </Pressable>
      </View>
    );
  }

  // --- Camera ---
  if (!photo) {
    return (
      <View style={styles.container}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" zoom={zoom} />
        <Text style={styles.hint}>Line the card up and tap to capture.</Text>
        <View style={styles.zoomBar}>
          <Pressable style={styles.zoomBtn} onPress={() => setZoom((z) => Math.max(0, z - 0.1))}>
            <Ionicons name="remove" size={22} color="white" />
          </Pressable>
          <Text style={styles.zoomLabel}>{Math.round(zoom * 100)}%</Text>
          <Pressable style={styles.zoomBtn} onPress={() => setZoom((z) => Math.min(1, z + 0.1))}>
            <Ionicons name="add" size={22} color="white" />
          </Pressable>
        </View>
        <Pressable style={styles.shutter} onPress={capture} />
      </View>
    );
  }

  // --- Confirm a selected match ---
  if (selected) {
    return (
      <View style={styles.confirm}>
        <View style={styles.confirmRow}>
          <Image source={{ uri: photo.uri }} style={styles.confirmImg} />
          {selected.imageUrlSmall && <Image source={{ uri: selected.imageUrlSmall }} style={styles.confirmImg} />}
        </View>
        <Text style={styles.confirmName}>{selected.name}</Text>
        <Text style={styles.muted}>#{selected.number}{set ? ` · ${set.name}` : ''}</Text>

        <View style={styles.chips}>
          {CONDITIONS.map((c) => (
            <Pressable key={c} style={[styles.chip, c === condition && styles.chipOn]} onPress={() => setCondition(c)}>
              <Text style={[styles.chipText, c === condition && styles.chipTextOn]}>{LABEL[c]}</Text>
            </Pressable>
          ))}
        </View>

        {addError ? <Text style={styles.error}>{addError}</Text> : null}

        <Pressable style={[styles.primary, (add.isPending || setLoading) && styles.disabled]} onPress={confirmAdd} disabled={add.isPending || setLoading}>
          {add.isPending || setLoading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>Add to collection</Text>}
        </Pressable>
        <Pressable onPress={() => { setSelected(null); setAddError(null); }} style={styles.linkBtn}>
          <Text style={styles.link}>Not this card — search again</Text>
        </Pressable>
      </View>
    );
  }

  // --- Match: search for the captured card ---
  return (
    <View style={styles.container}>
      <View style={styles.matchHeader}>
        <Image source={{ uri: photo.uri }} style={styles.thumb} />
        <View style={{ flex: 1 }}>
          <Text style={styles.matchTitle}>What card is this?</Text>
          <TextInput
            style={styles.input}
            placeholder="Type the card name"
            autoFocus
            autoCapitalize="none"
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>
      <Pressable onPress={reset} style={styles.linkBtn}>
        <Text style={styles.link}>Retake photo</Text>
      </Pressable>

      {searching ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={results ?? []}
          keyExtractor={(c) => c.id}
          numColumns={3}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <Pressable style={styles.cell} onPress={() => setSelected(item)}>
              {item.imageUrlSmall ? (
                <Image source={{ uri: item.imageUrlSmall }} style={styles.cardImg} />
              ) : (
                <View style={[styles.cardImg, styles.placeholder]} />
              )}
              <Text numberOfLines={1} style={styles.cardName}>{item.name}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            debounced.trim().length >= 2 ? <Text style={styles.muted}>No matches — try a different spelling.</Text> : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  camera: { flex: 1 },
  hint: { position: 'absolute', top: 16, alignSelf: 'center', color: 'white', backgroundColor: '#00000088', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  shutter: { position: 'absolute', bottom: 32, alignSelf: 'center', width: 72, height: 72, borderRadius: 36, backgroundColor: 'white', borderWidth: 4, borderColor: '#2563EB' },
  zoomBar: { position: 'absolute', bottom: 120, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#00000088', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  zoomBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#ffffff33', alignItems: 'center', justifyContent: 'center' },
  zoomLabel: { color: 'white', fontWeight: '700', minWidth: 42, textAlign: 'center' },
  error: { color: '#DC2626', textAlign: 'center' },
  muted: { color: '#6B7280', textAlign: 'center' },
  primary: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' },
  primaryText: { color: 'white', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.5 },
  successTitle: { fontSize: 20, fontWeight: '800' },
  matchHeader: { flexDirection: 'row', gap: 12, padding: 16, alignItems: 'center' },
  thumb: { width: 60, height: 84, borderRadius: 6 },
  matchTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15 },
  linkBtn: { alignItems: 'center', paddingVertical: 6 },
  link: { color: '#2563EB', fontWeight: '600' },
  cell: { width: '33.33%', padding: 4 },
  cardImg: { width: '100%', aspectRatio: 0.71, borderRadius: 6 },
  placeholder: { backgroundColor: '#E5E7EB' },
  cardName: { fontSize: 12, marginTop: 3 },
  confirm: { flex: 1, alignItems: 'center', padding: 20, gap: 10 },
  confirmRow: { flexDirection: 'row', gap: 12 },
  confirmImg: { width: 120, height: 168, borderRadius: 8 },
  confirmName: { fontSize: 20, fontWeight: '800', marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginVertical: 8 },
  chip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { color: '#374151', fontWeight: '600', fontSize: 13 },
  chipTextOn: { color: 'white' },
});
