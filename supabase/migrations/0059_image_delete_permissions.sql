-- 0059_image_delete_permissions.sql — Phân quyền xoá ảnh hoá đơn và chứng từ:
-- Chỉ được quyền xoá ảnh do chính tài khoản mình tải lên.
-- Không được xoá ảnh do người khác tải lên.
-- Tài khoản dev (superuser) có toàn quyền sửa, xoá mọi thứ.

-- 1. update_receipt_invoice_images
create or replace function public.update_receipt_invoice_images(
  p_id uuid,
  p_invoice_images text[],
  p_by uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.receipt_status;
  v_created_by uuid;
  v_old_images text[];
  v_removed_img text;
  v_is_dev boolean;
  v_is_mgr boolean;
begin
  if auth.uid() is null and p_by is null then raise exception 'Chưa đăng nhập'; end if;
  if p_by is null then p_by := auth.uid(); end if;

  v_is_dev := public.is_superuser();
  v_is_mgr := public.is_manager();

  if not v_is_mgr and not v_is_dev then
    raise exception 'Chỉ quản lý hoặc dev mới được cập nhật ảnh hóa đơn';
  end if;

  select status, created_by, coalesce(invoice_images, '{}')
  into v_status, v_created_by, v_old_images
  from public.receipts where id = p_id for update;

  if v_status is null then raise exception 'Không tìm thấy phiếu nhập kho'; end if;

  -- Kiểm tra quyền xoá đối với từng ảnh bị gỡ
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
  set invoice_images = coalesce(p_invoice_images, '{}'),
      updated_at = now()
  where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'receipt.update_invoices', 'receipt', p_id,
          jsonb_build_object('status', v_status, 'invoice_images', v_old_images),
          jsonb_build_object('status', v_status, 'invoice_images', p_invoice_images));
end;
$$;

-- 2. update_issue_invoice_images
create or replace function public.update_issue_invoice_images(
  p_id uuid,
  p_invoice_images text[],
  p_by uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_created_by uuid;
  v_old_images text[];
  v_removed_img text;
  v_is_dev boolean;
  v_is_mgr boolean;
begin
  if auth.uid() is null and p_by is null then raise exception 'Chưa đăng nhập'; end if;
  if p_by is null then p_by := auth.uid(); end if;

  v_is_dev := public.is_superuser();
  v_is_mgr := public.is_manager();

  if not v_is_mgr and not v_is_dev then
    raise exception 'Chỉ quản lý hoặc dev mới được cập nhật ảnh hóa đơn';
  end if;

  select status, creator_id, coalesce(invoice_images, '{}')
  into v_status, v_created_by, v_old_images
  from public.issues where id = p_id for update;

  if v_status is null then raise exception 'Không tìm thấy phiếu xuất kho'; end if;

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

  update public.issues
  set invoice_images = coalesce(p_invoice_images, '{}'),
      updated_at = now()
  where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'issue.update_invoices', 'issue', p_id,
          jsonb_build_object('status', v_status, 'invoice_images', v_old_images),
          jsonb_build_object('status', v_status, 'invoice_images', p_invoice_images));
end;
$$;

-- 3. update_receipt
create or replace function public.update_receipt(
  p_id uuid,
  p_items jsonb,
  p_supplier_id uuid,
  p_by uuid,
  p_notes text default null,
  p_invoice_images text[] default '{}'
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.receipt_status;
  v_created_by uuid;
  v_old_images text[];
  v_removed_img text;
  v_is_dev boolean;
  v_is_mgr boolean;
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

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'receipt.update', 'receipt', p_id,
          jsonb_build_object('supplier_id', p_supplier_id, 'items_count', jsonb_array_length(p_items), 'invoice_images', p_invoice_images));
end;
$$;

-- 4. update_defect_item_images
create or replace function public.update_defect_item_images(
  p_item_id uuid,
  p_images text[],
  p_by uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_note_id uuid;
  v_status public.defect_status;
  v_reporter uuid;
  v_old_images text[];
  v_removed_img text;
  v_is_dev boolean;
begin
  if auth.uid() is null and p_by is null then raise exception 'Chưa đăng nhập'; end if;
  if p_by is null then p_by := auth.uid(); end if;

  v_is_dev := public.is_superuser();

  select dni.defect_note_id, dn.status, dn.reported_by, coalesce(dni.images, '{}')
  into v_note_id, v_status, v_reporter, v_old_images
  from public.defect_note_items dni
  join public.defect_notes dn on dn.id = dni.defect_note_id
  where dni.id = p_item_id
  for update of dn;

  if v_note_id is null then raise exception 'Không tìm thấy dòng vật tư hỏng'; end if;
  if not public.is_manager() and v_reporter is distinct from p_by and not v_is_dev then
    raise exception 'Chỉ người báo hỏng hoặc quản lý/dev mới được cập nhật ảnh';
  end if;

  if not v_is_dev then
    foreach v_removed_img in array v_old_images loop
      if not (v_removed_img = any(coalesce(p_images, '{}'))) then
        if not (
          v_removed_img like '%' || p_by::text || '%'
          or (
            p_by = v_reporter
            and not exists (
              select 1 from public.profiles p
              where p.id <> p_by and v_removed_img like '%' || p.id::text || '%'
            )
          )
        ) then
          raise exception 'Bạn chỉ được quyền xoá ảnh do chính mình tải lên. Không được xoá ảnh do người khác tải lên.';
        end if;
      end if;
    end loop;
  end if;

  update public.defect_note_items
  set images = coalesce(p_images, '{}')
  where id = p_item_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'defect.update_images', 'defect', v_note_id,
          jsonb_build_object('item_id', p_item_id, 'images', p_images));
end;
$$;
