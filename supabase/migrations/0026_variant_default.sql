-- 0026_variant_default.sql — biến thể mặc định cho vật tư.
-- Mỗi vật tư có tối đa 1 biến thể mặc định (dùng để lấy ảnh đại diện cho thẻ vật tư).

alter table public.variants add column if not exists is_default boolean not null default false;

create unique index if not exists variants_one_default_per_product
  on public.variants (product_id) where is_default = true;
