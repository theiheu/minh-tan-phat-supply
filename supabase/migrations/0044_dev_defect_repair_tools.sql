-- 0044_dev_defect_repair_tools.sql — Công cụ DEV (superuser-only) cho PHIẾU HỎNG + PHIẾU SỬA.
--
-- Đặc thù module này (xem bản đồ): phiếu hỏng không có trạng thái "nháp" — record_defect
-- vừa tạo vừa ghi sổ ngay (defect_out → KHO_HONG). cancel_defect/cancel_repair hiện đảo
-- bằng cách GHI THÊM dòng reversal cùng ref (không xoá dòng gốc), nên _revert_movements
-- xử lý cả dòng gốc lẫn dòng reversal → net về 0 đúng.
--
-- 1) delete_defect: xoá phiếu hỏng — chỉ khi KHÔNG còn repair_order_items hay requisition
--    replacement trỏ tới (FK restrict), đảo toàn bộ sổ 'defect' rồi xoá note (items cascade).
-- 2) revert_repair: repair ĐÃ HOÀN TẤT (returned) → mở lại 'in_repair' để dev sửa outcome/cost:
--    chỉ đảo các dòng kết quả (repair_return_in / transfer-outcome), KHÔNG đảo repair_out;
--    reset outcome/cost, hoàn nguyên resolution của defect items, dựng lại trạng thái note.
-- 3) delete_repair: xoá repair — đảo TOÀN BỘ sổ 'repair', hoàn nguyên resolution + trạng thái
--    defect notes, xoá repair (items cascade theo repair_order_id).

