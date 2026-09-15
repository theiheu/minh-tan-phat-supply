-- 0068_post_receipt_require_manager_approval.sql
-- Yêu cầu: Cấp phát ngay cho phiếu yêu cầu khi nhập hàng mới về cần có thêm bước duyệt của quản kho.
-- Thay đổi: Trong post_receipt, chỉ tự động cấp phát cho các phiếu yêu cầu ĐÃ ĐƯỢC DUYỆT (status = 'approved').
-- Bỏ việc tự động chuyển pending -> approved trong post_receipt.

-- 1. Xóa overload cũ của create_requisition và create_issue để tránh lỗi ambiguous function call
drop function if exists public.create_requisition(jsonb, uuid, text, public.requisition_type, uuid, uuid);
drop function if exists public.create_issue(jsonb, text, uuid, uuid, text, text, text, uuid);

-- 2. Đảm bảo RPC create_requisition chuẩn nhất với 7 tham số
create or replace function public.create_requisition(
  p_items jsonb,
  p_zone_id uuid,
  p_purpose text default null,
  p_type public.requisition_type default 'new_supply',
  p_linked_defect_id uuid default null,
  p_requester_id uuid default null,
  p_sub_zone_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_code text;
  v_requester uuid;
  it record;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if p_requester_id is not null and p_requester_id <> auth.uid() then
    if not public.is_manager() then raise exception 'Chỉ quản lý mới được tạo phiếu yêu cầu dùm người khác'; end if;
    v_requester := p_requester_id;
  else
    v_requester := auth.uid();
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Phiếu yêu cầu phải có ít nhất 1 mặt hàng';
  end if;

  v_code := public.next_code('YCCP', 'public.requisitions_seq'::regclass);

  insert into public.requisitions (code, requester_id, zone_id, sub_zone_id, purpose, requisition_type, linked_defect_id, status)
  values (v_code, v_requester, p_zone_id, p_sub_zone_id, p_purpose, coalesce(p_type, 'new_supply'), p_linked_defect_id, 'draft')
  returning id into v_id;

  for it in select * from jsonb_to_recordset(p_items) as x(variant_id uuid, quantity int) loop
    if it.quantity is null or it.quantity <= 0 then raise exception 'Số lượng phải > 0'; end if;
    insert into public.requisition_items (requisition_id, variant_id, quantity)
    values (v_id, it.variant_id, it.quantity);
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (auth.uid(), 'requisition.create', 'requisition', v_id, null, jsonb_build_object('code', v_code, 'status', 'draft'));

  return v_id;
end;
$$;

-- 3. Cập nhật RPC post_receipt: CHỈ tự động cấp phát các phiếu yêu cầu ĐÃ ĐƯỢC DUYỆT (approved)
create or replace function public.post_receipt(p_id uuid, p_by uuid)
returns uuid[] language plpgsql security definer set search_path = public as $$
declare
  v_status public.receipt_status;
  v_main uuid;
  it record;
  r record;
  v_linked uuid[] := '{}';
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được ghi nhận nhập kho'; end if;
  select id into v_main from public.stock_locations where code = 'KHO_CHINH';

  select status into v_status from public.receipts where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu nhập'; end if;
  if v_status not in ('draft', 'approved') then
    raise exception 'Phiếu không ở trạng thái hợp lệ để nhập kho (hiện tại: %)', v_status;
  end if;

  -- cộng stock (order by variant_id chống deadlock)
  for it in select * from public.receipt_items where receipt_id = p_id order by variant_id loop
    perform public._move_stock(it.variant_id, null, v_main, it.quantity, 'receipt_in', 'receipt', p_id, p_by);
  end loop;

  -- auto cấp phát các requisition ĐÃ DUYỆT (status = 'approved') theo FIFO (created_at, id tăng dần)
  -- Không tự động duyệt các phiếu đang ở trạng thái pending
  for r in select id from public.requisitions
           where status = 'approved'
           order by created_at asc, id asc loop
    begin
      perform public.fulfill_requisition(r.id, p_by, 'Tự động cấp phát từ phiếu nhập');
      v_linked := array_append(v_linked, r.id);
    exception when others then
      -- bỏ qua phiếu không thể cấp phát (thiếu tồn / đã được xử lý song song)
      null;
    end;
  end loop;

  update public.receipts set status = 'posted', linked_requisition_ids = v_linked where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'receipt.post', 'receipt', p_id,
          jsonb_build_object('status', v_status), jsonb_build_object('status', 'posted', 'linked', v_linked));

  return v_linked;
end;
$$;
