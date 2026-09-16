-- 0071_admin_doc_delete_and_reopen.sql — Phân quyền Quản trị viên (Admin / Chủ trại / Superuser) xoá và mở lại các loại phiếu
--
-- Cập nhật tất cả các hàm RPC mở lại và xoá phiếu để cho phép vai trò Quản trị viên (is_owner() bao gồm 'owner' và 'superuser').
-- Đồng thời bổ sung RPC xoá/mở lại cho phiếu đổi mới (exchange) và phiếu kho dầu (fuel_dispenses, fuel_receipts).

-- ===========================================================================
-- 1. PHIẾU XUẤT KHO (ISSUES)
-- ===========================================================================
create or replace function public.revert_issue(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not public.is_owner() then raise exception 'Chỉ quản trị viên (Admin/Chủ trại) được mở lại phiếu xuất'; end if;
  select status into v_status from public.issues where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu xuất'; end if;
  if v_status <> 'posted' then raise exception 'Chỉ phiếu ĐÃ XUẤT mới mở lại được (hiện tại: %)', v_status; end if;

  perform public._revert_movements('issue', p_id, p_by);
  update public.issues set status = 'draft', updated_at = now() where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'issue.reopen', 'issue', p_id,
          jsonb_build_object('status','posted'), jsonb_build_object('status','draft'));
end;
$$;

create or replace function public.delete_issue(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not public.is_owner() then raise exception 'Chỉ quản trị viên (Admin/Chủ trại) được xoá phiếu xuất'; end if;
  select status into v_status from public.issues where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu xuất'; end if;

  if v_status = 'posted' then
    perform public._revert_movements('issue', p_id, p_by);
  end if;

  delete from public.issues where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'issue.delete', 'issue', p_id, jsonb_build_object('status', v_status), null);
end;
$$;

-- ===========================================================================
-- 2. PHIẾU THANH LÝ (LIQUIDATIONS)
-- ===========================================================================
create or replace function public.revert_liquidation(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.liquidation_status;
begin
  if not public.is_owner() then raise exception 'Chỉ quản trị viên (Admin/Chủ trại) được mở lại phiếu thanh lý'; end if;
  select status into v_status from public.liquidation_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu thanh lý'; end if;
  if v_status <> 'completed' then raise exception 'Chỉ phiếu ĐÃ HOÀN TẤT mới mở lại được (hiện tại: %)', v_status; end if;

  perform public._revert_movements('liquidation', p_id, p_by);
  update public.liquidation_notes
  set status = 'approved', completed_at = null, notes = coalesce(notes,'') || ' [Admin: mở lại từ completed]'
  where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'liquidation.reopen', 'liquidation', p_id,
          jsonb_build_object('status','completed'), jsonb_build_object('status','approved'));
end;
$$;

create or replace function public.delete_liquidation(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.liquidation_status;
begin
  if not public.is_owner() then raise exception 'Chỉ quản trị viên (Admin/Chủ trại) được xoá phiếu thanh lý'; end if;
  select status into v_status from public.liquidation_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu thanh lý'; end if;

  if v_status = 'completed' then
    perform public._revert_movements('liquidation', p_id, p_by);
  end if;

  delete from public.liquidation_notes where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'liquidation.delete', 'liquidation', p_id,
          jsonb_build_object('status', v_status), null);
end;
$$;

-- ===========================================================================
-- 3. PHIẾU NHẬP KHO (RECEIPTS)
-- ===========================================================================
create or replace function public.revert_receipt(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.receipt_status;
begin
  if not public.is_owner() then raise exception 'Chỉ quản trị viên (Admin/Chủ trại) được mở lại phiếu nhập'; end if;
  select status into v_status from public.receipts where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu nhập'; end if;
  if v_status <> 'posted' then raise exception 'Chỉ phiếu ĐÃ GHI NHẬN mới mở lại được (hiện tại: %)', v_status; end if;
  if public._receipt_has_active_linked(p_id) then
    raise exception 'Phiếu nhập này đã tự cấp phát các phiếu yêu cầu đang ở trạng thái đã cấp/nhận. Hãy dùng chức năng "Mở lại sửa/Xoá" cho các phiếu yêu cầu đó TRƯỚC, rồi mở lại phiếu nhập này.';
  end if;

  perform public._revert_movements('receipt', p_id, p_by);
  update public.receipts set status = 'draft', linked_requisition_ids = '{}', updated_at = now() where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'receipt.reopen', 'receipt', p_id,
          jsonb_build_object('status','posted'), jsonb_build_object('status','draft'));
