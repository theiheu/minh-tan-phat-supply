-- 0052_update_receipt_rpc.sql — Cập nhật / kiểm đếm phiếu nhập nháp (draft / đang đặt hàng)
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
  if v_status <> 'draft' then raise exception 'Chỉ được sửa phiếu nhập ở trạng thái nháp / chờ hàng (hiện tại: %)', v_status; end if;

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
          jsonb_build_object('status', 'draft'), jsonb_build_object('status', 'draft', 'action', 'update'));
end;
$$;
