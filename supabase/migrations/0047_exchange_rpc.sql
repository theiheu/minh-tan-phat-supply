-- 0047_exchange_rpc.sql — nghiệp vụ phiếu Đổi Mới (manager xử lý trọn gói)
-- Bám sát style 0017_rpc.sql: security definer, is_manager() guard,
-- SELECT ... FOR UPDATE, order-by-variant_id chống deadlock,
-- next_code('DM','public.exchange_notes_seq'), audit_logs đầy đủ.
alter type public.movement_type add value if not exists 'exchange_out';

-- Tạo phiếu Đổi Mới từ phiếu HONG staging (owner hoặc manager)
create or replace function public.create_exchange(p_defect_id uuid, p_by uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if not exists (
    select 1 from public.defect_notes d
    where d.id = p_defect_id and d.status = 'staging'
      and (d.reported_by = p_by or public.is_manager())
  ) then
    raise exception 'Phiếu hỏng không tồn tại, không ở trạng thái tập kết, hoặc bạn không có quyền';
  end if;
  if exists (select 1 from public.defect_notes d
             where d.id = p_defect_id and d.repair_requested_at is not null) then
    raise exception 'Phiếu hỏng đang chờ xác nhận sửa — không tạo phiếu Đổi Mới được';
  end if;
  -- Mỗi dòng HONG phải đủ chứng cứ (mô tả + ≥1 ảnh)
  if exists (
    select 1 from public.defect_note_items dni
    where dni.defect_note_id = p_defect_id
      and (dni.damage_detail is null or dni.images is null
           or array_length(dni.images,1) is null or array_length(dni.images,1) = 0)
  ) then
    raise exception 'Phiếu hỏng chưa đủ thông tin/ảnh — cần bổ sung trước khi đổi mới';
  end if;

  begin
    insert into public.exchange_notes (code, linked_defect_id, created_by)
    select public.next_code('DM','public.exchange_notes_seq'::regclass), d.id, p_by
    from public.defect_notes d where d.id = p_defect_id
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Phiếu hỏng này đã có phiếu Đổi Mới đang xử lý';
  end;

  insert into public.exchange_note_items (exchange_note_id, variant_id, quantity)
  select v_id, dni.variant_id, dni.quantity
  from public.defect_note_items dni where dni.defect_note_id = p_defect_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'exchange.create', 'exchange', v_id, jsonb_build_object('status','pending'));
  return v_id;
end;
$$;

create or replace function public.approve_exchange(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.exchange_status;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được duyệt'; end if;
  select status into v_status from public.exchange_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu Đổi Mới'; end if;
  if v_status <> 'pending' then raise exception 'Phiếu không ở trạng thái đang chờ (hiện tại: %)', v_status; end if;
  update public.exchange_notes set status='approved', approved_by=p_by, approved_at=now() where id=p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'exchange.approve', 'exchange', p_id,
          jsonb_build_object('status','pending'), jsonb_build_object('status','approved'));
end;
$$;

create or replace function public.reject_exchange(p_id uuid, p_by uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.exchange_status;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được từ chối'; end if;
  if p_reason is null or length(trim(p_reason))=0 then raise exception 'Phải nhập lý do từ chối'; end if;
  select status into v_status from public.exchange_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu Đổi Mới'; end if;
  if v_status <> 'pending' then raise exception 'Chỉ từ chối phiếu đang chờ (hiện tại: %)', v_status; end if;
  update public.exchange_notes set status='rejected', rejected_by=p_by, rejection_reason=p_reason, rejected_at=now() where id=p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'exchange.reject', 'exchange', p_id,
          jsonb_build_object('status','pending'), jsonb_build_object('status','rejected'));
end;
$$;

create or replace function public.issue_exchange(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.exchange_status;
  v_main uuid;
  it record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được cấp phát'; end if;
  select id into v_main from public.stock_locations where code='KHO_CHINH';
  select status into v_status from public.exchange_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu Đổi Mới'; end if;
  if v_status <> 'approved' then raise exception 'Phiếu chưa được duyệt (hiện tại: %)', v_status; end if;

  -- Bung composite → trừ Kho chính, order by variant_id chống deadlock
  for it in
    select d.variant_id, d.quantity from public._expand_variant_demand(
      (select jsonb_agg(jsonb_build_object('variant_id', i.variant_id, 'quantity', i.quantity))
       from public.exchange_note_items i where i.exchange_note_id = p_id)
    ) d order by d.variant_id
  loop
    perform public._move_stock(it.variant_id, v_main, null, it.quantity, 'exchange_out', 'exchange', p_id, p_by);
  end loop;

  update public.exchange_notes set status='issued', issued_by=p_by, issued_at=now() where id=p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'exchange.issue', 'exchange', p_id,
          jsonb_build_object('status','approved'), jsonb_build_object('status','issued'));
end;
$$;

create or replace function public.receive_exchange(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.exchange_status;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được xác nhận nhận'; end if;
  select status into v_status from public.exchange_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu Đổi Mới'; end if;
  if v_status <> 'issued' then raise exception 'Phiếu chưa cấp phát (hiện tại: %)', v_status; end if;
  update public.exchange_notes set status='received', received_by=p_by, received_at=now() where id=p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'exchange.receive', 'exchange', p_id,
          jsonb_build_object('status','issued'), jsonb_build_object('status','received'));
end;
$$;

create or replace function public.cancel_exchange(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.exchange_status;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select status into v_status from public.exchange_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu Đổi Mới'; end if;
  if v_status <> 'pending' then raise exception 'Chỉ huỷ phiếu đang chờ (hiện tại: %)', v_status; end if;
  if not (public.is_manager() or exists (
    select 1 from public.exchange_notes en
    join public.defect_notes d on d.id = en.linked_defect_id
    where en.id = p_id and d.reported_by = p_by
  )) then raise exception 'Bạn không có quyền huỷ phiếu này'; end if;
  update public.exchange_notes set status='cancelled', cancelled_at=now() where id=p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'exchange.cancel', 'exchange', p_id,
          jsonb_build_object('status','pending'), jsonb_build_object('status','cancelled'));
end;
$$;
