-- 0048_repair_request.sql — đề nghị gửi đi sửa từ người lập HONG
alter table public.defect_notes
  add column repair_requested_by uuid references public.profiles(id),
  add column repair_requested_at timestamptz;

-- Người lập HONG (hoặc manager) đề nghị đưa đồ hỏng đi sửa
create or replace function public.request_repair(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.defect_status;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select status into v_status from public.defect_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu hỏng'; end if;
  if v_status <> 'staging' then raise exception 'Chỉ phiếu đang tập kết mới đề nghị sửa (hiện tại: %)', v_status; end if;
  if not (public.is_manager() or exists (select 1 from public.defect_notes d where d.id=p_id and d.reported_by=p_by)) then
    raise exception 'Bạn không có quyền đề nghị cho phiếu này';
  end if;
  if exists (select 1 from public.defect_notes d where d.id=p_id and d.repair_requested_at is not null) then
    raise exception 'Phiếu này đã được đề nghị sửa';
  end if;
  if exists (select 1 from public.exchange_notes en
             where en.linked_defect_id=p_id and en.status in ('pending','approved','issued','received')) then
    raise exception 'Phiếu này đang có phiếu Đổi Mới — không đề nghị sửa được';
  end if;
  update public.defect_notes set repair_requested_by=p_by, repair_requested_at=now() where id=p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'defect.repair_request', 'defect', p_id, jsonb_build_object('status','staging','requested',true));
end;
$$;

-- Huỷ đề nghị sửa (khi HONG còn staging)
create or replace function public.cancel_repair_request(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.defect_status;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select status into v_status from public.defect_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu hỏng'; end if;
  if v_status <> 'staging' then raise exception 'Chỉ huỷ đề nghị khi phiếu còn tập kết'; end if;
  if not (public.is_manager() or exists (select 1 from public.defect_notes d where d.id=p_id and d.reported_by=p_by)) then
    raise exception 'Bạn không có quyền huỷ đề nghị này';
  end if;
  update public.defect_notes set repair_requested_by=null, repair_requested_at=null where id=p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'defect.repair_request_cancel', 'defect', p_id, jsonb_build_object('requested',false));
end;
$$;

-- send_to_repair — bản mới: sau khi tạo phiếu sửa + chuyển stock + in_repair, xoá cờ đề nghị
create or replace function public.send_to_repair(
  p_defect_item_ids uuid[], p_vendor text, p_sent_at date, p_expected_return_at date, p_by uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_repair_id uuid;
  v_hong uuid;
  v_sua uuid;
  it record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được tạo phiếu sửa'; end if;
  if p_vendor is null or length(trim(p_vendor)) = 0 then raise exception 'Đơn vị sửa chữa không được trống'; end if;
  select id into v_hong from public.stock_locations where code = 'KHO_HONG';
  select id into v_sua from public.stock_locations where code = 'KHO_DANG_SUA';

  insert into public.repair_orders (code, vendor, sent_at, expected_return_at, created_by)
  values (public.next_code('SC', 'public.repair_orders_seq'::regclass), p_vendor, p_sent_at, p_expected_return_at, p_by)
  returning id into v_repair_id;

  for it in select dni.* from public.defect_note_items dni
            where dni.id = any(p_defect_item_ids)
            order by dni.id loop
    insert into public.repair_order_items (repair_order_id, defect_item_id, variant_id, quantity)
    values (v_repair_id, it.id, it.variant_id, it.quantity);

    perform public._move_stock(it.variant_id, v_hong, v_sua, it.quantity, 'repair_out', 'repair', v_repair_id, p_by);
  end loop;

  update public.defect_notes set status = 'in_repair'
  where id in (select distinct defect_note_id from public.defect_note_items where id = any(p_defect_item_ids))
    and status = 'staging';

  -- Xoá cờ đề nghị sửa cho các HONG vừa chính thức vào sửa (không để cờ mồ côi)
  update public.defect_notes set repair_requested_by = null, repair_requested_at = null
  where id in (select distinct defect_note_id from public.defect_note_items where id = any(p_defect_item_ids));

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'repair.create', 'repair', v_repair_id, jsonb_build_object('status','in_repair'));
  return v_repair_id;
end;
$$;
