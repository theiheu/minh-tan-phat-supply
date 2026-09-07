-- 0054_receipt_invoice_images.sql — Hỗ trợ tải ảnh hóa đơn / chứng từ mua hàng cho phiếu nhập kho

-- 1. Tạo storage bucket receipt-images
insert into storage.buckets (id, name, public)
values ('receipt-images', 'receipt-images', true)
on conflict (id) do nothing;

drop policy if exists "receipt_images_public_read" on storage.objects;
create policy "receipt_images_public_read"
  on storage.objects for select
  using (bucket_id = 'receipt-images');

drop policy if exists "receipt_images_auth_write" on storage.objects;
create policy "receipt_images_auth_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'receipt-images');

-- 2. Thêm cột invoice_images vào bảng receipts
alter table public.receipts
  add column if not exists invoice_images text[] not null default '{}';

-- 3. Cập nhật RPC create_receipt
drop function if exists public.create_receipt(p_items jsonb, p_supplier_id uuid, p_by uuid);
drop function if exists public.create_receipt(p_items jsonb, p_supplier_id uuid, p_by uuid, p_notes text);
drop function if exists public.create_receipt(p_items jsonb, p_supplier_id uuid, p_by uuid, p_notes text, p_invoice_images text[]);

create or replace function public.create_receipt(
  p_items jsonb,
  p_supplier_id uuid,
  p_by uuid,
  p_notes text default null,
  p_invoice_images text[] default '{}'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  it record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được tạo phiếu nhập'; end if;
  insert into public.receipts (code, supplier_id, notes, created_by, invoice_images)
  values (public.next_code('GRN', 'public.receipts_seq'::regclass), p_supplier_id, p_notes, p_by, coalesce(p_invoice_images, '{}'))
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

-- 4. Cập nhật RPC update_receipt
drop function if exists public.update_receipt(p_id uuid, p_items jsonb, p_supplier_id uuid, p_by uuid, p_notes text);
drop function if exists public.update_receipt(p_id uuid, p_items jsonb, p_supplier_id uuid, p_by uuid, p_notes text, p_invoice_images text[]);

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

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'receipt.update', 'receipt', p_id,
          jsonb_build_object('status', v_status), jsonb_build_object('status', v_status, 'action', 'update'));
end;
$$;
