-- 0053_receipt_approval_flow.sql — Thêm quy trình duyệt đặt hàng trước khi kiểm đếm và nhập kho
-- Luồng: Tạo phiếu (draft) -> Quản lý kiểm tra & sửa -> Quản lý duyệt (approved) -> Hàng về kiểm đếm -> Duyệt nhập kho (posted) -> Cấp phát

-- 1. Bổ sung giá trị enum 'approved' cho receipt_status
alter type public.receipt_status add value if not exists 'approved' after 'draft';

-- 2. Thêm cột người duyệt & thời gian duyệt vào bảng receipts
alter table public.receipts
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz;

-- 3. RPC approve_receipt: draft -> approved (Quản lý duyệt đặt hàng)
create or replace function public.approve_receipt(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.receipt_status;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý được duyệt đặt hàng'; end if;
  
  select status into v_status from public.receipts where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu đặt hàng'; end if;
  if v_status <> 'draft' then raise exception 'Phiếu không ở trạng thái chờ duyệt (hiện tại: %)', v_status; end if;

  update public.receipts
  set status = 'approved',
      approved_by = p_by,
      approved_at = now(),
      updated_at = now()
  where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'receipt.approve', 'receipt', p_id,
          jsonb_build_object('status', 'draft'), jsonb_build_object('status', 'approved'));
end;
$$;

-- 4. RPC update_receipt: cho phép sửa ở cả 'draft' (khi quản lý sửa trước khi duyệt) và 'approved' (khi kiểm đếm hàng về)
create or replace function public.update_receipt(
  p_id uuid,
  p_items jsonb,
  p_supplier_id uuid,
  p_by uuid,
  p_notes text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.receipt_status;
  it record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được sửa phiếu nhập'; end if;
  
  select status into v_status from public.receipts where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu nhập'; end if;
  if v_status not in ('draft', 'approved') then
    raise exception 'Chỉ được sửa/kiểm đếm phiếu ở trạng thái chờ duyệt hoặc đã duyệt (hiện tại: %)', v_status;
  end if;

  update public.receipts
  set supplier_id = p_supplier_id,
      notes = p_notes,
      updated_at = now()
  where id = p_id;

  delete from public.receipt_items where receipt_id = p_id;

  for it in select value from jsonb_array_elements(p_items) loop
    insert into public.receipt_items (receipt_id, variant_id, quantity, unit_cost, batch_no, expiry_date)
    values (
      p_id,
      (it.value->>'variant_id')::uuid,
      (it.value->>'quantity')::int,
      nullif(it.value->>'unit_cost','')::numeric,
      nullif(it.value->>'batch_no',''),
      nullif(it.value->>'expiry_date','')::date
    );
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'receipt.update', 'receipt', p_id,
          jsonb_build_object('status', v_status), jsonb_build_object('status', v_status, 'action', 'update'));
end;
$$;

-- 5. RPC post_receipt: cho phép nhập kho từ 'approved' (hoặc 'draft')
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

  -- auto cấp phát các requisition pending/approved theo FIFO (created_at, id tăng dần)
  for r in select id from public.requisitions
           where status in ('pending','approved')
           order by created_at asc, id asc loop
    begin
      -- nhập kho đủ tồn → tự duyệt phiếu pending trước khi cấp phát
      update public.requisitions
      set status = 'approved', approved_by = p_by, approved_at = now()
      where id = r.id and status = 'pending';

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

-- 6. RPC cancel_receipt: cho phép hủy ở cả 'draft' và 'approved'
create or replace function public.cancel_receipt(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.receipt_status;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được hủy phiếu nhập'; end if;
  select status into v_status from public.receipts where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu nhập'; end if;
  if v_status not in ('draft', 'approved') then
    raise exception 'Chỉ phiếu chưa nhập kho mới được hủy (hiện tại: %)', v_status;
  end if;

  update public.receipts set status = 'cancelled' where id = p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'receipt.cancel', 'receipt', p_id,
          jsonb_build_object('status', v_status), jsonb_build_object('status', 'cancelled'));
end;
$$;
