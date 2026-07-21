import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { StagedImage } from '../hooks/useImageAttachments';

/**
 * The "are you sure?" step for photo sending: staged images render as
 * thumbnails above the composer with per-photo remove — nothing goes out
 * until the user taps Send.
 */
export function AttachmentTray({
  images,
  onRemove,
}: {
  images: StagedImage[];
  onRemove: (uri: string) => void;
}) {
  if (!images.length) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {images.map((img) => (
        <View key={img.uri} style={styles.item}>
          <Image source={{ uri: img.uri }} style={styles.thumb} contentFit="cover" />
          <Pressable style={styles.remove} hitSlop={6} onPress={() => onRemove(img.uri)}>
            <Ionicons name="close" size={13} color="white" />
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: 12, paddingTop: 8 },
  item: { position: 'relative' },
  thumb: { width: 64, height: 64, borderRadius: 8 },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
