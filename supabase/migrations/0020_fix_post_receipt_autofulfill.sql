-- 0020_fix_post_receipt_autofulfill.sql
-- Sửa: auto cấp phát phải xử lý cả requisition `pending` (tự duyệt khi đủ tồn),
-- không chỉ `approved`. (mục 15.3)
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
  if v_status <> 'draft' then raise exception 'Phiếu nhập không ở trạng thái nháp (hiện tại: %)', v_status; end if;

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
          jsonb_build_object('status','draft'), jsonb_build_object('status','posted','linked', v_linked));

  return v_linked;
end;
$$;
