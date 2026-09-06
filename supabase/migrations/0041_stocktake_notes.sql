-- 0041_stocktake_notes.sql — ghi chú từng dòng kiểm kê + chốt chỉ xử lý dòng đã kiểm.
--
-- 1) stocktake_items.notes: ghi chú của người kiểm cho từng dòng vật tư
--    (lưu khi chốt phiếu; hiển thị trong chi tiết phiếu đã chốt + PDF).
-- 2) post_stocktake được định nghĩa LẠI: chỉ tạo điều chỉnh tồn kho cho các dòng
--    đã đánh dấu "đã kiểm" (checked = true). Dòng chưa kiểm bị bỏ qua hoàn toàn —
--    khớp với quyết định "phiếu chốt chỉ còn vật tư đã kiểm".
alter table public.stocktake_items
  add column notes text not null default '';

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

  for r in select * from public.stocktake_items
           where session_id = p_session_id and checked
           order by variant_id loop
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
