import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { dbGetSets } from '../services/catalog';
import { getProvider } from '../services/tcg-providers';
import { useTheme } from '../theme';
import type { CardSet } from '../types/card';

/**
 * Full-screen set picker: searchable list of every set (newest first, DB-first
 * with live-API fallback). Used to browse/filter by set from the Add tab and
 * card search.
 */
export function SetPickerModal({
  visible,
  gameId,
  onClose,
  onSelect,
}: {
  visible: boolean;
  gameId: string;
  onClose: () => void;
  onSelect: (set: CardSet) => void;
}) {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');

  const { data: sets } = useQuery({
    queryKey: ['set-picker', gameId],
    queryFn: async () => (await dbGetSets(gameId)) ?? getProvider(gameId).searchSets(),
  });

  const filtered = (sets ?? []).filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()));

  function pick(set: CardSet) {
    onSelect(set);
    setSearch('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Choose a set</Text>
          <Pressable hitSlop={8} onPress={onClose}>
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
        </View>
        <View style={[styles.search, { backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={18} color={colors.textFaint} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Find a set"
            placeholderTextColor={colors.textFaint}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => pick(item)}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.logo} contentFit="contain" />
              ) : (
                <View style={styles.logo} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>
                  {item.series ? `${item.series} · ` : ''}{item.totalCards} cards
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </Pressable>
          )}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.textMuted }]}>No sets found.</Text>}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '800' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  input: { flex: 1, fontSize: 15, padding: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  logo: { width: 46, height: 30 },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 13, marginTop: 1 },
  empty: { textAlign: 'center', marginTop: 24 },
});
