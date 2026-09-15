-- 0067_admin_force_delete_user.sql — Quyền xóa sạch tài khoản và lịch sử phiếu cho Quản trị hệ thống (superuser)

create or replace function public.admin_purge_user_data(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_is_protected boolean;
  v_username text;
begin
  -- 1. Chỉ superuser mới có quyền xóa sạch dữ liệu
  if not public.is_superuser() then
    raise exception 'Chỉ quản trị hệ thống (superuser) mới có quyền xóa sạch tài khoản và toàn bộ lịch sử dữ liệu liên quan';
  end if;

  -- 2. Chặn tự xóa chính mình
  if p_user_id = auth.uid() then
    raise exception 'Không thể tự xóa tài khoản của chính mình';
  end if;

  -- 3. Chặn xóa tài khoản hệ thống
  select is_protected, username into v_is_protected, v_username from public.profiles where id = p_user_id;
  if v_is_protected then
    raise exception 'Không thể xóa tài khoản hệ thống %', coalesce(v_username, '');
  end if;

  -- 4. Xóa sạch dữ liệu lịch sử liên kết với user
  -- Gỡ liên kết defect_notes trong requisitions và exchange_notes
  update public.requisitions set linked_defect_id = null
  where requester_id = p_user_id or approved_by = p_user_id or fulfilled_by = p_user_id or received_by = p_user_id;
  
  update public.exchange_notes set linked_defect_id = null
  where created_by = p_user_id or approved_by = p_user_id or issued_by = p_user_id or received_by = p_user_id or rejected_by = p_user_id;

  -- Xóa notifications & audit logs của user
  delete from public.notifications where user_id = p_user_id;
  delete from public.audit_logs where actor_id = p_user_id;

  -- Xóa mượn trả dụng cụ
  delete from public.tool_borrowings where borrower_id = p_user_id or issued_by = p_user_id or received_back_by = p_user_id;

  -- Xóa cấp phát & giao dịch kho dầu
  delete from public.fuel_dispenses where dispenser_id = p_user_id;
  delete from public.fuel_receipts where received_by = p_user_id;
  delete from public.fuel_movements where created_by = p_user_id;

  -- Xóa phiếu đổi trả & thanh lý & sửa chữa
  delete from public.exchange_notes where created_by = p_user_id or approved_by = p_user_id or issued_by = p_user_id or received_by = p_user_id or rejected_by = p_user_id;
  delete from public.liquidation_notes where created_by = p_user_id or approved_by = p_user_id;
  delete from public.repair_orders where created_by = p_user_id;

  -- Xóa phiếu trả hàng & phiếu yêu cầu vật tư
  delete from public.requisition_returns where returned_by = p_user_id;
  delete from public.requisitions where requester_id = p_user_id or approved_by = p_user_id or fulfilled_by = p_user_id or received_by = p_user_id;

  -- Xóa phiếu báo hỏng
  delete from public.defect_notes where reported_by = p_user_id or repair_requested_by = p_user_id or collected_by = p_user_id;

  -- Xóa phiếu xuất & phiếu nhập
  delete from public.issues where creator_id = p_user_id;
  delete from public.receipts where created_by = p_user_id or approved_by = p_user_id;

  -- Xóa phiên kiểm kê
  delete from public.stocktake_sessions where created_by = p_user_id;

  -- Xóa biến động kho
  delete from public.stock_movements where created_by = p_user_id;
end;
$$;
