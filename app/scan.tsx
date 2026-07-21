import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useBatch } from '../src/context/BatchContext';
import { useCardSearch } from '../src/hooks/useCardSearch';
import { useDebouncedValue } from '../src/hooks/useDebouncedValue';
import { dbGetSet } from '../src/services/catalog';
import { getProvider, listProviders } from '../src/services/tcg-providers';
import { ocrAvailable, recognizeCard } from '../src/services/ocr';
import type { Card } from '../src/types/card';

interface Captured {
  uri: string;
  base64: string | null;
}

/**
 * Camera scan flow: capture a photo → OCR/search to confirm the matching card →
 * drop it into the shared "cart" and keep scanning. The Add tab commits the whole
 * cart at once (one condition for the lot, one grouped feed post), so scanning a
 * full pack is just capture-confirm-repeat. Set the condition/grade when adding.
 */
export default function ScanScreen() {
  const router = useRouter();
  const { items: cart, add: addToCart } = useBatch();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const gameId = listProviders()[0]?.gameId ?? 'pokemon';

  const [photo, setPhoto] = useState<Captured | null>(null);
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query);
  const [selected, setSelected] = useState<Card | null>(null);
  const [zoom, setZoom] = useState(0);
  const [detecting, setDetecting] = useState(false);
  const [detectedNumber, setDetectedNumber] = useState<string | null>(null);

  const { data: results, isLoading: searching } = useCardSearch(selected ? '' : debounced, gameId);

  // Auto-select the card whose collector number matches what OCR read.
  useEffect(() => {
    if (!detectedNumber || selected || !results?.length) return;
    const match = results.find((c) => c.number === detectedNumber);
    if (match) setSelected(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, detectedNumber, selected]);

  const { data: set, isLoading: setLoading } = useQuery({
    queryKey: ['set', selected?.setId],
    enabled: Boolean(selected?.setId),
    queryFn: async () => (await dbGetSet(selected!.setId)) ?? getProvider(gameId).getSet(selected!.setId),
  });

  function reset() {
    setPhoto(null);
    setQuery('');
    setSelected(null);
    setDetectedNumber(null);
  }

  async function capture() {
    const shot = await cameraRef.current?.takePictureAsync({ base64: true, quality: 0.5 });
    if (!shot) return;
    setPhoto({ uri: shot.uri, base64: shot.base64 ?? null });

    // Auto-detect the card (OCR) if a vision key is configured; otherwise the
    // user types the name manually. Either way, they confirm the match.
    if (shot.base64 && ocrAvailable()) {
      setDetecting(true);
      const ocr = await recognizeCard(shot.base64);
      setDetecting(false);
      if (ocr?.number) setDetectedNumber(ocr.number);
      if (ocr?.name) setQuery(ocr.name);
    }
  }

  // Drop the confirmed card into the cart and jump back to the camera for the next.
  function addToCartAndContinue() {
    if (!selected || !set) return;
    addToCart(selected, set);
    reset();
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

  // --- Camera ---
  if (!photo) {
    return (
      <View style={styles.container}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" zoom={zoom} />
        {/* Card-shaped framing guide (real TCG aspect ratio) for better OCR crops. */}
        <View style={styles.frameWrap} pointerEvents="none">
          <View style={styles.frame} />
        </View>
        <Text style={styles.hint}>Fit the card inside the frame, then tap to capture.</Text>
        <Pressable style={styles.done} onPress={() => router.back()}>
          <Text style={styles.doneText}>Done{cart.length ? ` · ${cart.length} in cart` : ''}</Text>
        </Pressable>
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

        <Pressable style={[styles.primary, setLoading && styles.disabled]} onPress={addToCartAndContinue} disabled={setLoading}>
          {setLoading ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>Add to cart &amp; scan next</Text>}
        </Pressable>
        <Pressable onPress={() => setSelected(null)} style={styles.linkBtn}>
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
          <Text style={styles.matchTitle}>
            {detecting ? 'Reading the card…' : ocrAvailable() ? 'Is this it? (edit if wrong)' : 'What card is this?'}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Type the card name"
            autoFocus={!ocrAvailable()}
            autoCapitalize="none"
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>
      <Pressable onPress={reset} style={styles.linkBtn}>
        <Text style={styles.link}>Retake photo</Text>
      </Pressable>

      {searching || detecting ? (
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
  frameWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: '74%',
    aspectRatio: 0.716, // standard TCG card (63×88mm)
    borderWidth: 2.5,
    borderColor: '#FFFFFFCC',
    borderRadius: 14,
    marginBottom: 60, // keep clear of the shutter/zoom controls
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  shutter: { position: 'absolute', bottom: 32, alignSelf: 'center', width: 72, height: 72, borderRadius: 36, backgroundColor: 'white', borderWidth: 4, borderColor: '#2563EB' },
  zoomBar: { position: 'absolute', bottom: 120, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#00000088', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  zoomBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#ffffff33', alignItems: 'center', justifyContent: 'center' },
  zoomLabel: { color: 'white', fontWeight: '700', minWidth: 42, textAlign: 'center' },
  done: { position: 'absolute', top: 16, right: 16, backgroundColor: '#059669', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  doneText: { color: 'white', fontWeight: '700' },
  muted: { color: '#6B7280', textAlign: 'center' },
  primary: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' },
  primaryText: { color: 'white', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.5 },
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
});
