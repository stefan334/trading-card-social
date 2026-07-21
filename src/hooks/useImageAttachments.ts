import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

export interface StagedImage {
  uri: string; // local uri, for the preview thumbnail
  base64: string; // what actually uploads
}

/**
 * Multi-select photo staging for chat composers: pick several images, show
 * them as removable thumbnails, and only send on an explicit Send tap —
 * nothing uploads at pick time. Used by the DM chat and the trade discussion.
 */
export function useImageAttachments(max = 6) {
  const [staged, setStaged] = useState<StagedImage[]>([]);

  async function pick() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: max,
      quality: 0.5,
      base64: true,
    });
    if (res.canceled) return;
    const assets = res.assets
      .filter((a) => a.base64)
      .map((a) => ({ uri: a.uri, base64: a.base64! }));
    setStaged((prev) => [...prev, ...assets].slice(0, max));
  }

  const removeAt = (uri: string) => setStaged((prev) => prev.filter((s) => s.uri !== uri));
  const clear = () => setStaged([]);

  return { staged, pick, removeAt, clear };
}
