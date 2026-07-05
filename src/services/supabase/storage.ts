import { decode } from 'base64-arraybuffer';
import { supabase } from './client';

const SCANS_BUCKET = 'card-scans';

/**
 * Upload a base64 JPEG to the current user's folder in the public card-scans
 * bucket, returning the public URL. RLS restricts writes to `<userId>/…`
 * (see 0010_storage_scans.sql). `kind` just namespaces the filename.
 */
export async function uploadImage(base64: string, userId: string, kind = 'img'): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured.');
  const path = `${userId}/${kind}-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(SCANS_BUCKET)
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return supabase.storage.from(SCANS_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Scan photo upload (kept for the scanner). */
export const uploadScan = (base64: string, userId: string) => uploadImage(base64, userId, 'scan');
