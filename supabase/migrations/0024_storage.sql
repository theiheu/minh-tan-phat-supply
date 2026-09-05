-- 0024_storage.sql — bucket ảnh sản phẩm (public read, authenticated write)
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read"
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "product_images_auth_write" on storage.objects;
create policy "product_images_auth_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images');
