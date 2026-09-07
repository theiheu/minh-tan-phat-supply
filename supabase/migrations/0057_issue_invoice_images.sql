-- 0057_issue_invoice_images.sql — Hỗ trợ tải ảnh hóa đơn / chứng từ cho phiếu xuất kho
-- (giống 0054/0055 cho phiếu nhập: cột invoice_images + bucket riêng + RPC cập nhật bất kỳ lúc nào)

-- 1. Tạo storage bucket issue-images
insert into storage.buckets (id, name, public)
values ('issue-images', 'issue-images', true)
on conflict (id) do nothing;

drop policy if exists "issue_images_public_read" on storage.objects;
create policy "issue_images_public_read"
  on storage.objects for select
  using (bucket_id = 'issue-images');

drop policy if exists "issue_images_auth_write" on storage.objects;
create policy "issue_images_auth_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'issue-images');

-- 2. Thêm cột invoice_images vào bảng issues
alter table public.issues
  add column if not exists invoice_images text[] not null default '{}';

-- 3. RPC bổ sung/cập nhật ảnh hóa đơn của phiếu xuất (hoạt động kể cả sau khi đã xuất kho)
create or replace function public.update_issue_invoice_images(
  p_id uuid,
  p_invoice_images text[],
  p_by uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý được cập nhật ảnh hóa đơn'; end if;

  select status into v_status from public.issues where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu xuất kho'; end if;

  update public.issues
  set invoice_images = coalesce(p_invoice_images, '{}'),
      updated_at = now()
  where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'issue.update_invoices', 'issue', p_id,
          jsonb_build_object('status', v_status), jsonb_build_object('status', v_status, 'invoice_images', p_invoice_images));
end;
$$;
