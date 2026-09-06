-- 0042_dev_stocktake_tools.sql — Công cụ DEV: mở lại / xoá phiếu kiểm kê.
--
-- CHỈ superuser dùng được (is_superuser()) — manager thường KHÔNG.
-- Nguyên tắc an toàn: mọi thao tác trên phiếu ĐÃ CHỐT phải ĐẢO NGƯỢC bút toán
-- stock_movements đã ghi trước khi sửa/xoá; đảo không được làm âm tồn kho
-- (nếu tồn đã bị dùng đi thì báo lỗi, không tự ý trừ).

-- ---------------------------------------------------------------------------
-- _revert_movements: đảo toàn bộ bút toán stock_movements của một ref
-- (mỗi dòng ledger chứa variant/from/to/qty nên đảo ngược được chính xác),
-- sau đó XOÁ các dòng ledger đó. Raise nếu đảo sẽ làm âm tồn kho.
-- ---------------------------------------------------------------------------
create or replace function public._revert_movements(p_ref_type text, p_ref_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_bal int;
begin
  for r in
    select id, variant_id, from_location_id, to_location_id, quantity
    from public.stock_movements
    where ref_type = p_ref_type and ref_id = p_ref_id
    order by created_at desc, id
  loop
    -- Bên NHẬN (to): trả lại → trừ khỏi tồn nơi đã nhận.
    if r.to_location_id is not null then
      select quantity into v_bal
      from public.stock_balances
      where variant_id = r.variant_id and location_id = r.to_location_id
      for update;
      if v_bal is null or v_bal < r.quantity then
        raise exception 'Không đảo được bút toán: tồn kho của biến thể đã bị dùng đi (cần % tại kho nhận)',
          r.quantity;
      end if;
      update public.stock_balances
      set quantity = quantity - r.quantity, updated_at = now()
      where variant_id = r.variant_id and location_id = r.to_location_id;
    end if;

    -- Bên XUẤT (from): lấy về → cộng lại tồn nơi đã xuất.
    if r.from_location_id is not null then
      insert into public.stock_balances (variant_id, location_id, quantity)
      values (r.variant_id, r.from_location_id, r.quantity)
      on conflict (variant_id, location_id)
      do update set quantity = public.stock_balances.quantity + excluded.quantity, updated_at = now();
    end if;

    delete from public.stock_movements where id = r.id;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- revert_stocktake: posted → đảo sổ + về nháp (để dev sửa rồi chốt lại).
-- ---------------------------------------------------------------------------
create or replace function public.revert_stocktake(p_session_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.stocktake_status;
begin
  if not public.is_superuser() then raise exception 'Chỉ tài khoản dev (superuser) được mở lại phiếu kiểm kê'; end if;

  select status into v_status
  from public.stocktake_sessions
  where id = p_session_id
  for update;

  if v_status is null then raise exception 'Không tìm thấy phiếu kiểm kê'; end if;
  if v_status <> 'posted' then raise exception 'Chỉ phiếu ĐÃ CHỐT mới mở lại được (hiện tại: %)', v_status; end if;

  perform public._revert_movements('stocktake', p_session_id, p_by);

  update public.stocktake_sessions
  set status = 'draft', posted_at = null
  where id = p_session_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'stocktake.reopen', 'stocktake', p_session_id,
          jsonb_build_object('status', 'posted'), jsonb_build_object('status', 'draft'));
end;
$$;

-- ---------------------------------------------------------------------------
-- delete_stocktake: xoá phiếu (draft: xoá thẳng; posted/cancelled: đảo sổ rồi xoá).
-- ---------------------------------------------------------------------------
create or replace function public.delete_stocktake(p_session_id uuid, p_by uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.stocktake_status;
begin
  if not public.is_superuser() then raise exception 'Chỉ tài khoản dev (superuser) được xoá phiếu kiểm kê'; end if;

  select status into v_status
  from public.stocktake_sessions
  where id = p_session_id
  for update;

  if v_status is null then raise exception 'Không tìm thấy phiếu kiểm kê'; end if;

  -- Phiếu đã ghi sổ (posted) thì phải đảo bút toán trước khi xoá.
  if v_status = 'posted' then
    perform public._revert_movements('stocktake', p_session_id, p_by);
  end if;

  delete from public.stocktake_sessions where id = p_session_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'stocktake.delete', 'stocktake', p_session_id,
          jsonb_build_object('status', v_status), null);
end;
$$;