end;
$$;

create or replace function public.delete_receipt(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.receipt_status;
begin
  if not public.is_owner() then raise exception 'Chỉ quản trị viên (Admin/Chủ trại) được xoá phiếu nhập'; end if;
  select status into v_status from public.receipts where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu nhập'; end if;

  if v_status = 'posted' then
    if public._receipt_has_active_linked(p_id) then
      raise exception 'Phiếu nhập đã chốt và đã tự cấp phát các phiếu yêu cầu đang ở trạng thái đã cấp/nhận. Hãy xử lý (mở lại/xoá) các phiếu yêu cầu đó TRƯỚC khi xoá phiếu nhập này.';
    end if;
    perform public._revert_movements('receipt', p_id, p_by);
  end if;

  delete from public.receipts where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'receipt.delete', 'receipt', p_id, jsonb_build_object('status', v_status), null);
end;
$$;

-- ===========================================================================
-- 4. PHIẾU YÊU CẦU VẬT TƯ (REQUISITIONS)
-- ===========================================================================
create or replace function public.revert_requisition(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.requisition_status;
begin
  if not public.is_owner() then raise exception 'Chỉ quản trị viên (Admin/Chủ trại) được mở lại phiếu yêu cầu'; end if;
  select status into v_status from public.requisitions where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu yêu cầu'; end if;
  if v_status not in ('issued','received') then
    raise exception 'Phiếu chưa cấp phát nên không cần mở lại (hiện tại: %)', v_status;
  end if;

  perform public._revert_movements('requisition', p_id, p_by);

  delete from public.requisition_returns where requisition_id = p_id;

  update public.requisitions
  set status = 'approved',
      fulfilled_by = null, fulfilled_at = null, fulfillment_notes = null,
      received_by = null, received_at = null,
      updated_at = now()
  where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'requisition.reopen', 'requisition', p_id,
          jsonb_build_object('status', v_status), jsonb_build_object('status','approved'));
end;
$$;

create or replace function public.delete_requisition(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.requisition_status;
begin
  if not public.is_owner() then raise exception 'Chỉ quản trị viên (Admin/Chủ trại) được xoá phiếu yêu cầu'; end if;
  select status into v_status from public.requisitions where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu yêu cầu'; end if;

  if v_status in ('issued','received') then
    perform public._revert_movements('requisition', p_id, p_by);
  end if;

  delete from public.requisition_returns where requisition_id = p_id;
  delete from public.requisitions where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'requisition.delete', 'requisition', p_id,
          jsonb_build_object('status', v_status), null);
end;
$$;

-- ===========================================================================
-- 5. PHIẾU BÁO HỎNG (DEFECTS)
-- ===========================================================================
create or replace function public.delete_defect(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.defect_status;
  v_blocked text;
begin
  if not public.is_owner() then raise exception 'Chỉ quản trị viên (Admin/Chủ trại) được xoá phiếu hỏng'; end if;
  select status into v_status from public.defect_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu hỏng'; end if;

  select string_agg(t.msg, '; ') into v_blocked from (
    select 'còn phiếu sửa chữa dùng vật tư của phiếu này' as msg
    from public.defect_note_items dni
    join public.repair_order_items roi on roi.defect_item_id = dni.id
    where dni.defect_note_id = p_id
    union
    select 'còn phiếu yêu cầu thay thế (replacement) trỏ tới' as msg
    from public.requisitions r
    where r.linked_defect_id = p_id
    union
    select 'còn phiếu đổi mới (exchange) trỏ tới' as msg
    from public.exchange_notes en
    where en.linked_defect_id = p_id
  ) t;
  if v_blocked is not null then
    raise exception 'Không xoá được phiếu hỏng: % — hãy xử lý các phiếu liên quan trước.', v_blocked;
  end if;

  perform public._revert_movements('defect', p_id, p_by);

  delete from public.defect_notes where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'defect.delete', 'defect', p_id, jsonb_build_object('status', v_status), null);
