-- 0025_catalog_search.sql — tìm kiếm vật tư theo tên / mô tả / thuộc tính biến thể.
-- PostgREST không ilike được cột jsonb trực tiếp, nên tập kết trung gian qua RPC.
-- security invoker để tôn trọng RLS của products/variants (giống cách trang danh mục đang đọc).

create or replace function public.search_catalog(p_query text)
returns table (id uuid)
language sql
stable
security invoker
set search_path = public
as $$
  select p.id
  from public.products p
  where p.deleted_at is null
    and (
      p.name ilike '%' || p_query || '%'
      or coalesce(p.description, '') ilike '%' || p_query || '%'
      or exists (
        select 1
        from public.variants v
        where v.product_id = p.id
          and v.attributes::text ilike '%' || p_query || '%'
      )
    )
  order by p.name
$$;
