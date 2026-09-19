-- 0098_sync_requisition_and_receipt_invoice_images.sql
-- Đồng bộ hóa đơn 2 chiều giữa Phiếu yêu cầu cấp phát và Phiếu nhập/đặt hàng

-- 1. Cập nhật hàm update_requisition_invoice_images
CREATE OR REPLACE FUNCTION public.update_requisition_invoice_images(
  p_id uuid,
  p_invoice_images text[],
  p_by uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_status public.requisition_status;
  v_requester uuid;
  v_old_images text[];
  v_removed_img text;
  v_rec_id uuid;
begin
  if auth.uid() is null and p_by is null then raise exception 'Chưa đăng nhập'; end if;

  select status, requester_id, coalesce(invoice_images, '{}')
  into v_status, v_requester, v_old_images
  from public.requisitions
  where id = p_id
  for update;

  if v_status is null then raise exception 'Không tìm thấy phiếu yêu cầu'; end if;

  -- Chỉ người yêu cầu hoặc quản trị/quản kho được cập nhật hóa đơn
  if v_requester is distinct from coalesce(auth.uid(), p_by) and not public.is_manager() then
    raise exception 'Chỉ người yêu cầu hoặc quản lý kho mới được tải lên/cập nhật hóa đơn';
  end if;

  -- Kiểm tra quyền xóa ảnh
  if not public._posting_actor_has_role(coalesce(auth.uid(), p_by), array['superuser']) then
    foreach v_removed_img in array v_old_images loop
      if not (v_removed_img = any(coalesce(p_invoice_images, '{}'))) then
        if not (
          v_removed_img like '%/' || coalesce(auth.uid(), p_by)::text || '/%'
          or (
            not (v_removed_img ~* '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/')
            and v_requester = coalesce(auth.uid(), p_by)
          )
        ) then
          raise exception 'Bạn chỉ có thể xóa ảnh do chính mình tải lên';
        end if;
      end if;
    end loop;
  end if;

  update public.requisitions
  set invoice_images = coalesce(p_invoice_images, '{}'),
      updated_at = now()
  where id = p_id;

  -- Đồng bộ 2 chiều: chuyển ảnh hóa đơn sang TẤT CẢ phiếu nhập liên quan (mọi trạng thái)
  for v_rec_id in
    select id from public.receipts
    where p_id = any(linked_requisition_ids)
  loop
    update public.receipts
    set invoice_images = array(
      select distinct img
      from unnest(coalesce(invoice_images, '{}'::text[]) || coalesce(p_invoice_images, '{}'::text[])) as img
      where nullif(trim(img), '') is not null
    ),
    updated_at = now()
    where id = v_rec_id;
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (
    p_by,
    'requisition.upload_invoice',
    'requisition',
    p_id,
    jsonb_build_object('status', v_status, 'invoice_images', v_old_images),
    jsonb_build_object(
      'status', v_status,
      'invoice_images', p_invoice_images,
      'count', coalesce(array_length(p_invoice_images, 1), 0)
    )
  );
end;
$$;

GRANT ALL ON FUNCTION public.update_requisition_invoice_images(uuid, text[], uuid) TO anon;
GRANT ALL ON FUNCTION public.update_requisition_invoice_images(uuid, text[], uuid) TO authenticated;
GRANT ALL ON FUNCTION public.update_requisition_invoice_images(uuid, text[], uuid) TO service_role;

-- 2. Cập nhật hàm update_receipt_invoice_images
CREATE OR REPLACE FUNCTION public.update_receipt_invoice_images(
  p_id uuid,
  p_invoice_images text[],
  p_by uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_status public.receipt_status;
  v_creator uuid;
  v_old_images text[];
  v_removed_img text;
  v_req_id uuid;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được sửa ảnh hóa đơn'; end if;

  select status, created_by, coalesce(invoice_images, '{}')
  into v_status, v_creator, v_old_images
  from public.receipts
  where id = p_id
  for update;

  if v_status is null then raise exception 'Không tìm thấy phiếu nhập'; end if;

  if not public._posting_actor_has_role(coalesce(auth.uid(), p_by), array['superuser']) then
    foreach v_removed_img in array v_old_images loop
      if not (v_removed_img = any(coalesce(p_invoice_images, '{}'))) then
        if not (
          v_removed_img like '%/' || coalesce(auth.uid(), p_by)::text || '/%'
          or (
            not (v_removed_img ~* '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/')
            and v_creator = coalesce(auth.uid(), p_by)
          )
        ) then
          raise exception 'Bạn chỉ có thể xóa ảnh do chính mình tải lên';
        end if;
      end if;
    end loop;
  end if;

  update public.receipts
  set invoice_images = coalesce(p_invoice_images, '{}'),
      updated_at = now()
  where id = p_id;

  -- Đồng bộ sang các phiếu yêu cầu liên kết nếu có
  for v_req_id in
    select unnest(linked_requisition_ids) from public.receipts where id = p_id
  loop
    update public.requisitions
    set invoice_images = array(
      select distinct img
      from unnest(coalesce(invoice_images, '{}'::text[]) || coalesce(p_invoice_images, '{}'::text[])) as img
      where nullif(trim(img), '') is not null
    ),
    updated_at = now()
    where id = v_req_id;
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (
    p_by,
    'receipt.update_invoices',
    'receipt',
    p_id,
    jsonb_build_object('status', v_status, 'invoice_images', v_old_images),
    jsonb_build_object('status', v_status, 'invoice_images', p_invoice_images)
  );
end;
$$;

GRANT ALL ON FUNCTION public.update_receipt_invoice_images(uuid, text[], uuid) TO anon;
GRANT ALL ON FUNCTION public.update_receipt_invoice_images(uuid, text[], uuid) TO authenticated;
GRANT ALL ON FUNCTION public.update_receipt_invoice_images(uuid, text[], uuid) TO service_role;

-- 3. Cập nhật hàm create_receipt tự động nhận hóa đơn từ các phiếu yêu cầu liên kết
DROP FUNCTION IF EXISTS public.create_receipt(jsonb, uuid, uuid, text, text[], uuid[]);

CREATE OR REPLACE FUNCTION public.create_receipt(
  p_items jsonb,
  p_supplier_id uuid,
  p_by uuid,
  p_notes text DEFAULT NULL::text,
  p_invoice_images text[] DEFAULT '{}'::text[],
  p_linked_requisition_ids uuid[] DEFAULT '{}'::uuid[]
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_id uuid;
  v_code text;
  it record;
  req_id uuid;
  v_supplier_name text;
  v_req_invoices text[];
  v_final_invoices text[];
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được tạo phiếu nhập'; end if;
  v_code := public.next_code('GRN', 'public.receipts_seq'::regclass);

  -- Thu thập ảnh hóa đơn đã có từ các phiếu yêu cầu liên kết
  if p_linked_requisition_ids is not null and array_length(p_linked_requisition_ids, 1) > 0 then
    select coalesce(array_agg(distinct img), '{}'::text[]) into v_req_invoices
    from (
      select unnest(coalesce(invoice_images, '{}'::text[])) as img
      from public.requisitions
      where id = any(p_linked_requisition_ids)
    ) sub;
  else
    v_req_invoices := '{}'::text[];
  end if;

  v_final_invoices := array(
    select distinct img
    from unnest(coalesce(p_invoice_images, '{}'::text[]) || coalesce(v_req_invoices, '{}'::text[])) as img
    where nullif(trim(img), '') is not null
  );

  insert into public.receipts (code, supplier_id, notes, created_by, invoice_images, linked_requisition_ids)
  values (v_code, p_supplier_id, p_notes, p_by, coalesce(v_final_invoices, '{}'), coalesce(p_linked_requisition_ids, '{}'))
  returning id into v_id;

  for it in select value from jsonb_array_elements(p_items) loop
    insert into public.receipt_items (receipt_id, sku_id, quantity, unit_cost, batch_no, expiry_date, transaction_unit_id, entered_quantity)
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
    update public.receipt_items ri
    set quantity = round((it.value->>'entered_quantity')::numeric * coalesce((select factor_to_base from public.sku_transaction_units tu where tu.id = nullif(it.value->>'transaction_unit_id','')::uuid limit 1), 1))
    where ri.receipt_id = v_id and ri.sku_id = (it.value->>'sku_id')::uuid;
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'receipt.create', 'receipt', v_id, jsonb_build_object('status','draft', 'linked_requisition_ids', p_linked_requisition_ids, 'invoice_images', v_final_invoices));

  -- Lấy tên nhà cung cấp nếu có
  if p_supplier_id is not null then
    select name into v_supplier_name from public.suppliers where id = p_supplier_id;
  end if;

  -- Ghi nhận mốc Đã đặt hàng vào audit log của từng phiếu yêu cầu liên kết & đồng bộ ảnh
  if p_linked_requisition_ids is not null and array_length(p_linked_requisition_ids, 1) > 0 then
    foreach req_id in array p_linked_requisition_ids loop
      if array_length(v_final_invoices, 1) > 0 then
        update public.requisitions
        set invoice_images = array(
          select distinct img
          from unnest(coalesce(invoice_images, '{}'::text[]) || v_final_invoices) as img
          where nullif(trim(img), '') is not null
        ),
        updated_at = now()
        where id = req_id;
      end if;

      insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
      values (
        p_by,
        'requisition.order',
        'requisition',
        req_id,
        jsonb_build_object(
          'receipt_id', v_id,
          'receipt_code', v_code,
          'supplier_id', p_supplier_id,
          'supplier_name', v_supplier_name,
          'notes', p_notes
        )
      );
    end loop;
  end if;

  return v_id;
end;
$$;

GRANT ALL ON FUNCTION public.create_receipt(jsonb, uuid, uuid, text, text[], uuid[]) TO anon;
GRANT ALL ON FUNCTION public.create_receipt(jsonb, uuid, uuid, text, text[], uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.create_receipt(jsonb, uuid, uuid, text, text[], uuid[]) TO service_role;

-- 4. Cập nhật post_receipt đồng bộ hóa đơn từ các phiếu yêu cầu vào phiếu nhập
DROP FUNCTION IF EXISTS public.post_receipt(uuid, uuid);

CREATE OR REPLACE FUNCTION public.post_receipt(p_id uuid, p_by uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_status public.receipt_status;
  v_main uuid;
  it record;
  r record;
  v_linked uuid[] := '{}';
  v_skipped jsonb := '[]'::jsonb;
  v_outcome jsonb;
  v_command jsonb := '{}'::jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_factor numeric;
  v_base_qty numeric;
  v_issue_entered numeric;
  v_issue_tu uuid;
  v_initial_linked uuid[];
  v_all_linked uuid[];
  v_req_invoices text[];
  v_final_invoices text[];
  v_req_id uuid;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được ghi nhận nhập kho'; end if;
  select id into v_main from public.stock_locations where code = 'KHO_CHINH';

  select status, coalesce(linked_requisition_ids, '{}')
  into v_status, v_initial_linked
  from public.receipts
  where id = p_id
  for update;

  if v_status is null then raise exception 'Không tìm thấy phiếu nhập'; end if;
  if v_status not in ('draft', 'approved') then
    raise exception 'Phiếu không ở trạng thái hợp lệ để nhập kho (hiện tại: %)', v_status;
  end if;

  for it in select * from public.receipt_items where receipt_id = p_id order by sku_id loop
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
      v_base_qty := it.quantity;
      v_issue_entered := it.quantity;
      v_issue_tu := null;
    end if;

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
    exception
      when raise_exception then
        v_skipped := v_skipped || jsonb_build_object('id', r.id, 'reason', SQLERRM, 'type', 'business_rejection');
      when others then
        raise exception 'Lỗi hệ thống bất ngờ khi tự động cấp phát phiếu yêu cầu %: %', r.id, SQLERRM;
    end;
  end loop;

  -- Gộp toàn bộ danh sách phiếu yêu cầu liên quan (từ trước và được auto cấp phát)
  v_all_linked := array(
    select distinct id from unnest(coalesce(v_initial_linked, '{}'::uuid[]) || v_linked) as id
  );

  -- Thu thập ảnh hóa đơn từ tất cả các phiếu yêu cầu liên quan
  if array_length(v_all_linked, 1) > 0 then
    select coalesce(array_agg(distinct img), '{}'::text[]) into v_req_invoices
    from (
      select unnest(coalesce(invoice_images, '{}'::text[])) as img
      from public.requisitions
      where id = any(v_all_linked)
    ) sub;
  else
    v_req_invoices := '{}'::text[];
  end if;

  select array(
    select distinct img
    from unnest(coalesce(invoice_images, '{}'::text[]) || coalesce(v_req_invoices, '{}'::text[])) as img
    where nullif(trim(img), '') is not null
  ) into v_final_invoices
  from public.receipts
  where id = p_id;

  update public.receipts
  set status = 'posted',
      linked_requisition_ids = v_all_linked,
      invoice_images = coalesce(v_final_invoices, invoice_images),
      updated_at = now()
  where id = p_id;

  -- Đồng bộ ngược lại cho các phiếu yêu cầu nếu có
  if array_length(v_final_invoices, 1) > 0 and array_length(v_all_linked, 1) > 0 then
    foreach v_req_id in array v_all_linked loop
      update public.requisitions
      set invoice_images = array(
        select distinct img
        from unnest(coalesce(invoice_images, '{}'::text[]) || v_final_invoices) as img
        where nullif(trim(img), '') is not null
      ),
      updated_at = now()
      where id = v_req_id;
    end loop;
  end if;

  v_outcome := jsonb_build_object(
    'linked', coalesce(to_jsonb(v_all_linked), '[]'::jsonb),
    'skipped', v_skipped,
    'failed', '[]'::jsonb
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'receipt.post', 'receipt', p_id,
          jsonb_build_object('status', v_status), jsonb_build_object('status', 'posted', 'outcome', v_outcome, 'invoice_images', v_final_invoices));

  return v_outcome;
end;
$$;

GRANT ALL ON FUNCTION public.post_receipt(uuid, uuid) TO anon;
GRANT ALL ON FUNCTION public.post_receipt(uuid, uuid) TO authenticated;
GRANT ALL ON FUNCTION public.post_receipt(uuid, uuid) TO service_role;

-- 5. Cập nhật complete_requisition_direct đồng bộ hóa đơn tuyệt đối sang phiếu nhập
CREATE OR REPLACE FUNCTION public.complete_requisition_direct(
  p_id uuid,
  p_by uuid,
  p_notes text DEFAULT ''::text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_status public.requisition_status;
  v_req record;
  v_receipt record;
  v_invoice_images text[];
begin
  if not public.can_post_inventory() then
    raise exception 'Chỉ quản lý kho mới được duyệt hoàn tất phiếu yêu cầu qua hóa đơn';
  end if;

  select * into v_req
  from public.requisitions
  where id = p_id
  for update;

  if v_req.id is null then
    raise exception 'Không tìm thấy phiếu yêu cầu';
  end if;

  if v_req.status in ('received', 'cancelled', 'rejected') then
    raise exception 'Phiếu yêu cầu đã ở trạng thái % không thể duyệt tiếp', v_req.status;
  end if;

  v_invoice_images := coalesce(v_req.invoice_images, '{}');

  -- Đồng bộ ảnh hóa đơn sang tất cả phiếu nhập liên quan và post phiếu nhập
  for v_receipt in
    select * from public.receipts
    where p_id = any(linked_requisition_ids)
    order by created_at desc
  loop
    -- Luôn đồng bộ ảnh hóa đơn vào phiếu nhập
    update public.receipts
    set invoice_images = array(
      select distinct img
      from unnest(coalesce(invoice_images, '{}'::text[]) || v_invoice_images) as img
      where nullif(trim(img), '') is not null
    ),
    updated_at = now()
    where id = v_receipt.id;

    if v_receipt.status in ('draft', 'approved') then
      perform public.post_receipt(v_receipt.id, p_by);
    end if;
  end loop;

  -- Kiểm tra lại trạng thái phiếu yêu cầu sau khi post_receipt
  select status into v_status from public.requisitions where id = p_id for update;

  if v_status in ('pending', 'draft') then
    perform public.approve_requisition(p_id, p_by);
    select status into v_status from public.requisitions where id = p_id for update;
  end if;

  if v_status = 'approved' then
    perform public.fulfill_requisition(p_id, p_by, coalesce(nullif(p_notes, ''), 'Cấp phát trực tiếp qua hóa đơn NCC'));
    select status into v_status from public.requisitions where id = p_id for update;
  end if;

  if v_status = 'issued' then
    update public.requisitions
    set status = 'received',
        received_by = coalesce(v_req.requester_id, p_by),
        received_at = now(),
        updated_at = now()
    where id = p_id;

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
    values (
      p_by,
      'requisition.direct_complete',
      'requisition',
      p_id,
      jsonb_build_object('status', 'issued'),
      jsonb_build_object(
        'status', 'received',
        'direct_pickup', true,
        'invoice_count', cardinality(v_invoice_images),
        'notes', p_notes
      )
    );
  end if;
end;
$$;

GRANT ALL ON FUNCTION public.complete_requisition_direct(uuid, uuid, text) TO anon;
GRANT ALL ON FUNCTION public.complete_requisition_direct(uuid, uuid, text) TO authenticated;
GRANT ALL ON FUNCTION public.complete_requisition_direct(uuid, uuid, text) TO service_role;