end;
$$;

-- ===========================================================================
-- 6. PHIẾU SỬA CHỮA (REPAIRS)
-- ===========================================================================
create or replace function public.revert_repair(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  if not public.is_owner() then raise exception 'Chỉ quản trị viên (Admin/Chủ trại) được mở lại phiếu sửa chữa'; end if;
  select status into v_status from public.repair_orders where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu sửa chữa'; end if;
  if v_status <> 'returned' then
    raise exception 'Chỉ phiếu ĐÃ HOÀN TẤT (returned) mới mở lại được (hiện tại: %)', v_status;
  end if;

  perform public._revert_movements('repair_outcome', p_id, p_by);

  update public.defect_note_items dni
  set resolution = null, updated_at = now()
  from public.repair_order_items roi
  where roi.repair_order_id = p_id and roi.defect_item_id = dni.id;

  perform public._rebuild_defect_notes(p_id, 'revert');

  update public.repair_order_items
  set outcome = null, notes = coalesce(notes,'') || ' [Admin: mở lại từ returned]'
  where repair_order_id = p_id;

  update public.repair_orders
  set status = 'in_repair', cost = 0, returned_at = null, updated_at = now()
  where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'repair.reopen', 'repair', p_id,
          jsonb_build_object('status','returned'), jsonb_build_object('status','in_repair'));
end;
$$;

create or replace function public.delete_repair(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  if not public.is_owner() then raise exception 'Chỉ quản trị viên (Admin/Chủ trại) được xoá phiếu sửa chữa'; end if;
  select status into v_status from public.repair_orders where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu sửa chữa'; end if;

  perform public._revert_movements('repair', p_id, p_by);
  perform public._revert_movements('repair_outcome', p_id, p_by);

  update public.defect_note_items dni
  set resolution = null, updated_at = now()
  from public.repair_order_items roi
  where roi.repair_order_id = p_id and roi.defect_item_id = dni.id;

  perform public._rebuild_defect_notes(p_id, 'delete');

  delete from public.repair_orders where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'repair.delete', 'repair', p_id, jsonb_build_object('status', v_status), null);
end;
$$;

-- ===========================================================================
-- 7. PHIẾU KIỂM KÊ (STOCKTAKE)
-- ===========================================================================
create or replace function public.revert_stocktake(p_session_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.stocktake_status;
begin
  if not public.is_owner() then raise exception 'Chỉ quản trị viên (Admin/Chủ trại) được mở lại phiếu kiểm kê'; end if;
  select status into v_status
  from public.stocktake_sessions
  where id = p_session_id
  for update;

  if v_status is null then raise exception 'Không tìm thấy phiếu kiểm kê'; end if;
  if v_status <> 'posted' then raise exception 'Chỉ phiếu ĐÃ CHỐT mới mở lại được (hiện tại: %)', v_status; end if;

  perform public._revert_movements('stocktake', p_session_id, p_by);

  update public.stocktake_sessions
  set status = 'draft', posted_at = null
  where id = p_session_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'stocktake.reopen', 'stocktake', p_session_id,
          jsonb_build_object('status', 'posted'), jsonb_build_object('status', 'draft'));
end;
$$;

create or replace function public.delete_stocktake(p_session_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.stocktake_status;
begin
  if not public.is_owner() then raise exception 'Chỉ quản trị viên (Admin/Chủ trại) được xoá phiếu kiểm kê'; end if;
  select status into v_status
  from public.stocktake_sessions
  where id = p_session_id
  for update;

  if v_status is null then raise exception 'Không tìm thấy phiếu kiểm kê'; end if;

  if v_status = 'posted' then
    perform public._revert_movements('stocktake', p_session_id, p_by);
  end if;

  delete from public.stocktake_sessions where id = p_session_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'stocktake.delete', 'stocktake', p_session_id,
          jsonb_build_object('status', v_status), null);
