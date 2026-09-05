-- 0022_create_stocktake.sql — tạo phiếu kiểm kê + snapshot system_qty
create or replace function public.create_stocktake(p_location_id uuid, p_by uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  r record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được tạo kiểm kê'; end if;

  insert into public.stocktake_sessions (code, location_id, created_by)
  values (public.next_code('KK', 'public.stocktake_seq'::regclass), p_location_id, p_by)
  returning id into v_id;

  for r in
    select variant_id, quantity
    from public.stock_balances
    where location_id = p_location_id and quantity > 0
    order by variant_id
  loop
    insert into public.stocktake_items (session_id, variant_id, system_qty, actual_qty)
    values (v_id, r.variant_id, r.quantity, r.quantity);
  end loop;

  return v_id;
end;
$$;
