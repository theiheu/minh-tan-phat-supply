-- 0023_fix_return_requisition_role.sql — cho phép người yêu cầu (owner) hoặc quản lý
-- trả lại vật tư không dùng hết (mục 14.6 / 15.8).
create or replace function public.return_requisition_items(p_requisition_id uuid, p_items jsonb, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.requisition_status;
  v_requester uuid;
  v_main uuid;
  it record;
  v_issued int;
  v_returned int;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select id into v_main from public.stock_locations where code = 'KHO_CHINH';

  select status, requester_id into v_status, v_requester from public.requisitions where id = p_requisition_id for update;
  if v_requester is distinct from auth.uid() and not public.is_manager() then
    raise exception 'Chỉ người yêu cầu hoặc quản lý kho được nhập trả lại';
  end if;
  if v_status not in ('issued','received') then raise exception 'Phiếu chưa cấp phát nên không thể trả lại (hiện tại: %)', v_status; end if;

  for it in select value from jsonb_array_elements(p_items) loop
    select quantity into v_issued from public.requisition_items
    where requisition_id = p_requisition_id and variant_id = (it.value->>'variant_id')::uuid;
    if v_issued is null then raise exception 'Variant % không có trong phiếu', it.value->>'variant_id'; end if;

    select coalesce(sum(quantity),0) into v_returned from public.stock_movements
    where ref_type = 'requisition' and ref_id = p_requisition_id
      and variant_id = (it.value->>'variant_id')::uuid and movement_type = 'return_in';

    if (it.value->>'quantity')::int > v_issued - v_returned then
      raise exception 'Số lượng trả vượt quá số đã cấp cho variant %', it.value->>'variant_id';
    end if;

    perform public._move_stock(
      (it.value->>'variant_id')::uuid, null, v_main,
      (it.value->>'quantity')::int, 'return_in', 'requisition', p_requisition_id, p_by);
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'requisition.return', 'requisition', p_requisition_id, jsonb_build_object('items', p_items));
end;
$$;
