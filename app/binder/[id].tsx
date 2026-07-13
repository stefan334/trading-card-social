import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useAuth } from '../../src/context/AuthContext';
import { useBinder, type BinderCard } from '../../src/hooks/useBinder';

const { width } = Dimensions.get('window');
const PER_PAGE_OPTIONS = [4, 6, 9] as const;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Binder viewer, routed as /binder/[id]. Flip through pages like a real binder —
 * a swipeable pager where each slide is a grid of cards. Cards-per-page is
 * adjustable (2×2, 3×2, 3×3). Owner gets an Edit action in the header.
 */
export default function BinderViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: binder, isLoading, error } = useBinder(id);
  const [perPage, setPerPage] = useState<number>(9);

  const columns = perPage === 4 ? 2 : 3;
  const gap = 8;
  const pagePad = 16;
  const cardW = (width - pagePad * 2 - gap * (columns - 1)) / columns;
  const cardH = cardW * 1.39;

  const pages = useMemo(() => chunk(binder?.cards ?? [], perPage), [binder?.cards, perPage]);

  if (isLoading) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (error || !binder) return <Text style={styles.center}>Binder not found.</Text>;

  const isOwner = user?.id === binder.ownerId;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: binder.name,
          headerRight: isOwner
            ? () => (
                <Link href={`/binder/edit/${binder.id}`} style={styles.edit}>
                  Edit
                </Link>
              )
            : undefined,
        }}
      />

      {binder.cards.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>This binder is empty.</Text>
          {isOwner ? (
            <Link href={`/binder/edit/${binder.id}`} style={styles.editLink}>
              Add some cards
            </Link>
          ) : null}
        </View>
      ) : (
        <>
          <View style={styles.perPageBar}>
            <Text style={styles.perPageLabel}>Per page</Text>
            {PER_PAGE_OPTIONS.map((n) => (
              <Pressable key={n} style={[styles.perChip, perPage === n && styles.perChipOn]} onPress={() => setPerPage(n)}>
                <Text style={[styles.perChipText, perPage === n && styles.perChipTextOn]}>{n}</Text>
              </Pressable>
            ))}
          </View>

          <FlatList
            data={pages}
            keyExtractor={(_, i) => `page-${i}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            renderItem={({ item: pageCards, index: pageIndex }) => (
              <View style={[styles.page, { width }]}>
                <View style={[styles.grid, { gap }]}>
                  {pageCards.map((c: BinderCard) => (
                    <Link key={c.binderCardId} href={`/card/${encodeURIComponent(c.cardId)}`} asChild>
                      <Pressable>
                        {c.imageUrlLarge || c.imageUrlSmall ? (
                          <Image
                            source={{ uri: c.imageUrlLarge ?? c.imageUrlSmall ?? undefined }}
                            style={{ width: cardW, height: cardH, borderRadius: 8 }}
                            contentFit="contain"
                            recyclingKey={c.binderCardId}
                          />
                        ) : (
                          <View style={[{ width: cardW, height: cardH, borderRadius: 8 }, styles.placeholder]} />
                        )}
                      </Pressable>
                    </Link>
                  ))}
                </View>
                <Text style={styles.pos}>Page {pageIndex + 1} / {pages.length}</Text>
              </View>
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  muted: { color: '#9CA3AF' },
  edit: { color: '#2563EB', fontWeight: '700', marginRight: 16 },
  editLink: { color: '#60A5FA', fontWeight: '700' },
  perPageBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  perPageLabel: { color: '#9CA3AF', fontWeight: '600', marginRight: 2 },
  perChip: { minWidth: 34, alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: '#374151', paddingHorizontal: 10, paddingVertical: 5 },
  perChipOn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  perChipText: { color: '#D1D5DB', fontWeight: '700' },
  perChipTextOn: { color: 'white' },
  page: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, gap: 14, flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  placeholder: { backgroundColor: '#374151' },
  pos: { color: '#9CA3AF' },
});
