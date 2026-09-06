-- 0039_category_icons.sql — bucket ảnh icon danh mục (public read, authenticated write)
insert into storage.buckets (id, name, public)
values ('category-icons', 'category-icons', true)
on conflict (id) do nothing;

drop policy if exists "category_icons_public_read" on storage.objects;
create policy "category_icons_public_read"
  on storage.objects for select
  using (bucket_id = 'category-icons');

drop policy if exists "category_icons_auth_write" on storage.objects;
create policy "category_icons_auth_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'category-icons');
