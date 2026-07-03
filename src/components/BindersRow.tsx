import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useBinderActions } from '../hooks/useBinderActions';
import { useBinders } from '../hooks/useBinders';

/**
 * Instagram-highlights-style row of binder covers on a profile. Owners get a
 * leading "+ New" that creates a binder and jumps into the editor.
 */
export function BindersRow({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const { data: binders } = useBinders(userId);
  const { create } = useBinderActions();
  const router = useRouter();

  // Hide the whole section on someone else's profile if they have no binders.
  if (!isOwner && !binders?.length) return null;

  async function newBinder() {
    const id = await create.mutateAsync('New binder');
    router.push(`/binder/edit/${id}`);
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {isOwner && (
        <Pressable style={styles.item} onPress={newBinder} disabled={create.isPending}>
          <View style={[styles.cover, styles.newCover]}>
            <Ionicons name="add" size={28} color="#2563EB" />
          </View>
          <Text style={styles.label}>New</Text>
        </Pressable>
      )}

      {binders?.map((b) => (
        <Link key={b.id} href={`/binder/${b.id}`} asChild>
          <Pressable style={styles.item}>
            {b.coverImageUrl ? (
              <Image source={{ uri: b.coverImageUrl }} style={styles.cover} />
            ) : (
              <View style={[styles.cover, styles.emptyCover]}>
                <Ionicons name="albums-outline" size={24} color="#9CA3AF" />
              </View>
            )}
            <Text style={styles.label} numberOfLines={1}>{b.name}</Text>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

const SIZE = 68;
const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 12, gap: 14 },
  item: { alignItems: 'center', width: SIZE },
  cover: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 2, borderColor: '#2563EB' },
  newCover: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  emptyCover: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  label: { fontSize: 12, marginTop: 4, maxWidth: SIZE, textAlign: 'center' },
});
