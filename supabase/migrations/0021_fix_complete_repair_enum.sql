-- 0021_fix_complete_repair_enum.sql — sửa CASE gán enum defect_status
create or replace function public.complete_repair(p_repair_id uuid, p_outcomes jsonb, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.repair_status;
  v_main uuid;
  v_hong uuid;
  v_sua uuid;
  o record;
  r record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được hoàn tất sửa chữa'; end if;
  select id into v_main from public.stock_locations where code = 'KHO_CHINH';
  select id into v_hong from public.stock_locations where code = 'KHO_HONG';
  select id into v_sua from public.stock_locations where code = 'KHO_DANG_SUA';

  select status into v_status from public.repair_orders where id = p_repair_id for update;
  if v_status <> 'in_repair' then raise exception 'Phiếu sửa không ở trạng thái đang sửa (hiện tại: %)', v_status; end if;

  for o in select value from jsonb_array_elements(p_outcomes) loop
    update public.repair_order_items
    set outcome = (o.value->>'outcome')::public.repair_outcome,
        cost = nullif(o.value->>'cost','')::numeric
    where id = (o.value->>'repair_item_id')::uuid
      and repair_order_id = p_repair_id;
  end loop;

  for r in select roi.* from public.repair_order_items roi where roi.repair_order_id = p_repair_id order by roi.variant_id loop
    if r.outcome = 'returned_to_stock' then
      perform public._move_stock(r.variant_id, v_sua, v_main, r.quantity, 'repair_return_in', 'repair', p_repair_id, p_by);
      update public.defect_note_items set resolution = 'repaired' where id = r.defect_item_id;
    elsif r.outcome = 'liquidation' then
      perform public._move_stock(r.variant_id, v_sua, v_hong, r.quantity, 'transfer', 'repair', p_repair_id, p_by, 'Sửa không được → chờ thanh lý');
      update public.defect_note_items set resolution = 'liquidated' where id = r.defect_item_id;
    else
      raise exception 'Thiếu kết quả xử lý cho item %', r.id;
    end if;
  end loop;

  update public.repair_orders set status = 'returned', returned_at = now(), total_cost = (
    select coalesce(sum(cost),0) from public.repair_order_items where repair_order_id = p_repair_id
  ) where id = p_repair_id;

  update public.defect_notes d set status = (
    case
      when exists (
        select 1 from public.defect_note_items dni
        where dni.defect_note_id = d.id and (dni.resolution is null or dni.resolution = 'liquidated')
      ) then 'liquidated'::public.defect_status
      else 'returned'::public.defect_status
    end
  )
  where d.id in (
    select distinct dni.defect_note_id from public.defect_note_items dni
    join public.repair_order_items roi on roi.defect_item_id = dni.id
    where roi.repair_order_id = p_repair_id
  )
  and not exists (
    select 1 from public.defect_note_items dni where dni.defect_note_id = d.id and dni.resolution is null
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'repair.complete', 'repair', p_repair_id,
          jsonb_build_object('status','in_repair'), jsonb_build_object('status','returned'));
end;
$$;
