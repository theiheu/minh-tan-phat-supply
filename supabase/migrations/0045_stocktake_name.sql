-- 0045_stocktake_name.sql — tên phiếu kiểm kê.
-- 1) stocktake_sessions.name: tên người dùng đặt khi tạo (VD "Kiểm kê tháng 9").
--    Null được phép ở DB để phiếu cũ không tên vẫn tồn tại; UI fallback hiển thị mã.
-- 2) create_stocktake nhận p_name — BẮT BUỘC (rỗng → báo lỗi, không tạo phiếu).
alter table public.stocktake_sessions
  add column if not exists name text;

create or replace function public.create_stocktake(p_location_id uuid, p_name text, p_by uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  r record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được tạo kiểm kê'; end if;
  if p_name is null or btrim(p_name) = '' then raise exception 'Phải nhập tên phiếu kiểm kê'; end if;

  insert into public.stocktake_sessions (code, location_id, name, created_by)
  values (public.next_code('KK', 'public.stocktake_seq'::regclass), p_location_id, btrim(p_name), p_by)
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
