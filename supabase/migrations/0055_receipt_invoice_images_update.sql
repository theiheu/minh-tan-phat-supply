-- 0055_receipt_invoice_images_update.sql — Cho phép bổ sung/cập nhật ảnh hóa đơn ngay cả sau khi đã nhập kho (posted)
create or replace function public.update_receipt_invoice_images(
  p_id uuid,
  p_invoice_images text[],
  p_by uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.receipt_status;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý được cập nhật ảnh hóa đơn'; end if;

  select status into v_status from public.receipts where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu nhập kho'; end if;

  update public.receipts
  set invoice_images = coalesce(p_invoice_images, '{}'),
      updated_at = now()
  where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'receipt.update_invoices', 'receipt', p_id,
          jsonb_build_object('status', v_status), jsonb_build_object('status', v_status, 'invoice_images', p_invoice_images));
end;
$$;