-- Helper: sau khi xoá/mở lại repair, dựng lại status của các defect_notes chứa items của nó.
--   - mode 'revert': repair vẫn còn in_repair, mọi item của phiếu đang ở Kho đang sửa → note = 'in_repair'
--     (nếu note còn item staging khác chưa gửi thì note cũng đang có hàng đi sửa — 'in_repair').
--   - mode 'delete': phiếu sửa đã xoá, items về Kho hỏng → nếu note còn repair KHÁC đang giữ item
--     thì 'in_repair', nếu có item chưa resolution → 'staging', có item liquidated → 'liquidated',
--     ngược lại 'returned'.
create or replace function public._rebuild_defect_notes(p_repair_id uuid, p_mode text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_mode = 'revert' then
    update public.defect_notes d
    set status = 'in_repair'
    where d.id in (
      select distinct dni.defect_note_id
      from public.defect_note_items dni
      join public.repair_order_items roi on roi.defect_item_id = dni.id
      where roi.repair_order_id = p_repair_id
    );
  else
    update public.defect_notes d
    set status = (
      case
        when exists (
          -- vẫn còn phiếu sửa khác (không phải cái vừa xoá, chưa hủy) đang giữ item của note
          select 1 from public.repair_order_items roi
          join public.repair_orders ro on ro.id = roi.repair_order_id
          join public.defect_note_items dni on dni.id = roi.defect_item_id
          where dni.defect_note_id = d.id and roi.repair_order_id <> p_repair_id
            and ro.status in ('in_repair','returned')
        ) then 'in_repair'::public.defect_status
        when exists (
          select 1 from public.defect_note_items dni
          where dni.defect_note_id = d.id and dni.resolution is null
        ) then 'staging'::public.defect_status
        when exists (
          select 1 from public.defect_note_items dni
          where dni.defect_note_id = d.id and dni.resolution = 'liquidated'
        ) then 'liquidated'::public.defect_status
        else 'returned'::public.defect_status
      end
    )
    where d.id in (
      select distinct dni.defect_note_id
      from public.defect_note_items dni
      join public.repair_order_items roi on roi.defect_item_id = dni.id
      where roi.repair_order_id = p_repair_id
    );
  end if;
end;
$$;

-- ===========================================================================
-- 1. delete_defect
-- ===========================================================================
create or replace function public.delete_defect(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.defect_status;
  v_blocked text;
begin
  if not public.is_superuser() then raise exception 'Chỉ tài khoản dev (superuser) được xoá phiếu hỏng'; end if;
  select status into v_status from public.defect_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu hỏng'; end if;

  -- FK restrict: repair_order_items.defect_item_id + requisitions.linked_defect_id
  select string_agg(t.msg, '; ') into v_blocked from (
    select 'còn phiếu sửa chữa dùng vật tư của phiếu này' as msg
    from public.defect_note_items dni
    join public.repair_order_items roi on roi.defect_item_id = dni.id
    where dni.defect_note_id = p_id
    union
    select 'còn phiếu yêu cầu thay thế (replacement) trỏ tới' as msg
    from public.requisitions r
    where r.linked_defect_id = p_id
  ) t;
  if v_blocked is not null then
    raise exception 'Không xoá được phiếu hỏng: % — hãy xử lý các phiếu liên quan trước.', v_blocked;
  end if;

  -- Phiếu đã chuyển kho hỏng (staging trở lên) → đảo sổ (gồm cả dòng reversal của cancel).
  perform public._revert_movements('defect', p_id, p_by);

  delete from public.defect_notes where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'defect.delete', 'defect', p_id, jsonb_build_object('status', v_status), null);
end;
$$;

-- ===========================================================================
-- 2. revert_repair — returned → in_repair (chỉ đảo dòng KẾT QUẢ, giữ items ở Kho đang sửa)
-- ===========================================================================
create or replace function public.revert_repair(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.repair_status;
  r record;
  v_bal int;
begin
  if not public.is_superuser() then raise exception 'Chỉ tài khoản dev (superuser) được mở lại phiếu sửa'; end if;
  select status into v_status from public.repair_orders where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu sửa'; end if;
  if v_status <> 'returned' then raise exception 'Chỉ phiếu ĐÃ HOÀN TẤT mới mở lại được (hiện tại: %)', v_status; end if;

  -- Đảo các dòng kết quả của complete_repair (repair_return_in = về kho chính,
  -- transfer = chuyển sang kho hỏng chờ thanh lý). Mỗi dòng: trả về từ nơi nhận.
  for r in
    select id, variant_id, from_location_id, to_location_id, quantity
    from public.stock_movements
    where ref_type = 'repair' and ref_id = p_id
      and movement_type in ('repair_return_in','transfer')
    order by created_at desc, id
  loop
    if r.to_location_id is not null then
      select quantity into v_bal
      from public.stock_balances
      where variant_id = r.variant_id and location_id = r.to_location_id
      for update;
      if v_bal is null or v_bal < r.quantity then
        raise exception 'Không mở lại được phiếu sửa: tồn kho của biến thể đã bị dùng đi (cần % tại kho đích)',
          r.quantity;
      end if;
      update public.stock_balances
      set quantity = quantity - r.quantity, updated_at = now()
      where variant_id = r.variant_id and location_id = r.to_location_id;
    end if;
    if r.from_location_id is not null then
      insert into public.stock_balances (variant_id, location_id, quantity)
      values (r.variant_id, r.from_location_id, r.quantity)
      on conflict (variant_id, location_id)
      do update set quantity = public.stock_balances.quantity + excluded.quantity, updated_at = now();
    end if;
    delete from public.stock_movements where id = r.id;
  end loop;

  -- Reset kết quả + hoàn nguyên resolution defect items + trạng thái note.
  update public.repair_order_items
  set outcome = null, cost = null
  where repair_order_id = p_id;
  update public.repair_orders
  set status = 'in_repair', returned_at = null, total_cost = null
  where id = p_id;

  update public.defect_note_items dni
  set resolution = null
  from public.repair_order_items roi
  where roi.repair_order_id = p_id and roi.defect_item_id = dni.id;

  perform public._rebuild_defect_notes(p_id, 'revert');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'repair.reopen', 'repair', p_id,
          jsonb_build_object('status','returned'), jsonb_build_object('status','in_repair'));
end;
$$;

-- ===========================================================================
-- 3. delete_repair — xoá phiếu sửa (đảo TOÀN BỘ sổ repair + hoàn nguyên defect)
-- ===========================================================================
create or replace function public.delete_repair(p_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.repair_status;
begin
  if not public.is_superuser() then raise exception 'Chỉ tài khoản dev (superuser) được xoá phiếu sửa'; end if;
  select status into v_status from public.repair_orders where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu sửa'; end if;

  -- Đảo toàn bộ bút toán của phiếu (repair_out + các dòng kết quả/reversal) — mọi item về Kho hỏng.
  perform public._revert_movements('repair', p_id, p_by);

  update public.defect_note_items dni
  set resolution = null
  from public.repair_order_items roi
  where roi.repair_order_id = p_id and roi.defect_item_id = dni.id;

  perform public._rebuild_defect_notes(p_id, 'delete');

  delete from public.repair_orders where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'repair.delete', 'repair', p_id, jsonb_build_object('status', v_status), null);
end;
$$;
