import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Dimensions, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useAuth } from '../../src/context/AuthContext';
import { useBinder } from '../../src/hooks/useBinder';

const { width } = Dimensions.get('window');

/**
 * Binder viewer, routed as /binder/[id]. A swipeable full-card pager — the
 * "flip through the binder" experience. Owner gets an Edit action in the header.
 */
export default function BinderViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: binder, isLoading, error } = useBinder(id);

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
        <FlatList
          data={binder.cards}
          keyExtractor={(c) => c.binderCardId}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Link href={`/card/${encodeURIComponent(item.cardId)}`} asChild>
              <Pressable style={styles.page}>
                {item.imageUrlLarge ? (
                  <Image source={{ uri: item.imageUrlLarge }} style={styles.card} contentFit="contain" />
                ) : (
                  <View style={[styles.card, styles.placeholder]} />
                )}
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.pos}>
                  {index + 1} / {binder.cards.length}
                </Text>
              </Pressable>
            </Link>
          )}
        />
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
  page: { width, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
  card: { width: width * 0.8, height: width * 0.8 * 1.4, borderRadius: 12 },
  placeholder: { backgroundColor: '#374151' },
  name: { color: 'white', fontSize: 18, fontWeight: '700' },
  pos: { color: '#9CA3AF' },
});