end;
$$;

-- ===========================================================================
-- 8. PHIẾU ĐỔI MỚI VẬT TƯ (EXCHANGES)
-- ===========================================================================
create or replace function public.revert_exchange(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.exchange_status;
begin
  if not public.is_owner() then raise exception 'Chỉ quản trị viên (Admin/Chủ trại) được mở lại phiếu đổi mới'; end if;
  select status into v_status from public.exchange_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu đổi mới'; end if;
  if v_status not in ('issued', 'received') then
    raise exception 'Chỉ phiếu ĐÃ CẤP PHÁT/HOÀN TẤT mới mở lại được (hiện tại: %)', v_status;
  end if;

  perform public._revert_movements('exchange', p_id, p_by);

  update public.exchange_notes
  set status = 'approved',
      issued_by = null, issued_at = null,
      received_by = null, received_at = null,
      updated_at = now()
  where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'exchange.reopen', 'exchange', p_id,
          jsonb_build_object('status', v_status), jsonb_build_object('status', 'approved'));
end;
$$;

create or replace function public.delete_exchange(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.exchange_status;
begin
  if not public.is_owner() then raise exception 'Chỉ quản trị viên (Admin/Chủ trại) được xoá phiếu đổi mới'; end if;
  select status into v_status from public.exchange_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu đổi mới'; end if;

  if v_status in ('issued', 'received') then
    perform public._revert_movements('exchange', p_id, p_by);
  end if;

  delete from public.exchange_notes where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'exchange.delete', 'exchange', p_id, jsonb_build_object('status', v_status), null);
end;
$$;

-- ===========================================================================
-- 9. PHIẾU CẤP & NHẬP DẦU (FUEL DISPENSES & FUEL RECEIPTS)
-- ===========================================================================
create or replace function public.delete_fuel_dispense(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_dispense record;
begin
  if not public.is_owner() then raise exception 'Chỉ quản trị viên (Admin/Chủ trại) được xoá phiếu cấp phát dầu'; end if;
  select * into v_dispense from public.fuel_dispenses where id = p_id for update;
  if v_dispense.id is null then raise exception 'Không tìm thấy phiếu cấp dầu'; end if;

  if v_dispense.status <> 'cancelled' then
    update public.fuel_types
    set current_stock = current_stock + v_dispense.quantity, updated_at = now()
    where id = v_dispense.fuel_type_id;
  end if;

  delete from public.fuel_movements where ref_type = 'fuel_dispenses' and ref_id = p_id;
  delete from public.fuel_dispenses where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'fuel_dispense.delete', 'fuel_dispense', p_id, jsonb_build_object('code', v_dispense.code), null);
end;
$$;

create or replace function public.delete_fuel_receipt(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_receipt record; v_cur_stock numeric;
begin
  if not public.is_owner() then raise exception 'Chỉ quản trị viên (Admin/Chủ trại) được xoá phiếu nhập dầu'; end if;
  select * into v_receipt from public.fuel_receipts where id = p_id for update;
  if v_receipt.id is null then raise exception 'Không tìm thấy phiếu nhập dầu'; end if;

  if v_receipt.status <> 'cancelled' then
    select current_stock into v_cur_stock from public.fuel_types where id = v_receipt.fuel_type_id for update;
    if v_cur_stock < v_receipt.quantity then
      raise exception 'Không thể xoá phiếu nhập vì tồn kho hiện tại (%) nhỏ hơn số lượng nhập cần trừ lại (%)', v_cur_stock, v_receipt.quantity;
    end if;
    update public.fuel_types
    set current_stock = current_stock - v_receipt.quantity, updated_at = now()
    where id = v_receipt.fuel_type_id;
  end if;

  delete from public.fuel_movements where ref_type = 'fuel_receipts' and ref_id = p_id;
  delete from public.fuel_receipts where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'fuel_receipt.delete', 'fuel_receipt', p_id, jsonb_build_object('code', v_receipt.code), null);
end;
$$;
