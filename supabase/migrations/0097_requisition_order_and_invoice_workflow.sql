-- 0097_requisition_order_and_invoice_workflow.sql
-- Thêm tiến trình đặt hàng, upload hóa đơn nhận hàng trực tiếp và duyệt nhanh cho phiếu yêu cầu

-- 1. Thêm cột invoice_images vào bảng requisitions
ALTER TABLE public.requisitions
  ADD COLUMN IF NOT EXISTS invoice_images text[] DEFAULT '{}'::text[] NOT NULL;

-- 2. Đảm bảo storage bucket requisition-images tồn tại và có RLS policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('requisition-images', 'requisition-images', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access for requisition-images'
  ) THEN
    CREATE POLICY "Public Access for requisition-images" ON storage.objects
      FOR SELECT USING (bucket_id = 'requisition-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can upload to requisition-images'
  ) THEN
    CREATE POLICY "Authenticated users can upload to requisition-images" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (bucket_id = 'requisition-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can update requisition-images'
  ) THEN
    CREATE POLICY "Authenticated users can update requisition-images" ON storage.objects
      FOR UPDATE TO authenticated USING (bucket_id = 'requisition-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can delete from requisition-images'
  ) THEN
    CREATE POLICY "Authenticated users can delete from requisition-images" ON storage.objects
      FOR DELETE TO authenticated USING (bucket_id = 'requisition-images');
  END IF;
END $$;

-- 3. RPC cập nhật ảnh hóa đơn cho phiếu yêu cầu (người yêu cầu hoặc quản kho)
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

  -- Kiểm tra quyền xóa ảnh: superuser toàn quyền, người thường chỉ xóa ảnh do mình tải lên
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

  -- Đồng bộ ảnh hóa đơn sang phiếu nhập/đặt hàng liên quan nếu phiếu nhập chưa có ảnh
  for v_rec_id in
    select id from public.receipts
    where p_id = any(linked_requisition_ids)
      and status in ('draft', 'approved')
  loop
    update public.receipts
    set invoice_images = array_cat(invoice_images, coalesce(p_invoice_images, '{}'))
    where id = v_rec_id and (invoice_images is null or cardinality(invoice_images) = 0);
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

-- 4. Cập nhật create_receipt hỗ trợ linked_requisition_ids & ghi audit log đặt hàng cho phiếu yêu cầu
DROP FUNCTION IF EXISTS public.create_receipt(jsonb, uuid, uuid, text, text[]);
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
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được tạo phiếu nhập'; end if;
  v_code := public.next_code('GRN', 'public.receipts_seq'::regclass);

  insert into public.receipts (code, supplier_id, notes, created_by, invoice_images, linked_requisition_ids)
  values (v_code, p_supplier_id, p_notes, p_by, coalesce(p_invoice_images, '{}'), coalesce(p_linked_requisition_ids, '{}'))
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
    -- Fix quantity for legacy compatibility until Task 13
    update public.receipt_items ri
    set quantity = round((it.value->>'entered_quantity')::numeric * coalesce((select factor_to_base from public.sku_transaction_units tu where tu.id = nullif(it.value->>'transaction_unit_id','')::uuid limit 1), 1))
    where ri.receipt_id = v_id and ri.sku_id = (it.value->>'sku_id')::uuid;
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'receipt.create', 'receipt', v_id, jsonb_build_object('status','draft', 'linked_requisition_ids', p_linked_requisition_ids));

  -- Lấy tên nhà cung cấp nếu có
  if p_supplier_id is not null then
    select name into v_supplier_name from public.suppliers where id = p_supplier_id;
  end if;

  -- Ghi nhận mốc Đã đặt hàng vào audit log của từng phiếu yêu cầu liên kết
  if p_linked_requisition_ids is not null and array_length(p_linked_requisition_ids, 1) > 0 then
    foreach req_id in array p_linked_requisition_ids loop
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

-- 5. Cập nhật update_receipt hỗ trợ linked_requisition_ids
DROP FUNCTION IF EXISTS public.update_receipt(uuid, jsonb, uuid, uuid, text, text[]);
DROP FUNCTION IF EXISTS public.update_receipt(uuid, jsonb, uuid, uuid, text, text[], uuid[]);

CREATE OR REPLACE FUNCTION public.update_receipt(
  p_id uuid,
  p_items jsonb,
  p_supplier_id uuid,
  p_by uuid,
  p_notes text DEFAULT NULL::text,
  p_invoice_images text[] DEFAULT '{}'::text[],
  p_linked_requisition_ids uuid[] DEFAULT NULL::uuid[]
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_status public.receipt_status;
  v_creator uuid;
  v_old_images text[];
  v_removed_img text;
  it record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được sửa phiếu nhập'; end if;

  select status, created_by, coalesce(invoice_images, '{}')
  into v_status, v_creator, v_old_images
  from public.receipts
  where id = p_id
  for update;

  if v_status is null then raise exception 'Không tìm thấy phiếu nhập'; end if;
  if v_status not in ('draft', 'approved') then
    raise exception 'Chỉ phiếu nháp hoặc đã duyệt mới được sửa thông tin (hiện tại: %)', v_status;
  end if;

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
  set supplier_id = p_supplier_id,
      notes = p_notes,
      invoice_images = coalesce(p_invoice_images, invoice_images),
      linked_requisition_ids = coalesce(p_linked_requisition_ids, linked_requisition_ids),
      updated_at = now()
  where id = p_id;

  delete from public.receipt_items where receipt_id = p_id;
  for it in select value from jsonb_array_elements(p_items) loop
    insert into public.receipt_items (receipt_id, sku_id, quantity, unit_cost, batch_no, expiry_date, transaction_unit_id, entered_quantity)
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
    update public.receipt_items ri
    set quantity = round((it.value->>'entered_quantity')::numeric * coalesce((select factor_to_base from public.sku_transaction_units tu where tu.id = nullif(it.value->>'transaction_unit_id','')::uuid limit 1), 1))
    where ri.receipt_id = p_id and ri.sku_id = (it.value->>'sku_id')::uuid;
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'receipt.update', 'receipt', p_id,
          jsonb_build_object('supplier_id', p_supplier_id, 'items_count', jsonb_array_length(p_items), 'invoice_images', p_invoice_images, 'linked_requisition_ids', p_linked_requisition_ids));
end;
$$;

GRANT ALL ON FUNCTION public.update_receipt(uuid, jsonb, uuid, uuid, text, text[], uuid[]) TO anon;
GRANT ALL ON FUNCTION public.update_receipt(uuid, jsonb, uuid, uuid, text, text[], uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.update_receipt(uuid, jsonb, uuid, uuid, text, text[], uuid[]) TO service_role;

-- 6. RPC Duyệt & hoàn tất phiếu yêu cầu trực tiếp qua hóa đơn (Rút ngắn quy trình)
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

  -- Nếu có phiếu nhập/đặt hàng liên quan ở trạng thái draft hoặc approved, đồng bộ hóa đơn và post phiếu nhập
  for v_receipt in
    select * from public.receipts
    where p_id = any(linked_requisition_ids)
      and status in ('draft', 'approved')
    order by created_at desc
  loop
    if (v_receipt.invoice_images is null or cardinality(v_receipt.invoice_images) = 0) and cardinality(v_invoice_images) > 0 then
      update public.receipts set invoice_images = v_invoice_images where id = v_receipt.id;
    end if;
    perform public.post_receipt(v_receipt.id, p_by);
  end loop;

  -- Kiểm tra lại trạng thái phiếu yêu cầu sau khi post_receipt (post_receipt có thể tự động cấp phát nếu phiếu đã approved)
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
