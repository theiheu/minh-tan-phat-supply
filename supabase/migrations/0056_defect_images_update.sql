-- 0056_defect_images_update.sql — Cho phép bổ sung/cập nhật ảnh vật tư hỏng sau khi lập phiếu
create or replace function public.update_defect_item_images(
  p_item_id uuid,
  p_images text[],
  p_by uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_note_id uuid;
  v_status public.defect_status;
  v_reporter uuid;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;

  select dni.defect_note_id, dn.status, dn.reported_by
  into v_note_id, v_status, v_reporter
  from public.defect_note_items dni
  join public.defect_notes dn on dn.id = dni.defect_note_id
  where dni.id = p_item_id
  for update of dn;

  if v_note_id is null then raise exception 'Không tìm thấy dòng vật tư hỏng'; end if;
  if not public.is_manager() and v_reporter is distinct from p_by then
    raise exception 'Chỉ người báo hỏng hoặc quản lý mới được cập nhật ảnh';
  end if;

  update public.defect_note_items
  set images = coalesce(p_images, '{}')
  where id = p_item_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'defect.update_images', 'defect', v_note_id,
          jsonb_build_object('item_id', p_item_id, 'images', p_images));
end;
$$;
