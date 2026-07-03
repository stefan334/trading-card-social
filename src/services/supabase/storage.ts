import { decode } from 'base64-arraybuffer';
import { supabase } from './client';

const SCANS_BUCKET = 'card-scans';

/**
 * Upload a base64 JPEG (e.g. from CameraView.takePictureAsync({ base64: true }))
 * to the current user's folder in the public card-scans bucket, returning the
 * public URL. RLS restricts writes to `<userId>/…` (see 0010_storage_scans.sql).
 */
export async function uploadScan(base64: string, userId: string): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured.');
  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(SCANS_BUCKET)
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return supabase.storage.from(SCANS_BUCKET).getPublicUrl(path).data.publicUrl;
}
