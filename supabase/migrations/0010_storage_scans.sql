-- CardLink — Storage bucket for card scan photos
-- Public bucket (images served via public URL). Files are stored under a per-user
-- folder: `<user_id>/<filename>`. Anyone can read; only the owner can write to
-- their own folder. Also usable later for avatars.

insert into storage.buckets (id, name, public)
values ('card-scans', 'card-scans', true)
on conflict (id) do nothing;

create policy "card-scans public read" on storage.objects
  for select using (bucket_id = 'card-scans');

create policy "card-scans owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'card-scans' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "card-scans owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'card-scans' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "card-scans owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'card-scans' and (storage.foldername(name))[1] = auth.uid()::text);
