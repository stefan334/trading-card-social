import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useBinderActions } from '../hooks/useBinderActions';
import { useBinders } from '../hooks/useBinders';
import { useTheme } from '../theme';

/**
 * Instagram-highlights-style row of binder covers on a profile, presented as its
 * own titled section. Owners get a leading "+ New" that creates a binder and
 * jumps into the editor.
 */
export function BindersRow({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const { colors } = useTheme();
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
    <View style={[styles.section, { borderTopColor: colors.borderLight }]}>
      <View style={styles.titleRow}>
        <Ionicons name="book-outline" size={16} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>Binders</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {isOwner && (
          <Pressable style={styles.item} onPress={newBinder} disabled={create.isPending}>
            <View style={[styles.cover, styles.newCover, { borderColor: colors.primary }]}>
              <Ionicons name="add" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.label, { color: colors.textMuted }]}>New</Text>
          </Pressable>
        )}

        {binders?.map((b) => (
          <Link key={b.id} href={`/binder/${b.id}`} asChild>
            <Pressable style={styles.item}>
              {b.coverImageUrl ? (
                <Image source={{ uri: b.coverImageUrl }} style={[styles.cover, { borderColor: colors.primary }]} />
              ) : (
                <View style={[styles.cover, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="albums-outline" size={24} color={colors.textFaint} />
                </View>
              )}
              <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>{b.name}</Text>
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </View>
  );
}

const SIZE = 68;
const styles = StyleSheet.create({
  section: { marginTop: 18, borderTopWidth: 1, paddingTop: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginBottom: 2 },
  title: { fontSize: 18, fontWeight: '700' },
  row: { paddingHorizontal: 16, paddingVertical: 10, gap: 14 },
  item: { alignItems: 'center', width: SIZE },
  cover: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  newCover: { borderStyle: 'dashed' },
  label: { fontSize: 12, marginTop: 4, maxWidth: SIZE, textAlign: 'center' },
});
