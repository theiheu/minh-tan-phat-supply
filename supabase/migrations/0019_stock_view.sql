-- 0019_stock_view.sql — tồn kho khả dụng tại Kho chính.
-- composite = min(floor(stock(child)/qty)); non-composite = balance tại KHO_CHINH.
-- security_invoker để view tôn trọng RLS của các bảng bên dưới.
create or replace view public.variant_stock
with (security_invoker = true) as
select
  v.id as variant_id,
  v.product_id,
  v.min_stock,
  v.unit,
  case
    when exists (
      select 1 from public.variant_components vc where vc.parent_variant_id = v.id
    ) then coalesce((
      select min(sb.quantity / greatest(vc.quantity, 1))
      from public.variant_components vc
      join public.stock_balances sb on sb.variant_id = vc.child_variant_id
      join public.stock_locations sl on sl.id = sb.location_id and sl.code = 'KHO_CHINH'
      where vc.parent_variant_id = v.id
    ), 0)
    else coalesce((
      select sb.quantity
      from public.stock_balances sb
      join public.stock_locations sl on sl.id = sb.location_id and sl.code = 'KHO_CHINH'
      where sb.variant_id = v.id
    ), 0)
  end as quantity
from public.variants v;
