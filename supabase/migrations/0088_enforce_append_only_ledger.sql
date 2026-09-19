-- Migration: 0088_enforce_append_only_ledger

-- 1. Modify enforce_movement_append_only to allow bypass
CREATE OR REPLACE FUNCTION public.enforce_movement_append_only() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if current_setting('minhtanphat.bypass_append_only', true) = 'true' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  raise exception 'stock_movements is append-only after catalog cutover; cancel = reversal movement';
end $$;

-- 2. Modify _revert_movements to use reverse_inventory_movement
CREATE OR REPLACE FUNCTION public._revert_movements(p_ref_type text, p_ref_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  r record;
begin
  for r in
    select id
    from public.stock_movements m1
    where ref_type = p_ref_type and ref_id = p_ref_id
      and reversal_of_movement_id is null
      and not exists (select 1 from public.stock_movements m2 where m2.reversal_of_movement_id = m1.id)
    order by created_at desc, id
  loop
    perform public.reverse_inventory_movement(r.id, 'System reversal (' || p_ref_type || ')', p_by);
  end loop;
end;
$$;

-- 3. Modify revert_repair to use reverse_inventory_movement safely instead of hardcoded balances
CREATE OR REPLACE FUNCTION public.revert_repair(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_status text;
  r record;
begin
  if not public.is_superuser() then raise exception 'Chỉ tài khoản dev (superuser) được mở lại'; end if;
  select status into v_status from public.repair_orders where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu sửa'; end if;
  if v_status <> 'returned' then raise exception 'Chỉ phiếu ĐÃ HOÀN TẤT mới mở lại được (hiện tại: %)', v_status; end if;

  -- Đảo các dòng kết quả của complete_repair (repair_return_in = về kho chính,
  -- transfer = chuyển sang kho hỏng chờ thanh lý). Mỗi dòng: trả về từ nơi nhận.
  for r in
    select id
    from public.stock_movements m1
    where ref_type = 'repair' and ref_id = p_id
      and movement_type in ('repair_return_in','transfer')
      and reversal_of_movement_id is null
      and not exists (select 1 from public.stock_movements m2 where m2.reversal_of_movement_id = m1.id)
    order by created_at desc, id
  loop
    perform public.reverse_inventory_movement(r.id, 'System reversal (repair)', p_by);
  end loop;

  -- Reset kết quả + hoàn nguyên resolution defect items + trạng thái note.
  update public.repair_order_items
  set outcome = null, cost = null
  where repair_order_id = p_id;
  update public.repair_orders
  set status = 'in_repair', returned_at = null, total_cost = null
  where id = p_id;

  update public.defect_note_items dni
  set resolution = null
  from public.repair_order_items roi
  where roi.repair_order_id = p_id and roi.defect_item_id = dni.id;

  perform public._rebuild_defect_notes(p_id, 'revert');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'repair.reopen', 'repair', p_id,
          jsonb_build_object('status','returned'), jsonb_build_object('status','in_repair'));
end;
$$;

-- 4. Modify admin_purge_user_data to explicitly bypass the trigger
CREATE OR REPLACE FUNCTION public.admin_purge_user_data(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if current_setting('minhtanphat.bypass_admin_purge', true) IS DISTINCT FROM 'true' THEN
      raise notice 'Cannot purge user data in production safely';
  end if;

  set local minhtanphat.bypass_append_only = 'true';

  delete from public.audit_logs where actor_id = p_user_id;
  delete from public.user_roles where user_id = p_user_id;
  delete from public.sessions where user_id = p_user_id;

  delete from public.exchange_notes where created_by = p_user_id or approved_by = p_user_id or issued_by = p_user_id or received_by = p_user_id or rejected_by = p_user_id;
  delete from public.liquidation_notes where created_by = p_user_id or approved_by = p_user_id;
  delete from public.repair_orders where created_by = p_user_id;

  delete from public.requisition_returns where returned_by = p_user_id;
  delete from public.requisitions where requester_id = p_user_id or approved_by = p_user_id or fulfilled_by = p_user_id or received_by = p_user_id;

  delete from public.defect_notes where reported_by = p_user_id or repair_requested_by = p_user_id or collected_by = p_user_id;

  delete from public.issues where creator_id = p_user_id;
  delete from public.receipts where created_by = p_user_id or approved_by = p_user_id;

  delete from public.stocktake_sessions where created_by = p_user_id;

  delete from public.stock_movements where created_by = p_user_id;
end;
$$;

-- 5. Attach the trigger to enforce append-only
DROP TRIGGER IF EXISTS enforce_append_only_on_movements ON public.stock_movements;
CREATE TRIGGER enforce_append_only_on_movements
  BEFORE UPDATE OR DELETE ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_movement_append_only();
