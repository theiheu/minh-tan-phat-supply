-- 0017_rpc.sql — RPC & business logic (mục 8 + 15)
-- Nguyên tắc: mọi thay đổi stock/chuyển trạng thái qua RPC security definer,
-- dùng SELECT ... FOR UPDATE chống race; ledger ghi qua stock_movements; mọi
-- bước chuyển trạng thái ghi audit_logs.
--
-- JSON item shape (snake_case): [{"variant_id": uuid, "quantity": int, ...}]
-- Actor được lấy từ auth.uid() (không tin p_by từ client).

-- ---------------------------------------------------------------------------
-- Helper: di chuyển stock vật lý (non-composite) + ghi ledger.
-- p_from/p_to có thể null (nhập kho không có from; xuất/thanh lý không có to).
-- ---------------------------------------------------------------------------
create or replace function public._move_stock(
  p_variant uuid,
  p_from uuid,
  p_to uuid,
  p_qty int,
  p_mtype public.movement_type,
  p_ref_type text,
  p_ref_id uuid,
  p_by uuid,
  p_notes text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_qty int;
begin
  if p_qty <= 0 then
    raise exception 'Số lượng phải lớn hơn 0';
  end if;

  if p_from is not null then
    select quantity into v_qty from public.stock_balances
    where variant_id = p_variant and location_id = p_from for update;
    if v_qty is null or v_qty < p_qty then
      raise exception 'Không đủ tồn tại location % cho variant %', p_from, p_variant;
    end if;
    update public.stock_balances set quantity = quantity - p_qty, updated_at = now()
    where variant_id = p_variant and location_id = p_from;
  end if;

  if p_to is not null then
    insert into public.stock_balances (variant_id, location_id, quantity)
    values (p_variant, p_to, p_qty)
    on conflict (variant_id, location_id)
    do update set quantity = public.stock_balances.quantity + excluded.quantity, updated_at = now();
  end if;

  insert into public.stock_movements
    (variant_id, from_location_id, to_location_id, movement_type, quantity, ref_type, ref_id, notes, created_by)
  values
    (p_variant, p_from, p_to, p_mtype, p_qty, p_ref_type, p_ref_id, p_notes, p_by);
end;
$$;

-- ---------------------------------------------------------------------------
-- Helper: nhu cầu thực tế của 1 requisition (mở composite thành linh kiện).
-- Variant có variant_components → trừ từng component; ngược lại trừ chính variant.
-- ---------------------------------------------------------------------------
create or replace function public._effective_demand(p_requisition uuid)
returns table (variant_id uuid, quantity int)
language sql stable security definer set search_path = public as $$
  select t.variant_id, sum(t.qty)::int as quantity
  from (
    select ri.variant_id, ri.quantity as qty
    from public.requisition_items ri
    where ri.requisition_id = p_requisition
      and not exists (select 1 from public.variant_components vc where vc.parent_variant_id = ri.variant_id)
    union all
    select vc.child_variant_id, ri.quantity * vc.quantity as qty
    from public.requisition_items ri
    join public.variant_components vc on vc.parent_variant_id = ri.variant_id
    where ri.requisition_id = p_requisition
  ) t
  group by t.variant_id
$$;

-- ===========================================================================
-- 1. create_requisition — tạo phiếu yêu cầu draft + items
-- ===========================================================================
create or replace function public.create_requisition(
  p_items jsonb, p_zone_id uuid, p_purpose text, p_type public.requisition_type,
  p_linked_defect_id uuid, p_requester_id uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  it record;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if p_requester_id is distinct from auth.uid() and not public.is_manager() then
    raise exception 'Chỉ được tạo phiếu cho chính mình';
  end if;
  if p_purpose is null or length(trim(p_purpose)) = 0 then
    raise exception 'Mục đích không được trống';
  end if;
  if p_type = 'replacement' and p_linked_defect_id is null then
    raise exception 'Đổi mới phải chọn phiếu hỏng liên quan';
  end if;

  insert into public.requisitions
    (code, requester_id, zone_id, purpose, requisition_type, linked_defect_id)
  values
    (public.next_code('REQ', 'public.requisitions_seq'::regclass), p_requester_id, p_zone_id, p_purpose, p_type, p_linked_defect_id)
  returning id into v_id;

  for it in select value from jsonb_array_elements(p_items) loop
    insert into public.requisition_items (requisition_id, variant_id, quantity)
    values (v_id, (it.value->>'variant_id')::uuid, (it.value->>'quantity')::int);
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'requisition.create', 'requisition', v_id, jsonb_build_object('status','draft'));

  return v_id;
end;
$$;

-- ===========================================================================
-- 2. submit_requisition — draft → pending
-- ===========================================================================
create or replace function public.submit_requisition(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.requisition_status;
  v_items int;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select status into v_status from public.requisitions where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu'; end if;
  if v_status <> 'draft' then raise exception 'Chỉ phiếu nháp mới được gửi (hiện tại: %)', v_status; end if;

  select count(*) into v_items from public.requisition_items where requisition_id = p_id;
  if v_items = 0 then raise exception 'Phiếu phải có ít nhất 1 vật tư'; end if;

  update public.requisitions set status = 'pending' where id = p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (auth.uid(), 'requisition.submit', 'requisition', p_id,
          jsonb_build_object('status','draft'), jsonb_build_object('status','pending'));
end;
$$;

-- ===========================================================================
-- 3. approve_requisition — pending → approved (manager)
-- ===========================================================================
create or replace function public.approve_requisition(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.requisition_status;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được duyệt'; end if;
  select status into v_status from public.requisitions where id = p_id for update;
  if v_status <> 'pending' then raise exception 'Phiếu không ở trạng thái đang chờ (hiện tại: %)', v_status; end if;

  update public.requisitions
  set status = 'approved', approved_by = p_by, approved_at = now()
  where id = p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'requisition.approve', 'requisition', p_id,
          jsonb_build_object('status','pending'), jsonb_build_object('status','approved'));
end;
$$;

-- ===========================================================================
-- 4. fulfill_requisition — approved → issued (manager): trừ stock + ledger
-- ===========================================================================
create or replace function public.fulfill_requisition(p_id uuid, p_by uuid, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
declare
  it record;
  v_main uuid;
  v_status public.requisition_status;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được cấp phát'; end if;
  select id into v_main from public.stock_locations where code = 'KHO_CHINH';

  select status into v_status from public.requisitions where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu'; end if;
  if v_status <> 'approved' then raise exception 'Phiếu không ở trạng thái đã duyệt (hiện tại: %)', v_status; end if;

  -- trừ stock theo thứ tự variant_id cố định (chống deadlock); composite → trừ linh kiện
  for it in select * from public._effective_demand(p_id) order by variant_id loop
    perform public._move_stock(it.variant_id, v_main, null, it.quantity, 'requisition_out', 'requisition', p_id, p_by);
  end loop;

  update public.requisitions
  set status = 'issued', fulfilled_by = p_by, fulfilled_at = now(), fulfillment_notes = p_notes
  where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'requisition.fulfill', 'requisition', p_id,
          jsonb_build_object('status','approved'), jsonb_build_object('status','issued'));
end;
$$;

-- ===========================================================================
-- 5. receive_requisition — issued → received (requester)
-- ===========================================================================
create or replace function public.receive_requisition(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.requisition_status;
  v_requester uuid;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select status, requester_id into v_status, v_requester from public.requisitions where id = p_id for update;
  if v_requester is distinct from auth.uid() and not public.is_manager() then
    raise exception 'Chỉ người yêu cầu mới xác nhận nhận hàng';
  end if;
  if v_status <> 'issued' then raise exception 'Phiếu chưa được cấp phát (hiện tại: %)', v_status; end if;

  update public.requisitions set status = 'received', received_by = p_by, received_at = now()
  where id = p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'requisition.receive', 'requisition', p_id,
          jsonb_build_object('status','issued'), jsonb_build_object('status','received'));
end;
$$;

-- ===========================================================================
-- 6. reject_requisition — pending/approved → rejected (manager, bắt buộc reason)
-- ===========================================================================
create or replace function public.reject_requisition(p_id uuid, p_by uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.requisition_status;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được từ chối'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'Phải nhập lý do từ chối'; end if;
  select status into v_status from public.requisitions where id = p_id for update;
  if v_status not in ('pending','approved') then raise exception 'Không thể từ chối phiếu ở trạng thái %', v_status; end if;

  update public.requisitions set status = 'rejected', rejection_reason = p_reason where id = p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'requisition.reject', 'requisition', p_id,
          jsonb_build_object('status', v_status), jsonb_build_object('status','rejected'));
end;
$$;

-- ===========================================================================
-- 7. cancel_requisition — draft/pending → cancelled (requester)
-- ===========================================================================
create or replace function public.cancel_requisition(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.requisition_status;
  v_requester uuid;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select status, requester_id into v_status, v_requester from public.requisitions where id = p_id for update;
  if v_requester is distinct from auth.uid() and not public.is_manager() then
    raise exception 'Chỉ người yêu cầu mới được hủy';
  end if;
  if v_status not in ('draft','pending') then raise exception 'Không thể hủy phiếu ở trạng thái %', v_status; end if;

  update public.requisitions set status = 'cancelled' where id = p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'requisition.cancel', 'requisition', p_id,
          jsonb_build_object('status', v_status), jsonb_build_object('status','cancelled'));
end;
$$;

-- ===========================================================================
-- 8. create_receipt — tạo phiếu nhập draft
-- ===========================================================================
create or replace function public.create_receipt(p_items jsonb, p_supplier_id uuid, p_by uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  it record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được tạo phiếu nhập'; end if;
  insert into public.receipts (code, supplier_id, created_by)
  values (public.next_code('GRN', 'public.receipts_seq'::regclass), p_supplier_id, p_by)
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

-- ===========================================================================
-- 9. post_receipt — draft → posted: cộng stock + auto cấp phát (FIFO)
-- ===========================================================================
create or replace function public.post_receipt(p_id uuid, p_by uuid)
returns uuid[] language plpgsql security definer set search_path = public as $$
declare
  v_status public.receipt_status;
  v_main uuid;
  it record;
  r record;
  v_linked uuid[] := '{}';
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được ghi nhận nhập kho'; end if;
  select id into v_main from public.stock_locations where code = 'KHO_CHINH';

  select status into v_status from public.receipts where id = p_id for update;
  if v_status <> 'draft' then raise exception 'Phiếu nhập không ở trạng thái nháp (hiện tại: %)', v_status; end if;

  -- cộng stock (order by variant_id chống deadlock)
  for it in select * from public.receipt_items where receipt_id = p_id order by variant_id loop
    perform public._move_stock(it.variant_id, null, v_main, it.quantity, 'receipt_in', 'receipt', p_id, p_by);
  end loop;

  -- auto cấp phát các requisition pending/approved theo FIFO (created_at, id tăng dần)
  for r in select id from public.requisitions
           where status in ('pending','approved')
           order by created_at asc, id asc loop
    begin
      perform public.fulfill_requisition(r.id, p_by, 'Tự động cấp phát từ phiếu nhập');
      v_linked := array_append(v_linked, r.id);
    exception when others then
      -- bỏ qua phiếu không thể cấp phát (thiếu tồn / đã được xử lý song song)
      null;
    end;
  end loop;

  update public.receipts set status = 'posted', linked_requisition_ids = v_linked where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'receipt.post', 'receipt', p_id,
          jsonb_build_object('status','draft'), jsonb_build_object('status','posted','linked', v_linked));

  return v_linked;
end;
$$;

-- ===========================================================================
-- 10. cancel_receipt — draft → cancelled
-- ===========================================================================
create or replace function public.cancel_receipt(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.receipt_status;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được hủy phiếu nhập'; end if;
  select status into v_status from public.receipts where id = p_id for update;
  if v_status <> 'draft' then raise exception 'Chỉ phiếu nháp mới được hủy (hiện tại: %)', v_status; end if;

  update public.receipts set status = 'cancelled' where id = p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'receipt.cancel', 'receipt', p_id,
          jsonb_build_object('status','draft'), jsonb_build_object('status','cancelled'));
end;
$$;

-- ===========================================================================
-- 11. record_defect — tạo phiếu hỏng + chuyển Kho chính → Kho hỏng
-- ===========================================================================
create or replace function public.record_defect(p_items jsonb, p_source_loc uuid, p_by uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_defect_loc uuid;
  it record;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select id into v_defect_loc from public.stock_locations where code = 'KHO_HONG';

  insert into public.defect_notes (code, source_location_id, reported_by)
  values (public.next_code('HONG', 'public.defect_notes_seq'::regclass), p_source_loc, p_by)
  returning id into v_id;

  for it in select value from jsonb_array_elements(p_items) loop
    insert into public.defect_note_items
      (defect_note_id, variant_id, quantity, damage_detail, damage_type, severity, images, unit_cost)
    values (
      v_id,
      (it.value->>'variant_id')::uuid,
      (it.value->>'quantity')::int,
      it.value->>'damage_detail',
      nullif(it.value->>'damage_type','')::public.damage_type,
      nullif(it.value->>'severity','')::public.severity_level,
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(it.value->'images','[]'::jsonb)) as x), '{}'),
      nullif(it.value->>'unit_cost','')::numeric
    );

    perform public._move_stock(
      (it.value->>'variant_id')::uuid, p_source_loc, v_defect_loc,
      (it.value->>'quantity')::int, 'defect_out', 'defect', v_id, p_by);
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'defect.record', 'defect', v_id, jsonb_build_object('status','staging'));
  return v_id;
