-- 0051_repair_batch.sql — tập kết nhiều phiếu HONG thành 1 phiếu sửa (SC)
-- send_to_repair hiện nhận mảng item id từ NHIỀU HONG; chuẩn hoá gate:
--   • chỉ nhận item thuộc HONG đang staging, chưa từng nằm trong phiếu sửa nào;
--   • HONG có phiếu Đổi Mới sống thì không đưa đi sửa;
--   • HONG chỉ chuyển in_repair khi KHÔNG còn dòng nào chưa đi sửa (đợt này hoặc trước).

create or replace function public.send_to_repair(
  p_defect_item_ids uuid[], p_vendor text, p_sent_at date, p_expected_return_at date, p_by uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_repair_id uuid;
  v_hong uuid;
  v_sua uuid;
  it record;
  v_bad uuid;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được tạo phiếu sửa'; end if;
  if p_vendor is null or length(trim(p_vendor)) = 0 then raise exception 'Đơn vị sửa chữa không được trống'; end if;
  if array_length(p_defect_item_ids, 1) is null then raise exception 'Chưa chọn vật tư hỏng nào'; end if;

  -- Gate: item phải thuộc HONG staging, chưa từng đi sửa, HONG không có phiếu Đổi Mới sống
  select dni.id into v_bad
  from public.defect_note_items dni
  join public.defect_notes d on d.id = dni.defect_note_id
  where dni.id = any(p_defect_item_ids)
    and (
      d.status <> 'staging'
      or exists (select 1 from public.repair_order_items roi where roi.defect_item_id = dni.id)
      or exists (select 1 from public.exchange_notes en
                 where en.linked_defect_id = d.id
                   and en.status in ('pending','approved','issued','received'))
    )
  limit 1;
  if v_bad is not null then
    raise exception 'Có dòng vật tư không hợp lệ (phiếu không còn tập kết, đã đi sửa, hoặc đang có phiếu Đổi Mới)';
  end if;

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

  -- Đóng HONG (staging → in_repair) khi mọi dòng của HONG đều ĐÃ đi sửa
  -- (có trong repair_order_items đợt này hoặc từ trước); nếu còn dòng chưa gửi thì giữ staging.
  update public.defect_notes d set status = 'in_repair'
  where d.status = 'staging'
    and d.id in (
      select distinct dni.defect_note_id
      from public.defect_note_items dni
      where dni.id = any(p_defect_item_ids)
    )
    and not exists (
      select 1 from public.defect_note_items dni
      where dni.defect_note_id = d.id
        and not exists (
          select 1 from public.repair_order_items roi
          where roi.defect_item_id = dni.id
        )
    );

  -- Xoá cờ đề nghị sửa cho các HONG vừa chính thức vào sửa (không để cờ mồ côi)
  update public.defect_notes set repair_requested_by = null, repair_requested_at = null
  where id in (
    select distinct dni.defect_note_id
    from public.defect_note_items dni
    where dni.id = any(p_defect_item_ids)
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'repair.create', 'repair', v_repair_id, jsonb_build_object('status','in_repair'));
  return v_repair_id;
end;
$$;
