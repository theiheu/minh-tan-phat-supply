-- 0095_fix_stocktake_creation.sql
-- Fix stocktake creation to include all active physical SKUs in catalog
-- and allow warehouse managers to delete/cancel draft stocktake sessions.

CREATE OR REPLACE FUNCTION public.create_stocktake(
  p_location_id uuid, p_name text, p_by uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_id uuid;
  r record;
begin
  if not public.can_post_inventory() then raise exception 'Chỉ quản lý kho được tạo kiểm kê'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'Phải nhập tên phiếu kiểm kê'; end if;

  insert into public.stocktake_sessions (code, name, location_id, created_by)
  values (public.next_code('PKK', 'public.stocktake_seq'::regclass), trim(p_name), p_location_id, p_by)
  returning id into v_id;

  -- Include all active physical SKUs for the location (system_qty = 0 if not yet in stock_balances)
  for r in
    select
      v.id as sku_id,
      coalesce(sb.quantity, 0) as quantity
    from public.skus v
    left join public.stock_balances sb
      on sb.sku_id = v.id
      and sb.location_id = p_location_id
    where v.inventory_policy <> 'virtual_kit'
      and (v.sku_status is null or v.sku_status = 'active' or coalesce(sb.quantity, 0) > 0)
    order by v.sku_code, v.id
  loop
    insert into public.stocktake_items (
      session_id, sku_id, system_qty, actual_qty,
      snapshot_quality, conversion_factor_snapshot
    )
    values (v_id, r.sku_id, r.quantity, r.quantity, 'complete', 1);
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'stocktake.create', 'stocktake', v_id, jsonb_build_object('status','draft','name',p_name));

  return v_id;
end;
$$;

CREATE OR REPLACE FUNCTION public.create_stocktake(p_location_id uuid, p_by uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  return public.create_stocktake(p_location_id, 'Kỳ kiểm kê ' || to_char(now(), 'DD/MM/YYYY HH24:MI'), p_by);
end;
$$;

-- Allow warehouse managers and superuser/owner to delete draft stocktake sessions,
-- and superuser/owner to delete posted stocktake sessions (with revert).
CREATE OR REPLACE FUNCTION public.delete_stocktake(p_session_id uuid, p_by uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_status public.stocktake_status;
begin
  if not public.can_post_inventory() then
    raise exception 'Chỉ quản lý kho hoặc chủ trại mới được xoá phiếu kiểm kê';
  end if;

  select status into v_status
  from public.stocktake_sessions
  where id = p_session_id
  for update;

  if v_status is null then raise exception 'Không tìm thấy phiếu kiểm kê'; end if;

  -- Phiếu đã ghi sổ (posted) thì chỉ superuser / owner mới được xoá và đảo bút toán.
  if v_status = 'posted' then
    if not public._posting_actor_has_role(coalesce(auth.uid(), p_by), array['superuser','owner']) then
      raise exception 'Chỉ chủ trại hoặc admin mới được xoá phiếu đã chốt';
    end if;
    perform public._revert_movements('stocktake', p_session_id, p_by);
  end if;

  delete from public.stocktake_sessions where id = p_session_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'stocktake.delete', 'stocktake', p_session_id,
          jsonb_build_object('status', v_status), null);
end;
$$;

-- Add cancel_stocktake RPC
CREATE OR REPLACE FUNCTION public.cancel_stocktake(p_id uuid, p_by uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_status public.stocktake_status;
begin
  if not public.can_post_inventory() then
    raise exception 'Chỉ quản lý kho được hủy phiếu kiểm kê';
  end if;
  select status into v_status from public.stocktake_sessions where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu kiểm kê'; end if;
  if v_status <> 'draft' then raise exception 'Chỉ phiếu nháp mới được hủy (hiện tại: %)', v_status; end if;
  update public.stocktake_sessions set status = 'cancelled' where id = p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'stocktake.cancel', 'stocktake', p_id,
          jsonb_build_object('status','draft'), jsonb_build_object('status','cancelled'));
end;
$$;

GRANT ALL ON FUNCTION public.cancel_stocktake(uuid, uuid) TO anon;
GRANT ALL ON FUNCTION public.cancel_stocktake(uuid, uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_stocktake(uuid, uuid) TO service_role;

-- Backfill items for any existing draft sessions that have 0 items
do $$
declare
  sess record;
  r record;
begin
  for sess in select id, location_id from public.stocktake_sessions where status = 'draft' loop
    if not exists (select 1 from public.stocktake_items where session_id = sess.id) then
      for r in
        select
          v.id as sku_id,
          coalesce(sb.quantity, 0) as quantity
        from public.skus v
        left join public.stock_balances sb
          on sb.sku_id = v.id
          and sb.location_id = sess.location_id
        where v.inventory_policy <> 'virtual_kit'
          and (v.sku_status is null or v.sku_status = 'active' or coalesce(sb.quantity, 0) > 0)
        order by v.sku_code, v.id
      loop
        insert into public.stocktake_items (
          session_id, sku_id, system_qty, actual_qty,
          snapshot_quality, conversion_factor_snapshot
        )
        values (sess.id, r.sku_id, r.quantity, r.quantity, 'complete', 1);
      end loop;
    end if;
  end loop;
end $$;