end;
$$;

-- ===========================================================================
-- 12. send_to_repair — staging → in_repair; Kho hỏng → Kho đang sửa
-- ===========================================================================
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

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'repair.create', 'repair', v_repair_id, jsonb_build_object('status','in_repair'));
  return v_repair_id;
end;
$$;

-- ===========================================================================
-- 13. complete_repair — in_repair → returned; xử lý từng item outcome
-- ===========================================================================
create or replace function public.complete_repair(p_repair_id uuid, p_outcomes jsonb, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.repair_status;
  v_main uuid;
  v_hong uuid;
  v_sua uuid;
  o record;
  r record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được hoàn tất sửa chữa'; end if;
  select id into v_main from public.stock_locations where code = 'KHO_CHINH';
  select id into v_hong from public.stock_locations where code = 'KHO_HONG';
  select id into v_sua from public.stock_locations where code = 'KHO_DANG_SUA';

  select status into v_status from public.repair_orders where id = p_repair_id for update;
  if v_status <> 'in_repair' then raise exception 'Phiếu sửa không ở trạng thái đang sửa (hiện tại: %)', v_status; end if;

  for o in select value from jsonb_array_elements(p_outcomes) loop
    update public.repair_order_items
    set outcome = (o.value->>'outcome')::public.repair_outcome,
        cost = nullif(o.value->>'cost','')::numeric
    where id = (o.value->>'repair_item_id')::uuid
      and repair_order_id = p_repair_id;
  end loop;

  for r in select roi.* from public.repair_order_items roi where roi.repair_order_id = p_repair_id order by roi.variant_id loop
    if r.outcome = 'returned_to_stock' then
      perform public._move_stock(r.variant_id, v_sua, v_main, r.quantity, 'repair_return_in', 'repair', p_repair_id, p_by);
      update public.defect_note_items set resolution = 'repaired' where id = r.defect_item_id;
    elsif r.outcome = 'liquidation' then
      perform public._move_stock(r.variant_id, v_sua, v_hong, r.quantity, 'transfer', 'repair', p_repair_id, p_by, 'Sửa không được → chờ thanh lý');
      update public.defect_note_items set resolution = 'liquidated' where id = r.defect_item_id;
    else
      raise exception 'Thiếu kết quả xử lý cho item %', r.id;
    end if;
  end loop;

  update public.repair_orders set status = 'returned', returned_at = now(), total_cost = (
    select coalesce(sum(cost),0) from public.repair_order_items where repair_order_id = p_repair_id
  ) where id = p_repair_id;

  -- cập nhật trạng thái phiếu hỏng cha: tất cả item đã có resolution
  update public.defect_notes d set status = case
    when exists (
      select 1 from public.defect_note_items dni
      where dni.defect_note_id = d.id and (dni.resolution is null or dni.resolution = 'liquidated')
    ) then 'liquidated'
    else 'returned'
  end
  where d.id in (
    select distinct dni.defect_note_id from public.defect_note_items dni
    join public.repair_order_items roi on roi.defect_item_id = dni.id
    where roi.repair_order_id = p_repair_id
  )
  and not exists (
    select 1 from public.defect_note_items dni where dni.defect_note_id = d.id and dni.resolution is null
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'repair.complete', 'repair', p_repair_id,
          jsonb_build_object('status','in_repair'), jsonb_build_object('status','returned'));
end;
$$;

-- ===========================================================================
-- 14. create_liquidation — tạo phiếu thanh lý pending
-- ===========================================================================
create or replace function public.create_liquidation(p_items jsonb, p_reason text, p_by uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  it record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được tạo phiếu thanh lý'; end if;
  insert into public.liquidation_notes (code, reason, created_by)
  values (public.next_code('TL', 'public.liquidation_notes_seq'::regclass), p_reason, p_by)
  returning id into v_id;

  for it in select value from jsonb_array_elements(p_items) loop
    insert into public.liquidation_items
      (liquidation_note_id, variant_id, source_item_id, quantity, method, unit_value, notes)
    values (
      v_id,
      (it.value->>'variant_id')::uuid,
      nullif(it.value->>'source_item_id','')::uuid,
      (it.value->>'quantity')::int,
      coalesce(nullif(it.value->>'method','')::public.liquidation_method, 'dispose'),
      nullif(it.value->>'unit_value','')::numeric,
      it.value->>'notes'
    );
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'liquidation.create', 'liquidation', v_id, jsonb_build_object('status','pending'));
  return v_id;
end;
$$;

-- ===========================================================================
-- 15. approve_liquidation — pending → approved
-- ===========================================================================
create or replace function public.approve_liquidation(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.liquidation_status;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được duyệt thanh lý'; end if;
  select status into v_status from public.liquidation_notes where id = p_id for update;
  if v_status <> 'pending' then raise exception 'Phiếu thanh lý không ở trạng thái chờ duyệt (hiện tại: %)', v_status; end if;

  update public.liquidation_notes set status = 'approved', approved_by = p_by, approved_at = now()
  where id = p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'liquidation.approve', 'liquidation', p_id,
          jsonb_build_object('status','pending'), jsonb_build_object('status','approved'));
end;
$$;

-- ===========================================================================
-- 16. complete_liquidation — approved → completed: trừ stock Kho hỏng + proceeds
-- ===========================================================================
create or replace function public.complete_liquidation(p_id uuid, p_items_outcome jsonb, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.liquidation_status;
  v_hong uuid;
  o record;
  r record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được hoàn tất thanh lý'; end if;
  select id into v_hong from public.stock_locations where code = 'KHO_HONG';

  select status into v_status from public.liquidation_notes where id = p_id for update;
  if v_status <> 'approved' then raise exception 'Phiếu thanh lý chưa được duyệt (hiện tại: %)', v_status; end if;

  for o in select value from jsonb_array_elements(p_items_outcome) loop
    update public.liquidation_items set proceeds = (o.value->>'proceeds')::numeric
    where id = (o.value->>'item_id')::uuid and liquidation_note_id = p_id;
  end loop;

  for r in select * from public.liquidation_items where liquidation_note_id = p_id order by variant_id loop
    perform public._move_stock(r.variant_id, v_hong, null, r.quantity, 'liquidation_out', 'liquidation', p_id, p_by);
  end loop;

  update public.liquidation_notes set status = 'completed', completed_at = now() where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'liquidation.complete', 'liquidation', p_id,
          jsonb_build_object('status','approved'), jsonb_build_object('status','completed'));
end;
$$;

-- ===========================================================================
-- 17. reject_liquidation — pending → rejected
-- ===========================================================================
create or replace function public.reject_liquidation(p_id uuid, p_by uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.liquidation_status;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được từ chối thanh lý'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'Phải nhập lý do từ chối'; end if;
  select status into v_status from public.liquidation_notes where id = p_id for update;
  if v_status <> 'pending' then raise exception 'Không thể từ chối phiếu ở trạng thái %', v_status; end if;

  update public.liquidation_notes set status = 'rejected', notes = coalesce(notes, '') || ' [Từ chối: ' || p_reason || ']'
  where id = p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'liquidation.reject', 'liquidation', p_id,
          jsonb_build_object('status','pending'), jsonb_build_object('status','rejected'));
end;
$$;

-- ===========================================================================
-- 18. post_stocktake — draft → posted: tạo adjustment cho từng lệch
-- ===========================================================================
create or replace function public.post_stocktake(p_session_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.stocktake_status;
  v_loc uuid;
  r record;
  v_delta int;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được chốt kiểm kê'; end if;
  select status, location_id into v_status, v_loc from public.stocktake_sessions where id = p_session_id for update;
  if v_status <> 'draft' then raise exception 'Phiếu kiểm kê không ở trạng thái nháp (hiện tại: %)', v_status; end if;

  for r in select * from public.stocktake_items where session_id = p_session_id order by variant_id loop
    v_delta := r.actual_qty - r.system_qty;
    if v_delta > 0 then
      perform public._move_stock(r.variant_id, null, v_loc, v_delta, 'adjustment_in', 'stocktake', p_session_id, p_by);
    elsif v_delta < 0 then
      perform public._move_stock(r.variant_id, v_loc, null, -v_delta, 'adjustment_out', 'stocktake', p_session_id, p_by);
    end if;
  end loop;

  update public.stocktake_sessions set status = 'posted', posted_at = now() where id = p_session_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'stocktake.post', 'stocktake', p_session_id,
          jsonb_build_object('status','draft'), jsonb_build_object('status','posted'));
end;
$$;

-- ===========================================================================
-- 19. transfer_stock — chuyển kho giữa locations
-- ===========================================================================
create or replace function public.transfer_stock(p_items jsonb, p_from_loc uuid, p_to_loc uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare it record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được chuyển kho'; end if;
  if p_from_loc = p_to_loc then raise exception 'Kho nguồn và đích phải khác nhau'; end if;

  for it in select value from jsonb_array_elements(p_items) loop
    perform public._move_stock(
      (it.value->>'variant_id')::uuid, p_from_loc, p_to_loc,
      (it.value->>'quantity')::int, 'transfer', 'transfer', null, p_by,
      it.value->>'notes');
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'stock.transfer', 'transfer', null, jsonb_build_object('from', p_from_loc, 'to', p_to_loc));
end;
$$;

-- ===========================================================================
-- 20. return_requisition_items — nhập trả lại kho (return_in)
-- ===========================================================================
create or replace function public.return_requisition_items(p_requisition_id uuid, p_items jsonb, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.requisition_status;
  v_main uuid;
  it record;
  v_issued int;
  v_returned int;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được nhập trả lại'; end if;
  select id into v_main from public.stock_locations where code = 'KHO_CHINH';

  select status into v_status from public.requisitions where id = p_requisition_id for update;
  if v_status not in ('issued','received') then raise exception 'Phiếu chưa cấp phát nên không thể trả lại (hiện tại: %)', v_status; end if;

  for it in select value from jsonb_array_elements(p_items) loop
    select quantity into v_issued from public.requisition_items
    where requisition_id = p_requisition_id and variant_id = (it.value->>'variant_id')::uuid;
    if v_issued is null then raise exception 'Variant % không có trong phiếu', it.value->>'variant_id'; end if;

    select coalesce(sum(quantity),0) into v_returned from public.stock_movements
    where ref_type = 'requisition' and ref_id = p_requisition_id
      and variant_id = (it.value->>'variant_id')::uuid and movement_type = 'return_in';

    if (it.value->>'quantity')::int > v_issued - v_returned then
      raise exception 'Số lượng trả vượt quá số đã cấp cho variant %', it.value->>'variant_id';
    end if;

    perform public._move_stock(
      (it.value->>'variant_id')::uuid, null, v_main,
      (it.value->>'quantity')::int, 'return_in', 'requisition', p_requisition_id, p_by);
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'requisition.return', 'requisition', p_requisition_id, jsonb_build_object('items', p_items));
end;
$$;

-- ===========================================================================
-- 21. adjust_stock — điều chỉnh tồn thủ công (delta ±, bắt buộc reason)
-- ===========================================================================
create or replace function public.adjust_stock(p_variant_id uuid, p_location_id uuid, p_delta int, p_reason text, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được điều chỉnh tồn'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'Bắt buộc nhập lý do điều chỉnh'; end if;
  if p_delta = 0 then raise exception 'Delta phải khác 0'; end if;

  if p_delta > 0 then
    perform public._move_stock(p_variant_id, null, p_location_id, p_delta, 'adjustment_in', 'adjust', null, p_by, p_reason);
  else
    perform public._move_stock(p_variant_id, p_location_id, null, -p_delta, 'adjustment_out', 'adjust', null, p_by, p_reason);
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'stock.adjust', 'variant', p_variant_id, jsonb_build_object('delta', p_delta, 'reason', p_reason));
end;
$$;

-- ===========================================================================
-- Bổ sung: các hàm hủy (state machine có cancel cho defect/repair/liquidation)
-- ===========================================================================

-- 22. cancel_defect — staging → cancelled; trả stock về nguồn
create or replace function public.cancel_defect(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.defect_status;
  v_source uuid;
  v_hong uuid;
  r record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được hủy phiếu hỏng'; end if;
  select id into v_hong from public.stock_locations where code = 'KHO_HONG';
  select status, source_location_id into v_status, v_source from public.defect_notes where id = p_id for update;
  if v_status <> 'staging' then raise exception 'Chỉ phiếu đang tập kết mới được hủy (hiện tại: %)', v_status; end if;

  for r in select * from public.defect_note_items where defect_note_id = p_id order by variant_id loop
    perform public._move_stock(r.variant_id, v_hong, v_source, r.quantity, 'transfer', 'defect', p_id, p_by, 'Hủy phiếu hỏng');
  end loop;

  update public.defect_notes set status = 'cancelled' where id = p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'defect.cancel', 'defect', p_id,
          jsonb_build_object('status','staging'), jsonb_build_object('status','cancelled'));
end;
$$;

-- 23. cancel_repair — in_repair → cancelled; trả stock về Kho hỏng
create or replace function public.cancel_repair(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.repair_status;
  v_hong uuid;
  v_sua uuid;
  r record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được hủy phiếu sửa'; end if;
  select id into v_hong from public.stock_locations where code = 'KHO_HONG';
  select id into v_sua from public.stock_locations where code = 'KHO_DANG_SUA';
  select status into v_status from public.repair_orders where id = p_id for update;
  if v_status <> 'in_repair' then raise exception 'Chỉ phiếu đang sửa mới được hủy (hiện tại: %)', v_status; end if;

  for r in select * from public.repair_order_items where repair_order_id = p_id order by variant_id loop
    perform public._move_stock(r.variant_id, v_sua, v_hong, r.quantity, 'transfer', 'repair', p_id, p_by, 'Hủy phiếu sửa');
  end loop;

  update public.repair_orders set status = 'cancelled' where id = p_id;
  update public.defect_notes set status = 'staging'
  where id in (select distinct defect_note_id from public.defect_note_items dni
               join public.repair_order_items roi on roi.defect_item_id = dni.id
               where roi.repair_order_id = p_id);

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'repair.cancel', 'repair', p_id,
          jsonb_build_object('status','in_repair'), jsonb_build_object('status','cancelled'));
end;
$$;

-- 24. cancel_liquidation — pending → cancelled
create or replace function public.cancel_liquidation(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.liquidation_status;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được hủy phiếu thanh lý'; end if;
  select status into v_status from public.liquidation_notes where id = p_id for update;
  if v_status <> 'pending' then raise exception 'Chỉ phiếu chờ duyệt mới được hủy (hiện tại: %)', v_status; end if;

  update public.liquidation_notes set status = 'cancelled' where id = p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'liquidation.cancel', 'liquidation', p_id,
          jsonb_build_object('status','pending'), jsonb_build_object('status','cancelled'));
end;
$$;
