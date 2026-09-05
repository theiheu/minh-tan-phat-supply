-- 0030_defect_images.sql — bucket ảnh vật tư hỏng (public read, authenticated write)
insert into storage.buckets (id, name, public)
values ('defect-images', 'defect-images', true)
on conflict (id) do nothing;

drop policy if exists "defect_images_public_read" on storage.objects;
create policy "defect_images_public_read"
  on storage.objects for select
  using (bucket_id = 'defect-images');

drop policy if exists "defect_images_auth_write" on storage.objects;
create policy "defect_images_auth_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'defect-images');
