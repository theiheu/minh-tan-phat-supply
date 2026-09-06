-- 0050_defect_collect.sql — đồ hỏng CHỈ về Kho hỏng khi manager thực sự xử lý
-- Nguyên tắc (chốt với người dùng):
--   • Lập HONG (record_defect) chỉ là khai báo — KHÔNG trừ Kho chính, không chuyển kho.
--   • Đổi Mới: manager cấp vật tư mới (trừ Kho chính) → THU đồ hỏng về Kho hỏng (chỉ CỘNG, không trừ Kho chính — đã cấp ra ngoài từ trước).
--   • Gửi đi sửa: manager xác nhận → THU đồ hỏng về Kho hỏng rồi mới chuyển sang Kho đang sửa (repair_out như cũ).
--   • Thanh lý: giữ nguyên — chỉ thao tác trên hàng đã có ở Kho hỏng.
--   • Huỷ HONG khi còn staging (chưa thu) → chỉ xoá khai báo, không có stock nào để trả lại.

alter type public.movement_type add value if not exists 'defect_collect_in';

-- 1) record_defect: chỉ ghi nhận, không đụng kho
create or replace function public.record_defect(p_items jsonb, p_source_loc uuid, p_by uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  it record;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;

  insert into public.defect_notes (code, source_location_id, reported_by)
  values (public.next_code('HONG', 'public.defect_notes_seq'::regclass), p_source_loc, p_by)
  returning id into v_id;

  for it in select value from jsonb_array_elements(p_items) loop
    insert into public.defect_note_items
      (defect_note_id, variant_id, quantity, damage_detail, damage_type, severity, images, unit_cost, note)
    values (
      v_id,
      (it.value->>'variant_id')::uuid,
      (it.value->>'quantity')::int,
      it.value->>'damage_detail',
      nullif(it.value->>'damage_type','')::public.damage_type,
      nullif(it.value->>'severity','')::public.severity_level,
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(it.value->'images','[]'::jsonb)) as x), '{}'),
      nullif(it.value->>'unit_cost','')::numeric,
      nullif(btrim(it.value->>'note',''),'')
    );
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'defect.record', 'defect', v_id, jsonb_build_object('status','staging'));
  return v_id;
end;
$$;

-- 2) cancel_defect: HONG staging (chưa thu đồ) → chỉ huỷ, không hoàn stock
create or replace function public.cancel_defect(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status public.defect_status;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được hủy phiếu hỏng'; end if;
  select status into v_status from public.defect_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu hỏng'; end if;
  if v_status <> 'staging' then raise exception 'Chỉ phiếu đang tập kết mới được hủy (hiện tại: %)', v_status; end if;
  -- Chưa thu đồ về kho nên không hoàn stock; chặn huỷ khi đang có DM sống hoặc đang đề nghị sửa
  if exists (select 1 from public.exchange_notes en
             where en.linked_defect_id = p_id and en.status in ('pending','approved','issued','received')) then
    raise exception 'Phiếu hỏng đang có phiếu Đổi Mới — không huỷ được';
  end if;
  if exists (select 1 from public.defect_notes d
             where d.id = p_id and d.repair_requested_at is not null) then
    raise exception 'Phiếu hỏng đang chờ xác nhận sửa — hủy đề nghị trước khi hủy phiếu';
  end if;
  update public.defect_notes set status = 'cancelled' where id = p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'defect.cancel', 'defect', p_id,
          jsonb_build_object('status','staging'), jsonb_build_object('status','cancelled'));
end;
$$;

-- 3) issue_exchange: cấp vật tư mới (trừ Kho chính) + THU đồ hỏng của HONG liên kết về Kho hỏng
create or replace function public.issue_exchange(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.exchange_status;
  v_main uuid;
  v_hong uuid;
  v_note uuid;
  it record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được cấp phát'; end if;
  select id into v_main from public.stock_locations where code='KHO_CHINH';
  select id into v_hong from public.stock_locations where code='KHO_HONG';
  select status into v_status from public.exchange_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu Đổi Mới'; end if;
  if v_status <> 'approved' then raise exception 'Phiếu chưa được duyệt (hiện tại: %)', v_status; end if;

  -- (a) Cấp vật tư mới: bung composite → trừ Kho chính, order theo variant_id chống deadlock
  for it in
    select d.variant_id, d.quantity from public._expand_variant_demand(
      (select jsonb_agg(jsonb_build_object('variant_id', i.variant_id, 'quantity', i.quantity))
       from public.exchange_note_items i where i.exchange_note_id = p_id)
    ) d order by d.variant_id
  loop
    perform public._move_stock(it.variant_id, v_main, null, it.quantity, 'exchange_out', 'exchange', p_id, p_by);
  end loop;

  -- (b) THU đồ hỏng về Kho hỏng: lấy theo dòng HONG liên kết (chỉ CỘNG Kho hỏng, không trừ Kho chính)
  select linked_defect_id into v_note from public.exchange_notes where id = p_id;
  if v_note is not null then
    for it in
      select dni.variant_id, dni.quantity
      from public.defect_note_items dni
      where dni.defect_note_id = v_note
      order by dni.variant_id
    loop
      perform public._move_stock(it.variant_id, null, v_hong, it.quantity, 'defect_collect_in', 'defect', v_note, p_by);
    end loop;
  end if;

  update public.exchange_notes set status='issued', issued_by=p_by, issued_at=now() where id=p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'exchange.issue', 'exchange', p_id,
          jsonb_build_object('status','approved'), jsonb_build_object('status','issued'));
end;
$$;

-- 4) send_to_repair: THU đồ hỏng về Kho hỏng trước, rồi chuyển Kho hỏng → Kho đang sửa như cũ
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

    -- Thu đồ hỏng về Kho hỏng (chỉ cộng — đồ đã cấp ra ngoài từ trước) rồi mới chuyển đi sửa
    perform public._move_stock(it.variant_id, null, v_hong, it.quantity, 'defect_collect_in', 'defect', it.defect_note_id, p_by);
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
