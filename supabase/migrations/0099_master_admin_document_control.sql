-- 0099_master_admin_document_control.sql
-- Cung cấp quyền can thiệp sâu & xoá cứng mọi loại phiếu cho Superuser và Owner

-- 1. Helper kiểm tra quan hệ phụ thuộc trước khi xoá
CREATE OR REPLACE FUNCTION public.admin_inspect_document_dependencies(p_kind text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_result jsonb := '{}'::jsonb;
  v_doc jsonb := null;
  v_deps jsonb := '[]'::jsonb;
  v_movements_count int := 0;
  v_can_direct_delete boolean := true;
begin
  if not (public.is_owner() or public.is_superuser()) then
    raise exception 'Chỉ tài khoản Quản trị viên (Superuser / Chủ trại) được thực hiện thao tác này';
  end if;

  if p_kind = 'receipt' then
    select jsonb_build_object('id', id, 'code', code, 'status', status, 'created_at', created_at)
    into v_doc from public.receipts where id = p_id;
    
    select count(*) into v_movements_count
    from public.stock_movements where ref_type = 'receipt' and ref_id = p_id;
    
    -- Check auto-fulfilled requisitions
    select coalesce(jsonb_agg(jsonb_build_object('kind', 'requisition', 'id', r.id, 'code', r.code, 'status', r.status)), '[]'::jsonb)
    into v_deps
    from public.requisitions r
    where r.auto_fulfilled_by_receipt_id = p_id and r.status in ('issued', 'received');

  elsif p_kind = 'issue' then
    select jsonb_build_object('id', id, 'code', code, 'status', status, 'created_at', created_at, 'requisition_id', requisition_id)
    into v_doc from public.issues where id = p_id;
    
    select count(*) into v_movements_count
    from public.stock_movements where ref_type = 'issue' and ref_id = p_id;

  elsif p_kind = 'requisition' then
    select jsonb_build_object('id', id, 'code', code, 'status', status, 'created_at', created_at)
    into v_doc from public.requisitions where id = p_id;
    
    select count(*) into v_movements_count
    from public.stock_movements where ref_type = 'requisition' and ref_id = p_id;

    -- Check linked issues and returns
    select coalesce(jsonb_agg(dep), '[]'::jsonb) into v_deps
    from (
      select jsonb_build_object('kind', 'issue', 'id', i.id, 'code', i.code, 'status', i.status, 'created_at', i.created_at) as dep
      from public.issues i where i.requisition_id = p_id
      union all
      select jsonb_build_object('kind', 'requisition_return', 'id', rr.id, 'code', 'PHT-' || substr(rr.id::text, 1, 8), 'status', 'returned', 'created_at', rr.created_at) as dep
      from public.requisition_returns rr where rr.requisition_id = p_id
    ) sub;

  elsif p_kind = 'defect' then
    select jsonb_build_object('id', id, 'code', code, 'status', status, 'created_at', created_at)
    into v_doc from public.defect_notes where id = p_id;
    
    select count(*) into v_movements_count
    from public.stock_movements where ref_type = 'defect' and ref_id = p_id;

    select coalesce(jsonb_agg(dep), '[]'::jsonb) into v_deps
    from (
      select distinct jsonb_build_object('kind', 'repair', 'id', ro.id, 'code', ro.code, 'status', ro.status) as dep
      from public.defect_note_items dni
      join public.repair_order_items roi on roi.defect_item_id = dni.id
      join public.repair_orders ro on ro.id = roi.repair_order_id
      where dni.defect_note_id = p_id
      union all
      select jsonb_build_object('kind', 'exchange', 'id', en.id, 'code', en.code, 'status', en.status) as dep
      from public.exchange_notes en where en.defect_note_id = p_id
      union all
      select jsonb_build_object('kind', 'requisition', 'id', req.id, 'code', req.code, 'status', req.status) as dep
      from public.requisitions req where req.linked_defect_id = p_id
    ) sub;

  elsif p_kind = 'repair' then
    select jsonb_build_object('id', id, 'code', code, 'status', status, 'created_at', created_at)
    into v_doc from public.repair_orders where id = p_id;
    
    select count(*) into v_movements_count
    from public.stock_movements where ref_type = 'repair' and ref_id = p_id;

  elsif p_kind = 'exchange' then
    select jsonb_build_object('id', id, 'code', code, 'status', status, 'created_at', created_at)
    into v_doc from public.exchange_notes where id = p_id;
    
    select count(*) into v_movements_count
    from public.stock_movements where ref_type = 'exchange' and ref_id = p_id;

  elsif p_kind = 'liquidation' then
    select jsonb_build_object('id', id, 'code', code, 'status', status, 'created_at', created_at)
    into v_doc from public.liquidation_notes where id = p_id;
    
    select count(*) into v_movements_count
    from public.stock_movements where ref_type = 'liquidation' and ref_id = p_id;

  elsif p_kind = 'stocktake' then
    select jsonb_build_object('id', id, 'code', code, 'status', status, 'created_at', created_at)
    into v_doc from public.stocktake_sessions where id = p_id;
    
    select count(*) into v_movements_count
    from public.stock_movements where ref_type = 'stocktake' and ref_id = p_id;

  elsif p_kind = 'fuel_receipt' then
    select jsonb_build_object('id', id, 'code', code, 'status', status, 'created_at', created_at, 'quantity', quantity)
    into v_doc from public.fuel_receipts where id = p_id;
    
    select count(*) into v_movements_count
    from public.fuel_movements where (ref_type = 'fuel_receipts' or ref_type = 'fuel_receipt') and ref_id = p_id;

  elsif p_kind = 'fuel_dispense' then
    select jsonb_build_object('id', id, 'code', code, 'status', status, 'created_at', created_at, 'quantity', quantity)
    into v_doc from public.fuel_dispenses where id = p_id;
    
    select count(*) into v_movements_count
    from public.fuel_movements where (ref_type = 'fuel_dispenses' or ref_type = 'fuel_dispense') and ref_id = p_id;
  end if;

  if v_doc is null then
    raise exception 'Không tìm thấy phiếu loại % với ID %', p_kind, p_id;
  end if;

  v_can_direct_delete := (jsonb_array_length(v_deps) = 0);

  return jsonb_build_object(
    'document', v_doc,
    'dependencies', v_deps,
    'movements_count', v_movements_count,
    'can_direct_delete', v_can_direct_delete
  );
end;
$$;


-- 2. Hàm Master Admin Hard Delete xoá triệt để mọi phiếu
CREATE OR REPLACE FUNCTION public.admin_delete_document(
  p_kind text,
  p_id uuid,
  p_cascade boolean DEFAULT false,
  p_reason text DEFAULT 'Admin hard delete',
  p_by uuid DEFAULT auth.uid()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_actor uuid := coalesce(auth.uid(), p_by);
  v_snapshot jsonb;
  v_items_snapshot jsonb := '[]'::jsonb;
  r record;
  r_dep record;
begin
  if not (public.is_owner() or public.is_superuser() or public._posting_actor_has_role(v_actor, array['superuser', 'owner'])) then
    raise exception 'Chỉ tài khoản Quản trị viên (Superuser / Chủ trại) được thực hiện quyền xoá phiếu';
  end if;

  -- Bật quyền bypass append-only trong transaction này để dọn sạch dữ liệu
  set local minhtanphat.bypass_append_only = 'true';

  -- ─── 1. PHIẾU NHẬP (receipt) ───
  if p_kind = 'receipt' then
    select row_to_json(r_row) into v_snapshot from public.receipts r_row where id = p_id for update;
    if v_snapshot is null then raise exception 'Không tìm thấy phiếu nhập %', p_id; end if;

    select coalesce(jsonb_agg(row_to_json(i)), '[]'::jsonb) into v_items_snapshot
    from public.receipt_items i where receipt_id = p_id;

    if (v_snapshot->>'status') = 'posted' then
      -- Nếu có phiếu yêu cầu tự động cấp phát, xử lý hoặc ngắt liên kết
      if exists (select 1 from public.requisitions where auto_fulfilled_by_receipt_id = p_id and status in ('issued','received')) then
        if not p_cascade then
          raise exception 'Phiếu nhập đã tự cấp phát cho Phiếu yêu cầu đang hoạt động. Hãy chọn Xoá dây chuyền (Cascade) hoặc xử lý phiếu yêu cầu trước.';
        else
          update public.requisitions
          set auto_fulfilled_by_receipt_id = null
          where auto_fulfilled_by_receipt_id = p_id;
        end if;
      end if;

      perform public._revert_movements('receipt', p_id, v_actor);
    end if;

    delete from public.receipt_items where receipt_id = p_id;
    delete from public.receipts where id = p_id;

  -- ─── 2. PHIẾU XUẤT (issue) ───
  elsif p_kind = 'issue' then
    select row_to_json(i_row) into v_snapshot from public.issues i_row where id = p_id for update;
    if v_snapshot is null then raise exception 'Không tìm thấy phiếu xuất %', p_id; end if;

    select coalesce(jsonb_agg(row_to_json(i)), '[]'::jsonb) into v_items_snapshot
    from public.issue_items i where issue_id = p_id;

    if (v_snapshot->>'status') = 'posted' then
      perform public._revert_movements('issue', p_id, v_actor);
    end if;

    -- Nếu xuất theo phiếu yêu cầu, hoàn nguyên trạng thái phiếu yêu cầu nếu cần
    if (v_snapshot->>'requisition_id') is not null then
      update public.requisitions
      set status = 'approved', fulfilled_by = null, fulfilled_at = null
      where id = (v_snapshot->>'requisition_id')::uuid and status in ('issued', 'received');
    end if;

    delete from public.issue_items where issue_id = p_id;
    delete from public.issues where id = p_id;

  -- ─── 3. PHIẾU YÊU CẦU (requisition) ───
  elsif p_kind = 'requisition' then
    select row_to_json(req_row) into v_snapshot from public.requisitions req_row where id = p_id for update;
    if v_snapshot is null then raise exception 'Không tìm thấy phiếu yêu cầu %', p_id; end if;

    select coalesce(jsonb_agg(row_to_json(i)), '[]'::jsonb) into v_items_snapshot
    from public.requisition_items i where requisition_id = p_id;

    -- Xử lý các phiếu con (issues & returns)
    for r_dep in select id, code from public.issues where requisition_id = p_id loop
      if p_cascade then
        perform public.admin_delete_document('issue', r_dep.id, true, p_reason || ' (Dây chuyền từ PYC ' || (v_snapshot->>'code') || ')', v_actor);
      else
        raise exception 'Phiếu yêu cầu này đã có Phiếu xuất kho liên kết (%). Hãy chọn Xoá dây chuyền (Cascade) để xoá toàn bộ.', r_dep.code;
      end if;
    end loop;

    -- Đảo và xóa các phiếu hoàn trả liên quan
    delete from public.requisition_return_items where return_id in (select id from public.requisition_returns where requisition_id = p_id);
    delete from public.requisition_returns where requisition_id = p_id;

    if (v_snapshot->>'status') in ('issued', 'received') then
      perform public._revert_movements('requisition', p_id, v_actor);
    end if;

    delete from public.requisition_items where requisition_id = p_id;
    delete from public.requisitions where id = p_id;

  -- ─── 4. PHIẾU BÁO HỎNG (defect) ───
  elsif p_kind = 'defect' then
    select row_to_json(d_row) into v_snapshot from public.defect_notes d_row where id = p_id for update;
    if v_snapshot is null then raise exception 'Không tìm thấy phiếu hỏng %', p_id; end if;

    select coalesce(jsonb_agg(row_to_json(i)), '[]'::jsonb) into v_items_snapshot
    from public.defect_note_items i where defect_note_id = p_id;

    -- Kiểm tra phiếu sửa chữa liên quan
    for r_dep in
      select distinct ro.id, ro.code
      from public.defect_note_items dni
      join public.repair_order_items roi on roi.defect_item_id = dni.id
      join public.repair_orders ro on ro.id = roi.repair_order_id
      where dni.defect_note_id = p_id
    loop
      if p_cascade then
        perform public.admin_delete_document('repair', r_dep.id, true, p_reason || ' (Dây chuyền từ PBH ' || (v_snapshot->>'code') || ')', v_actor);
      else
        raise exception 'Phiếu hỏng này đang có Phiếu sửa chữa liên kết (%). Hãy chọn Xoá dây chuyền (Cascade) để xoá.', r_dep.code;
      end if;
    end loop;

    -- Kiểm tra phiếu đổi hàng liên quan
    for r_dep in select id, code from public.exchange_notes where defect_note_id = p_id loop
      if p_cascade then
        perform public.admin_delete_document('exchange', r_dep.id, true, p_reason || ' (Dây chuyền từ PBH ' || (v_snapshot->>'code') || ')', v_actor);
      else
        raise exception 'Phiếu hỏng này đang có Phiếu đổi hàng liên kết (%). Hãy chọn Xoá dây chuyền (Cascade) để xoá.', r_dep.code;
      end if;
    end loop;

    -- Ngắt liên kết từ requisition replacement
    update public.requisitions set linked_defect_id = null where linked_defect_id = p_id;

    perform public._revert_movements('defect', p_id, v_actor);

    delete from public.defect_note_items where defect_note_id = p_id;
    delete from public.defect_notes where id = p_id;

  -- ─── 5. PHIẾU ĐỔI HÀNG LỖI (exchange) ───
  elsif p_kind = 'exchange' then
    select row_to_json(e_row) into v_snapshot from public.exchange_notes e_row where id = p_id for update;
    if v_snapshot is null then raise exception 'Không tìm thấy phiếu đổi hàng %', p_id; end if;

    select coalesce(jsonb_agg(row_to_json(i)), '[]'::jsonb) into v_items_snapshot
    from public.exchange_note_items i where exchange_note_id = p_id;

    if (v_snapshot->>'status') in ('issued', 'received') then
      perform public._revert_movements('exchange', p_id, v_actor);
    end if;

    delete from public.exchange_note_items where exchange_note_id = p_id;
    delete from public.exchange_notes where id = p_id;

  -- ─── 6. PHIẾU SỬA CHỮA (repair) ───
  elsif p_kind = 'repair' then
    select row_to_json(rep_row) into v_snapshot from public.repair_orders rep_row where id = p_id for update;
    if v_snapshot is null then raise exception 'Không tìm thấy phiếu sửa %', p_id; end if;

    select coalesce(jsonb_agg(row_to_json(i)), '[]'::jsonb) into v_items_snapshot
    from public.repair_order_items i where repair_order_id = p_id;

    perform public._revert_movements('repair', p_id, v_actor);

    -- Reset trạng thái resolution trên defect_note_items
    update public.defect_note_items dni
    set resolution = null
    from public.repair_order_items roi
    where roi.repair_order_id = p_id and roi.defect_item_id = dni.id;

    perform public._rebuild_defect_notes(p_id, 'delete');

    delete from public.repair_order_items where repair_order_id = p_id;
    delete from public.repair_orders where id = p_id;

  -- ─── 7. PHIẾU THANH LÝ (liquidation) ───
  elsif p_kind = 'liquidation' then
    select row_to_json(liq_row) into v_snapshot from public.liquidation_notes liq_row where id = p_id for update;
    if v_snapshot is null then raise exception 'Không tìm thấy phiếu thanh lý %', p_id; end if;

    select coalesce(jsonb_agg(row_to_json(i)), '[]'::jsonb) into v_items_snapshot
    from public.liquidation_items i where liquidation_note_id = p_id;

    if (v_snapshot->>'status') = 'completed' then
      perform public._revert_movements('liquidation', p_id, v_actor);
    end if;

    delete from public.liquidation_items where liquidation_note_id = p_id;
    delete from public.liquidation_notes where id = p_id;

  -- ─── 8. PHIẾU KIỂM KÊ (stocktake) ───
  elsif p_kind = 'stocktake' then
    select row_to_json(stk_row) into v_snapshot from public.stocktake_sessions stk_row where id = p_id for update;
    if v_snapshot is null then raise exception 'Không tìm thấy phiếu kiểm kê %', p_id; end if;

    select coalesce(jsonb_agg(row_to_json(i)), '[]'::jsonb) into v_items_snapshot
    from public.stocktake_items i where session_id = p_id;

    if (v_snapshot->>'status') = 'posted' then
      perform public._revert_movements('stocktake', p_id, v_actor);
    end if;

    delete from public.stocktake_items where session_id = p_id;
    delete from public.stocktake_sessions where id = p_id;

  -- ─── 9. PHIẾU NHẬP DẦU (fuel_receipt) ───
  elsif p_kind = 'fuel_receipt' then
    select row_to_json(fr_row) into v_snapshot from public.fuel_receipts fr_row where id = p_id for update;
    if v_snapshot is null then raise exception 'Không tìm thấy phiếu nhập dầu %', p_id; end if;

    -- Hoàn nguyên tồn kho dầu nếu chưa bị huỷ
    if (v_snapshot->>'status') != 'cancelled' then
      update public.fuel_types
      set current_stock = greatest(0, current_stock - (v_snapshot->>'quantity')::numeric), updated_at = now()
      where id = (v_snapshot->>'fuel_type_id')::uuid;
    end if;

    delete from public.fuel_movements where (ref_type = 'fuel_receipts' or ref_type = 'fuel_receipt') and ref_id = p_id;
    delete from public.fuel_receipts where id = p_id;

  -- ─── 10. PHIẾU CẤP PHÁT DẦU (fuel_dispense) ───
  elsif p_kind = 'fuel_dispense' then
    select row_to_json(fd_row) into v_snapshot from public.fuel_dispenses fd_row where id = p_id for update;
    if v_snapshot is null then raise exception 'Không tìm thấy phiếu cấp dầu %', p_id; end if;

    -- Hoàn lại tồn kho dầu nếu chưa bị huỷ
    if (v_snapshot->>'status') != 'cancelled' then
      update public.fuel_types
      set current_stock = current_stock + (v_snapshot->>'quantity')::numeric, updated_at = now()
      where id = (v_snapshot->>'fuel_type_id')::uuid;
    end if;

    delete from public.fuel_movements where (ref_type = 'fuel_dispenses' or ref_type = 'fuel_dispense') and ref_id = p_id;
    delete from public.fuel_dispenses where id = p_id;

  -- ─── 11. PHIẾU HOÀN TRẢ VẬT TƯ (requisition_return) ───
  elsif p_kind = 'requisition_return' then
    select row_to_json(rr_row) into v_snapshot from public.requisition_returns rr_row where id = p_id for update;
    if v_snapshot is null then raise exception 'Không tìm thấy phiếu hoàn trả %', p_id; end if;

    select coalesce(jsonb_agg(row_to_json(i)), '[]'::jsonb) into v_items_snapshot
    from public.requisition_return_items i where return_id = p_id;

    perform public._revert_movements('return', p_id, v_actor);

    delete from public.requisition_return_items where return_id = p_id;
    delete from public.requisition_returns where id = p_id;

  else
    raise exception 'Loại phiếu % không được hỗ trợ để xoá', p_kind;
  end if;

  -- Ghi nhận vết bất biến vào audit_logs
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (
    v_actor,
    'admin.hard_delete',
    p_kind,
    p_id,
    jsonb_build_object(
      'header', v_snapshot,
      'items', v_items_snapshot,
      'reason', coalesce(p_reason, 'Admin hard delete'),
      'cascade', p_cascade,
      'deleted_at', now()
    ),
    null
  );
end;
$$;


-- 3. Hàm Master Admin Reopen mở lại phiếu về trạng thái sửa được
CREATE OR REPLACE FUNCTION public.admin_reopen_document(
  p_kind text,
  p_id uuid,
  p_reason text DEFAULT 'Admin reopen',
  p_by uuid DEFAULT auth.uid()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_actor uuid := coalesce(auth.uid(), p_by);
  v_old_status text;
  v_code text;
begin
  if not (public.is_owner() or public.is_superuser() or public._posting_actor_has_role(v_actor, array['superuser', 'owner'])) then
    raise exception 'Chỉ tài khoản Quản trị viên (Superuser / Chủ trại) được thực hiện quyền mở lại phiếu';
  end if;

  if p_kind = 'receipt' then
    select status, code into v_old_status, v_code from public.receipts where id = p_id for update;
    if v_old_status is null then raise exception 'Không tìm thấy phiếu nhập'; end if;
    if v_old_status = 'posted' then
      if public._receipt_has_active_linked(p_id) then
        raise exception 'Phiếu nhập đã chốt và đã tự cấp phát các phiếu yêu cầu đang ở trạng thái đã cấp/nhận. Hãy mở lại/xử lý các phiếu yêu cầu đó TRƯỚC.';
      end if;
      perform public._revert_movements('receipt', p_id, v_actor);
    end if;
    update public.receipts set status = 'draft', approved_by = null, approved_at = null, updated_at = now() where id = p_id;

  elsif p_kind = 'issue' then
    select status, code into v_old_status, v_code from public.issues where id = p_id for update;
    if v_old_status is null then raise exception 'Không tìm thấy phiếu xuất'; end if;
    if v_old_status = 'posted' then
      perform public._revert_movements('issue', p_id, v_actor);
    end if;
    update public.issues set status = 'draft', updated_at = now() where id = p_id;

  elsif p_kind = 'requisition' then
    select status, code into v_old_status, v_code from public.requisitions where id = p_id for update;
    if v_old_status is null then raise exception 'Không tìm thấy phiếu yêu cầu'; end if;
    if v_old_status in ('issued', 'received') then
      perform public._revert_movements('requisition', p_id, v_actor);
    end if;
    update public.requisitions set status = 'pending', approved_by = null, approved_at = null, fulfilled_by = null, fulfilled_at = null, updated_at = now() where id = p_id;

  elsif p_kind = 'repair' then
    perform public.revert_repair(p_id, v_actor);
    return;

  elsif p_kind = 'exchange' then
    select status, code into v_old_status, v_code from public.exchange_notes where id = p_id for update;
    if v_old_status is null then raise exception 'Không tìm thấy phiếu đổi hàng'; end if;
    if v_old_status in ('issued', 'received') then
      perform public._revert_movements('exchange', p_id, v_actor);
    end if;
    update public.exchange_notes set status = 'pending', approved_by = null, approved_at = null, issued_by = null, issued_at = null, updated_at = now() where id = p_id;

  elsif p_kind = 'liquidation' then
    select status, code into v_old_status, v_code from public.liquidation_notes where id = p_id for update;
    if v_old_status is null then raise exception 'Không tìm thấy phiếu thanh lý'; end if;
    if v_old_status = 'completed' then
      perform public._revert_movements('liquidation', p_id, v_actor);
    end if;
    update public.liquidation_notes set status = 'pending', approved_by = null, approved_at = null, updated_at = now() where id = p_id;

  elsif p_kind = 'stocktake' then
    select status, code into v_old_status, v_code from public.stocktake_sessions where id = p_id for update;
    if v_old_status is null then raise exception 'Không tìm thấy phiếu kiểm kê'; end if;
    if v_old_status = 'posted' then
      perform public._revert_movements('stocktake', p_id, v_actor);
    end if;
    update public.stocktake_sessions set status = 'draft', posted_by = null, posted_at = null, updated_at = now() where id = p_id;

  else
    raise exception 'Loại phiếu % chưa hỗ trợ mở lại trực tiếp', p_kind;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (
    v_actor,
    'admin.reopen',
    p_kind,
    p_id,
    jsonb_build_object('status', v_old_status, 'reason', p_reason),
    jsonb_build_object('status', 'reopened')
  );
end;
$$;


-- 4. Hàm Master Admin Direct Metadata Override (Sửa ngày tạo, người tạo, ghi chú)
CREATE OR REPLACE FUNCTION public.admin_override_document_meta(
  p_kind text,
  p_id uuid,
  p_created_at timestamptz DEFAULT null,
  p_actor_id uuid DEFAULT null,
  p_notes text DEFAULT null,
  p_reason text DEFAULT 'Admin override meta',
  p_by uuid DEFAULT auth.uid()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_actor uuid := coalesce(auth.uid(), p_by);
  v_old jsonb;
begin
  if not (public.is_owner() or public.is_superuser() or public._posting_actor_has_role(v_actor, array['superuser', 'owner'])) then
    raise exception 'Chỉ tài khoản Quản trị viên (Superuser / Chủ trại) được thực hiện quyền sửa thông tin phiếu';
  end if;

  if p_kind = 'receipt' then
    select row_to_json(r) into v_old from public.receipts r where id = p_id;
    update public.receipts
    set created_at = coalesce(p_created_at, created_at),
        created_by = coalesce(p_actor_id, created_by),
        notes = coalesce(p_notes, notes),
        updated_at = now()
    where id = p_id;

  elsif p_kind = 'issue' then
    select row_to_json(i) into v_old from public.issues i where id = p_id;
    update public.issues
    set created_at = coalesce(p_created_at, created_at),
        creator_id = coalesce(p_actor_id, creator_id),
        notes = coalesce(p_notes, notes),
        updated_at = now()
    where id = p_id;

  elsif p_kind = 'requisition' then
    select row_to_json(req) into v_old from public.requisitions req where id = p_id;
    update public.requisitions
    set created_at = coalesce(p_created_at, created_at),
        requester_id = coalesce(p_actor_id, requester_id),
        notes = coalesce(p_notes, notes),
        updated_at = now()
    where id = p_id;

  elsif p_kind = 'fuel_receipt' then
    select row_to_json(fr) into v_old from public.fuel_receipts fr where id = p_id;
    update public.fuel_receipts
    set created_at = coalesce(p_created_at, created_at),
        created_by = coalesce(p_actor_id, created_by),
        notes = coalesce(p_notes, notes),
        updated_at = now()
    where id = p_id;

  elsif p_kind = 'fuel_dispense' then
    select row_to_json(fd) into v_old from public.fuel_dispenses fd where id = p_id;
    update public.fuel_dispenses
    set created_at = coalesce(p_created_at, created_at),
        dispenser_id = coalesce(p_actor_id, dispenser_id),
        notes = coalesce(p_notes, notes),
        updated_at = now()
    where id = p_id;

  else
    raise exception 'Loại phiếu % chưa hỗ trợ sửa siêu dữ liệu', p_kind;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (
    v_actor,
    'admin.override_meta',
    p_kind,
    p_id,
    v_old,
    jsonb_build_object('created_at', p_created_at, 'actor_id', p_actor_id, 'notes', p_notes, 'reason', p_reason)
  );
end;
$$;

-- Cấp quyền thực thi RPC cho authenticated và service_role
GRANT ALL ON FUNCTION public.admin_inspect_document_dependencies(text, uuid) TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.admin_delete_document(text, uuid, boolean, text, uuid) TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.admin_reopen_document(text, uuid, text, uuid) TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.admin_override_document_meta(text, uuid, timestamptz, uuid, text, text, uuid) TO anon, authenticated, service_role;
