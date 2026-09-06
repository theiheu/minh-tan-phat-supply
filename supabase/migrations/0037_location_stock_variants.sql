-- 0037_location_stock_variants.sql — sửa view location_stock cho đúng nghĩa "bảng tồn theo kho".
--
-- View 0035 chạy theo stock_balances nên composite parent (không bao giờ có balance
-- riêng, chỉ "bung linh kiện" từ children) không xuất hiện → bảng tồn thiếu hàng lắp ráp.
--
-- View mới: variants × (tập kho thực sự có tồn). Với mỗi (biến thể, kho):
--   - composite  → min(floor(sb.quantity / vc.quantity)) trên các children có balance tại kho đó
--     (coalesce 0 nếu không có children nào có balance) — chia số nguyên như 0019_stock_view.sql.
--   - non-composite → balance trực tiếp tại kho đó (coalesce 0 nếu không có).
-- security_invoker giữ nguyên để view tôn trọng RLS của các bảng bên dưới.
create or replace view public.location_stock
with (security_invoker = true) as
select
  loc.location_id,
  v.id as variant_id,
  v.product_id,
  case
    when exists (select 1 from public.variant_components vc where vc.parent_variant_id = v.id) then coalesce((
      select min(sb.quantity / greatest(vc.quantity, 1))
      from public.variant_components vc
      join public.stock_balances sb
        on sb.variant_id = vc.child_variant_id
       and sb.location_id = loc.location_id
      where vc.parent_variant_id = v.id
    ), 0)
    else coalesce((
      select sb.quantity
      from public.stock_balances sb
      where sb.variant_id = v.id
        and sb.location_id = loc.location_id
    ), 0)
  end as quantity
from public.variants v
cross join (
  select distinct location_id
  from public.stock_balances
) loc;
