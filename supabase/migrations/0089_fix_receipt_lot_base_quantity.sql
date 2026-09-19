-- WP-05: Sửa receipt allocation theo Base UOM cho lot tracking

CREATE OR REPLACE FUNCTION public.post_receipt(p_id uuid, p_by uuid) RETURNS uuid[]
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_status public.receipt_status;
  v_main uuid;
  it record;
  r record;
  v_linked uuid[] := '{}';
  v_command jsonb := '{}'::jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_factor numeric;
  v_base_qty numeric;
  v_issue_entered numeric;
  v_issue_tu uuid;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được ghi nhận nhập kho'; end if;
  select id into v_main from public.stock_locations where code = 'KHO_CHINH';

  select status into v_status from public.receipts where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu nhập'; end if;
  if v_status not in ('draft', 'approved') then
    raise exception 'Phiếu không ở trạng thái hợp lệ để nhập kho (hiện tại: %)', v_status;
  end if;

  for it in select * from public.receipt_items where receipt_id = p_id order by sku_id loop
    -- Resolve factor snapshot and base quantity cho allocations (WP-05 3,4)
    v_factor := coalesce(
      it.conversion_factor_snapshot, 
      (select factor_to_base from public.sku_transaction_units tu where tu.id = it.transaction_unit_id limit 1), 
      1
    );

    if it.entered_quantity is not null then
      v_base_qty := public._posting_round_base(it.entered_quantity * v_factor, 6::smallint);
      v_issue_entered := it.entered_quantity;
      v_issue_tu := it.transaction_unit_id;
    else
      -- Legacy fallback (chứng từ đã lưu base UOM ở quantity)
      v_base_qty := it.quantity;
      v_issue_entered := it.quantity;
      v_issue_tu := null; -- Phải set null để kernel không nhân đôi factor
    end if;

    -- Cần dùng explicitly calculated base_quantity thay vì dùng entered_quantity cho allocation.
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'sku_id', it.sku_id,
        'to_location_id', v_main,
        'entered_quantity', v_issue_entered,
        'transaction_unit_id', v_issue_tu,
        'unit_cost', it.unit_cost,
        'allocations', case when nullif(btrim(it.batch_no), '') is not null then jsonb_build_array(
            jsonb_build_object(
               'lot_number', it.batch_no,
               'expiry_date', it.expiry_date,
               'quantity', v_base_qty
            )
        ) else '[]'::jsonb end
      )
    );
  end loop;

  v_command := jsonb_build_object(
    'document_id', p_id,
    'idempotency_key', 'receipt-' || p_id::text,
    'lines', v_lines
  );

  perform public.post_receipt_command(v_command);
  
  -- Record snapshots natively to receipt_items to adhere to legacy fallback
  update public.receipt_items 
    set snapshot_quality = 'complete',
        conversion_factor_snapshot = coalesce(conversion_factor_snapshot, (select factor_to_base from public.sku_transaction_units tu where tu.id = transaction_unit_id limit 1), 1)
  where receipt_id = p_id;

  for r in select id from public.requisitions
           where status = 'approved'
           order by created_at asc, id asc loop
    begin
      perform public.fulfill_requisition(r.id, p_by, 'Tự động cấp phát từ phiếu nhập');
      v_linked := array_append(v_linked, r.id);
    exception when integrity_constraint_violation then
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
