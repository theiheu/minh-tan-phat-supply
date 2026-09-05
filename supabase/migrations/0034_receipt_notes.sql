-- 0034_receipt_notes.sql — phiếu nhập hỗ trợ ghi chú (cột receipts.notes đã có từ 0010).
-- create_receipt nhận thêm p_notes (default null) → lưu vào receipts.notes.
-- Idempotent (create or replace) nên an toàn chạy lại khi reset DB.
create or replace function public.create_receipt(
  p_items jsonb,
  p_supplier_id uuid,
  p_by uuid,
  p_notes text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  it record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được tạo phiếu nhập'; end if;
  insert into public.receipts (code, supplier_id, notes, created_by)
  values (public.next_code('GRN', 'public.receipts_seq'::regclass), p_supplier_id, p_notes, p_by)
  returning id into v_id;

  for it in select value from jsonb_array_elements(p_items) loop
    insert into public.receipt_items (receipt_id, variant_id, quantity, unit_cost, batch_no, expiry_date)
    values (
      v_id,
      (it.value->>'variant_id')::uuid,
      (it.value->>'quantity')::int,
      nullif(it.value->>'unit_cost','')::numeric,
      nullif(it.value->>'batch_no',''),
      nullif(it.value->>'expiry_date','')::date
    );
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'receipt.create', 'receipt', v_id, jsonb_build_object('status','draft'));
  return v_id;
end;
$$;
