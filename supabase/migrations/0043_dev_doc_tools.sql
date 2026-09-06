-- 0043_dev_doc_tools.sql — Công cụ DEV (superuser-only): mở lại / xoá phiếu các loại.
--
-- Áp dụng pattern 0042 cho 4 module: issues, liquidations, receipts, requisitions.
-- Mọi movement ledger đều ref id phiếu TRỰC TIẾP nên _revert_movements(ref_type, ref_id)
-- đảo chính xác; guard trong _revert_movements chặn đảo làm âm tồn (an toàn).
-- Ràng buộc chéo đặc biệt: post_receipt auto-fulfill requisition (0020) — khi mở lại/xoá
-- receipt posted, các requisition linked đang 'issued'/'received' phải được xử lý TRƯỚC
-- (bằng revert/delete requisition của tool này), nếu không đảo sẽ raise thiếu tồn.

-- ===========================================================================
-- ISSUES
-- ===========================================================================
create or replace function public.revert_issue(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not public.is_superuser() then raise exception 'Chỉ tài khoản dev (superuser) được mở lại phiếu xuất'; end if;
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
  if not public.is_superuser() then raise exception 'Chỉ tài khoản dev (superuser) được xoá phiếu xuất'; end if;
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
-- LIQUIDATIONS
-- ===========================================================================
create or replace function public.revert_liquidation(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.liquidation_status;
begin
  if not public.is_superuser() then raise exception 'Chỉ tài khoản dev (superuser) được mở lại phiếu thanh lý'; end if;
  select status into v_status from public.liquidation_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu thanh lý'; end if;
  if v_status <> 'completed' then raise exception 'Chỉ phiếu ĐÃ HOÀN TẤT mới mở lại được (hiện tại: %)', v_status; end if;

  perform public._revert_movements('liquidation', p_id, p_by);
  update public.liquidation_notes
  set status = 'approved', completed_at = null, notes = coalesce(notes,'') || ' [Dev: mở lại từ completed]'
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
  if not public.is_superuser() then raise exception 'Chỉ tài khoản dev (superuser) được xoá phiếu thanh lý'; end if;
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
-- RECEIPTS (guard: phải xử lý requisition linked trước)
-- ===========================================================================
-- helper: kiểm tra xem receipt có còn requisition linked đang 'issued'/'received' không.
create or replace function public._receipt_has_active_linked(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_ids uuid[]; v_any boolean;
begin
  select linked_requisition_ids into v_ids from public.receipts where id = p_id;
  if v_ids is null or cardinality(v_ids) = 0 then return false; end if;
  select exists (
    select 1 from public.requisitions r
    where r.id = any(v_ids) and r.status in ('issued','received')
  ) into v_any;
  return coalesce(v_any, false);
end;
$$;

create or replace function public.revert_receipt(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.receipt_status;
begin
  if not public.is_superuser() then raise exception 'Chỉ tài khoản dev (superuser) được mở lại phiếu nhập'; end if;
  select status into v_status from public.receipts where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu nhập'; end if;
  if v_status <> 'posted' then raise exception 'Chỉ phiếu ĐÃ GHI NHẬN mới mở lại được (hiện tại: %)', v_status; end if;
  if public._receipt_has_active_linked(p_id) then
    raise exception 'Phiếu nhập này đã tự cấp phát các phiếu yêu cầu đang ở trạng thái đã cấp/nhận. Hãy dùng công cụ dev "Mở lại sửa/Xoá" cho các phiếu yêu cầu đó TRƯỚC, rồi mở lại phiếu nhập này.';
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
  if not public.is_superuser() then raise exception 'Chỉ tài khoản dev (superuser) được xoá phiếu nhập'; end if;
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
-- REQUISITIONS (đảo requisition_out + mọi return_in cùng ref; xoá lịch sử trả)
-- ===========================================================================
create or replace function public.revert_requisition(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.requisition_status;
begin
  if not public.is_superuser() then raise exception 'Chỉ tài khoản dev (superuser) được mở lại phiếu yêu cầu'; end if;
  select status into v_status from public.requisitions where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu yêu cầu'; end if;
  -- Chỉ issued/received mới có bút toán (fulfill). Trả về 'approved' để duyệt/cấp lại.
  if v_status not in ('issued','received') then
    raise exception 'Phiếu chưa cấp phát nên không cần mở lại (hiện tại: %)', v_status;
  end if;

  perform public._revert_movements('requisition', p_id, p_by);

  -- Xoá lịch sử trả lại (movement return_in đã bị đảo ở trên).
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
  if not public.is_superuser() then raise exception 'Chỉ tài khoản dev (superuser) được xoá phiếu yêu cầu'; end if;
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
