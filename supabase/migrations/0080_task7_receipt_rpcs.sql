-- 0080_task7_receipt_rpcs.sql
-- Replace create, update, and post receipt RPCs to support UOMs and Tracking.
-- This bridges the old signature pattern with the new unified architecture.

CREATE OR REPLACE FUNCTION public.create_receipt(p_items jsonb, p_supplier_id uuid, p_by uuid, p_notes text DEFAULT NULL::text, p_invoice_images text[] DEFAULT '{}'::text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_id uuid;
  it record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được tạo phiếu nhập'; end if;
  insert into public.receipts (code, supplier_id, notes, created_by, invoice_images)
  values (public.next_code('GRN', 'public.receipts_seq'::regclass), p_supplier_id, p_notes, p_by, coalesce(p_invoice_images, '{}'))
  returning id into v_id;

  for it in select value from jsonb_array_elements(p_items) loop
    insert into public.receipt_items (receipt_id, variant_id, quantity, unit_cost, batch_no, expiry_date, transaction_unit_id, entered_quantity)
    values (
      v_id,
      (it.value->>'sku_id')::uuid,
      1,
      nullif(it.value->>'unit_cost','')::numeric,
      (it.value->'allocations'->0->>'lot_number'),
      (it.value->'allocations'->0->>'expiry_date')::date,
      nullif(it.value->>'transaction_unit_id','')::uuid,
      (it.value->>'entered_quantity')::numeric
    );
    -- Fix quantity for legacy compatibility until Task 13
    update public.receipt_items ri 
    set quantity = round((it.value->>'entered_quantity')::numeric * coalesce((select factor_to_base from public.sku_transaction_units tu where tu.id = nullif(it.value->>'transaction_unit_id','')::uuid limit 1), 1))
    where ri.receipt_id = v_id and ri.variant_id = (it.value->>'sku_id')::uuid;
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'receipt.create', 'receipt', v_id, jsonb_build_object('status','draft'));
  return v_id;
end;
$$;

CREATE OR REPLACE FUNCTION public.update_receipt(p_id uuid, p_items jsonb, p_supplier_id uuid, p_by uuid, p_notes text DEFAULT NULL::text, p_invoice_images text[] DEFAULT '{}'::text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_status public.receipt_status;
  v_created_by uuid;
  v_old_images text[];
  v_removed_img text;
  v_is_dev boolean;
  it record;
begin
  if not public.is_manager() and not public.is_superuser() then
    raise exception 'Chỉ quản lý kho hoặc dev mới được sửa phiếu nhập';
  end if;
  
  v_is_dev := public.is_superuser();

  select status, created_by, coalesce(invoice_images, '{}')
  into v_status, v_created_by, v_old_images
  from public.receipts where id = p_id for update;

  if v_status is null then raise exception 'Không tìm thấy phiếu nhập'; end if;
  if v_status not in ('draft', 'approved') and not v_is_dev then
    raise exception 'Chỉ được sửa/kiểm đếm phiếu ở trạng thái chờ duyệt hoặc đã duyệt (hiện tại: %)', v_status;
  end if;

  if not v_is_dev then
    foreach v_removed_img in array v_old_images loop
      if not (v_removed_img = any(coalesce(p_invoice_images, '{}'))) then
        if not (
          v_removed_img like '%' || p_by::text || '%'
          or (
            p_by = v_created_by
            and not exists (
              select 1 from public.profiles p
              where p.id <> p_by and v_removed_img like '%' || p.id::text || '%'
            )
          )
        ) then
          raise exception 'Bạn chỉ được quyền xoá ảnh do chính mình tải lên. Không được xoá ảnh hoá đơn do người khác tải lên.';
        end if;
      end if;
    end loop;
  end if;

  update public.receipts
  set supplier_id = p_supplier_id,
      notes = p_notes,
      invoice_images = coalesce(p_invoice_images, invoice_images),
      updated_at = now()
  where id = p_id;

  delete from public.receipt_items where receipt_id = p_id;

  for it in select value from jsonb_array_elements(p_items) loop
    insert into public.receipt_items (receipt_id, variant_id, quantity, unit_cost, batch_no, expiry_date, transaction_unit_id, entered_quantity)
    values (
      p_id,
      (it.value->>'sku_id')::uuid,
      1,
      nullif(it.value->>'unit_cost','')::numeric,
      (it.value->'allocations'->0->>'lot_number'),
      (it.value->'allocations'->0->>'expiry_date')::date,
      nullif(it.value->>'transaction_unit_id','')::uuid,
      (it.value->>'entered_quantity')::numeric
    );
     -- Fix quantity for legacy compatibility until Task 13
    update public.receipt_items ri 
    set quantity = round((it.value->>'entered_quantity')::numeric * coalesce((select factor_to_base from public.sku_transaction_units tu where tu.id = nullif(it.value->>'transaction_unit_id','')::uuid limit 1), 1))
    where ri.receipt_id = p_id and ri.variant_id = (it.value->>'sku_id')::uuid;
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'receipt.update', 'receipt', p_id,
          jsonb_build_object('supplier_id', p_supplier_id, 'items_count', jsonb_array_length(p_items), 'invoice_images', p_invoice_images));
end;
$$;

-- Finally update post_receipt
CREATE OR REPLACE FUNCTION public.post_receipt(p_id uuid, p_by uuid)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
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
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được ghi nhận nhập kho'; end if;
  select id into v_main from public.stock_locations where code = 'KHO_CHINH';

  select status into v_status from public.receipts where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu nhập'; end if;
  if v_status not in ('draft', 'approved') then
    raise exception 'Phiếu không ở trạng thái hợp lệ để nhập kho (hiện tại: %)', v_status;
  end if;

  for it in select * from public.receipt_items where receipt_id = p_id order by variant_id loop
    -- Construct posting kernel lines
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'sku_id', it.variant_id,
        'to_location_id', v_main,
        'entered_quantity', coalesce(it.entered_quantity, it.quantity),
        'transaction_unit_id', it.transaction_unit_id,
        'unit_cost', it.unit_cost,
        'allocations', case when nullif(btrim(it.batch_no), '') is not null then jsonb_build_array(
            jsonb_build_object(
               'lot_number', it.batch_no,
               'expiry_date', it.expiry_date,
               'quantity', coalesce(it.entered_quantity, it.quantity)
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
        conversion_factor_snapshot = coalesce((select factor_to_base from public.sku_transaction_units tu where tu.id = transaction_unit_id limit 1), 1)
  where receipt_id = p_id;

  for r in select id from public.requisitions
           where status = 'approved'
           order by created_at asc, id asc loop
    begin
      perform public.fulfill_requisition(r.id, p_by, 'Tự động cấp phát từ phiếu nhập');
      v_linked := array_append(v_linked, r.id);
    exception when others then
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
