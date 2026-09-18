-- Canonical clean schema baseline for Minh Tan Phat Supply.
-- Contains schema/contracts only; all current databases are disposable fake data.
-- Product is catalog identity; SKU is the only stock/document identity.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: damage_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.damage_type AS ENUM (
    'cracked',
    'chipped',
    'broken',
    'worn',
    'electrical',
    'chemical',
    'other'
);


--
-- Name: defect_resolution; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.defect_resolution AS ENUM (
    'repaired',
    'liquidated'
);


--
-- Name: defect_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.defect_status AS ENUM (
    'staging',
    'in_repair',
    'returned',
    'liquidated',
    'cancelled'
);


--
-- Name: exchange_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.exchange_status AS ENUM (
    'pending',
    'approved',
    'issued',
    'received',
    'rejected',
    'cancelled'
);


--
-- Name: fuel_calc_unit; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fuel_calc_unit AS ENUM (
    'km',
    'hours'
);


--
-- Name: fuel_movement_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fuel_movement_type AS ENUM (
    'receipt_in',
    'dispense_out',
    'adjustment_in',
    'adjustment_out',
    'cancel_revert'
);


--
-- Name: liquidation_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.liquidation_method AS ENUM (
    'sale',
    'dispose'
);


--
-- Name: liquidation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.liquidation_status AS ENUM (
    'pending',
    'approved',
    'completed',
    'rejected',
    'cancelled'
);


--
-- Name: location_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.location_type AS ENUM (
    'main',
    'defect',
    'repair',
    'other'
);


--
-- Name: movement_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.movement_type AS ENUM (
    'receipt_in',
    'requisition_out',
    'return_in',
    'defect_out',
    'repair_out',
    'repair_return_in',
    'liquidation_out',
    'adjustment_in',
    'adjustment_out',
    'transfer',
    'issue_out',
    'exchange_out',
    'defect_collect_in',
    'tool_borrow_out',
    'tool_return_in'
);


--
-- Name: receipt_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.receipt_status AS ENUM (
    'draft',
    'approved',
    'posted',
    'cancelled'
);


--
-- Name: repair_outcome; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.repair_outcome AS ENUM (
    'returned_to_stock',
    'liquidation'
);


--
-- Name: repair_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.repair_status AS ENUM (
    'in_repair',
    'returned',
    'cancelled'
);


--
-- Name: requisition_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.requisition_status AS ENUM (
    'draft',
    'pending',
    'approved',
    'issued',
    'received',
    'rejected',
    'cancelled'
);


--
-- Name: requisition_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.requisition_type AS ENUM (
    'new_supply',
    'replacement'
);


--
-- Name: severity_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.severity_level AS ENUM (
    'light',
    'medium',
    'severe'
);


--
-- Name: stocktake_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.stocktake_status AS ENUM (
    'draft',
    'posted',
    'cancelled'
);


--
-- Name: tool_borrowing_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tool_borrowing_status AS ENUM (
    'borrowed',
    'returned',
    'cancelled'
);


--
-- Name: vehicle_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vehicle_type AS ENUM (
    'truck',
    'excavator',
    'generator',
    'car',
    'forklift',
    'tractor',
    'other'
);


--
-- Name: _move_stock(uuid, uuid, uuid, integer, public.movement_type, text, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._move_stock(p_sku uuid, p_from uuid, p_to uuid, p_qty integer, p_mtype public.movement_type, p_ref_type text, p_ref_id uuid, p_by uuid, p_notes text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_qty int;
begin
  if p_qty <= 0 then
    raise exception 'Số lượng phải lớn hơn 0';
  end if;

  if p_from is not null then
    select quantity into v_qty from public.stock_balances
    where sku_id = p_sku and location_id = p_from for update;
    if v_qty is null or v_qty < p_qty then
      raise exception 'Không đủ tồn tại location % cho variant %', p_from, p_sku;
    end if;
    update public.stock_balances set quantity = quantity - p_qty, updated_at = now()
    where sku_id = p_sku and location_id = p_from;
  end if;

  if p_to is not null then
    insert into public.stock_balances (sku_id, location_id, quantity)
    values (p_sku, p_to, p_qty)
    on conflict (sku_id, location_id)
    do update set quantity = public.stock_balances.quantity + excluded.quantity, updated_at = now();
  end if;

  insert into public.stock_movements
    (sku_id, from_location_id, to_location_id, movement_type, quantity, ref_type, ref_id, notes, created_by)
  values
    (p_sku, p_from, p_to, p_mtype, p_qty, p_ref_type, p_ref_id, p_notes, p_by);
end;
$$;


--
-- Name: _post_inventory_movement(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._post_inventory_movement(p_command jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_actor uuid := coalesce(auth.uid(), nullif(p_command->>'actor_id','')::uuid);
  v_doc_type text := p_command->>'document_type';
  v_command_hash text := md5((p_command - 'actor_id')::text);
  v_command_id uuid;
  v_doc_id uuid := (p_command->>'document_id')::uuid;
  v_idem text := nullif(p_command->>'idempotency_key','');
  v_lines jsonb := coalesce(p_command->'lines','[]'::jsonb);
  v_line jsonb;
  v_existing uuid;
  v_movement_id uuid;
  v_first uuid;
  v_rec record;
  v_base numeric;
  v_signed numeric;
  v_qty numeric;
  v_line_id uuid;
  v_alloc jsonb;
  v_alloc_sum numeric;
  v_seq integer := 0;
  v_lock record;
begin
  if v_actor is null then raise exception 'Thiếu actor_id'; end if;
  if not public._posting_actor_has_role(v_actor,coalesce(
      (select array_agg(value) from jsonb_array_elements_text(p_command->'required_roles')),
      array['superuser','owner','accountant','warehouse'])) then
    raise exception 'Actor không có quyền ghi sổ kho';
  end if;
  if v_doc_type is null or v_doc_id is null then raise exception 'Thiếu document_type hoặc document_id'; end if;
  if v_idem is null then raise exception 'Mọi posting command bắt buộc idempotency_key'; end if;
  if jsonb_array_length(v_lines) = 0 then raise exception 'Không có dòng nào để ghi sổ'; end if;
  perform public._posting_validate_operation_shape(v_doc_type,v_lines);

  -- Whole-command idempotency. Same key + same payload returns the original result;
  -- same key + different payload is rejected. Unique violation handles concurrency.
  insert into public.inventory_posting_commands(
    idempotency_key,command_hash,command_type,command_payload,actor_id)
  values(v_idem,v_command_hash,v_doc_type,p_command,v_actor)
  on conflict(idempotency_key) do nothing
  returning id into v_command_id;
  if v_command_id is null then
    select id,first_movement_id,command_hash into v_command_id,v_existing,v_command_hash
      from public.inventory_posting_commands where idempotency_key=v_idem for update;
    if v_command_hash <> md5((p_command - 'actor_id')::text) then
      raise exception 'idempotency_key đã được dùng cho payload khác';
    end if;
    if v_existing is not null then return v_existing; end if;
    raise exception 'Posting command cùng key đang được xử lý';
  end if;


  -- Pre-create then lock EVERY balance key in one global (SKU,location) order.
  -- This prevents opposite transfers A→B and B→A from taking reverse lock orders.
  for v_lock in
    with line_data as (select value l from jsonb_array_elements(v_lines)),
    keys as (
      select (l->>'sku_id')::uuid sku_id,nullif(l->>'from_location_id','')::uuid location_id from line_data
      union
      select (l->>'sku_id')::uuid,nullif(l->>'to_location_id','')::uuid from line_data)
    select k.sku_id,k.location_id,v.base_unit_id
    from keys k join public.skus v on v.id=k.sku_id
    where k.location_id is not null order by k.sku_id::text,k.location_id::text
  loop
    perform public._posting_lock_balance(v_lock.sku_id,v_lock.location_id,v_lock.base_unit_id);
  end loop;

  -- Process lines only after all summary balance locks are held.
  for v_line in
    select value from jsonb_array_elements(v_lines)
    order by value->>'sku_id', coalesce(value->>'from_location_id',''),
             coalesce(value->>'to_location_id','')
  loop
    v_line_id := nullif(v_line->>'sku_id','')::uuid;
    if v_line_id is null then raise exception 'Dòng thiếu sku_id'; end if;

    select * into v_rec from public._posting_resolve_unit(
      v_line_id,
      nullif(v_line->>'transaction_unit_id','')::uuid,
      (v_line->>'entered_quantity')::numeric);

    v_base := v_rec.base_quantity;
    if v_base <= 0 then raise exception 'Số lượng phải lớn hơn 0'; end if;

    -- Deterministic lock order: from-location then to-location, both created if absent.
    if nullif(v_line->>'from_location_id','') is not null then
      perform public._posting_lock_balance(v_line_id, (v_line->>'from_location_id')::uuid, v_rec.unit_id);
    end if;
    if nullif(v_line->>'to_location_id','') is not null then
      perform public._posting_lock_balance(v_line_id, (v_line->>'to_location_id')::uuid, v_rec.unit_id);
    end if;

    -- Signed NET change to total on-hand: receipt +qty, issue -qty, transfer 0.
    -- Every decrease is checked against AVAILABILITY (on-hand minus reserved).
    if nullif(v_line->>'from_location_id','') is not null then
      v_qty := public._posting_lock_balance(v_line_id,(v_line->>'from_location_id')::uuid,v_rec.unit_id);
      if v_qty - coalesce((select reserved_quantity from public.stock_balances
                           where sku_id=v_line_id
                             and location_id=(v_line->>'from_location_id')::uuid),0) < v_base then
        raise exception 'Không đủ tồn khả dụng ở kho nguồn: có %, cần %', v_qty, v_base;
      end if;
      if nullif(v_line->>'to_location_id','') is not null then
        v_signed := 0;   -- transfer keeps total on-hand unchanged
      else
        v_signed := -v_base;
      end if;
    else
      v_signed := v_base;
    end if;

    v_movement_id := gen_random_uuid();
    insert into public.stock_movements(
      id, sku_id, from_location_id, to_location_id, movement_type, quantity,
      ref_type, ref_id, notes, created_by,
      base_unit_id, entered_quantity, transaction_unit_id, conversion_factor_snapshot,
      base_quantity, unit_cost, snapshot_quality, idempotency_key,bom_version_id,
      sku_name_snapshot, uom_name_snapshot)
    select v_movement_id, v_line_id,
      nullif(v_line->>'from_location_id','')::uuid,
      nullif(v_line->>'to_location_id','')::uuid,
      (case
         when v_doc_type = 'receipt' or v_doc_type = 'receipt_in' then 'receipt_in'
         when v_doc_type = 'return' or v_doc_type = 'return_in' then 'return_in'
         when v_doc_type in ('direct_issue','reserved_issue','virtual_kit_issue','requisition_out') then 'requisition_out'
         when v_doc_type = 'defect_collect_in' then 'defect_collect_in'
         when v_doc_type = 'defect' or v_doc_type = 'defect_out' then 'defect_out'
         when v_doc_type = 'repair_return_in' then 'repair_return_in'
         when v_doc_type = 'repair' or v_doc_type = 'repair_out' then 'repair_out'
         when v_doc_type = 'exchange' or v_doc_type = 'exchange_out' then 'exchange_out'
         when v_doc_type = 'liquidation' or v_doc_type = 'liquidation_out' then 'liquidation_out'
         when nullif(v_line->>'from_location_id','') is not null
          and nullif(v_line->>'to_location_id','') is not null then 'transfer'
         when nullif(v_line->>'from_location_id','') is not null then 'adjustment_out'
         else 'adjustment_in'
       end)::public.movement_type,
      v_base, coalesce(p_command->>'ref_type', v_doc_type), v_doc_id, p_command->>'notes', v_actor,
      v_rec.unit_id, (v_line->>'entered_quantity')::numeric,
      nullif(v_line->>'transaction_unit_id','')::uuid,
      coalesce((select factor_to_base from public.sku_transaction_units
                where id=nullif(v_line->>'transaction_unit_id','')::uuid), 1),
      v_signed, nullif(v_line->>'unit_cost','')::numeric, 'complete',
      case when v_seq=0 then v_idem else null end,
      nullif(p_command->>'bom_version_id','')::uuid,
      (select name from public.products p join public.skus vv on vv.product_id=p.id where vv.id=v_line_id),
      coalesce((select display_name from public.sku_transaction_units
                where id=nullif(v_line->>'transaction_unit_id','')::uuid),
               (select name from public.units where id=v_rec.unit_id));

    -- Allocations. Explicit rows are mandatory for serial tracking and for inbound lots.
    v_alloc_sum := 0;
    if v_line ? 'allocations' and jsonb_array_length(coalesce(v_line->'allocations','[]'::jsonb)) > 0 then
      for v_alloc in select * from jsonb_array_elements(v_line->'allocations') loop
        if (v_alloc->>'quantity')::numeric <= 0 then raise exception 'Số lượng allocation phải lớn hơn 0'; end if;
        -- Inbound receipt may create the lot/serial by business key.
        if nullif(v_alloc->>'lot_id','') is null and nullif(v_alloc->>'lot_number','') is not null then
          insert into public.inventory_lots(sku_id,lot_number,expiry_date,status)
          values(v_line_id,btrim(v_alloc->>'lot_number'),nullif(v_alloc->>'expiry_date','')::date,'active')
          on conflict(sku_id,lot_number) do update set
            expiry_date=coalesce(excluded.expiry_date,public.inventory_lots.expiry_date),updated_at=now();
          v_alloc := v_alloc || jsonb_build_object('lot_id',(select id from public.inventory_lots
            where sku_id=v_line_id and lot_number=btrim(v_alloc->>'lot_number')));
        end if;
        if nullif(v_alloc->>'lot_id','') is not null and not exists(
          select 1 from public.inventory_lots where id=(v_alloc->>'lot_id')::uuid and sku_id=v_line_id
        ) then raise exception 'Lô không thuộc SKU'; end if;

        if nullif(v_alloc->>'serial_id','') is null and nullif(v_alloc->>'serial_code','') is not null then
          if nullif(v_line->>'from_location_id','') is not null then
            raise exception 'Không được tạo serial mới trong giao dịch xuất';
          end if;
          insert into public.serial_items(sku_id,serial_code,location_id,status)
          values(v_line_id,btrim(v_alloc->>'serial_code'),null,'available')
          on conflict(sku_id,serial_code) do nothing;
          v_alloc := v_alloc || jsonb_build_object('serial_id',(select id from public.serial_items
            where sku_id=v_line_id and serial_code=btrim(v_alloc->>'serial_code')));
        end if;
        if nullif(v_alloc->>'serial_id','') is not null then
          if (v_alloc->>'quantity')::numeric <> 1 then raise exception 'Mỗi serial phải có quantity = 1'; end if;
          if not exists(select 1 from public.serial_items where id=(v_alloc->>'serial_id')::uuid and sku_id=v_line_id) then
            raise exception 'Serial không thuộc SKU';
          end if;
        end if;

        if v_rec.tracking_policy in ('lot','lot_expiry') and nullif(v_alloc->>'lot_id','') is null then
          raise exception 'SKU theo lô bắt buộc lot_id hoặc lot_number';
        elsif v_rec.tracking_policy='serial' and nullif(v_alloc->>'serial_id','') is null then
          raise exception 'SKU serial bắt buộc serial_id hoặc serial_code';
        elsif v_rec.tracking_policy='none' and
          (nullif(v_alloc->>'lot_id','') is not null or nullif(v_alloc->>'serial_id','') is not null) then
          raise exception 'SKU không theo dõi không nhận lot/serial allocation';
        end if;

        insert into public.stock_movement_allocations(movement_id, lot_id, serial_id, base_quantity)
        values(v_movement_id, nullif(v_alloc->>'lot_id','')::uuid,
               nullif(v_alloc->>'serial_id','')::uuid, (v_alloc->>'quantity')::numeric);
        v_alloc_sum := v_alloc_sum + (v_alloc->>'quantity')::numeric;

        if nullif(v_alloc->>'lot_id','') is not null then
          if nullif(v_line->>'from_location_id','') is not null then
            update public.lot_stock_balances set quantity=quantity-(v_alloc->>'quantity')::numeric, updated_at=now()
              where lot_id=(v_alloc->>'lot_id')::uuid and location_id=(v_line->>'from_location_id')::uuid
                and quantity >= (v_alloc->>'quantity')::numeric;
            if not found then raise exception 'Không đủ tồn của lô tại kho nguồn'; end if;
          end if;
          if nullif(v_line->>'to_location_id','') is not null then
            insert into public.lot_stock_balances(lot_id,location_id,quantity)
            values((v_alloc->>'lot_id')::uuid,(v_line->>'to_location_id')::uuid,(v_alloc->>'quantity')::numeric)
            on conflict(lot_id,location_id) do update
              set quantity=public.lot_stock_balances.quantity+excluded.quantity,updated_at=now();
          end if;
        end if;

        if nullif(v_alloc->>'serial_id','') is not null then
          if nullif(v_line->>'from_location_id','') is not null then
            update public.serial_items set location_id=null,
              status=case when v_doc_type in ('defect','repair','liquidation') then v_doc_type else 'issued' end,
              updated_at=now()
            where id=(v_alloc->>'serial_id')::uuid
              and location_id=(v_line->>'from_location_id')::uuid
              and status in ('available','reserved');
            if not found then raise exception 'Serial không khả dụng ở kho nguồn'; end if;
          end if;
          if nullif(v_line->>'to_location_id','') is not null then
            update public.serial_items set location_id=(v_line->>'to_location_id')::uuid,status='available',updated_at=now()
              where id=(v_alloc->>'serial_id')::uuid;
          end if;
        end if;
      end loop;
      if v_alloc_sum <> v_base then
        raise exception 'Tổng phân bổ % không khớp số lượng cơ sở %', v_alloc_sum, v_base;
      end if;
    elsif v_rec.tracking_policy in ('lot','lot_expiry') and nullif(v_line->>'from_location_id','') is not null then
      for v_alloc in select to_jsonb(x) from public._posting_pick_lots(
             v_line_id,(v_line->>'from_location_id')::uuid,v_base) x loop
        insert into public.stock_movement_allocations(movement_id, lot_id, base_quantity)
        values(v_movement_id, (v_alloc->>'lot_id')::uuid, (v_alloc->>'take')::numeric);
        update public.lot_stock_balances set quantity=quantity-(v_alloc->>'take')::numeric, updated_at=now()
          where lot_id=(v_alloc->>'lot_id')::uuid and location_id=(v_line->>'from_location_id')::uuid;
      end loop;
    elsif v_rec.tracking_policy in ('lot','lot_expiry','serial') then
      raise exception 'SKU theo dõi % bắt buộc allocations',v_rec.tracking_policy;
    end if;

    -- Apply balances
    if nullif(v_line->>'from_location_id','') is not null then
      update public.stock_balances set quantity=quantity-v_base, updated_at=now()
        where sku_id=v_line_id and location_id=(v_line->>'from_location_id')::uuid;
    end if;
    if nullif(v_line->>'to_location_id','') is not null then
      update public.stock_balances set quantity=quantity+v_base, updated_at=now()
        where sku_id=v_line_id and location_id=(v_line->>'to_location_id')::uuid;
    end if;

    insert into public.inventory_posting_command_movements(command_id,movement_id,sequence_no)
      values(v_command_id,v_movement_id,v_seq);
    if v_first is null then v_first := v_movement_id; end if;
    v_seq := v_seq + 1;
  end loop;

  update public.inventory_posting_commands set status='completed',first_movement_id=v_first,completed_at=now()
    where id=v_command_id;
  return v_first;
end $$;


--
-- Name: _posting_actor_has_role(uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._posting_actor_has_role(p_actor uuid, p_roles text[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists(select 1 from public.profiles
    where id=p_actor and is_active and role=any(p_roles));
$$;


--
-- Name: _posting_lock_balance(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._posting_lock_balance(p_sku_id uuid, p_location_id uuid, p_base_unit_id uuid) RETURNS numeric
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_qty numeric;
begin
  select quantity into v_qty from public.stock_balances
   where sku_id=p_sku_id and location_id=p_location_id for update;
  if found then return v_qty; end if;
  begin
    insert into public.stock_balances(sku_id,location_id,quantity,base_unit_id)
    values(p_sku_id,p_location_id,0,p_base_unit_id);
  exception when unique_violation then null;
  end;
  select quantity into v_qty from public.stock_balances
   where sku_id=p_sku_id and location_id=p_location_id for update;
  return coalesce(v_qty,0);
end $$;


--
-- Name: _posting_pick_lots(uuid, uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._posting_pick_lots(p_sku_id uuid, p_location_id uuid, p_needed numeric) RETURNS TABLE(lot_id uuid, take numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare r record; v_remaining numeric := p_needed; v_take numeric;
begin
  for r in
    select l.id, l.expiry_date, lsb.quantity
    from public.inventory_lots l
    join public.lot_stock_balances lsb on lsb.lot_id=l.id
    where l.sku_id=p_sku_id and lsb.location_id=p_location_id
      and lsb.quantity > 0 and l.status='active'
    order by l.expiry_date nulls last, l.lot_number
    for update of lsb
  loop
    exit when v_remaining <= 0;
    v_take := least(r.quantity, v_remaining);
    lot_id := r.id; take := v_take;
    v_remaining := v_remaining - v_take;
    return next;
  end loop;
  if v_remaining > 0 then
    raise exception 'Không đủ tồn theo lô: còn thiếu %', v_remaining;
  end if;
end $$;


--
-- Name: _posting_resolve_unit(uuid, uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._posting_resolve_unit(p_sku_id uuid, p_transaction_unit_id uuid, p_entered numeric) RETURNS TABLE(unit_id uuid, factor numeric, entered_quantity numeric, base_quantity numeric, base_scale smallint, tracking_policy text, allow_fraction boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_sku public.skus%rowtype;
  v_base_scale smallint;
  v_tu public.sku_transaction_units%rowtype;
begin
  select * into v_sku from public.skus where id=p_sku_id;
  if not found then raise exception 'Không tìm thấy SKU %', p_sku_id; end if;
  if v_sku.sku_status <> 'active' then
    raise exception 'SKU đang ở trạng thái % không thể giao dịch', v_sku.sku_status;
  end if;
  if v_sku.base_unit_id is null then
    raise exception 'SKU chưa có đơn vị tồn kho cơ sở';
  end if;
  select decimal_scale into v_base_scale from public.units where id=v_sku.base_unit_id;

  if p_entered <= 0 then raise exception 'Số lượng phải lớn hơn 0'; end if;
  if p_transaction_unit_id is null then
    if not v_sku.allow_fraction and p_entered<>trunc(p_entered) then
      raise exception 'SKU này không cho phép số lượng lẻ';
    end if;
    if p_entered <> round(p_entered,v_base_scale) then
      raise exception 'Số lượng vượt precision % chữ số của đơn vị cơ sở',v_base_scale;
    end if;
    return query select v_sku.base_unit_id, 1::numeric, p_entered,
      public._posting_round_base(p_entered, v_base_scale), v_base_scale,
      v_sku.tracking_policy, v_sku.allow_fraction;
    return;
  end if;

  select * into v_tu from public.sku_transaction_units
    where id=p_transaction_unit_id and sku_id=p_sku_id;
  if not found then raise exception 'Đơn vị giao dịch không thuộc SKU này'; end if;
  if not v_tu.is_active then raise exception 'Đơn vị giao dịch đã ngừng sử dụng'; end if;
  if not v_tu.allow_fraction and p_entered <> trunc(p_entered) then
    raise exception 'Đơn vị % không cho phép số lượng lẻ', v_tu.display_name;
  end if;
  if p_entered*v_tu.factor_to_base <> round(p_entered*v_tu.factor_to_base,v_base_scale) then
    raise exception 'Quy đổi tạo sai số vượt precision đơn vị cơ sở';
  end if;

  -- The movement/balance owner is always the SKU base UOM. The selected
  -- transaction UOM is retained separately on the movement snapshot.
  return query select v_sku.base_unit_id, v_tu.factor_to_base, p_entered,
    public._posting_round_base(p_entered * v_tu.factor_to_base, v_base_scale), v_base_scale,
    v_sku.tracking_policy, v_sku.allow_fraction;
end $$;


--
-- Name: _posting_round_base(numeric, smallint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._posting_round_base(p_value numeric, p_scale smallint) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$
  select round(p_value, p_scale);
$$;


--
-- Name: _posting_validate_operation_shape(text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._posting_validate_operation_shape(p_type text, p_lines jsonb) RETURNS void
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare l jsonb;
begin
  for l in select * from jsonb_array_elements(p_lines) loop
    if p_type in ('receipt','return') and (nullif(l->>'from_location_id','') is not null or nullif(l->>'to_location_id','') is null) then
      raise exception '% chỉ cho phép dòng nhập vào kho đích',p_type;
    elsif p_type in ('direct_issue','reserved_issue','virtual_kit_issue','liquidation')
      and (nullif(l->>'from_location_id','') is null or nullif(l->>'to_location_id','') is not null) then
      raise exception '% chỉ cho phép dòng xuất từ kho nguồn',p_type;
    elsif p_type in ('transfer','defect','repair')
      and (nullif(l->>'from_location_id','') is null or nullif(l->>'to_location_id','') is null
           or l->>'from_location_id'=l->>'to_location_id') then
      raise exception '% bắt buộc kho nguồn và kho đích khác nhau',p_type;
    elsif p_type='assembly' and not (
      (nullif(l->>'from_location_id','') is not null and nullif(l->>'to_location_id','') is null)
      or (nullif(l->>'from_location_id','') is null and nullif(l->>'to_location_id','') is not null)) then
      raise exception 'assembly chỉ gồm dòng tiêu hao hoặc dòng thành phẩm';
    elsif p_type='disassembly' and not (
      (nullif(l->>'from_location_id','') is not null and nullif(l->>'to_location_id','') is null)
      or (nullif(l->>'from_location_id','') is null and nullif(l->>'to_location_id','') is not null)) then
      raise exception 'disassembly chỉ gồm dòng bộ nguồn hoặc dòng thu hồi';
    end if;
  end loop;
end $$;


--
-- Name: _rebuild_defect_notes(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._rebuild_defect_notes(p_repair_id uuid, p_mode text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: _receipt_has_active_linked(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._receipt_has_active_linked(p_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_ids uuid[]; v_any boolean;
begin
  select linked_requisition_ids into v_ids from public.receipts where id = p_id;
  if v_ids is null or cardinality(v_ids) = 0 then return false; end if;
  select exists (
    select 1 from public.requisitions r
    where r.id = any(v_ids) and r.status in ('issued','received')
  ) into v_any;
  return coalesce(v_any, false);
end;
$$;


--
-- Name: _revert_movements(text, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._revert_movements(p_ref_type text, p_ref_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  r record;
  v_bal int;
begin
  for r in
    select id, sku_id, from_location_id, to_location_id, quantity
    from public.stock_movements
    where ref_type = p_ref_type and ref_id = p_ref_id
    order by created_at desc, id
  loop
    -- Bên NHẬN (to): trả lại → trừ khỏi tồn nơi đã nhận.
    if r.to_location_id is not null then
      select quantity into v_bal
      from public.stock_balances
      where sku_id = r.sku_id and location_id = r.to_location_id
      for update;
      if v_bal is null or v_bal < r.quantity then
        raise exception 'Không đảo được bút toán: tồn kho của biến thể đã bị dùng đi (cần % tại kho nhận)',
          r.quantity;
      end if;
      update public.stock_balances
      set quantity = quantity - r.quantity, updated_at = now()
      where sku_id = r.sku_id and location_id = r.to_location_id;
    end if;

    -- Bên XUẤT (from): lấy về → cộng lại tồn nơi đã xuất.
    if r.from_location_id is not null then
      insert into public.stock_balances (sku_id, location_id, quantity)
      values (r.sku_id, r.from_location_id, r.quantity)
      on conflict (sku_id, location_id)
      do update set quantity = public.stock_balances.quantity + excluded.quantity, updated_at = now();
    end if;

    delete from public.stock_movements where id = r.id;
  end loop;
end;
$$;


--
-- Name: adjust_stock(uuid, uuid, numeric, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.adjust_stock(p_sku_id uuid, p_location_id uuid, p_delta numeric, p_reason text, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_sku public.skus%rowtype;
  v_lines jsonb;
  v_doc_id uuid := gen_random_uuid();
begin
  if not public.can_post_inventory() then raise exception 'Chỉ quản lý kho được điều chỉnh tồn'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'Bắt buộc nhập lý do điều chỉnh'; end if;
  if p_delta = 0 or p_delta is null then raise exception 'Delta phải khác 0'; end if;

  select * into v_sku from public.skus where id = p_sku_id;
  if not found then raise exception 'Không tìm thấy SKU %', p_sku_id; end if;
  if v_sku.inventory_policy = 'virtual_kit' then
    raise exception 'Không thể điều chỉnh tồn bộ ảo (không có tồn vật lý)';
  end if;

  if p_delta > 0 then
    v_lines := jsonb_build_array(jsonb_build_object(
      'sku_id', p_sku_id,
      'to_location_id', p_location_id,
      'entered_quantity', p_delta,
      'transaction_unit_id', null
    ));
  else
    v_lines := jsonb_build_array(jsonb_build_object(
      'sku_id', p_sku_id,
      'from_location_id', p_location_id,
      'entered_quantity', -p_delta,
      'transaction_unit_id', null
    ));
  end if;

  perform public.post_stocktake_adjustment_command(jsonb_build_object(
    'document_id', v_doc_id,
    'actor_id', coalesce(auth.uid(), p_by),
    'idempotency_key', 'adjust-' || v_doc_id::text,
    'notes', p_reason,
    'lines', v_lines
  ));

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'stock.adjust', 'variant', p_sku_id,
          jsonb_build_object('delta', p_delta, 'reason', p_reason, 'location_id', p_location_id));
end;
$$;


--
-- Name: admin_purge_user_data(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_purge_user_data(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_is_protected boolean;
  v_username text;
begin
  -- 1. Chỉ superuser mới có quyền xóa sạch dữ liệu
  if not public.is_superuser() then
    raise exception 'Chỉ quản trị hệ thống (superuser) mới có quyền xóa sạch tài khoản và toàn bộ lịch sử dữ liệu liên quan';
  end if;

  -- 2. Chặn tự xóa chính mình
  if p_user_id = auth.uid() then
    raise exception 'Không thể tự xóa tài khoản của chính mình';
  end if;

  -- 3. Chặn xóa tài khoản hệ thống
  select is_protected, username into v_is_protected, v_username from public.profiles where id = p_user_id;
  if v_is_protected then
    raise exception 'Không thể xóa tài khoản hệ thống %', coalesce(v_username, '');
  end if;

  -- 4. Xóa sạch dữ liệu lịch sử liên kết với user
  -- Gỡ liên kết defect_notes trong requisitions và exchange_notes
  update public.requisitions set linked_defect_id = null
  where requester_id = p_user_id or approved_by = p_user_id or fulfilled_by = p_user_id or received_by = p_user_id;
  
  update public.exchange_notes set linked_defect_id = null
  where created_by = p_user_id or approved_by = p_user_id or issued_by = p_user_id or received_by = p_user_id or rejected_by = p_user_id;

  -- Xóa notifications & audit logs của user
  delete from public.notifications where user_id = p_user_id;
  delete from public.audit_logs where actor_id = p_user_id;

  -- Xóa mượn trả dụng cụ
  delete from public.tool_borrowings where borrower_id = p_user_id or issued_by = p_user_id or received_back_by = p_user_id;

  -- Xóa cấp phát & giao dịch kho dầu
  delete from public.fuel_dispenses where dispenser_id = p_user_id;
  delete from public.fuel_receipts where received_by = p_user_id;
  delete from public.fuel_movements where created_by = p_user_id;

  -- Xóa phiếu đổi trả & thanh lý & sửa chữa
  delete from public.exchange_notes where created_by = p_user_id or approved_by = p_user_id or issued_by = p_user_id or received_by = p_user_id or rejected_by = p_user_id;
  delete from public.liquidation_notes where created_by = p_user_id or approved_by = p_user_id;
  delete from public.repair_orders where created_by = p_user_id;

  -- Xóa phiếu trả hàng & phiếu yêu cầu vật tư
  delete from public.requisition_returns where returned_by = p_user_id;
  delete from public.requisitions where requester_id = p_user_id or approved_by = p_user_id or fulfilled_by = p_user_id or received_by = p_user_id;

  -- Xóa phiếu báo hỏng
  delete from public.defect_notes where reported_by = p_user_id or repair_requested_by = p_user_id or collected_by = p_user_id;

  -- Xóa phiếu xuất & phiếu nhập
  delete from public.issues where creator_id = p_user_id;
  delete from public.receipts where created_by = p_user_id or approved_by = p_user_id;

  -- Xóa phiên kiểm kê
  delete from public.stocktake_sessions where created_by = p_user_id;

  -- Xóa biến động kho
  delete from public.stock_movements where created_by = p_user_id;
end;
$$;


--
-- Name: admin_update_profile(uuid, text, text, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_profile(p_user_id uuid, p_name text, p_role text, p_zone_id uuid, p_is_active boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được quản lý người dùng'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'Tên không được trống'; end if;
  if p_role not in ('requester','manager','superuser') then raise exception 'Role không hợp lệ'; end if;
  -- Chỉ superuser được cấp/gỡ vai trò superuser (chặn sớm, thân thiện hơn trigger).
  if p_role = 'superuser' and not public.is_superuser() then
    raise exception 'Chỉ tài khoản superuser được cấp vai trò superuser';
  end if;

  update public.profiles
  set name = p_name, role = p_role, zone_id = p_zone_id, is_active = p_is_active
  where id = p_user_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'profile.update', 'profile', p_user_id,
          jsonb_build_object('role', p_role, 'zone_id', p_zone_id, 'is_active', p_is_active));
end;
$$;


--
-- Name: admin_update_profile(uuid, text, text, uuid, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_profile(p_user_id uuid, p_name text, p_role text, p_zone_id uuid, p_is_active boolean, p_sub_zone_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được quản lý người dùng'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'Tên không được trống'; end if;
  if p_role not in ('requester','manager','superuser') then raise exception 'Role không hợp lệ'; end if;
  if p_role = 'superuser' and not public.is_superuser() then
    raise exception 'Chỉ tài khoản superuser được cấp vai trò superuser';
  end if;

  update public.profiles
  set name = p_name, role = p_role, zone_id = p_zone_id, sub_zone_id = p_sub_zone_id, is_active = p_is_active
  where id = p_user_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'profile.update', 'profile', p_user_id,
          jsonb_build_object('role', p_role, 'zone_id', p_zone_id, 'sub_zone_id', p_sub_zone_id, 'is_active', p_is_active));
end;
$$;


--
-- Name: admin_update_profile(uuid, text, text, uuid, boolean, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_profile(p_user_id uuid, p_name text, p_role text, p_zone_id uuid, p_is_active boolean, p_sub_zone_id uuid DEFAULT NULL::uuid, p_email text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_existing_name text;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý được quản lý người dùng'; end if;
  if p_role not in ('superuser', 'owner', 'accountant', 'warehouse', 'technician', 'requester', 'driver') then
    raise exception 'Role không hợp lệ: %', p_role;
  end if;
  -- Chỉ superuser được cấp/gỡ vai trò superuser
  if p_role = 'superuser' and not public.is_superuser() then
    raise exception 'Chỉ tài khoản superuser được cấp vai trò superuser';
  end if;

  select name into v_existing_name from public.profiles where id = p_user_id;

  update public.profiles
  set role = p_role,
      zone_id = p_zone_id,
      sub_zone_id = p_sub_zone_id,
      email = nullif(trim(lower(p_email)), ''),
      is_active = p_is_active,
      updated_at = now()
  where id = p_user_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'profile.update', 'profile', p_user_id,
          jsonb_build_object('role', p_role, 'zone_id', p_zone_id, 'sub_zone_id', p_sub_zone_id, 'email', p_email, 'is_active', p_is_active));
end;
$$;


--
-- Name: admin_update_username(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_username(p_user_id uuid, p_username text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  raise exception 'Tên đăng nhập không thể thay đổi sau khi đã tạo';
end;
$$;


--
-- Name: ai_get_fuel_summary(date, date, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ai_get_fuel_summary(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_vehicle_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 10) RETURNS TABLE(dispense_id uuid, dispense_code text, dispense_date timestamp with time zone, vehicle_name text, vehicle_code text, fuel_type_name text, quantity numeric, driver_name text, notes text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    fd.id as dispense_id,
    fd.code as dispense_code,
    fd.created_at as dispense_date,
    coalesce(v.name, 'Thiết bị/Xe khác') as vehicle_name,
    coalesce(v.code, 'N/A') as vehicle_code,
    coalesce(ft.name, 'Nhiên liệu') as fuel_type_name,
    fd.quantity,
    coalesce(fd.driver_name, coalesce(v.default_driver, 'Chưa ghi nhận')) as driver_name,
    coalesce(fd.notes, '') as notes
  from public.fuel_dispenses fd
  left join public.vehicles v on v.id = fd.vehicle_id
  left join public.fuel_types ft on ft.id = fd.fuel_type_id
  where (p_start_date is null or fd.created_at >= p_start_date::timestamptz)
    and (p_end_date is null or fd.created_at <= (p_end_date + interval '1 day')::timestamptz)
    and (p_vehicle_id is null or fd.vehicle_id = p_vehicle_id)
  order by fd.created_at desc
  limit p_limit;
$$;


--
-- Name: ai_get_stock_summary(text, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ai_get_stock_summary(p_query text DEFAULT NULL::text, p_location_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 20) RETURNS TABLE(product_id uuid, sku_id uuid, product_name text, category_name text, attributes jsonb, unit text, price numeric, min_stock integer, total_stock bigint, location_details text)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  WITH query_tokens AS (
    SELECT array_agg(DISTINCT t) AS tokens
    FROM unnest(regexp_split_to_array(public.unaccent_text(lower(trim(COALESCE(p_query, '')))), '[[:space:]]+')) t
    WHERE length(t) > 0
  ),
  variant_attrs AS (
    SELECT
      sav.sku_id,
      jsonb_object_agg(
        ad.name,
        COALESCE(sav.text_value, aov.label, sav.legacy_text_value, sav.numeric_value::text, '')
      ) AS attributes_json,
      string_agg(
        COALESCE(sav.text_value, '') || ' ' ||
        COALESCE(sav.legacy_text_value, '') || ' ' ||
        COALESCE(sav.numeric_value::text, '') || ' ' ||
        COALESCE(aov.label, '') || ' ' ||
        COALESCE(aov.code, '') || ' ' ||
        COALESCE(ad.name, '') || ' ' ||
        COALESCE(u.symbol, '') || ' ' ||
        COALESCE(u.name, ''),
        ' '
      ) AS attr_text
    FROM public.sku_attribute_values sav
    LEFT JOIN public.attribute_definitions ad ON ad.id = sav.attribute_definition_id
    LEFT JOIN public.attribute_option_values aov ON aov.id = sav.option_value_id
    LEFT JOIN public.units u ON u.id = sav.unit_id
    GROUP BY sav.sku_id
  ),
  variant_barcodes AS (
    SELECT
      br.sku_id,
      string_agg(br.barcode, ' ') AS barcode_text
    FROM public.barcode_registry br
    WHERE br.is_active = true
    GROUP BY br.sku_id
  ),
  variant_uoms AS (
    SELECT
      stu.sku_id,
      string_agg(stu.code || ' ' || stu.display_name, ' ') AS uom_text
    FROM public.sku_transaction_units stu
    WHERE stu.is_active = true
    GROUP BY stu.sku_id
  ),
  sku_pool AS (
    SELECT
      p.id AS product_id,
      v.id AS sku_id,
      p.name AS product_name,
      COALESCE(c.name, 'Chưa phân loại') AS category_name,
      COALESCE(va.attributes_json, '{}'::jsonb) AS attributes,
      COALESCE(u.name, 'Cái') AS unit,
      v.price,
      v.min_stock,
      COALESCE(sum(sb.quantity), 0)::bigint AS total_stock,
      COALESCE(
        string_agg(
          DISTINCT loc.name || ': ' || sb.quantity::text || ' ' || COALESCE(u.name, ''),
          ', '
        ),
        'Chưa có trong kho'
      ) AS location_details,
      public.unaccent_text(
        lower(
          p.name || ' ' ||
          COALESCE(c.name, '') || ' ' ||
          COALESCE(array_to_string(p.search_keywords, ' '), '') || ' ' ||
          COALESCE(p.description, '') || ' ' ||
          COALESCE(v.sku_code, '') || ' ' ||
          COALESCE(u.symbol, '') || ' ' ||
          COALESCE(u.name, '') || ' ' ||
          COALESCE(va.attr_text, '') || ' ' ||
          COALESCE(vb.barcode_text, '') || ' ' ||
          COALESCE(vuom.uom_text, '')
        )
      ) AS search_text
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    JOIN public.skus v ON v.product_id = p.id
    LEFT JOIN public.units u ON u.id = v.base_unit_id
    LEFT JOIN variant_attrs va ON va.sku_id = v.id
    LEFT JOIN variant_barcodes vb ON vb.sku_id = v.id
    LEFT JOIN variant_uoms vuom ON vuom.sku_id = v.id
    LEFT JOIN public.stock_balances sb ON sb.sku_id = v.id
    LEFT JOIN public.stock_locations loc ON loc.id = sb.location_id
    WHERE p.deleted_at IS NULL AND v.sku_status = 'active'
      AND (p_location_id IS NULL OR sb.location_id = p_location_id)
    GROUP BY p.id, v.id, p.name, c.name, u.name, u.symbol, v.price, v.min_stock, v.sku_code, p.search_keywords, p.description, va.attributes_json, va.attr_text, vb.barcode_text, vuom.uom_text
  )
  SELECT
    sp.product_id,
    sp.sku_id,
    sp.product_name,
    sp.category_name,
    sp.attributes,
    sp.unit,
    sp.price,
    sp.min_stock,
    sp.total_stock,
    sp.location_details
  FROM sku_pool sp, query_tokens qt
  WHERE cardinality(qt.tokens) IS NULL OR cardinality(qt.tokens) = 0 OR NOT EXISTS (
    SELECT 1
    FROM unnest(qt.tokens) tok
    WHERE sp.search_text NOT LIKE '%' || tok || '%'
  )
  ORDER BY sp.total_stock DESC, sp.product_name ASC
  LIMIT COALESCE(p_limit, 20);
$$;


--
-- Name: approve_exchange(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_exchange(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: approve_liquidation(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_liquidation(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: approve_receipt(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_receipt(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_status public.receipt_status;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý được duyệt đặt hàng'; end if;
  
  select status into v_status from public.receipts where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu đặt hàng'; end if;
  if v_status <> 'draft' then raise exception 'Phiếu không ở trạng thái chờ duyệt (hiện tại: %)', v_status; end if;

  update public.receipts
  set status = 'approved',
      approved_by = p_by,
      approved_at = now(),
      updated_at = now()
  where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'receipt.approve', 'receipt', p_id,
          jsonb_build_object('status', 'draft'), jsonb_build_object('status', 'approved'));
end;
$$;


--
-- Name: approve_requisition(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_requisition(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare 
  v_status public.requisition_status;
  it record;
  component record;
  v_main uuid;
  v_res_id uuid;
begin
  if not public.can_post_inventory() then raise exception 'Chỉ quản lý kho được duyệt'; end if;
  select status into v_status from public.requisitions where id = p_id for update;
  if v_status <> 'pending' then raise exception 'Phiếu không ở trạng thái đang chờ (hiện tại: %)', v_status; end if;

  select id into v_main from public.stock_locations where code = 'KHO_CHINH';

  update public.requisitions
  set status = 'approved', approved_by = p_by, approved_at = now()
  where id = p_id;

  -- Reserve the SKU itself, or reserve each component for a virtual kit using
  -- the active BOM version as the immutable allocation snapshot.
  for it in
    select ri.*, v.inventory_policy
    from public.requisition_items ri
    join public.skus v on v.id = ri.sku_id
    where ri.requisition_id = p_id
    order by ri.sku_id
  loop
    if it.inventory_policy = 'virtual_kit' then
      for component in
        select bi.component_sku_id,
               bi.base_quantity * (1 + bi.wastage_percent / 100) * coalesce(it.quantity, it.entered_quantity) as required_quantity,
               bh.active_version_id as bom_version_id
        from public.bom_headers bh
        join public.bom_items bi on bi.bom_version_id = bh.active_version_id
        where bh.sku_id = it.sku_id and bh.active_version_id is not null
        order by bi.component_sku_id
      loop
        v_res_id := public.reserve_stock(jsonb_build_object(
          'sku_id', component.component_sku_id,
          'location_id', v_main,
          'source_document_type', 'requisition',
          'source_document_id', p_id,
          'source_document_line_id', it.id,
          'base_quantity', component.required_quantity,
          'idempotency_key', 'res-req-' || p_id::text || '-' || it.id::text || '-' || component.component_sku_id::text
        ));
        update public.stock_reservations
        set bom_version_id = component.bom_version_id
        where id = v_res_id;
      end loop;
      if not found then raise exception 'Bộ vật tư % chưa có BOM đang hoạt động', it.sku_id; end if;
    else
      perform public.reserve_stock(jsonb_build_object(
        'sku_id', it.sku_id,
        'location_id', v_main,
        'source_document_type', 'requisition',
        'source_document_id', p_id,
        'source_document_line_id', it.id,
        'base_quantity', it.quantity,
        'idempotency_key', 'res-req-' || p_id::text || '-' || it.id::text
      ));
    end if;
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'requisition.approve', 'requisition', p_id,
          jsonb_build_object('status','pending'), jsonb_build_object('status','approved'));
end;
$$;


--
-- Name: audit_normalized_catalog_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_normalized_catalog_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_id uuid; v_before jsonb; v_after jsonb;
begin
  v_before := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  v_after := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end;
  v_id := coalesce((v_after->>'id')::uuid,(v_before->>'id')::uuid,(v_after->>'sku_id')::uuid,(v_before->>'sku_id')::uuid,(v_after->>'product_id')::uuid,(v_before->>'product_id')::uuid);
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,before,after)
  values(auth.uid(),'catalog.'||lower(tg_op),tg_table_name,v_id,v_before,v_after);
  return case when tg_op='DELETE' then old else new end;
end $$;


--
-- Name: can_activate_bom(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_activate_bom() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists(select 1 from public.profiles
    where id=auth.uid() and is_active
      and role in ('superuser','owner','warehouse'));
$$;


--
-- Name: can_approve_stocktake_adjustment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_approve_stocktake_adjustment() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists(select 1 from public.profiles
    where id=auth.uid() and is_active
      and role in ('superuser','owner','accountant'));
$$;


--
-- Name: can_edit_bom(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_edit_bom() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists(select 1 from public.profiles
    where id=auth.uid() and is_active
      and role in ('superuser','owner','warehouse','technician'));
$$;


--
-- Name: can_post_inventory(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_post_inventory() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists(select 1 from public.profiles
    where id=auth.uid() and is_active
      and role in ('superuser','owner','accountant','warehouse'));
$$;


--
-- Name: can_post_technician_inventory(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_post_technician_inventory() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists(select 1 from public.profiles
    where id=auth.uid() and is_active
      and role in ('superuser','owner','warehouse','technician'));
$$;


--
-- Name: cancel_defect(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_defect(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: cancel_exchange(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_exchange(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: cancel_fuel_dispense(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_fuel_dispense(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_dispense record;
  v_new_stock numeric;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý mới được hủy phiếu cấp phát dầu'; end if;

  select * into v_dispense from public.fuel_dispenses where id = p_id for update;
  if v_dispense.id is null then raise exception 'Không tìm thấy phiếu cấp dầu'; end if;
  if v_dispense.status = 'cancelled' then raise exception 'Phiếu cấp dầu đã bị hủy trước đó'; end if;

  -- Hoàn lại tồn kho
  update public.fuel_types
  set current_stock = current_stock + v_dispense.quantity, updated_at = now()
  where id = v_dispense.fuel_type_id
  returning current_stock into v_new_stock;

  update public.fuel_dispenses
  set status = 'cancelled', updated_at = now()
  where id = p_id;

  -- Ghi sổ cái
  insert into public.fuel_movements (
    fuel_type_id, movement_type, quantity, balance_after, ref_type, ref_id, notes, created_by
  ) values (
    v_dispense.fuel_type_id, 'cancel_revert', v_dispense.quantity, v_new_stock,
    'fuel_dispenses', p_id, 'Hủy phiếu cấp phát: ' || v_dispense.code, p_by
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'fuel_dispense.cancel', 'fuel_dispense', p_id, jsonb_build_object('code', v_dispense.code));
end;
$$;


--
-- Name: cancel_fuel_receipt(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_fuel_receipt(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_receipt record;
  v_cur_stock numeric;
  v_new_stock numeric;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý mới được hủy phiếu nhập dầu'; end if;

  select * into v_receipt from public.fuel_receipts where id = p_id for update;
  if v_receipt.id is null then raise exception 'Không tìm thấy phiếu nhập dầu'; end if;
  if v_receipt.status = 'cancelled' then raise exception 'Phiếu nhập dầu đã bị hủy trước đó'; end if;

  select current_stock into v_cur_stock from public.fuel_types where id = v_receipt.fuel_type_id for update;
  if v_cur_stock < v_receipt.quantity then
    raise exception 'Không thể hủy phiếu nhập vì tồn kho hiện tại (%) nhỏ hơn số lượng nhập cần trừ lại (%)', v_cur_stock, v_receipt.quantity;
  end if;

  update public.fuel_types
  set current_stock = current_stock - v_receipt.quantity, updated_at = now()
  where id = v_receipt.fuel_type_id
  returning current_stock into v_new_stock;

  update public.fuel_receipts
  set status = 'cancelled', updated_at = now()
  where id = p_id;

  insert into public.fuel_movements (
    fuel_type_id, movement_type, quantity, balance_after, ref_type, ref_id, notes, created_by
  ) values (
    v_receipt.fuel_type_id, 'cancel_revert', -v_receipt.quantity, v_new_stock,
    'fuel_receipts', p_id, 'Hủy phiếu nhập: ' || v_receipt.code, p_by
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'fuel_receipt.cancel', 'fuel_receipt', p_id, jsonb_build_object('code', v_receipt.code));
end;
$$;


--
-- Name: cancel_issue(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_issue(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_status text;
begin
  if not public.can_post_inventory() then raise exception 'Chỉ quản lý kho được hủy phiếu xuất'; end if;
  select status into v_status from public.issues where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu xuất'; end if;
  if v_status <> 'draft' then raise exception 'Chỉ phiếu nháp mới được hủy (hiện tại: %)', v_status; end if;
  update public.issues set status = 'cancelled', updated_at = now() where id = p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'issue.cancel', 'issue', p_id,
          jsonb_build_object('status','draft'), jsonb_build_object('status','cancelled'));
end;
$$;


--
-- Name: cancel_liquidation(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_liquidation(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: cancel_receipt(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_receipt(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_status public.receipt_status;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được hủy phiếu nhập'; end if;
  select status into v_status from public.receipts where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu nhập'; end if;
  if v_status not in ('draft', 'approved') then
    raise exception 'Chỉ phiếu chưa nhập kho mới được hủy (hiện tại: %)', v_status;
  end if;

  update public.receipts set status = 'cancelled' where id = p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'receipt.cancel', 'receipt', p_id,
          jsonb_build_object('status', v_status), jsonb_build_object('status', 'cancelled'));
end;
$$;


--
-- Name: cancel_repair(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_repair(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

  for r in select * from public.repair_order_items where repair_order_id = p_id order by sku_id loop
    perform public._move_stock(r.sku_id, v_sua, v_hong, r.quantity, 'transfer', 'repair', p_id, p_by, 'Hủy phiếu sửa');
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


--
-- Name: cancel_repair_request(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_repair_request(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: cancel_requisition(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_requisition(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_status public.requisition_status; v_requester uuid; r record;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select status,requester_id into v_status,v_requester from public.requisitions where id=p_id for update;
  if v_requester is distinct from auth.uid() and not public.can_post_inventory() then raise exception 'Chỉ người yêu cầu mới được hủy'; end if;
  if v_status not in ('draft','pending','approved') then raise exception 'Không thể hủy phiếu ở trạng thái %',v_status; end if;
  if v_status='approved' then
    for r in select id from public.stock_reservations where source_document_type='requisition' and source_document_id=p_id and status in ('active','partially_consumed') loop
      perform public.release_reservation(r.id,p_by);
    end loop;
  end if;
  update public.requisitions set status='cancelled' where id=p_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,before,after)
  values(p_by,'requisition.cancel','requisition',p_id,jsonb_build_object('status',v_status),jsonb_build_object('status','cancelled'));
end $$;


--
-- Name: cancel_tool_borrowing(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_tool_borrowing(p_borrowing_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_status public.tool_borrowing_status;
  v_borrower uuid;
  v_main_loc uuid;
  it record;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select status, borrower_id into v_status, v_borrower from public.tool_borrowings where id = p_borrowing_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu mượn'; end if;
  if v_status <> 'borrowed' then raise exception 'Chỉ có thể hủy phiếu đang mượn'; end if;
  if v_borrower is distinct from auth.uid() and not public.is_manager() then
    raise exception 'Chỉ người mượn hoặc quản lý mới được hủy phiếu';
  end if;

  -- Không cho hủy nếu đã có dòng trả lại
  if exists (
    select 1 from public.tool_borrowing_items where borrowing_id = p_borrowing_id and returned_quantity > 0
  ) then
    raise exception 'Phiếu đã có dụng cụ được trả, không thể hủy';
  end if;

  select id into v_main_loc from public.stock_locations where code = 'KHO_CHINH';

  -- Hoàn trả tồn kho Kho chính
  for it in select sku_id, quantity from public.tool_borrowing_items where borrowing_id = p_borrowing_id loop
    perform public._move_stock(
      it.sku_id,
      null,
      v_main_loc,
      it.quantity,
      'tool_return_in',
      'tool_borrowing',
      p_borrowing_id,
      p_by,
      'Hủy phiếu mượn dụng cụ'
    );
  end loop;

  update public.tool_borrowings set status = 'cancelled' where id = p_borrowing_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'tool_borrowing.cancel', 'tool_borrowing', p_borrowing_id, jsonb_build_object('status', 'cancelled'));
end;
$$;


--
-- Name: complete_liquidation(uuid, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_liquidation(p_id uuid, p_items_outcome jsonb, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

  for r in select * from public.liquidation_items where liquidation_note_id = p_id order by sku_id loop
    perform public._move_stock(r.sku_id, v_hong, null, r.quantity, 'liquidation_out', 'liquidation', p_id, p_by);
  end loop;

  update public.liquidation_notes set status = 'completed', completed_at = now() where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'liquidation.complete', 'liquidation', p_id,
          jsonb_build_object('status','approved'), jsonb_build_object('status','completed'));
end;
$$;


--
-- Name: complete_repair(uuid, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_repair(p_repair_id uuid, p_outcomes jsonb, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

  for r in select roi.* from public.repair_order_items roi where roi.repair_order_id = p_repair_id order by roi.sku_id loop
    if r.outcome = 'returned_to_stock' then
      perform public._post_inventory_movement(jsonb_build_object(
        'document_type', 'repair_return_in',
        'ref_type', 'repair',
        'document_id', p_repair_id,
        'idempotency_key', 'repair-return-' || r.id || '-' || p_repair_id,
        'actor_id', p_by,
        'lines', jsonb_build_array(jsonb_build_object(
          'sku_id', r.sku_id,
          'from_location_id', v_sua,
          'to_location_id', v_main,
          'entered_quantity', r.quantity
        ))
      ));
      update public.defect_note_items set resolution = 'repaired' where id = r.defect_item_id;
    elsif r.outcome = 'liquidation' then
      perform public._post_inventory_movement(jsonb_build_object(
        'document_type', 'transfer',
        'ref_type', 'repair',
        'document_id', p_repair_id,
        'idempotency_key', 'repair-liq-transfer-' || r.id || '-' || p_repair_id,
        'actor_id', p_by,
        'notes', 'Sửa không được → chờ thanh lý',
        'lines', jsonb_build_array(jsonb_build_object(
          'sku_id', r.sku_id,
          'from_location_id', v_sua,
          'to_location_id', v_hong,
          'entered_quantity', r.quantity
        ))
      ));
      update public.defect_note_items set resolution = 'liquidated' where id = r.defect_item_id;
    else
      raise exception 'Thiếu kết quả xử lý cho item %', r.id;
    end if;
  end loop;

  update public.repair_orders set status = 'returned', returned_at = now(), total_cost = (
    select coalesce(sum(cost),0) from public.repair_order_items where repair_order_id = p_repair_id
  ) where id = p_repair_id;

  update public.defect_notes d set status = (
    case
      when exists (
        select 1 from public.defect_note_items dni
        where dni.defect_note_id = d.id and (dni.resolution is null or dni.resolution = 'liquidated')
      ) then 'liquidated'::public.defect_status
      else 'returned'::public.defect_status
    end
  )
  where d.id in (
    select distinct dni.defect_note_id from public.defect_note_items dni
    join public.repair_order_items roi on roi.defect_item_id = dni.id
    where roi.repair_order_id = p_repair_id
  )
  and not exists (
    select 1 from public.defect_note_items dni where dni.defect_note_id = d.id and dni.resolution is null
  );
end;
$$;


--
-- Name: consume_reservation(uuid, numeric, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.consume_reservation(p_reservation_id uuid, p_quantity numeric, p_actor uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_actor uuid:=coalesce(auth.uid(),p_actor); v_r public.stock_reservations%rowtype; v_remaining numeric; v_new_consumed numeric;
begin
  if not public._posting_actor_has_role(v_actor,array['superuser','owner','accountant','warehouse']) then
    raise exception 'Actor không có quyền dùng giữ tồn'; end if;
  select * into v_r from public.stock_reservations where id=p_reservation_id for update;
  if not found then raise exception 'Không tìm thấy reservation'; end if;
  if p_quantity <= 0 then raise exception 'Số lượng consume phải lớn hơn 0'; end if;
  if v_r.status not in ('active','partially_consumed') then
    raise exception 'Reservation đang ở trạng thái %', v_r.status;
  end if;
  v_remaining := v_r.reserved_quantity - v_r.consumed_quantity;
  if p_quantity > v_remaining then raise exception 'Vượt quá số đã giữ: còn %', v_remaining; end if;
  v_new_consumed := v_r.consumed_quantity + p_quantity;
  update public.stock_reservations
    set consumed_quantity=v_new_consumed,
        status=case when v_new_consumed >= v_r.reserved_quantity then 'consumed' else 'partially_consumed' end,
        updated_at=now()
    where id=p_reservation_id;
  update public.stock_balances set reserved_quantity=greatest(reserved_quantity-p_quantity,0), updated_at=now()
    where sku_id=v_r.sku_id and location_id=v_r.location_id;
end $$;


--
-- Name: create_exchange(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_exchange(p_defect_id uuid, p_by uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
  v_status public.defect_status;
  it record;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select status into v_status from public.defect_notes where id = p_defect_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu hỏng'; end if;
  if v_status <> 'staging' then raise exception 'Chỉ tạo đổi mới cho phiếu hỏng đang tập kết (hiện tại: %)', v_status; end if;

  if exists (select 1 from public.exchange_notes where linked_defect_id = p_defect_id and status in ('pending','approved','issued','received')) then
    raise exception 'Phiếu hỏng này đã có phiếu Đổi Mới đang xử lý';
  end if;

  insert into public.exchange_notes (code, linked_defect_id, created_by)
  values (public.next_code('DM', 'public.exchange_notes_seq'::regclass), p_defect_id, p_by)
  returning id into v_id;

  for it in select dni.* from public.defect_note_items dni where dni.defect_note_id = p_defect_id order by dni.id loop
    insert into public.exchange_note_items (exchange_note_id, sku_id, quantity, entered_quantity)
    values (v_id, it.sku_id, it.quantity, coalesce(it.entered_quantity, it.quantity));
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'exchange.create', 'exchange', v_id, jsonb_build_object('status','pending'));
  return v_id;
end;
$$;


--
-- Name: create_fuel_dispense(uuid, uuid, uuid, numeric, numeric, text, text[], text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_fuel_dispense(p_vehicle_id uuid, p_zone_id uuid, p_fuel_type_id uuid, p_quantity numeric, p_current_odo numeric, p_driver_name text, p_meter_images text[], p_notes text, p_by uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
  v_code text;
  v_cur_stock numeric;
  v_new_stock numeric;
  v_prev_odo numeric := null;
  v_odo_unit public.fuel_calc_unit := 'km';
  v_usage_diff numeric := null;
  v_rate numeric := null;
  v_vehicle_zone uuid := null;
  v_target_zone uuid := null;
  v_driver text := null;
begin
  if auth.uid() is null and p_by is null and auth.role() is distinct from 'service_role' and current_user != 'postgres' then
    raise exception 'Yêu cầu đăng nhập để cấp phát dầu';
  end if;
  if auth.uid() is not null then
    p_by := auth.uid();
  end if;
  if p_by is not null and not exists (select 1 from public.profiles where id = p_by and is_active = true) then
    raise exception 'Tài khoản không hợp lệ hoặc đã bị khóa';
  end if;

  if p_quantity is null or p_quantity <= 0 then raise exception 'Số lượng cấp dầu phải lớn hơn 0'; end if;

  -- Kiểm tra và khóa tồn kho
  select current_stock into v_cur_stock
  from public.fuel_types
  where id = p_fuel_type_id for update;

  if v_cur_stock is null then raise exception 'Không tìm thấy loại dầu chỉ định'; end if;
  if v_cur_stock < p_quantity then
    raise exception 'Không đủ tồn kho dầu (Tồn hiện tại: % Lít, Yêu cầu: % Lít)', v_cur_stock, p_quantity;
  end if;

  -- Nếu có xe, lấy thông tin xe
  if p_vehicle_id is not null then
    select current_odo, odo_unit, zone_id, default_driver
    into v_prev_odo, v_odo_unit, v_vehicle_zone, v_driver
    from public.vehicles
    where id = p_vehicle_id for update;

    if p_current_odo is not null and v_prev_odo is not null and p_current_odo >= v_prev_odo then
      v_usage_diff := p_current_odo - v_prev_odo;
      if v_usage_diff > 0 then
        if v_odo_unit = 'km' then
          v_rate := round((p_quantity / v_usage_diff * 100)::numeric, 2); -- Lít / 100km
        else
          v_rate := round((p_quantity / v_usage_diff)::numeric, 2); -- Lít / giờ
        end if;
      end if;

      -- Cập nhật Odo mới cho xe
      update public.vehicles
      set current_odo = p_current_odo, updated_at = now()
      where id = p_vehicle_id;
    end if;
  end if;

  v_target_zone := coalesce(p_zone_id, v_vehicle_zone);
  v_driver := coalesce(nullif(trim(p_driver_name), ''), v_driver);

  -- Trừ tồn kho
  update public.fuel_types
  set current_stock = current_stock - p_quantity, updated_at = now()
  where id = p_fuel_type_id
  returning current_stock into v_new_stock;

  v_code := public.next_code('CKD', 'public.fuel_dispenses_seq'::regclass);

  insert into public.fuel_dispenses (
    code, vehicle_id, zone_id, fuel_type_id, quantity,
    previous_odo, current_odo, usage_diff, consumption_rate,
    driver_name, dispenser_id, meter_images, notes, status
  ) values (
    v_code, p_vehicle_id, v_target_zone, p_fuel_type_id, p_quantity,
    v_prev_odo, p_current_odo, v_usage_diff, v_rate,
    v_driver, p_by, coalesce(p_meter_images, '{}'), nullif(trim(p_notes), ''), 'completed'
  ) returning id into v_id;

  -- Ghi sổ cái
  insert into public.fuel_movements (
    fuel_type_id, movement_type, quantity, balance_after, ref_type, ref_id, notes, created_by
  ) values (
    p_fuel_type_id, 'dispense_out', p_quantity, v_new_stock, 'fuel_dispenses', v_id,
    'Cấp phát dầu: ' || v_code, p_by
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'fuel_dispense.create', 'fuel_dispense', v_id, jsonb_build_object('code', v_code, 'qty', p_quantity));

  return v_id;
end;
$$;


--
-- Name: create_fuel_dispense(uuid, uuid, uuid, numeric, numeric, text, text[], text, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_fuel_dispense(p_vehicle_id uuid, p_zone_id uuid, p_fuel_type_id uuid, p_quantity numeric, p_current_odo numeric, p_driver_name text, p_meter_images text[], p_notes text, p_by uuid, p_sub_zone_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
  v_code text;
  v_cur_stock numeric;
  v_new_stock numeric;
  v_prev_odo numeric := null;
  v_odo_unit public.fuel_calc_unit := 'km';
  v_usage_diff numeric := null;
  v_rate numeric := null;
  v_vehicle_zone uuid := null;
  v_vehicle_sub_zone uuid := null;
  v_target_zone uuid := null;
  v_target_sub_zone uuid := null;
  v_driver text := null;
begin
  if auth.uid() is null and p_by is null and auth.role() is distinct from 'service_role' and current_user != 'postgres' then
    raise exception 'Yêu cầu đăng nhập để cấp phát dầu';
  end if;
  if auth.uid() is not null then
    p_by := auth.uid();
  end if;
  if p_by is not null and not exists (select 1 from public.profiles where id = p_by and is_active = true) then
    raise exception 'Tài khoản không hợp lệ hoặc đã bị khóa';
  end if;

  if p_quantity is null or p_quantity <= 0 then raise exception 'Số lượng cấp dầu phải lớn hơn 0'; end if;

  -- Kiểm tra và khóa tồn kho
  select current_stock into v_cur_stock
  from public.fuel_types
  where id = p_fuel_type_id for update;

  if v_cur_stock is null then raise exception 'Không tìm thấy loại dầu chỉ định'; end if;
  if v_cur_stock < p_quantity then
    raise exception 'Không đủ tồn kho dầu (Tồn hiện tại: % Lít, Yêu cầu: % Lít)', v_cur_stock, p_quantity;
  end if;

  -- Nếu có xe, lấy thông tin xe
  if p_vehicle_id is not null then
    select current_odo, odo_unit, zone_id, sub_zone_id, default_driver
    into v_prev_odo, v_odo_unit, v_vehicle_zone, v_vehicle_sub_zone, v_driver
    from public.vehicles
    where id = p_vehicle_id for update;

    if p_current_odo is not null and v_prev_odo is not null and p_current_odo >= v_prev_odo then
      v_usage_diff := p_current_odo - v_prev_odo;
      if v_usage_diff > 0 then
        if v_odo_unit = 'km' then
          v_rate := round((p_quantity / v_usage_diff * 100)::numeric, 2); -- Lít / 100km
        else
          v_rate := round((p_quantity / v_usage_diff)::numeric, 2);       -- Lít / Giờ
        end if;
      end if;
    end if;
  end if;

  -- Xác định khu vực & người lái
  v_target_zone := coalesce(p_zone_id, v_vehicle_zone);
  v_target_sub_zone := coalesce(p_sub_zone_id, v_vehicle_sub_zone);
  v_driver := coalesce(nullif(trim(p_driver_name), ''), v_driver);

  v_code := public.next_code('CPD', 'public.fuel_dispenses_seq'::regclass);
  v_new_stock := v_cur_stock - p_quantity;

  -- Ghi nhận phiếu cấp phát
  insert into public.fuel_dispenses (
    code, vehicle_id, zone_id, sub_zone_id, fuel_type_id, quantity,
    prev_odo, current_odo, usage_diff, consumption_rate,
    driver_name, meter_images, notes, created_by
  ) values (
    v_code, p_vehicle_id, v_target_zone, v_target_sub_zone, p_fuel_type_id, p_quantity,
    v_prev_odo, p_current_odo, v_usage_diff, v_rate,
    v_driver, coalesce(p_meter_images, '{}'), nullif(trim(p_notes), ''), p_by
  ) returning id into v_id;

  -- Cập nhật tồn kho loại dầu
  update public.fuel_types
  set current_stock = v_new_stock, updated_at = now()
  where id = p_fuel_type_id;

  -- Cập nhật ODO xe nếu có nhập ODO mới hợp lệ
  if p_vehicle_id is not null and p_current_odo is not null and (v_prev_odo is null or p_current_odo >= v_prev_odo) then
    update public.vehicles
    set current_odo = p_current_odo, updated_at = now()
    where id = p_vehicle_id;
  end if;

  return v_id;
end;
$$;


--
-- Name: create_fuel_receipt(uuid, uuid, numeric, numeric, text, text[], text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_fuel_receipt(p_supplier_id uuid, p_fuel_type_id uuid, p_quantity numeric, p_unit_price numeric, p_invoice_number text, p_invoice_images text[], p_notes text, p_by uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
  v_code text;
  v_new_stock numeric;
  v_unit_price numeric;
  v_total_amount numeric;
begin
  if not public.is_manager() and auth.role() is distinct from 'service_role' and current_user != 'postgres' then
    raise exception 'Chỉ quản lý mới được lập phiếu nhập dầu';
  end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Số lượng nhập phải lớn hơn 0'; end if;
  if auth.uid() is not null then
    p_by := auth.uid();
  end if;

  v_unit_price := coalesce(p_unit_price, 0);
  v_total_amount := p_quantity * v_unit_price;
  v_code := public.next_code('NKD', 'public.fuel_receipts_seq'::regclass);

  -- Khóa và tăng tồn kho
  update public.fuel_types
  set current_stock = current_stock + p_quantity, updated_at = now()
  where id = p_fuel_type_id
  returning current_stock into v_new_stock;

  if v_new_stock is null then raise exception 'Không tìm thấy loại dầu'; end if;

  insert into public.fuel_receipts (
    code, supplier_id, fuel_type_id, quantity, unit_price, total_amount,
    invoice_number, invoice_images, received_by, notes, status
  ) values (
    v_code, p_supplier_id, p_fuel_type_id, p_quantity, v_unit_price, v_total_amount,
    nullif(trim(p_invoice_number), ''), coalesce(p_invoice_images, '{}'), p_by, nullif(trim(p_notes), ''), 'completed'
  ) returning id into v_id;

  -- Ghi sổ cái
  insert into public.fuel_movements (
    fuel_type_id, movement_type, quantity, balance_after, ref_type, ref_id, notes, created_by
  ) values (
    p_fuel_type_id, 'receipt_in', p_quantity, v_new_stock, 'fuel_receipts', v_id,
    'Nhập kho dầu: ' || v_code, p_by
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'fuel_receipt.create', 'fuel_receipt', v_id, jsonb_build_object('code', v_code, 'qty', p_quantity));

  return v_id;
end;
$$;


--
-- Name: create_issue(jsonb, text, uuid, uuid, text, text, text, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_issue(p_items jsonb, p_destination_type text, p_zone_id uuid, p_customer_id uuid, p_vehicle_plate text, p_driver_name text, p_notes text, p_by uuid, p_sub_zone_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
  it record;
  v_sku_id uuid;
  v_tu_id uuid;
  v_entered numeric;
  v_factor numeric;
  v_base_qty numeric;
  v_scale smallint;
  v_price numeric;
begin
  if not public.can_post_inventory() then raise exception 'Chỉ quản lý kho được lập phiếu xuất'; end if;
  if p_destination_type not in ('zone','customer') then raise exception 'Kiểu đích không hợp lệ'; end if;
  if p_destination_type = 'zone' and p_zone_id is null then raise exception 'Phải chọn khu nhận'; end if;
  if p_destination_type = 'customer' and p_customer_id is null then raise exception 'Phải chọn khách hàng'; end if;

  insert into public.issues
    (code, destination_type, zone_id, sub_zone_id, customer_id, vehicle_plate, driver_name, creator_id, notes)
  values (
    public.next_code('PXK', 'public.issues_seq'::regclass),
    p_destination_type, p_zone_id, p_sub_zone_id, p_customer_id,
    nullif(p_vehicle_plate,''), nullif(p_driver_name,''), p_by, nullif(p_notes,'')
  )
  returning id into v_id;

  for it in select value from jsonb_array_elements(p_items) loop
    v_sku_id := coalesce(nullif(it.value->>'sku_id',''), nullif(it.value->>'sku_id',''))::uuid;
    if v_sku_id is null then raise exception 'Dòng thiếu SKU ID'; end if;
    v_tu_id := nullif(it.value->>'transaction_unit_id','')::uuid;
    v_entered := coalesce((it.value->>'entered_quantity')::numeric, (it.value->>'quantity')::numeric);
    if v_entered is null or v_entered <= 0 then raise exception 'Số lượng xuất phải lớn hơn 0'; end if;

    v_price := nullif(it.value->>'unit_price','')::numeric;
    if p_destination_type = 'customer' and (v_price is null or v_price <= 0) then
      raise exception 'Xuất bán cho khách phải có đơn giá lớn hơn 0';
    end if;

    select decimal_scale into v_scale from public.units u join public.skus v on v.base_unit_id = u.id where v.id = v_sku_id;
    if v_tu_id is not null then
      select factor_to_base into v_factor from public.sku_transaction_units where id = v_tu_id and sku_id = v_sku_id;
    else
      v_factor := 1;
    end if;
    v_factor := coalesce(v_factor, 1);
    v_base_qty := round(v_entered * v_factor, coalesce(v_scale, 2));

    insert into public.issue_items (
      issue_id, sku_id, quantity, unit_price,
      transaction_unit_id, entered_quantity, conversion_factor_snapshot, snapshot_quality
    )
    values (
      v_id, v_sku_id, v_base_qty, v_price,
      v_tu_id, v_entered, v_factor, 'complete'
    );
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'issue.create', 'issue', v_id, jsonb_build_object('status','draft'));
  return v_id;
end;
$$;


--
-- Name: create_liquidation(jsonb, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_liquidation(p_items jsonb, p_reason text, p_by uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
      (liquidation_note_id, sku_id, source_item_id, quantity, method, unit_value, notes)
    values (
      v_id,
      (it.value->>'sku_id')::uuid,
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


--
-- Name: create_notification(uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_notification(p_user_id uuid, p_type text, p_title text, p_body text DEFAULT NULL::text, p_link text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if p_user_id is null then return; end if;
  insert into public.notifications (user_id, type, title, body, link)
  values (p_user_id, p_type, p_title, p_body, p_link);
end;
$$;


--
-- Name: create_receipt(jsonb, uuid, uuid, text, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_receipt(p_items jsonb, p_supplier_id uuid, p_by uuid, p_notes text DEFAULT NULL::text, p_invoice_images text[] DEFAULT '{}'::text[]) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
  it record;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được tạo phiếu nhập'; end if;
  insert into public.receipts (code, supplier_id, notes, created_by, invoice_images)
  values (public.next_code('GRN', 'public.receipts_seq'::regclass), p_supplier_id, p_notes, p_by, coalesce(p_invoice_images, '{}'))
  returning id into v_id;

  for it in select value from jsonb_array_elements(p_items) loop
    insert into public.receipt_items (receipt_id, sku_id, quantity, unit_cost, batch_no, expiry_date, transaction_unit_id, entered_quantity)
    values (
      v_id,
      (it.value->>'sku_id')::uuid,
      1,
      nullif(it.value->>'unit_cost','')::numeric,
      (it.value->'allocations'->0->>'lot_number'),
      (it.value->'allocations'->0->>'expiry_date')::date,
      nullif(it.value->>'transaction_unit_id','')::uuid,
      (it.value->>'entered_quantity')::numeric
    );
    -- Fix quantity for legacy compatibility until Task 13
    update public.receipt_items ri 
    set quantity = round((it.value->>'entered_quantity')::numeric * coalesce((select factor_to_base from public.sku_transaction_units tu where tu.id = nullif(it.value->>'transaction_unit_id','')::uuid limit 1), 1))
    where ri.receipt_id = v_id and ri.sku_id = (it.value->>'sku_id')::uuid;
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'receipt.create', 'receipt', v_id, jsonb_build_object('status','draft'));
  return v_id;
end;
$$;


--
-- Name: create_requisition(jsonb, uuid, text, public.requisition_type, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_requisition(p_items jsonb, p_zone_id uuid, p_purpose text, p_type public.requisition_type, p_linked_defect_id uuid, p_requester_id uuid, p_sub_zone_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
  it record;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if p_requester_id is distinct from auth.uid() and not public.can_post_inventory() then
    raise exception 'Chỉ được tạo phiếu cho chính mình';
  end if;
  if p_purpose is null or length(trim(p_purpose)) = 0 then
    raise exception 'Mục đích không được trống';
  end if;
  if p_type = 'replacement' and p_linked_defect_id is null then
    raise exception 'Đổi mới phải chọn phiếu hỏng liên quan';
  end if;

  insert into public.requisitions
    (code, requester_id, zone_id, sub_zone_id, purpose, requisition_type, linked_defect_id)
  values
    (public.next_code('REQ', 'public.requisitions_seq'::regclass), p_requester_id, p_zone_id, p_sub_zone_id, p_purpose, p_type, p_linked_defect_id)
  returning id into v_id;

  for it in select value from jsonb_array_elements(p_items) loop
    insert into public.requisition_items (requisition_id, sku_id, quantity, transaction_unit_id, entered_quantity)
    values (
      v_id, 
      (it.value->>'sku_id')::uuid, 
      1,
      nullif(it.value->>'transaction_unit_id','')::uuid,
      (it.value->>'entered_quantity')::numeric
    );
     -- Fix quantity for legacy compatibility until Task 13
    update public.requisition_items ri 
    set quantity = round((it.value->>'entered_quantity')::numeric * coalesce((select factor_to_base from public.sku_transaction_units tu where tu.id = nullif(it.value->>'transaction_unit_id','')::uuid limit 1), 1))
    where ri.requisition_id = v_id and ri.sku_id = (it.value->>'sku_id')::uuid;
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'requisition.create', 'requisition', v_id, jsonb_build_object('status','draft'));

  return v_id;
end;
$$;


--
-- Name: create_stocktake(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_stocktake(p_location_id uuid, p_by uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  return public.create_stocktake(p_location_id, 'Kỳ kiểm kê ' || to_char(now(), 'DD/MM/YYYY HH24:MI'), p_by);
end;
$$;


--
-- Name: create_stocktake(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_stocktake(p_location_id uuid, p_name text, p_by uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
  r record;
begin
  if not public.can_post_inventory() then raise exception 'Chỉ quản lý kho được tạo kiểm kê'; end if;
  if p_name is null or length(trim(p_name)) = 0 then raise exception 'Phải nhập tên phiếu kiểm kê'; end if;

  insert into public.stocktake_sessions (code, name, location_id, created_by)
  values (public.next_code('PKK', 'public.stocktake_seq'::regclass), trim(p_name), p_location_id, p_by)
  returning id into v_id;

  -- Exclude virtual kits from physical stocktake; count stocked assemblies and standard SKUs normally.
  for r in
    select sb.sku_id, sb.quantity
    from public.stock_balances sb
    join public.skus v on v.id = sb.sku_id
    where sb.location_id = p_location_id
      and sb.quantity > 0
      and v.inventory_policy <> 'virtual_kit'
    order by sb.sku_id
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


--
-- Name: create_tool_borrowing(jsonb, uuid, text, date, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_tool_borrowing(p_items jsonb, p_zone_id uuid, p_purpose text, p_expected_return_date date, p_borrower_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
  v_code text;
  v_main_loc uuid;
  it record;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if p_purpose is null or length(trim(p_purpose)) = 0 then raise exception 'Mục đích mượn không được để trống'; end if;
  if p_borrower_id is distinct from auth.uid() and not public.is_manager() then
    raise exception 'Chỉ quản lý kho mới được tạo phiếu mượn hộ người khác';
  end if;

  select id into v_main_loc from public.stock_locations where code = 'KHO_CHINH';
  v_code := public.next_code('MDC', 'public.tool_borrowings_seq'::regclass);

  insert into public.tool_borrowings (
    code, borrower_id, zone_id, purpose, expected_return_date, issued_by, status
  )
  values (
    v_code, p_borrower_id, p_zone_id, p_purpose, p_expected_return_date, auth.uid(), 'borrowed'
  )
  returning id into v_id;

  -- Trừ tồn kho Kho chính & ghi ledger tool_borrow_out
  for it in select value from jsonb_array_elements(p_items) loop
    insert into public.tool_borrowing_items (borrowing_id, sku_id, quantity)
    values (v_id, (it.value->>'sku_id')::uuid, (it.value->>'quantity')::int);

    perform public._move_stock(
      (it.value->>'sku_id')::uuid,
      v_main_loc,
      null,
      (it.value->>'quantity')::int,
      'tool_borrow_out',
      'tool_borrowing',
      v_id,
      auth.uid(),
      'Xuất mượn dụng cụ: ' || p_purpose
    );
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'tool_borrowing.create', 'tool_borrowing', v_id, jsonb_build_object('status', 'borrowed', 'code', v_code));

  return v_id;
end;
$$;


--
-- Name: create_tool_borrowing(jsonb, uuid, text, date, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_tool_borrowing(p_items jsonb, p_zone_id uuid, p_purpose text, p_expected_return_date date, p_borrower_id uuid, p_sub_zone_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
  v_code text;
  v_main_loc uuid;
  it record;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if p_purpose is null or length(trim(p_purpose)) = 0 then raise exception 'Mục đích mượn không được để trống'; end if;
  if p_borrower_id is distinct from auth.uid() and not public.is_manager() then
    raise exception 'Chỉ quản lý kho mới được tạo phiếu mượn hộ người khác';
  end if;

  select id into v_main_loc from public.stock_locations where code = 'KHO_CHINH';
  v_code := public.next_code('MDC', 'public.tool_borrowings_seq'::regclass);

  insert into public.tool_borrowings (
    code, borrower_id, zone_id, sub_zone_id, purpose, expected_return_date, issued_by, status
  )
  values (
    v_code, p_borrower_id, p_zone_id, p_sub_zone_id, p_purpose, p_expected_return_date, auth.uid(), 'borrowed'
  )
  returning id into v_id;

  -- Trừ tồn kho Kho chính & ghi ledger tool_borrow_out
  for it in select value from jsonb_array_elements(p_items) loop
    insert into public.tool_borrowing_items (borrowing_id, sku_id, quantity)
    values (v_id, (it.value->>'sku_id')::uuid, (it.value->>'quantity')::int);

    perform public._move_stock(
      (it.value->>'sku_id')::uuid,
      v_main_loc,
      null,
      (it.value->>'quantity')::int,
      'tool_borrow_out',
      'tool_borrowing',
      v_id,
      auth.uid(),
      'Xuất mượn dụng cụ: ' || p_purpose
    );
  end loop;

  return v_id;
end;
$$;


--
-- Name: delete_defect(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_defect(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: delete_issue(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_issue(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_status text;
begin
  if not public.is_superuser() then raise exception 'Chỉ tài khoản dev (superuser) được xoá phiếu xuất'; end if;
  select status into v_status from public.issues where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu xuất'; end if;

  if v_status = 'posted' then
    perform public._revert_movements('issue', p_id, p_by);
  end if;

  delete from public.issues where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'issue.delete', 'issue', p_id, jsonb_build_object('status', v_status), null);
end;
$$;


--
-- Name: delete_liquidation(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_liquidation(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_status public.liquidation_status;
begin
  if not public.is_superuser() then raise exception 'Chỉ tài khoản dev (superuser) được xoá phiếu thanh lý'; end if;
  select status into v_status from public.liquidation_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu thanh lý'; end if;

  if v_status = 'completed' then
    perform public._revert_movements('liquidation', p_id, p_by);
  end if;

  delete from public.liquidation_notes where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'liquidation.delete', 'liquidation', p_id,
          jsonb_build_object('status', v_status), null);
end;
$$;


--
-- Name: delete_receipt(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_receipt(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_status public.receipt_status;
begin
  if not public.is_superuser() then raise exception 'Chỉ tài khoản dev (superuser) được xoá phiếu nhập'; end if;
  select status into v_status from public.receipts where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu nhập'; end if;

  if v_status = 'posted' then
    if public._receipt_has_active_linked(p_id) then
      raise exception 'Phiếu nhập đã chốt và đã tự cấp phát các phiếu yêu cầu đang ở trạng thái đã cấp/nhận. Hãy xử lý (mở lại/xoá) các phiếu yêu cầu đó TRƯỚC khi xoá phiếu nhập này.';
    end if;
    perform public._revert_movements('receipt', p_id, p_by);
  end if;

  delete from public.receipts where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'receipt.delete', 'receipt', p_id, jsonb_build_object('status', v_status), null);
end;
$$;


--
-- Name: delete_repair(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_repair(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: delete_requisition(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_requisition(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_status public.requisition_status;
begin
  if not public.is_superuser() then raise exception 'Chỉ tài khoản dev (superuser) được xoá phiếu yêu cầu'; end if;
  select status into v_status from public.requisitions where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu yêu cầu'; end if;

  if v_status in ('issued','received') then
    perform public._revert_movements('requisition', p_id, p_by);
  end if;

  delete from public.requisition_returns where requisition_id = p_id;
  delete from public.requisitions where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'requisition.delete', 'requisition', p_id,
          jsonb_build_object('status', v_status), null);
end;
$$;


--
-- Name: delete_stocktake(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_stocktake(p_session_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: enforce_movement_append_only(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_movement_append_only() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  raise exception
    'stock_movements is append-only after catalog cutover; cancel = reversal movement';
  return null;
end $$;


--
-- Name: FUNCTION enforce_movement_append_only(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.enforce_movement_append_only() IS 'INSTALL DISABLED. Attach via Task 13 cutover migration only after revoking old revert helpers.';


--
-- Name: fulfill_requisition(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fulfill_requisition(p_id uuid, p_by uuid, p_notes text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  it record;
  v_main uuid;
  v_status public.requisition_status;
  v_command jsonb := '{}'::jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_res_id uuid;
  reservation record;
begin
  if not public.can_post_inventory() then raise exception 'Chỉ quản lý kho được cấp phát'; end if;
  select id into v_main from public.stock_locations where code = 'KHO_CHINH';

  select status into v_status from public.requisitions where id = p_id for update;
  if v_status <> 'approved' then raise exception 'Phiếu chưa được duyệt (trạng thái: %)', v_status; end if;

  for it in select * from public.requisition_items where requisition_id = p_id order by sku_id loop
    v_res_id := null;
    for reservation in
      select * from public.stock_reservations
      where source_document_type = 'requisition'
        and source_document_line_id = it.id
        and status in ('active','partially_consumed')
      order by sku_id
    loop
      v_res_id := reservation.id;
      perform public.post_reserved_issue(
        reservation.id,
        reservation.reserved_quantity - reservation.consumed_quantity,
        p_id,
        '[]'::jsonb,
        'issued-res-req-' || p_id::text || '-' || reservation.id::text,
        p_by
      );
    end loop;
    if v_res_id is null then
      -- No reservation (pre-migration phiếu không có reservation, hoặc reservation đã consumed hết).
      -- Fall back to direct issue so legacy approved requisitions can still be fulfilled.
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object(
          'sku_id', it.sku_id,
          'from_location_id', v_main,
          'entered_quantity', coalesce(it.entered_quantity, it.quantity),
          'transaction_unit_id', it.transaction_unit_id
        )
      );
    end if;

    update public.requisition_items 
    set snapshot_quality = 'complete',
        conversion_factor_snapshot = coalesce((select factor_to_base from public.sku_transaction_units tu where tu.id = it.transaction_unit_id limit 1), 1)
    where id = it.id;
  end loop;

  if jsonb_array_length(v_lines) > 0 then
    perform public.post_direct_issue_command(jsonb_build_object(
      'document_id', p_id,
      'idempotency_key', 'issue-direct-req-' || p_id::text,
      'notes', p_notes,
      'lines', v_lines
    ));
  end if;

  update public.requisitions set status = 'issued', fulfilled_by = p_by, fulfilled_at = now(), fulfillment_notes = p_notes where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'requisition.fulfill', 'requisition', p_id,
          jsonb_build_object('status', 'approved'), jsonb_build_object('status', 'issued'));
end;
$$;


--
-- Name: generate_sku_code_if_null(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_sku_code_if_null() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF new.sku_code IS NULL OR btrim(new.sku_code) = '' THEN
    new.sku_code := public.next_code('SKU', 'public.skus_seq');
  END IF;
  RETURN new;
END;
$$;


--
-- Name: get_login_email(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_login_email(p_username text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select u.email::text
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(p.username) = lower(p_username)
    and p.is_active
  limit 1;
$$;


--
-- Name: get_vehicle_by_qr(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_vehicle_by_qr(p_qr_text text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_veh record;
  v_last_dispense record;
begin
  if auth.uid() is null and auth.role() is distinct from 'service_role' and current_user != 'postgres' then
    raise exception 'Yêu cầu đăng nhập để xem thông tin phương tiện';
  end if;

  if p_qr_text is null or length(trim(p_qr_text)) = 0 then
    return null;
  end if;

  select v.*, z.name as zone_name, ft.name as fuel_type_name, ft.code as fuel_type_code, ft.unit as fuel_unit
  into v_veh
  from public.vehicles v
  left join public.zones z on z.id = v.zone_id
  left join public.fuel_types ft on ft.id = v.fuel_type_id
  where v.qr_token = trim(p_qr_text)
     or upper(v.code) = upper(trim(p_qr_text))
  limit 1;

  if v_veh.id is null then
    return null;
  end if;

  select code, quantity, current_odo, consumption_rate, created_at
  into v_last_dispense
  from public.fuel_dispenses
  where vehicle_id = v_veh.id and status = 'completed'
  order by created_at desc
  limit 1;

  return jsonb_build_object(
    'id', v_veh.id,
    'code', v_veh.code,
    'name', v_veh.name,
    'type', v_veh.type,
    'zone_id', v_veh.zone_id,
    'zone_name', v_veh.zone_name,
    'default_driver', v_veh.default_driver,
    'fuel_type_id', v_veh.fuel_type_id,
    'fuel_type_name', v_veh.fuel_type_name,
    'fuel_type_code', v_veh.fuel_type_code,
    'fuel_unit', v_veh.fuel_unit,
    'current_odo', v_veh.current_odo,
    'odo_unit', v_veh.odo_unit,
    'fuel_norm', v_veh.fuel_norm,
    'qr_token', v_veh.qr_token,
    'is_active', v_veh.is_active,
    'last_dispense', case when v_last_dispense.code is not null then
      jsonb_build_object(
        'code', v_last_dispense.code,
        'quantity', v_last_dispense.quantity,
        'current_odo', v_last_dispense.current_odo,
        'consumption_rate', v_last_dispense.consumption_rate,
        'created_at', v_last_dispense.created_at
      ) else null end
  );
end;
$$;


--
-- Name: guard_bom_header_activation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_bom_header_activation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.active_version_id is distinct from old.active_version_id
     and auth.uid() is not null and not public.is_warehouse() then
    raise exception 'Chỉ quản kho/chủ trại/superuser được đặt BOM active';
  end if;
  return new;
end $$;


--
-- Name: guard_bom_version_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_bom_version_mutation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- 1. Phiên bản đã retired là bất biến tuyệt đối
  IF tg_op = 'UPDATE' AND old.status = 'retired' THEN
    RAISE EXCEPTION 'BOM version đã retire là bất biến';
  END IF;

  -- 2. Phiên bản đã scheduled hoặc active chỉ được phép chuyển sang retired (hoặc giữ nguyên khi đóng period)
  IF tg_op = 'UPDATE' AND old.status IN ('scheduled', 'active') THEN
    IF new.status <> 'retired' AND new.status <> old.status THEN
      RAISE EXCEPTION 'BOM version đã kích hoạt chỉ có thể chuyển sang trạng thái retired';
    END IF;
    IF auth.uid() IS NOT NULL AND NOT public.is_warehouse() THEN
      RAISE EXCEPTION 'Chỉ quản kho/chủ trại/superuser được thay đổi trạng thái BOM';
    END IF;
    IF new.bom_header_id <> old.bom_header_id OR new.version_number <> old.version_number THEN
      RAISE EXCEPTION 'Không thể thay đổi cấu trúc định danh của BOM version đã kích hoạt';
    END IF;
  END IF;

  -- 3. Kiểm tra phân quyền và điều kiện khi kích hoạt / lên lịch BOM
  IF new.status IN ('scheduled', 'active') THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_warehouse() THEN
      RAISE EXCEPTION 'Chỉ quản kho/chủ trại/superuser được kích hoạt BOM';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.bom_items parent_item
      JOIN public.bom_versions parent_version ON parent_version.id = parent_item.bom_version_id
      WHERE parent_item.component_sku_id = (SELECT sku_id FROM public.bom_headers WHERE id = new.bom_header_id)
        AND parent_version.status IN ('scheduled', 'active')
    ) THEN
      RAISE EXCEPTION 'SKU đang là linh kiện của BOM active nên không thể kích hoạt BOM riêng';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.bom_items item
      JOIN public.bom_headers child_header ON child_header.sku_id = item.component_sku_id
      JOIN public.bom_versions child_version ON child_version.bom_header_id = child_header.id
      WHERE item.bom_version_id = new.id AND child_version.status IN ('scheduled', 'active')
    ) THEN
      RAISE EXCEPTION 'Linh kiện không được có BOM active';
    END IF;
  END IF;

  RETURN new;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_username text;
  v_email text;
begin
  v_username := nullif(trim(lower(new.raw_user_meta_data->>'username')), '');
  if v_username is null then
    v_username := lower(split_part(coalesce(new.email, ''), '@', 1));
  end if;

  v_email := nullif(trim(lower(new.raw_user_meta_data->>'email')), '');
  if v_email is null and new.email is not null and lower(new.email::text) not like '%@mtp.local' then
    v_email := lower(trim(new.email::text));
  end if;

  insert into public.profiles (id, name, role, zone_id, sub_zone_id, username, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'requester'),
    nullif(new.raw_user_meta_data->>'zone_id','')::uuid,
    nullif(new.raw_user_meta_data->>'sub_zone_id','')::uuid,
    v_username,
    v_email
  )
  on conflict (id) do update
  set email = coalesce(excluded.email, public.profiles.email);
  return new;
end;
$$;


--
-- Name: is_accountant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_accountant() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('accountant', 'owner', 'superuser') and is_active
  );
$$;


--
-- Name: is_manager(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_manager() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('warehouse', 'owner', 'accountant', 'superuser') and is_active
  );
$$;


--
-- Name: is_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_owner() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner', 'superuser') and is_active
  );
$$;


--
-- Name: is_superuser(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_superuser() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'superuser' and is_active
  );
$$;


--
-- Name: is_technician(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_technician() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('technician', 'warehouse', 'owner', 'superuser') and is_active
  );
$$;


--
-- Name: is_warehouse(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_warehouse() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('warehouse', 'owner', 'superuser') and is_active
  );
$$;


--
-- Name: issue_exchange(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.issue_exchange(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

  for it in select i.sku_id, i.quantity from public.exchange_note_items i where i.exchange_note_id = p_id order by i.sku_id loop
    perform public._post_inventory_movement(jsonb_build_object(
      'document_type', 'exchange_out',
      'ref_type', 'exchange',
      'document_id', p_id,
      'idempotency_key', 'exchange-out-' || it.sku_id || '-' || p_id,
      'actor_id', p_by,
      'lines', jsonb_build_array(jsonb_build_object(
        'sku_id', it.sku_id,
        'from_location_id', v_main,
        'entered_quantity', it.quantity
      ))
    ));
  end loop;

  select linked_defect_id into v_note from public.exchange_notes where id = p_id;
  if v_note is not null then
    for it in select dni.sku_id, dni.quantity from public.defect_note_items dni where dni.defect_note_id = v_note order by dni.sku_id loop
      perform public._post_inventory_movement(jsonb_build_object(
        'document_type', 'defect_collect_in',
        'ref_type', 'defect',
        'document_id', v_note,
        'idempotency_key', 'exchange-collect-' || it.sku_id || '-' || v_note || '-' || p_id,
        'actor_id', p_by,
        'lines', jsonb_build_array(jsonb_build_object(
          'sku_id', it.sku_id,
          'to_location_id', v_hong,
          'entered_quantity', it.quantity
        ))
      ));
    end loop;
  end if;

  update public.exchange_notes set status='issued', issued_by=p_by, issued_at=now() where id=p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'exchange.issue', 'exchange', p_id,
          jsonb_build_object('status','approved'), jsonb_build_object('status','issued'));
end;
$$;


--
-- Name: liquidate_defects(uuid, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.liquidate_defects(p_id uuid, p_items_outcome jsonb, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

  for r in select * from public.liquidation_items where liquidation_note_id = p_id order by sku_id loop
    perform public._post_inventory_movement(jsonb_build_object(
      'document_type', 'liquidation_out',
      'ref_type', 'liquidation',
      'document_id', p_id,
      'idempotency_key', 'liquidation-out-' || r.id || '-' || p_id,
      'actor_id', p_by,
      'lines', jsonb_build_array(jsonb_build_object(
        'sku_id', r.sku_id,
        'from_location_id', v_hong,
        'entered_quantity', r.quantity
      ))
    ));
  end loop;

  update public.liquidation_notes set status = 'completed', completed_at = now() where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'liquidation.complete', 'liquidation', p_id,
          jsonb_build_object('status','approved'), jsonb_build_object('status','completed'));
end;
$$;


--
-- Name: list_requester_accounts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_requester_accounts() RETURNS TABLE(id uuid, name text, username text, zone_id uuid, sub_zone_id uuid, email text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_manager() then
    raise exception 'Chỉ quản lý kho được xem tài khoản người yêu cầu';
  end if;
  return query
    select p.id, p.name, p.username, p.zone_id, p.sub_zone_id, p.email
    from public.profiles p
    where p.role = 'requester' and p.is_active
    order by p.name;
end;
$$;


--
-- Name: mark_defect_collected(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_defect_collected(p_id uuid, p_by uuid, p_collected boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if p_collected then
    update public.defect_notes
    set collected_at = now(), collected_by = p_by, updated_at = now()
    where id = p_id;
  else
    update public.defect_notes
    set collected_at = null, collected_by = null, updated_at = now()
    where id = p_id;
  end if;
end;
$$;


--
-- Name: next_code(text, regclass); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.next_code(prefix text, seq regclass) RETURNS text
    LANGUAGE plpgsql
    AS $$
begin
  return prefix || '-' || lpad(nextval(seq)::text, 4, '0');
end;
$$;


--
-- Name: next_sku_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.next_sku_code() RETURNS text
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN public.next_code('SKU', 'public.skus_seq');
END;
$$;


--
-- Name: post_assembly(uuid, uuid, numeric, uuid, uuid, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_assembly(p_kit_sku_id uuid, p_bom_version_id uuid, p_quantity numeric, p_component_location_id uuid, p_finished_location_id uuid, p_document_id uuid, p_idempotency_key text, p_actor uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_actor uuid := coalesce(auth.uid(),p_actor); v_lines jsonb := '[]'::jsonb; v_item record; v_req numeric; v_header uuid;
begin
  if v_actor is null then raise exception 'Thiếu actor_id'; end if;
  if not public._posting_actor_has_role(v_actor,array['superuser','owner','warehouse']) then
    raise exception 'Actor không có quyền lắp ráp'; end if;
  if p_quantity <= 0 then raise exception 'Số lượng phải lớn hơn 0'; end if;
  if (select inventory_policy from public.skus where id=p_kit_sku_id) <> 'stocked_assembly' then
    raise exception 'SKU này không phải bộ ráp sẵn';
  end if;

  select id into v_header from public.bom_headers where sku_id=p_kit_sku_id;
  if v_header is null then raise exception 'SKU bộ chưa có BOM'; end if;
  if not exists(select 1 from public.bom_versions where id=p_bom_version_id and bom_header_id=v_header) then
    raise exception 'Phiên bản BOM không thuộc SKU bộ này';
  end if;

  for v_item in select component_sku_id, base_quantity, wastage_percent
                 from public.bom_items where bom_version_id=p_bom_version_id loop
    v_req := public._posting_round_base(
      v_item.base_quantity * p_quantity * (1 + v_item.wastage_percent/100), 6::smallint);
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'sku_id', v_item.component_sku_id,
      'from_location_id', p_component_location_id,
      'entered_quantity', v_req,
      'transaction_unit_id', null));
  end loop;

  v_lines := v_lines || jsonb_build_array(jsonb_build_object(
    'sku_id', p_kit_sku_id,
    'to_location_id', p_finished_location_id,
    'entered_quantity', p_quantity,
    'transaction_unit_id', null));

  return public._post_inventory_movement(jsonb_build_object(
    'document_type','assembly',
    'bom_version_id',p_bom_version_id,
    'actor_id',v_actor,
    'document_id', p_document_id,
    'idempotency_key', p_idempotency_key,
    'notes', 'Lắp ráp theo BOM '||p_bom_version_id,
    'lines', v_lines));
end $$;


--
-- Name: post_defect_command(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_defect_command(p_command jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ declare v_actor uuid:=coalesce(auth.uid(),nullif(p_command->>'actor_id','')::uuid); begin
  if not public._posting_actor_has_role(v_actor,array['superuser','owner','warehouse','technician']) then raise exception 'Actor không có quyền chuyển kho hỏng'; end if;
  return public._post_inventory_movement(p_command||jsonb_build_object(
    'document_type','defect','actor_id',v_actor,'required_roles',jsonb_build_array('superuser','owner','warehouse','technician'))); end $$;


--
-- Name: post_direct_issue_command(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_direct_issue_command(p_command jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ begin
  return public._post_inventory_movement(p_command||jsonb_build_object('document_type','direct_issue','actor_id',coalesce(auth.uid(),nullif(p_command->>'actor_id','')::uuid))); end $$;


--
-- Name: post_disassembly(uuid, uuid, numeric, uuid, jsonb, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_disassembly(p_kit_sku_id uuid, p_bom_version_id uuid, p_quantity numeric, p_from_location_id uuid, p_items jsonb, p_document_id uuid, p_idempotency_key text, p_actor uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_actor uuid := coalesce(auth.uid(),p_actor);
  v_lines jsonb := jsonb_build_array(jsonb_build_object(
    'sku_id',p_kit_sku_id,'from_location_id',p_from_location_id,
    'entered_quantity',p_quantity,'transaction_unit_id',null));
  v_item jsonb; v_bom_qty numeric; v_total numeric; v_component uuid; v_header uuid;
begin
  if v_actor is null then raise exception 'Thiếu actor_id'; end if;
  if not public._posting_actor_has_role(v_actor,array['superuser','owner','warehouse']) then
    raise exception 'Actor không có quyền tháo bộ'; end if;
  if p_quantity <= 0 then raise exception 'Số lượng phải lớn hơn 0'; end if;
  if (select inventory_policy from public.skus where id=p_kit_sku_id) <> 'stocked_assembly' then
    raise exception 'SKU này không phải bộ ráp sẵn';
  end if;
  select id into v_header from public.bom_headers where sku_id=p_kit_sku_id;
  if not exists(select 1 from public.bom_versions where id=p_bom_version_id and bom_header_id=v_header) then
    raise exception 'Phiên bản BOM không thuộc SKU bộ này';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    v_component := (v_item->>'component_sku_id')::uuid;
    select base_quantity*p_quantity into v_bom_qty from public.bom_items
      where bom_version_id=p_bom_version_id and component_sku_id=v_component;
    if v_bom_qty is null then raise exception 'Linh kiện không thuộc BOM'; end if;
    v_total := coalesce((v_item->>'recovered_quantity')::numeric,0)
             + coalesce((v_item->>'damaged_quantity')::numeric,0)
             + coalesce((v_item->>'lost_quantity')::numeric,0);
    if v_total <> v_bom_qty then
      raise exception 'Tổng thu hồi/hỏng/mất % không khớp định mức %',v_total,v_bom_qty;
    end if;
    if coalesce((v_item->>'recovered_quantity')::numeric,0)>0 then
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'sku_id',v_component,'to_location_id',(v_item->>'recovery_location_id')::uuid,
        'entered_quantity',(v_item->>'recovered_quantity')::numeric,'transaction_unit_id',null));
    end if;
    if coalesce((v_item->>'damaged_quantity')::numeric,0)>0 then
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'sku_id',v_component,'to_location_id',(v_item->>'damaged_location_id')::uuid,
        'entered_quantity',(v_item->>'damaged_quantity')::numeric,'transaction_unit_id',null));
    end if;
  end loop;
  if jsonb_array_length(p_items)=0 then raise exception 'Thiếu kết quả thu hồi linh kiện'; end if;
  return public._post_inventory_movement(jsonb_build_object(
    'document_type','disassembly','bom_version_id',p_bom_version_id,
    'actor_id',v_actor,'document_id',p_document_id,
    'idempotency_key',p_idempotency_key,
    'notes','Tháo bộ theo BOM '||p_bom_version_id,'lines',v_lines));
end $$;


--
-- Name: post_inventory_movement(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_inventory_movement(p_command jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  return public._post_inventory_movement(p_command||jsonb_build_object('actor_id',auth.uid()));
end $$;


--
-- Name: post_issue(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_issue(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_status text;
  v_main uuid;
  v_notes text;
  it record;
  v_policy text;
  v_tracking text;
  v_lines jsonb := '[]'::jsonb;
  v_allocs jsonb;
  v_comp record;
  v_comp_qty numeric;
  v_comp_allocs jsonb;
  v_bom_version uuid;
begin
  if not public.can_post_inventory() then raise exception 'Chỉ quản lý kho được xác nhận xuất'; end if;
  select id into v_main from public.stock_locations where code = 'KHO_CHINH';
  select status, notes into v_status, v_notes from public.issues where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu xuất'; end if;
  if v_status <> 'draft' then raise exception 'Phiếu xuất không ở trạng thái nháp (hiện tại: %)', v_status; end if;
  if not exists (select 1 from public.issue_items where issue_id = p_id) then
    raise exception 'Phiếu xuất không có vật tư';
  end if;

  for it in
    select ii.*, v.inventory_policy, v.tracking_policy
    from public.issue_items ii
    join public.skus v on v.id = ii.sku_id
    where ii.issue_id = p_id
    order by ii.sku_id
  loop
    if it.inventory_policy = 'virtual_kit' then
      select active_version_id into v_bom_version from public.bom_headers where sku_id = it.sku_id;
      if v_bom_version is null then raise exception 'Bộ ảo % chưa có BOM đang hoạt động', it.sku_id; end if;

      for v_comp in
        select bi.component_sku_id, bi.base_quantity, bi.wastage_percent, cv.tracking_policy as comp_tracking
        from public.bom_items bi
        join public.skus cv on cv.id = bi.component_sku_id
        where bi.bom_version_id = v_bom_version
        order by bi.component_sku_id
      loop
        v_comp_qty := public._posting_round_base(
          v_comp.base_quantity * (1 + v_comp.wastage_percent / 100) * coalesce(it.quantity, it.entered_quantity),
          6::smallint
        );
        v_comp_allocs := '[]'::jsonb;
        if v_comp.comp_tracking in ('lot','lot_expiry') then
          select coalesce(jsonb_agg(jsonb_build_object('lot_id', lot_id, 'quantity', take)), '[]'::jsonb)
          into v_comp_allocs
          from public._posting_pick_lots(v_comp.component_sku_id, v_main, v_comp_qty);
        elsif v_comp.comp_tracking = 'serial' then
          select coalesce(jsonb_agg(jsonb_build_object('serial_id', id, 'quantity', 1)), '[]'::jsonb)
          into v_comp_allocs
          from (
            select id from public.serial_items
            where sku_id = v_comp.component_sku_id and location_id = v_main and status = 'available'
            order by created_at asc limit v_comp_qty::int
          ) s;
          if jsonb_array_length(v_comp_allocs) < v_comp_qty then
            raise exception 'Không đủ serial linh kiện % tại kho chính', v_comp.component_sku_id;
          end if;
        end if;

        v_lines := v_lines || jsonb_build_array(jsonb_build_object(
          'sku_id', v_comp.component_sku_id,
          'from_location_id', v_main,
          'entered_quantity', v_comp_qty,
          'transaction_unit_id', null,
          'allocations', v_comp_allocs
        ));
      end loop;
    else
      v_allocs := '[]'::jsonb;
      if it.tracking_policy in ('lot','lot_expiry') then
        select coalesce(jsonb_agg(jsonb_build_object('lot_id', lot_id, 'quantity', take)), '[]'::jsonb)
        into v_allocs
        from public._posting_pick_lots(it.sku_id, v_main, coalesce(it.quantity, it.entered_quantity));
      elsif it.tracking_policy = 'serial' then
        select coalesce(jsonb_agg(jsonb_build_object('serial_id', id, 'quantity', 1)), '[]'::jsonb)
        into v_allocs
        from (
          select id from public.serial_items
          where sku_id = it.sku_id and location_id = v_main and status = 'available'
          order by created_at asc limit coalesce(it.quantity, it.entered_quantity)::int
        ) s;
        if jsonb_array_length(v_allocs) < coalesce(it.quantity, it.entered_quantity) then
          raise exception 'Không đủ serial cho SKU % tại kho chính', it.sku_id;
        end if;
      end if;

      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'sku_id', it.sku_id,
        'from_location_id', v_main,
        'entered_quantity', coalesce(it.entered_quantity, it.quantity),
        'transaction_unit_id', it.transaction_unit_id,
        'unit_cost', it.unit_price,
        'allocations', v_allocs
      ));
    end if;

    update public.issue_items
    set snapshot_quality = 'complete',
        conversion_factor_snapshot = coalesce(conversion_factor_snapshot, 1),
        sku_name_snapshot = (select p.name from public.products p join public.skus vv on vv.product_id = p.id where vv.id = it.sku_id),
        uom_name_snapshot = coalesce(
          (select display_name from public.sku_transaction_units where id = it.transaction_unit_id),
          (select u.name from public.units u join public.skus vv on vv.base_unit_id = u.id where vv.id = it.sku_id)
        )
    where id = it.id;
  end loop;

  if jsonb_array_length(v_lines) > 0 then
    perform public.post_direct_issue_command(jsonb_build_object(
      'document_id', p_id,
      'actor_id', coalesce(auth.uid(), p_by),
      'idempotency_key', 'issue-direct-' || p_id::text,
      'notes', v_notes,
      'lines', v_lines
    ));
  end if;

  update public.issues set status = 'posted', updated_at = now() where id = p_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'issue.post', 'issue', p_id,
          jsonb_build_object('status','draft'), jsonb_build_object('status','posted'));
end;
$$;


--
-- Name: post_liquidation_command(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_liquidation_command(p_command jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ declare v_actor uuid:=coalesce(auth.uid(),nullif(p_command->>'actor_id','')::uuid); begin
  if not public._posting_actor_has_role(v_actor,array['superuser','owner','warehouse']) then raise exception 'Actor không có quyền thanh lý'; end if;
  return public._post_inventory_movement(p_command||jsonb_build_object('document_type','liquidation','actor_id',v_actor,'required_roles',jsonb_build_array('superuser','owner','warehouse'))); end $$;


--
-- Name: post_receipt(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_receipt(p_id uuid, p_by uuid) RETURNS uuid[]
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_status public.receipt_status;
  v_main uuid;
  it record;
  r record;
  v_linked uuid[] := '{}';
  v_command jsonb := '{}'::jsonb;
  v_lines jsonb := '[]'::jsonb;
begin
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được ghi nhận nhập kho'; end if;
  select id into v_main from public.stock_locations where code = 'KHO_CHINH';

  select status into v_status from public.receipts where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu nhập'; end if;
  if v_status not in ('draft', 'approved') then
    raise exception 'Phiếu không ở trạng thái hợp lệ để nhập kho (hiện tại: %)', v_status;
  end if;

  for it in select * from public.receipt_items where receipt_id = p_id order by sku_id loop
    -- Construct posting kernel lines
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'sku_id', it.sku_id,
        'to_location_id', v_main,
        'entered_quantity', coalesce(it.entered_quantity, it.quantity),
        'transaction_unit_id', it.transaction_unit_id,
        'unit_cost', it.unit_cost,
        'allocations', case when nullif(btrim(it.batch_no), '') is not null then jsonb_build_array(
            jsonb_build_object(
               'lot_number', it.batch_no,
               'expiry_date', it.expiry_date,
               'quantity', coalesce(it.entered_quantity, it.quantity)
            )
        ) else '[]'::jsonb end
      )
    );
  end loop;

  v_command := jsonb_build_object(
    'document_id', p_id,
    'idempotency_key', 'receipt-' || p_id::text,
    'lines', v_lines
  );

  perform public.post_receipt_command(v_command);
  
  -- Record snapshots natively to receipt_items to adhere to legacy fallback
  update public.receipt_items 
    set snapshot_quality = 'complete',
        conversion_factor_snapshot = coalesce((select factor_to_base from public.sku_transaction_units tu where tu.id = transaction_unit_id limit 1), 1)
  where receipt_id = p_id;

  for r in select id from public.requisitions
           where status = 'approved'
           order by created_at asc, id asc loop
    begin
      perform public.fulfill_requisition(r.id, p_by, 'Tự động cấp phát từ phiếu nhập');
      v_linked := array_append(v_linked, r.id);
    exception when integrity_constraint_violation then
      null;
    end;
  end loop;

  update public.receipts set status = 'posted', linked_requisition_ids = v_linked where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'receipt.post', 'receipt', p_id,
          jsonb_build_object('status', v_status), jsonb_build_object('status', 'posted', 'linked', v_linked));

  return v_linked;
end;
$$;


--
-- Name: post_receipt_command(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_receipt_command(p_command jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ begin
  return public._post_inventory_movement(p_command||jsonb_build_object('document_type','receipt','actor_id',coalesce(auth.uid(),nullif(p_command->>'actor_id','')::uuid))); end $$;


--
-- Name: post_repair_command(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_repair_command(p_command jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ declare v_actor uuid:=coalesce(auth.uid(),nullif(p_command->>'actor_id','')::uuid); begin
  if not public._posting_actor_has_role(v_actor,array['superuser','owner','warehouse','technician']) then raise exception 'Actor không có quyền chuyển sửa chữa'; end if;
  return public._post_inventory_movement(p_command||jsonb_build_object(
    'document_type','repair','actor_id',v_actor,'required_roles',jsonb_build_array('superuser','owner','warehouse','technician'))); end $$;


--
-- Name: post_reserved_issue(uuid, numeric, uuid, jsonb, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_reserved_issue(p_reservation_id uuid, p_quantity numeric, p_document_id uuid, p_allocations jsonb, p_idempotency_key text, p_actor uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_actor uuid := coalesce(auth.uid(),p_actor); v_r public.stock_reservations%rowtype; v_movement uuid;
begin
  -- If the exact command already completed, return it before touching reservation state.
  select first_movement_id into v_movement from public.inventory_posting_commands
    where idempotency_key=p_idempotency_key and status='completed';
  if found and v_movement is not null then return v_movement; end if;

  select * into v_r from public.stock_reservations where id=p_reservation_id for update;
  if not found then raise exception 'Không tìm thấy reservation'; end if;
  if v_r.status not in ('active','partially_consumed') then
    raise exception 'Reservation không còn khả dụng (status=%)',v_r.status;
  end if;
  if p_quantity<=0 or p_quantity>v_r.reserved_quantity-v_r.consumed_quantity then
    raise exception 'Số lượng xuất không hợp lệ với reservation';
  end if;
  -- Release exactly the consumed quantity inside this transaction, then post.
  update public.stock_balances set reserved_quantity=reserved_quantity-p_quantity
    where sku_id=v_r.sku_id and location_id=v_r.location_id;
  v_movement := public._post_inventory_movement(jsonb_build_object(
    'document_type','reserved_issue','actor_id',v_actor,'document_id',p_document_id,
    'idempotency_key',p_idempotency_key,'reservation_id',p_reservation_id,
    'lines',jsonb_build_array(jsonb_build_object(
      'sku_id',v_r.sku_id,'from_location_id',v_r.location_id,
      'entered_quantity',p_quantity,'allocations',coalesce(p_allocations,'[]'::jsonb)))));
  update public.stock_reservations set consumed_quantity=consumed_quantity+p_quantity,
    status=case when consumed_quantity+p_quantity>=reserved_quantity then 'consumed' else 'partially_consumed' end,
    updated_at=now() where id=p_reservation_id;
  return v_movement;
end $$;


--
-- Name: post_return_command(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_return_command(p_command jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ begin
  return public._post_inventory_movement(p_command||jsonb_build_object('document_type','return','actor_id',coalesce(auth.uid(),nullif(p_command->>'actor_id','')::uuid))); end $$;


--
-- Name: post_stocktake(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_stocktake(p_session_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_status public.stocktake_status;
  v_loc uuid;
  v_code text;
  r record;
  v_delta numeric;
  v_lines jsonb := '[]'::jsonb;
begin
  if not public.can_post_inventory() then raise exception 'Chỉ quản lý kho được chốt kiểm kê'; end if;
  select status, location_id, code into v_status, v_loc, v_code
  from public.stocktake_sessions where id = p_session_id for update;

  if v_status is null then raise exception 'Không tìm thấy phiếu kiểm kê'; end if;
  if v_status <> 'draft' then raise exception 'Phiếu kiểm kê không ở trạng thái nháp (hiện tại: %)', v_status; end if;

  -- Process only CHECKED items (items actually counted)
  for r in
    select si.*, v.inventory_policy
    from public.stocktake_items si
    join public.skus v on v.id = si.sku_id
    where si.session_id = p_session_id and si.checked = true
    order by si.sku_id
  loop
    if r.inventory_policy = 'virtual_kit' then
      raise exception 'Không thể kiểm kê bộ ảo (không có tồn vật lý)';
    end if;

    v_delta := r.actual_qty - r.system_qty;
    if v_delta > 0 then
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'sku_id', r.sku_id,
        'to_location_id', v_loc,
        'entered_quantity', v_delta,
        'transaction_unit_id', r.transaction_unit_id
      ));
    elsif v_delta < 0 then
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'sku_id', r.sku_id,
        'from_location_id', v_loc,
        'entered_quantity', -v_delta,
        'transaction_unit_id', r.transaction_unit_id
      ));
    end if;

    update public.stocktake_items
    set snapshot_quality = 'complete',
        conversion_factor_snapshot = coalesce(conversion_factor_snapshot, 1)
    where id = r.id;
  end loop;

  if jsonb_array_length(v_lines) > 0 then
    perform public.post_stocktake_adjustment_command(jsonb_build_object(
      'document_id', p_session_id,
      'actor_id', coalesce(auth.uid(), p_by),
      'idempotency_key', 'stocktake-' || p_session_id::text,
      'notes', 'Điều chỉnh chênh lệch kỳ kiểm kê ' || v_code,
      'lines', v_lines
    ));
  end if;

  update public.stocktake_sessions set status = 'posted', posted_at = now() where id = p_session_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'stocktake.post', 'stocktake', p_session_id, jsonb_build_object('status','posted'));
end;
$$;


--
-- Name: post_stocktake_adjustment_command(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_stocktake_adjustment_command(p_command jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_actor uuid := coalesce(auth.uid(), nullif(p_command->>'actor_id','')::uuid);
begin
  if not public._posting_actor_has_role(v_actor, array['superuser','owner','accountant','warehouse']) then
    raise exception 'Actor không có quyền duyệt điều chỉnh kiểm kê';
  end if;
  return public._post_inventory_movement(
    p_command || jsonb_build_object(
      'document_type', 'stocktake_adjustment',
      'actor_id', v_actor,
      'required_roles', jsonb_build_array('superuser','owner','accountant','warehouse')
    )
  );
end $$;


--
-- Name: post_transfer_command(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_transfer_command(p_command jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ begin
  return public._post_inventory_movement(p_command||jsonb_build_object('document_type','transfer','actor_id',coalesce(auth.uid(),nullif(p_command->>'actor_id','')::uuid))); end $$;


--
-- Name: post_virtual_kit_issue(uuid, uuid, numeric, uuid, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_virtual_kit_issue(p_kit_sku_id uuid, p_location_id uuid, p_kit_quantity numeric, p_bom_version_id uuid, p_document_id uuid, p_idempotency_key text, p_actor uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_actor uuid := coalesce(auth.uid(),p_actor);
  v_header uuid; v_version uuid; v_lines jsonb := '[]'::jsonb;
  v_item record; v_kit public.skus%rowtype; v_req numeric;
begin
  if v_actor is null then raise exception 'Thiếu actor_id'; end if;
  if not public._posting_actor_has_role(v_actor,array['superuser','owner','accountant','warehouse']) then
    raise exception 'Actor không có quyền xuất bộ'; end if;
  if p_kit_quantity <= 0 then raise exception 'Số lượng bộ phải lớn hơn 0'; end if;

  select * into v_kit from public.skus where id=p_kit_sku_id;
  if not found then raise exception 'Không tìm thấy SKU bộ'; end if;
  if v_kit.inventory_policy <> 'virtual_kit' then
    raise exception 'SKU này không phải bộ ảo (policy=%)', v_kit.inventory_policy;
  end if;

  select id, active_version_id into v_header, v_version from public.bom_headers where sku_id=p_kit_sku_id;
  if v_header is null then raise exception 'SKU bộ chưa có BOM'; end if;
  -- Lock the requested version, or the active one when none was supplied.
  v_version := coalesce(p_bom_version_id, v_version);
  if v_version is null then raise exception 'Bộ chưa có phiên bản BOM hiệu lực'; end if;
  if not exists(select 1 from public.bom_versions where id=v_version and bom_header_id=v_header) then
    raise exception 'Phiên bản BOM không thuộc SKU bộ này';
  end if;

  for v_item in select component_sku_id, base_quantity, wastage_percent
                 from public.bom_items where bom_version_id=v_version
  loop
    v_req := public._posting_round_base(
      v_item.base_quantity * p_kit_quantity * (1 + v_item.wastage_percent/100), 6::smallint);
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'sku_id', v_item.component_sku_id,
      'from_location_id', p_location_id,
      'entered_quantity', v_req,
      'transaction_unit_id', null));
  end loop;

  if jsonb_array_length(v_lines)=0 then raise exception 'BOM không có linh kiện'; end if;

  return public._post_inventory_movement(jsonb_build_object(
    'document_type','virtual_kit_issue',
    'bom_version_id',v_version,
    'actor_id',v_actor,
    'document_id', p_document_id,
    'idempotency_key', p_idempotency_key,
    'notes', 'Xuất bộ ảo theo BOM '||v_version,
    'lines', v_lines));
end $$;


--
-- Name: prevent_profile_identity_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_profile_identity_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  -- Nếu name đã có giá trị và bị thay đổi khác rỗng -> chặn
  if old.name is not null and new.name is distinct from old.name then
    raise exception 'Họ và tên người dùng không thể thay đổi sau khi đã tạo';
  end if;

  -- Nếu username đã có giá trị và bị thay đổi khác rỗng -> chặn
  if old.username is not null and new.username is distinct from old.username then
    raise exception 'Tên đăng nhập không thể thay đổi sau khi đã tạo';
  end if;

  return new;
end;
$$;


--
-- Name: prevent_role_escalation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_role_escalation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  if new.role is distinct from old.role or new.zone_id is distinct from old.zone_id or new.sub_zone_id is distinct from old.sub_zone_id then
    raise exception 'Không được tự đổi role/zone';
  end if;
  return new;
end;
$$;


--
-- Name: protect_system_account(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_system_account() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_target_username text;
begin
  select username into v_target_username from public.profiles where id = old.id;
  v_target_username := coalesce(v_target_username, '(không tên)');

  if not old.is_protected then
    -- Không phải tài khoản hệ thống: chỉ chặn kẻ không phải superuser gán role superuser.
    -- auth.uid() is null = đường setup/service role (không thể qua RLS anon) → cho phép.
    if tg_op = 'UPDATE' and new.role = 'superuser' and old.role is distinct from 'superuser'
       and not public.is_superuser() and auth.uid() is not null then
      raise exception 'Chỉ tài khoản superuser được cấp vai trò superuser';
    end if;
    if tg_op = 'UPDATE' and new.is_protected and not public.is_superuser() and auth.uid() is not null then
      raise exception 'Chỉ tài khoản superuser được đánh dấu tài khoản hệ thống';
    end if;
    return coalesce(new, old);
  end if;

  -- Đây là tài khoản hệ thống:
  if tg_op = 'DELETE' then
    raise exception 'Không thể xóa tài khoản hệ thống %', v_target_username;
  end if;
  if new.role is distinct from 'superuser' then
    raise exception 'Không thể hạ quyền tài khoản hệ thống %', v_target_username;
  end if;
  if new.is_active is distinct from true then
    raise exception 'Không thể khóa tài khoản hệ thống %', v_target_username;
  end if;
  if new.is_protected is distinct from true then
    raise exception 'Không thể gỡ bảo vệ tài khoản hệ thống %', v_target_username;
  end if;
  if new.username is distinct from old.username then
    raise exception 'Không thể đổi tên đăng nhập tài khoản hệ thống %', v_target_username;
  end if;
  if new.id is distinct from old.id then
    raise exception 'Không thể đổi id tài khoản hệ thống';
  end if;
  return new;
end;
$$;


--
-- Name: receive_exchange(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.receive_exchange(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: receive_requisition(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.receive_requisition(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: record_defect(jsonb, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_defect(p_items jsonb, p_source_loc uuid, p_by uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
      (defect_note_id, sku_id, quantity, entered_quantity, damage_detail, damage_type, severity, images, unit_cost, note)
    values (
      v_id,
      coalesce((it.value->>'sku_id')::uuid, (it.value->>'sku_id')::uuid),
      (it.value->>'quantity')::int,
      coalesce((it.value->>'entered_quantity')::numeric, (it.value->>'quantity')::numeric),
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


--
-- Name: reject_exchange(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_exchange(p_id uuid, p_by uuid, p_reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: reject_liquidation(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_liquidation(p_id uuid, p_by uuid, p_reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: reject_requisition(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_requisition(p_id uuid, p_by uuid, p_reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_status public.requisition_status; r record;
begin
  if not public.can_post_inventory() then raise exception 'Chỉ quản lý kho được từ chối'; end if;
  if p_reason is null or length(trim(p_reason))=0 then raise exception 'Phải nhập lý do từ chối'; end if;
  select status into v_status from public.requisitions where id=p_id for update;
  if v_status not in ('pending','approved') then raise exception 'Không thể từ chối phiếu ở trạng thái %',v_status; end if;
  if v_status='approved' then
    for r in select id from public.stock_reservations where source_document_type='requisition' and source_document_id=p_id and status in ('active','partially_consumed') loop
      perform public.release_reservation(r.id,p_by);
    end loop;
  end if;
  update public.requisitions set status='rejected',rejection_reason=p_reason where id=p_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,before,after)
  values(p_by,'requisition.reject','requisition',p_id,jsonb_build_object('status',v_status),jsonb_build_object('status','rejected'));
end $$;


--
-- Name: release_reservation(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_reservation(p_reservation_id uuid, p_actor uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_actor uuid:=coalesce(auth.uid(),p_actor); v_r public.stock_reservations%rowtype; v_remaining numeric;
begin
  if not public._posting_actor_has_role(v_actor,array['superuser','owner','accountant','warehouse']) then
    raise exception 'Actor không có quyền giải phóng giữ tồn'; end if;
  select * into v_r from public.stock_reservations where id=p_reservation_id for update;
  if not found then raise exception 'Không tìm thấy reservation'; end if;
  if v_r.status='released' then return; end if;
  if v_r.status='consumed' then return; end if;
  v_remaining := v_r.reserved_quantity - v_r.consumed_quantity;
  update public.stock_balances set reserved_quantity=greatest(reserved_quantity-v_remaining,0), updated_at=now()
    where sku_id=v_r.sku_id and location_id=v_r.location_id;
  update public.stock_reservations set status='released', updated_at=now() where id=p_reservation_id;
end $$;


--
-- Name: request_repair(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_repair(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: reserve_stock(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reserve_stock(p_command jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_actor uuid := coalesce(auth.uid(),nullif(p_command->>'actor_id','')::uuid);
  v_sku uuid := (p_command->>'sku_id')::uuid;
  v_loc uuid := (p_command->>'location_id')::uuid;
  v_qty numeric := (p_command->>'base_quantity')::numeric;
  v_avail numeric;
  v_id uuid;
begin
  if v_actor is null then raise exception 'Thiếu actor_id'; end if;
  if not public._posting_actor_has_role(v_actor,array['superuser','owner','accountant','warehouse']) then
    raise exception 'Actor không có quyền giữ tồn';
  end if;
  if v_qty <= 0 then raise exception 'Số lượng giữ tồn phải lớn hơn 0'; end if;

  -- Idempotency: same command key returns the existing reservation.
  if nullif(p_command->>'idempotency_key','') is not null then
    select id into v_id from public.stock_reservations
      where idempotency_key=p_command->>'idempotency_key'
        and command_hash=md5((p_command-'actor_id')::text);
    if found then return v_id; end if;
    if exists(select 1 from public.stock_reservations where idempotency_key=p_command->>'idempotency_key') then
      raise exception 'Reservation idempotency_key đã dùng cho payload khác'; end if;
  end if;

  perform public._posting_lock_balance(v_sku, v_loc,
    (select base_unit_id from public.skus where id=v_sku));

  select quantity - reserved_quantity into v_avail from public.stock_balances
    where sku_id=v_sku and location_id=v_loc for update;
  if coalesce(v_avail,0) < v_qty then
    raise exception 'Không đủ tồn khả dụng để giữ: khả dụng %, cần %', coalesce(v_avail,0), v_qty;
  end if;

  insert into public.stock_reservations(
    sku_id, location_id, source_document_type, source_document_id, source_document_line_id,
    base_unit_id, reserved_quantity, status, idempotency_key,command_hash)
  select v_sku, v_loc, p_command->>'source_document_type', (p_command->>'source_document_id')::uuid,
         nullif(p_command->>'source_document_line_id','')::uuid,
         (select base_unit_id from public.skus where id=v_sku),
         v_qty, 'active', nullif(p_command->>'idempotency_key',''),md5((p_command-'actor_id')::text)
  returning id into v_id;

  update public.stock_balances set reserved_quantity=reserved_quantity+v_qty, updated_at=now()
    where sku_id=v_sku and location_id=v_loc;

  return v_id;
end $$;


--
-- Name: return_requisition_items(uuid, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.return_requisition_items(p_requisition_id uuid, p_items jsonb, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_status public.requisition_status;
  v_req_code text;
  it record;
  qty int;
  existing_rq int;
  v_main uuid;
  v_lines jsonb := '[]'::jsonb;
  v_return_id uuid;
begin
  if not public.can_post_inventory() then raise exception 'Chỉ quản lý kho được nhận trả vật tư'; end if;
  select id into v_main from public.stock_locations where code = 'KHO_CHINH';

  select status, code into v_status, v_req_code from public.requisitions where id = p_requisition_id for update;
  if v_status not in ('issued', 'received') then
    raise exception 'Chỉ có thể trả lại hàng từ phiếu đã cấp phát / đã nhận (hiện tại: %)', v_status;
  end if;

  if p_operation_key is null then p_operation_key := gen_random_uuid()::text; end if;

  begin
    insert into public.requisition_returns(requisition_id, returned_by, operation_key, payload_hash)
    values(p_requisition_id, p_by, p_operation_key, md5(p_items::text))
    returning id into v_return_id;
  exception when unique_violation then
    select id into v_return_id from public.requisition_returns
    where requisition_id=p_requisition_id and operation_key=p_operation_key and payload_hash=md5(p_items::text);
    if v_return_id is not null then return v_return_id; end if;
    raise exception 'Conflict: Return operation key already used with different payload';
  end;

  for it in select value from jsonb_array_elements(p_items) loop
    qty := (it.value->>'quantity')::int;
    select ri.quantity - coalesce((
      select sum(rri.quantity) from public.requisition_returns rr
      join public.requisition_return_items rri on rri.return_id=rr.id
      where rr.requisition_id=p_requisition_id and rri.sku_id=ri.sku_id
    ),0) into existing_rq
    from public.requisition_items ri
    where ri.requisition_id=p_requisition_id and ri.sku_id=(it.value->>'sku_id')::uuid;

    if existing_rq is null then raise exception 'Vật tư % không có trong phiếu yêu cầu', it.value->>'sku_id'; end if;
    if qty > existing_rq then raise exception 'Số lượng trả (%) vượt số lượng còn lại (%)', qty, existing_rq; end if;

    insert into public.requisition_return_items (return_id, sku_id, quantity, transaction_unit_id, entered_quantity)
    values (
      v_return_id, 
      (it.value->>'sku_id')::uuid, 
      qty, 
      nullif(it.value->>'transaction_unit_id','')::uuid,
      (it.value->>'entered_quantity')::numeric
    );

    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'sku_id', (it.value->>'sku_id')::uuid,
        'to_location_id', v_main,
        'entered_quantity', (it.value->>'entered_quantity')::numeric,
        'transaction_unit_id', nullif(it.value->>'transaction_unit_id','')::uuid
      )
    );
  end loop;

  if jsonb_array_length(v_lines) > 0 then
    perform public.post_return_command(jsonb_build_object(
      'document_id', p_requisition_id,
      'idempotency_key', 'return-req-' || p_requisition_id::text || '-' || p_operation_key,
      'notes', 'Trả lại theo phiếu ' || v_req_code,
      'lines', v_lines
    ));
  end if;

  -- A return event does not replace the requisition state. The item-level history
  -- records how much was returned while the document remains issued/received.
  update public.requisitions set updated_at = now() where id = p_requisition_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'requisition.return', 'requisition', p_requisition_id,
          jsonb_build_object('status', v_status), jsonb_build_object('status', v_status, 'return_id', v_return_id));
  return v_return_id;
end;
$$;


--
-- Name: return_tool_borrowing(uuid, jsonb, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.return_tool_borrowing(p_borrowing_id uuid, p_items jsonb, p_notes text, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_status public.tool_borrowing_status;
  v_main_loc uuid;
  v_all_returned boolean := true;
  it record;
  v_borrowed_qty int;
  v_already_returned int;
  v_return_qty int;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if not public.is_manager() then raise exception 'Chỉ quản lý kho được xác nhận nhận lại dụng cụ'; end if;

  select status into v_status from public.tool_borrowings where id = p_borrowing_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu mượn'; end if;
  if v_status <> 'borrowed' then raise exception 'Phiếu không ở trạng thái đang mượn (hiện tại: %)', v_status; end if;

  select id into v_main_loc from public.stock_locations where code = 'KHO_CHINH';

  for it in select value from jsonb_array_elements(p_items) loop
    v_return_qty := (it.value->>'quantity')::int;
    if v_return_qty <= 0 then continue; end if;

    select quantity, returned_quantity into v_borrowed_qty, v_already_returned
    from public.tool_borrowing_items
    where borrowing_id = p_borrowing_id and sku_id = (it.value->>'sku_id')::uuid
    for update;

    if v_borrowed_qty is null then
      raise exception 'Dụng cụ % không có trong phiếu mượn', it.value->>'sku_id';
    end if;

    if v_already_returned + v_return_qty > v_borrowed_qty then
      raise exception 'Số lượng trả vượt quá số lượng còn đang mượn';
    end if;

    update public.tool_borrowing_items
    set returned_quantity = returned_quantity + v_return_qty
    where borrowing_id = p_borrowing_id and sku_id = (it.value->>'sku_id')::uuid;

    perform public._move_stock(
      (it.value->>'sku_id')::uuid,
      null,
      v_main_loc,
      v_return_qty,
      'tool_return_in',
      'tool_borrowing',
      p_borrowing_id,
      p_by,
      'Nhận trả dụng cụ'
    );
  end loop;

  -- Kiểm tra xem tất cả các món đã trả đủ chưa
  if exists (
    select 1 from public.tool_borrowing_items
    where borrowing_id = p_borrowing_id and returned_quantity < quantity
  ) then
    v_all_returned := false;
  end if;

  if v_all_returned then
    update public.tool_borrowings
    set status = 'returned', returned_at = now(), received_back_by = p_by, notes = coalesce(notes || E'\n', '') || coalesce(p_notes, '')
    where id = p_borrowing_id;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'tool_borrowing.return', 'tool_borrowing', p_borrowing_id, jsonb_build_object('all_returned', v_all_returned, 'items', p_items));
end;
$$;


--
-- Name: reverse_inventory_command(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reverse_inventory_command(p_idempotency_key text, p_reason text DEFAULT NULL::text) RETURNS uuid[]
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_command uuid; v_row record; v_results uuid[]:=array[]::uuid[];
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if not public.can_post_inventory() then raise exception 'Không có quyền đảo command kho'; end if;
  select id into v_command from public.inventory_posting_commands
    where idempotency_key=p_idempotency_key and status='completed' for update;
  if not found then raise exception 'Không tìm thấy posting command đã hoàn tất'; end if;
  -- Reverse in descending sequence so assembly finished goods are removed before components return.
  for v_row in select movement_id from public.inventory_posting_command_movements
    where command_id=v_command order by sequence_no desc
  loop
    v_results:=array_append(v_results,public.reverse_inventory_movement(v_row.movement_id,p_reason,auth.uid()));
  end loop;
  return v_results;
end $$;


--
-- Name: reverse_inventory_command(text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reverse_inventory_command(p_idempotency_key text, p_reason text, p_actor uuid) RETURNS uuid[]
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_command uuid; v_row record; v_results uuid[]:=array[]::uuid[];
begin
  if not public._posting_actor_has_role(coalesce(auth.uid(),p_actor),array['superuser','owner','accountant','warehouse']) then
    raise exception 'Actor không có quyền đảo command kho'; end if;
  select id into v_command from public.inventory_posting_commands
    where idempotency_key=p_idempotency_key and status='completed' for update;
  if not found then raise exception 'Không tìm thấy posting command đã hoàn tất'; end if;
  -- Reverse in descending sequence so assembly finished goods are removed before components return.
  for v_row in select movement_id from public.inventory_posting_command_movements
    where command_id=v_command order by sequence_no desc
  loop
    v_results:=array_append(v_results,public.reverse_inventory_movement(v_row.movement_id,p_reason,coalesce(auth.uid(),p_actor)));
  end loop;
  return v_results;
end $$;


--
-- Name: reverse_inventory_movement(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reverse_inventory_movement(p_movement_id uuid, p_reason text, p_actor uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_actor uuid := coalesce(auth.uid(),p_actor);
  v_src public.stock_movements%rowtype;
  v_new uuid := gen_random_uuid();
  v_alloc record;
begin
  if v_actor is null then raise exception 'Thiếu actor_id'; end if;
  if not public._posting_actor_has_role(v_actor,array['superuser','owner','accountant','warehouse']) then
    raise exception 'Actor không có quyền đảo giao dịch kho'; end if;

  select * into v_src from public.stock_movements where id=p_movement_id for update;
  if not found then raise exception 'Không tìm thấy movement %', p_movement_id; end if;
  if exists(select 1 from public.stock_movements where reversal_of_movement_id=p_movement_id) then
    raise exception 'Movement này đã được đảo trước đó';
  end if;

  insert into public.stock_movements(
    id, sku_id, from_location_id, to_location_id, movement_type, quantity,
    ref_type, ref_id, notes, created_by,
    base_unit_id, entered_quantity, transaction_unit_id, conversion_factor_snapshot,
    base_quantity, unit_cost, snapshot_quality, reversal_of_movement_id,
    sku_name_snapshot, uom_name_snapshot)
  values(
    v_new, v_src.sku_id, v_src.to_location_id, v_src.from_location_id,
    v_src.movement_type, v_src.quantity, v_src.ref_type, v_src.ref_id,
    coalesce(p_reason,'Đảo giao dịch'), v_actor,
    v_src.base_unit_id, v_src.entered_quantity, v_src.transaction_unit_id,
    v_src.conversion_factor_snapshot,
    coalesce(-v_src.base_quantity, -v_src.quantity), v_src.unit_cost,
    v_src.snapshot_quality, p_movement_id,
    v_src.sku_name_snapshot, v_src.uom_name_snapshot);

  for v_alloc in select * from public.stock_movement_allocations where movement_id=p_movement_id loop
    insert into public.stock_movement_allocations(movement_id, lot_id, serial_id, base_quantity)
    values(v_new, v_alloc.lot_id, v_alloc.serial_id, v_alloc.base_quantity);
    if v_alloc.lot_id is not null then
      if v_src.from_location_id is not null then
        insert into public.lot_stock_balances(lot_id,location_id,quantity)
        values(v_alloc.lot_id,v_src.from_location_id,v_alloc.base_quantity)
        on conflict(lot_id,location_id) do update set
          quantity=public.lot_stock_balances.quantity+excluded.quantity,updated_at=now();
      end if;
      if v_src.to_location_id is not null then
        update public.lot_stock_balances set quantity=quantity-v_alloc.base_quantity,updated_at=now()
          where lot_id=v_alloc.lot_id and location_id=v_src.to_location_id
            and quantity>=v_alloc.base_quantity;
        if not found then raise exception 'Không thể đảo: tồn chi tiết lô ở kho đích không đủ'; end if;
      end if;
    end if;
    if v_alloc.serial_id is not null then
      if v_src.from_location_id is not null then
        update public.serial_items set location_id=v_src.from_location_id,status='available',updated_at=now()
          where id=v_alloc.serial_id;
      elsif v_src.to_location_id is not null then
        update public.serial_items set location_id=null,status='issued',updated_at=now()
          where id=v_alloc.serial_id and location_id=v_src.to_location_id;
        if not found then raise exception 'Không thể đảo: serial không còn ở kho đích'; end if;
      end if;
    end if;
  end loop;

  -- Lock both balance rows before applying reverse deltas.
  if v_src.from_location_id is not null then
    perform public._posting_lock_balance(v_src.sku_id,v_src.from_location_id,v_src.base_unit_id);
  end if;
  if v_src.to_location_id is not null then
    perform public._posting_lock_balance(v_src.sku_id,v_src.to_location_id,v_src.base_unit_id);
  end if;

  -- Undo the effect on the ORIGINAL source location, which lost stock.
  if v_src.from_location_id is not null then
    update public.stock_balances set quantity=quantity+v_src.quantity, updated_at=now()
      where sku_id=v_src.sku_id and location_id=v_src.from_location_id;
  end if;
  -- Undo the effect on the ORIGINAL destination location, which gained stock.
  if v_src.to_location_id is not null then
    if (select quantity from public.stock_balances
         where sku_id=v_src.sku_id and location_id=v_src.to_location_id) < v_src.quantity then
      raise exception 'Không thể đảo: tồn kho đích đã thay đổi, không đủ % để hoàn ngược', v_src.quantity;
    end if;
    update public.stock_balances set quantity=quantity-v_src.quantity, updated_at=now()
      where sku_id=v_src.sku_id and location_id=v_src.to_location_id;
  end if;

  return v_new;
end $$;


--
-- Name: revert_issue(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revert_issue(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_status text;
  v_idem text := 'issue-direct-' || p_id::text;
begin
  if not public.is_owner() then raise exception 'Chỉ quản trị viên (Admin/Chủ trại) được mở lại phiếu xuất'; end if;
  select status into v_status from public.issues where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu xuất'; end if;
  if v_status <> 'posted' then raise exception 'Chỉ phiếu ĐÃ XUẤT mới mở lại được (hiện tại: %)', v_status; end if;

  if exists (select 1 from public.inventory_posting_commands where idempotency_key = v_idem and status = 'completed') then
    perform public.reverse_inventory_command(v_idem, 'Mở lại phiếu xuất', p_by);
  else
    perform public._revert_movements('issue', p_id, p_by);
  end if;

  update public.issues set status = 'draft', updated_at = now() where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'issue.reopen', 'issue', p_id,
          jsonb_build_object('status','posted'), jsonb_build_object('status','draft'));
end;
$$;


--
-- Name: revert_liquidation(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revert_liquidation(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_status public.liquidation_status;
begin
  if not public.is_superuser() then raise exception 'Chỉ tài khoản dev (superuser) được mở lại phiếu thanh lý'; end if;
  select status into v_status from public.liquidation_notes where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu thanh lý'; end if;
  if v_status <> 'completed' then raise exception 'Chỉ phiếu ĐÃ HOÀN TẤT mới mở lại được (hiện tại: %)', v_status; end if;

  perform public._revert_movements('liquidation', p_id, p_by);
  update public.liquidation_notes
  set status = 'approved', completed_at = null, notes = coalesce(notes,'') || ' [Dev: mở lại từ completed]'
  where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'liquidation.reopen', 'liquidation', p_id,
          jsonb_build_object('status','completed'), jsonb_build_object('status','approved'));
end;
$$;


--
-- Name: revert_receipt(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revert_receipt(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_status public.receipt_status;
begin
  if not public.is_superuser() then raise exception 'Chỉ tài khoản dev (superuser) được mở lại phiếu nhập'; end if;
  select status into v_status from public.receipts where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu nhập'; end if;
  if v_status <> 'posted' then raise exception 'Chỉ phiếu ĐÃ GHI NHẬN mới mở lại được (hiện tại: %)', v_status; end if;
  if public._receipt_has_active_linked(p_id) then
    raise exception 'Phiếu nhập này đã tự cấp phát các phiếu yêu cầu đang ở trạng thái đã cấp/nhận. Hãy dùng công cụ dev "Mở lại sửa/Xoá" cho các phiếu yêu cầu đó TRƯỚC, rồi mở lại phiếu nhập này.';
  end if;

  perform public._revert_movements('receipt', p_id, p_by);
  update public.receipts set status = 'draft', linked_requisition_ids = '{}', updated_at = now() where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'receipt.reopen', 'receipt', p_id,
          jsonb_build_object('status','posted'), jsonb_build_object('status','draft'));
end;
$$;


--
-- Name: revert_repair(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revert_repair(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
    select id, sku_id, from_location_id, to_location_id, quantity
    from public.stock_movements
    where ref_type = 'repair' and ref_id = p_id
      and movement_type in ('repair_return_in','transfer')
    order by created_at desc, id
  loop
    if r.to_location_id is not null then
      select quantity into v_bal
      from public.stock_balances
      where sku_id = r.sku_id and location_id = r.to_location_id
      for update;
      if v_bal is null or v_bal < r.quantity then
        raise exception 'Không mở lại được phiếu sửa: tồn kho của biến thể đã bị dùng đi (cần % tại kho đích)',
          r.quantity;
      end if;
      update public.stock_balances
      set quantity = quantity - r.quantity, updated_at = now()
      where sku_id = r.sku_id and location_id = r.to_location_id;
    end if;
    if r.from_location_id is not null then
      insert into public.stock_balances (sku_id, location_id, quantity)
      values (r.sku_id, r.from_location_id, r.quantity)
      on conflict (sku_id, location_id)
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


--
-- Name: revert_requisition(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revert_requisition(p_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_status public.requisition_status;
begin
  if not public.is_superuser() then raise exception 'Chỉ tài khoản dev (superuser) được mở lại phiếu yêu cầu'; end if;
  select status into v_status from public.requisitions where id = p_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu yêu cầu'; end if;
  -- Chỉ issued/received mới có bút toán (fulfill). Trả về 'approved' để duyệt/cấp lại.
  if v_status not in ('issued','received') then
    raise exception 'Phiếu chưa cấp phát nên không cần mở lại (hiện tại: %)', v_status;
  end if;

  perform public._revert_movements('requisition', p_id, p_by);

  -- Xoá lịch sử trả lại (movement return_in đã bị đảo ở trên).
  delete from public.requisition_returns where requisition_id = p_id;

  update public.requisitions
  set status = 'approved',
      fulfilled_by = null, fulfilled_at = null, fulfillment_notes = null,
      received_by = null, received_at = null,
      updated_at = now()
  where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'requisition.reopen', 'requisition', p_id,
          jsonb_build_object('status', v_status), jsonb_build_object('status','approved'));
end;
$$;


--
-- Name: revert_stocktake(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revert_stocktake(p_session_id uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_status public.stocktake_status;
  v_idem text := 'stocktake-' || p_session_id::text;
begin
  if not public.is_owner() then raise exception 'Chỉ quản trị viên (Admin/Chủ trại) được mở lại phiếu kiểm kê'; end if;

  select status into v_status from public.stocktake_sessions where id = p_session_id for update;
  if v_status is null then raise exception 'Không tìm thấy phiếu kiểm kê'; end if;
  if v_status <> 'posted' then raise exception 'Chỉ phiếu ĐÃ CHỐT mới mở lại được (hiện tại: %)', v_status; end if;

  if exists (select 1 from public.inventory_posting_commands where idempotency_key = v_idem and status = 'completed') then
    perform public.reverse_inventory_command(v_idem, 'Mở lại phiếu kiểm kê', p_by);
  else
    perform public._revert_movements('stocktake', p_session_id, p_by);
  end if;

  update public.stocktake_sessions set status = 'draft', posted_at = null where id = p_session_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'stocktake.reopen', 'stocktake', p_session_id,
          jsonb_build_object('status', 'posted'), jsonb_build_object('status', 'draft'));
end;
$$;


--
-- Name: search_ai_knowledge(text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_ai_knowledge(p_query text, p_category text DEFAULT NULL::text, p_limit integer DEFAULT 5) RETURNS TABLE(chunk_id uuid, document_id uuid, title text, category text, content text, rank double precision)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    c.id as chunk_id,
    d.id as document_id,
    d.title,
    d.category,
    c.content,
    ts_rank_cd(c.tsv, plainto_tsquery('simple', p_query))::float as rank
  from public.ai_knowledge_chunks c
  join public.ai_knowledge_documents d on d.id = c.document_id
  where (p_category is null or d.category = p_category)
    and (
      c.tsv @@ plainto_tsquery('simple', p_query)
      or c.content ilike '%' || p_query || '%'
      or d.title ilike '%' || p_query || '%'
    )
  order by rank desc, c.created_at asc
  limit p_limit;
$$;


--
-- Name: search_catalog(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_catalog(p_query text) RETURNS TABLE(id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  WITH query_tokens AS (
    SELECT array_agg(DISTINCT t) AS tokens
    FROM unnest(regexp_split_to_array(public.unaccent_text(lower(trim(COALESCE(p_query, '')))), '[[:space:]]+')) t
    WHERE length(t) > 0
  ),
  variant_attrs AS (
    SELECT
      sav.sku_id,
      string_agg(
        COALESCE(sav.text_value, '') || ' ' ||
        COALESCE(sav.legacy_text_value, '') || ' ' ||
        COALESCE(sav.numeric_value::text, '') || ' ' ||
        COALESCE(aov.label, '') || ' ' ||
        COALESCE(aov.code, '') || ' ' ||
        COALESCE(ad.name, '') || ' ' ||
        COALESCE(u.symbol, '') || ' ' ||
        COALESCE(u.name, ''),
        ' '
      ) AS attr_text
    FROM public.sku_attribute_values sav
    LEFT JOIN public.attribute_definitions ad ON ad.id = sav.attribute_definition_id
    LEFT JOIN public.attribute_option_values aov ON aov.id = sav.option_value_id
    LEFT JOIN public.units u ON u.id = sav.unit_id
    GROUP BY sav.sku_id
  ),
  variant_barcodes AS (
    SELECT
      br.sku_id,
      string_agg(br.barcode, ' ') AS barcode_text
    FROM public.barcode_registry br
    WHERE br.is_active = true
    GROUP BY br.sku_id
  ),
  variant_uoms AS (
    SELECT
      stu.sku_id,
      string_agg(stu.code || ' ' || stu.display_name, ' ') AS uom_text
    FROM public.sku_transaction_units stu
    WHERE stu.is_active = true
    GROUP BY stu.sku_id
  ),
  item_pool AS (
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      public.unaccent_text(
        lower(
          p.name || ' ' ||
          COALESCE(c.name, '') || ' ' ||
          COALESCE(array_to_string(p.search_keywords, ' '), '') || ' ' ||
          COALESCE(p.description, '') || ' ' ||
          COALESCE(v.sku_code, '') || ' ' ||
          COALESCE(vu.symbol, '') || ' ' ||
          COALESCE(vu.name, '') || ' ' ||
          COALESCE(va.attr_text, '') || ' ' ||
          COALESCE(vb.barcode_text, '') || ' ' ||
          COALESCE(vuom.uom_text, '')
        )
      ) AS search_text,
      -- Điểm số ưu tiên sắp xếp
      CASE
        WHEN lower(p.name) = lower(trim(p_query)) THEN 100
        WHEN public.unaccent_text(lower(p.name)) = public.unaccent_text(lower(trim(p_query))) THEN 90
        WHEN lower(p.name) LIKE lower(trim(p_query)) || '%' THEN 80
        WHEN public.unaccent_text(lower(p.name)) LIKE public.unaccent_text(lower(trim(p_query))) || '%' THEN 70
        WHEN lower(p.name) LIKE '%' || lower(trim(p_query)) || '%' THEN 60
        WHEN public.unaccent_text(lower(p.name)) LIKE '%' || public.unaccent_text(lower(trim(p_query))) || '%' THEN 50
        WHEN lower(COALESCE(v.sku_code, '')) = lower(trim(p_query)) THEN 45
        ELSE 10
      END AS score
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    LEFT JOIN public.skus v ON v.product_id = p.id AND v.sku_status != 'inactive'
    LEFT JOIN public.units vu ON vu.id = v.base_unit_id
    LEFT JOIN variant_attrs va ON va.sku_id = v.id
    LEFT JOIN variant_barcodes vb ON vb.sku_id = v.id
    LEFT JOIN variant_uoms vuom ON vuom.sku_id = v.id
    WHERE p.deleted_at IS NULL
  ),
  matched AS (
    SELECT
      ip.product_id,
      MAX(ip.score) AS max_score,
      MIN(ip.product_name) AS sort_name
    FROM item_pool ip, query_tokens qt
    WHERE cardinality(qt.tokens) IS NULL OR cardinality(qt.tokens) = 0 OR NOT EXISTS (
      SELECT 1
      FROM unnest(qt.tokens) tok
      WHERE ip.search_text NOT LIKE '%' || tok || '%'
    )
    GROUP BY ip.product_id
  )
  SELECT m.product_id AS id
  FROM matched m
  ORDER BY m.max_score DESC, m.sort_name ASC;
$$;


--
-- Name: search_skus(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_skus(p_query text, p_limit integer DEFAULT 50) RETURNS TABLE(sku_id uuid, product_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  WITH query_tokens AS (
    SELECT array_agg(DISTINCT t) AS tokens
    FROM unnest(regexp_split_to_array(public.unaccent_text(lower(trim(COALESCE(p_query, '')))), '[[:space:]]+')) t
    WHERE length(t) > 0
  ),
  variant_attrs AS (
    SELECT
      sav.sku_id,
      string_agg(
        COALESCE(sav.text_value, '') || ' ' ||
        COALESCE(sav.legacy_text_value, '') || ' ' ||
        COALESCE(sav.numeric_value::text, '') || ' ' ||
        COALESCE(aov.label, '') || ' ' ||
        COALESCE(aov.code, '') || ' ' ||
        COALESCE(ad.name, '') || ' ' ||
        COALESCE(u.symbol, '') || ' ' ||
        COALESCE(u.name, ''),
        ' '
      ) AS attr_text
    FROM public.sku_attribute_values sav
    LEFT JOIN public.attribute_definitions ad ON ad.id = sav.attribute_definition_id
    LEFT JOIN public.attribute_option_values aov ON aov.id = sav.option_value_id
    LEFT JOIN public.units u ON u.id = sav.unit_id
    GROUP BY sav.sku_id
  ),
  variant_barcodes AS (
    SELECT
      br.sku_id,
      string_agg(br.barcode, ' ') AS barcode_text
    FROM public.barcode_registry br
    WHERE br.is_active = true
    GROUP BY br.sku_id
  ),
  variant_uoms AS (
    SELECT
      stu.sku_id,
      string_agg(stu.code || ' ' || stu.display_name, ' ') AS uom_text
    FROM public.sku_transaction_units stu
    WHERE stu.is_active = true
    GROUP BY stu.sku_id
  ),
  sku_pool AS (
    SELECT
      v.id AS sku_id,
      p.id AS product_id,
      p.name AS product_name,
      v.sku_code,
      public.unaccent_text(
        lower(
          p.name || ' ' ||
          COALESCE(c.name, '') || ' ' ||
          COALESCE(array_to_string(p.search_keywords, ' '), '') || ' ' ||
          COALESCE(p.description, '') || ' ' ||
          COALESCE(v.sku_code, '') || ' ' ||
          COALESCE(vu.symbol, '') || ' ' ||
          COALESCE(vu.name, '') || ' ' ||
          COALESCE(va.attr_text, '') || ' ' ||
          COALESCE(vb.barcode_text, '') || ' ' ||
          COALESCE(vuom.uom_text, '')
        )
      ) AS search_text,
      -- Điểm số ưu tiên sắp xếp
      CASE
        WHEN lower(COALESCE(v.sku_code, '')) = lower(trim(p_query)) THEN 100
        WHEN vb.barcode_text ILIKE '%' || trim(p_query) || '%' THEN 95
        WHEN lower(p.name) = lower(trim(p_query)) THEN 90
        WHEN public.unaccent_text(lower(p.name)) = public.unaccent_text(lower(trim(p_query))) THEN 85
        WHEN lower(p.name) LIKE lower(trim(p_query)) || '%' THEN 80
        WHEN public.unaccent_text(lower(p.name)) LIKE public.unaccent_text(lower(trim(p_query))) || '%' THEN 70
        WHEN va.attr_text ILIKE '%' || trim(p_query) || '%' THEN 65
        WHEN public.unaccent_text(lower(va.attr_text)) LIKE '%' || public.unaccent_text(lower(trim(p_query))) || '%' THEN 60
        WHEN lower(p.name) LIKE '%' || lower(trim(p_query)) || '%' THEN 50
        ELSE 20
      END AS score
    FROM public.skus v
    JOIN public.products p ON p.id = v.product_id
    LEFT JOIN public.categories c ON c.id = p.category_id
    LEFT JOIN public.units vu ON vu.id = v.base_unit_id
    LEFT JOIN variant_attrs va ON va.sku_id = v.id
    LEFT JOIN variant_barcodes vb ON vb.sku_id = v.id
    LEFT JOIN variant_uoms vuom ON vuom.sku_id = v.id
    WHERE p.deleted_at IS NULL AND v.sku_status = 'active'
  )
  SELECT
    sp.sku_id,
    sp.product_id
  FROM sku_pool sp, query_tokens qt
  WHERE cardinality(qt.tokens) IS NULL OR cardinality(qt.tokens) = 0 OR NOT EXISTS (
    SELECT 1
    FROM unnest(qt.tokens) tok
    WHERE sp.search_text NOT LIKE '%' || tok || '%'
  )
  ORDER BY sp.score DESC, sp.product_name ASC, sp.sku_code ASC
  LIMIT COALESCE(p_limit, 50);
$$;


--
-- Name: send_to_repair(uuid[], text, date, date, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_to_repair(p_defect_item_ids uuid[], p_vendor text, p_sent_at date, p_expected_return_at date, p_by uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
    insert into public.repair_order_items (repair_order_id, defect_item_id, sku_id, quantity, entered_quantity)
    values (v_repair_id, it.id, it.sku_id, it.quantity, coalesce(it.entered_quantity, it.quantity));

    -- Thu đồ hỏng về Kho hỏng (ref_type = 'defect')
    perform public._post_inventory_movement(jsonb_build_object(
      'document_type', 'defect_collect_in',
      'ref_type', 'defect',
      'document_id', it.defect_note_id,
      'idempotency_key', 'defect-collect-' || it.id || '-' || v_repair_id,
      'actor_id', p_by,
      'lines', jsonb_build_array(jsonb_build_object(
        'sku_id', it.sku_id,
        'to_location_id', v_hong,
        'entered_quantity', it.quantity
      ))
    ));

    -- Chuyển từ Kho hỏng sang Kho đang sửa (ref_type = 'repair')
    perform public._post_inventory_movement(jsonb_build_object(
      'document_type', 'repair_out',
      'ref_type', 'repair',
      'document_id', v_repair_id,
      'idempotency_key', 'repair-out-' || it.id || '-' || v_repair_id,
      'actor_id', p_by,
      'lines', jsonb_build_array(jsonb_build_object(
        'sku_id', it.sku_id,
        'from_location_id', v_hong,
        'to_location_id', v_sua,
        'entered_quantity', it.quantity
      ))
    ));
  end loop;

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


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end;
$$;


--
-- Name: submit_requisition(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_requisition(p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: sync_bom_header_active_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_bom_header_active_version() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.status='active' then
    update public.bom_headers set active_version_id=new.id,updated_at=now() where id=new.bom_header_id;
  end if;
  if new.status='retired' and (select active_version_id from public.bom_headers where id=new.bom_header_id)=new.id then
    update public.bom_headers set active_version_id=null,updated_at=now() where id=new.bom_header_id;
  end if;
  return new;
end $$;


--
-- Name: transfer_stock(jsonb, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.transfer_stock(p_items jsonb, p_from_loc uuid, p_to_loc uuid, p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  it record;
  v_lines jsonb := '[]'::jsonb;
  v_sku_id uuid;
  v_tu_id uuid;
  v_entered numeric;
  v_qty numeric;
  v_factor numeric;
  v_policy text;
  v_tracking text;
  v_allocs jsonb;
  v_doc_id uuid := gen_random_uuid();
begin
  if not public.can_post_inventory() then raise exception 'Chỉ quản lý kho được chuyển kho'; end if;
  if p_from_loc = p_to_loc then raise exception 'Kho nguồn và đích phải khác nhau'; end if;
  if p_from_loc is null or p_to_loc is null then raise exception 'Phải chọn đủ kho nguồn và kho đích'; end if;

  for it in select value from jsonb_array_elements(p_items) loop
    v_sku_id := coalesce(nullif(it.value->>'sku_id',''), nullif(it.value->>'sku_id',''))::uuid;
    if v_sku_id is null then raise exception 'Dòng thiếu SKU'; end if;
    v_tu_id := nullif(it.value->>'transaction_unit_id','')::uuid;
    v_entered := coalesce((it.value->>'entered_quantity')::numeric, (it.value->>'quantity')::numeric);
    if v_entered is null or v_entered <= 0 then raise exception 'Số lượng chuyển phải lớn hơn 0'; end if;

    select inventory_policy, tracking_policy into v_policy, v_tracking from public.skus where id = v_sku_id;
    if not found then raise exception 'Không tìm thấy SKU %', v_sku_id; end if;

    if v_policy = 'virtual_kit' then
      raise exception 'Không thể chuyển kho bộ ảo (không có tồn vật lý)';
    end if;

    if v_tu_id is not null then
      select factor_to_base into v_factor from public.sku_transaction_units where id = v_tu_id and sku_id = v_sku_id;
    else
      v_factor := 1;
    end if;
    v_factor := coalesce(v_factor, 1);
    v_qty := v_entered * v_factor;

    v_allocs := '[]'::jsonb;
    if it.value ? 'allocations' and jsonb_array_length(coalesce(it.value->'allocations','[]'::jsonb)) > 0 then
      v_allocs := it.value->'allocations';
    else
      if v_tracking in ('lot','lot_expiry') then
        select coalesce(jsonb_agg(jsonb_build_object('lot_id', lot_id, 'quantity', take)), '[]'::jsonb)
        into v_allocs
        from public._posting_pick_lots(v_sku_id, p_from_loc, v_qty);
      elsif v_tracking = 'serial' then
        select coalesce(jsonb_agg(jsonb_build_object('serial_id', id, 'quantity', 1)), '[]'::jsonb)
        into v_allocs
        from (
          select id from public.serial_items
          where sku_id = v_sku_id and location_id = p_from_loc and status = 'available'
          order by created_at asc
          limit v_qty::int
        ) s;
        if jsonb_array_length(v_allocs) < v_qty then
          raise exception 'Không đủ serial tại kho nguồn';
        end if;
      end if;
    end if;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'sku_id', v_sku_id,
      'from_location_id', p_from_loc,
      'to_location_id', p_to_loc,
      'entered_quantity', v_entered,
      'transaction_unit_id', v_tu_id,
      'allocations', v_allocs
    ));
  end loop;

  if jsonb_array_length(v_lines) = 0 then
    raise exception 'Không có vật tư nào để chuyển';
  end if;

  perform public.post_transfer_command(jsonb_build_object(
    'document_id', v_doc_id,
    'actor_id', coalesce(auth.uid(), p_by),
    'idempotency_key', 'transfer-' || v_doc_id::text,
    'notes', 'Điều chuyển kho nội bộ',
    'lines', v_lines
  ));

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'stock.transfer', 'transfer', v_doc_id,
          jsonb_build_object('from', p_from_loc, 'to', p_to_loc, 'lines_count', jsonb_array_length(v_lines)));
end;
$$;


--
-- Name: unaccent_text(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unaccent_text(p_text text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
  SELECT extensions.unaccent('extensions.unaccent', COALESCE(p_text, ''));
$$;


--
-- Name: update_defect_item_images(uuid, text[], uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_defect_item_images(p_item_id uuid, p_images text[], p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_note_id uuid;
  v_status public.defect_status;
  v_reporter uuid;
  v_old_images text[];
  v_removed_img text;
  v_is_dev boolean;
begin
  if auth.uid() is null and p_by is null then raise exception 'Chưa đăng nhập'; end if;
  if p_by is null then p_by := auth.uid(); end if;

  v_is_dev := public.is_superuser();

  select dni.defect_note_id, dn.status, dn.reported_by, coalesce(dni.images, '{}')
  into v_note_id, v_status, v_reporter, v_old_images
  from public.defect_note_items dni
  join public.defect_notes dn on dn.id = dni.defect_note_id
  where dni.id = p_item_id
  for update of dn;

  if v_note_id is null then raise exception 'Không tìm thấy dòng vật tư hỏng'; end if;
  if not public.is_manager() and v_reporter is distinct from p_by and not v_is_dev then
    raise exception 'Chỉ người báo hỏng hoặc quản lý/dev mới được cập nhật ảnh';
  end if;

  if not v_is_dev then
    foreach v_removed_img in array v_old_images loop
      if not (v_removed_img = any(coalesce(p_images, '{}'))) then
        if not (
          v_removed_img like '%' || p_by::text || '%'
          or (
            p_by = v_reporter
            and not exists (
              select 1 from public.profiles p
              where p.id <> p_by and v_removed_img like '%' || p.id::text || '%'
            )
          )
        ) then
          raise exception 'Bạn chỉ được quyền xoá ảnh do chính mình tải lên. Không được xoá ảnh do người khác tải lên.';
        end if;
      end if;
    end loop;
  end if;

  update public.defect_note_items
  set images = coalesce(p_images, '{}')
  where id = p_item_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'defect.update_images', 'defect', v_note_id,
          jsonb_build_object('item_id', p_item_id, 'images', p_images));
end;
$$;


--
-- Name: update_issue_invoice_images(uuid, text[], uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_issue_invoice_images(p_id uuid, p_invoice_images text[], p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_status text;
  v_created_by uuid;
  v_old_images text[];
  v_removed_img text;
  v_is_dev boolean;
  v_is_mgr boolean;
begin
  if auth.uid() is null and p_by is null then raise exception 'Chưa đăng nhập'; end if;
  if p_by is null then p_by := auth.uid(); end if;

  v_is_dev := public.is_superuser();
  v_is_mgr := public.is_manager();

  if not v_is_mgr and not v_is_dev then
    raise exception 'Chỉ quản lý hoặc dev mới được cập nhật ảnh hóa đơn';
  end if;

  select status, creator_id, coalesce(invoice_images, '{}')
  into v_status, v_created_by, v_old_images
  from public.issues where id = p_id for update;

  if v_status is null then raise exception 'Không tìm thấy phiếu xuất kho'; end if;

  if not v_is_dev then
    foreach v_removed_img in array v_old_images loop
      if not (v_removed_img = any(coalesce(p_invoice_images, '{}'))) then
        if not (
          v_removed_img like '%' || p_by::text || '%'
          or (
            p_by = v_created_by
            and not exists (
              select 1 from public.profiles p
              where p.id <> p_by and v_removed_img like '%' || p.id::text || '%'
            )
          )
        ) then
          raise exception 'Bạn chỉ được quyền xoá ảnh do chính mình tải lên. Không được xoá ảnh hoá đơn do người khác tải lên.';
        end if;
      end if;
    end loop;
  end if;

  update public.issues
  set invoice_images = coalesce(p_invoice_images, '{}'),
      updated_at = now()
  where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'issue.update_invoices', 'issue', p_id,
          jsonb_build_object('status', v_status, 'invoice_images', v_old_images),
          jsonb_build_object('status', v_status, 'invoice_images', p_invoice_images));
end;
$$;


--
-- Name: update_receipt(uuid, jsonb, uuid, uuid, text, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_receipt(p_id uuid, p_items jsonb, p_supplier_id uuid, p_by uuid, p_notes text DEFAULT NULL::text, p_invoice_images text[] DEFAULT '{}'::text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_status public.receipt_status;
  v_created_by uuid;
  v_old_images text[];
  v_removed_img text;
  v_is_dev boolean;
  it record;
begin
  if not public.is_manager() and not public.is_superuser() then
    raise exception 'Chỉ quản lý kho hoặc dev mới được sửa phiếu nhập';
  end if;
  
  v_is_dev := public.is_superuser();

  select status, created_by, coalesce(invoice_images, '{}')
  into v_status, v_created_by, v_old_images
  from public.receipts where id = p_id for update;

  if v_status is null then raise exception 'Không tìm thấy phiếu nhập'; end if;
  if v_status not in ('draft', 'approved') and not v_is_dev then
    raise exception 'Chỉ được sửa/kiểm đếm phiếu ở trạng thái chờ duyệt hoặc đã duyệt (hiện tại: %)', v_status;
  end if;

  if not v_is_dev then
    foreach v_removed_img in array v_old_images loop
      if not (v_removed_img = any(coalesce(p_invoice_images, '{}'))) then
        if not (
          v_removed_img like '%' || p_by::text || '%'
          or (
            p_by = v_created_by
            and not exists (
              select 1 from public.profiles p
              where p.id <> p_by and v_removed_img like '%' || p.id::text || '%'
            )
          )
        ) then
          raise exception 'Bạn chỉ được quyền xoá ảnh do chính mình tải lên. Không được xoá ảnh hoá đơn do người khác tải lên.';
        end if;
      end if;
    end loop;
  end if;

  update public.receipts
  set supplier_id = p_supplier_id,
      notes = p_notes,
      invoice_images = coalesce(p_invoice_images, invoice_images),
      updated_at = now()
  where id = p_id;

  delete from public.receipt_items where receipt_id = p_id;

  for it in select value from jsonb_array_elements(p_items) loop
    insert into public.receipt_items (receipt_id, sku_id, quantity, unit_cost, batch_no, expiry_date, transaction_unit_id, entered_quantity)
    values (
      p_id,
      (it.value->>'sku_id')::uuid,
      1,
      nullif(it.value->>'unit_cost','')::numeric,
      (it.value->'allocations'->0->>'lot_number'),
      (it.value->'allocations'->0->>'expiry_date')::date,
      nullif(it.value->>'transaction_unit_id','')::uuid,
      (it.value->>'entered_quantity')::numeric
    );
     -- Fix quantity for legacy compatibility until Task 13
    update public.receipt_items ri 
    set quantity = round((it.value->>'entered_quantity')::numeric * coalesce((select factor_to_base from public.sku_transaction_units tu where tu.id = nullif(it.value->>'transaction_unit_id','')::uuid limit 1), 1))
    where ri.receipt_id = p_id and ri.sku_id = (it.value->>'sku_id')::uuid;
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (p_by, 'receipt.update', 'receipt', p_id,
          jsonb_build_object('supplier_id', p_supplier_id, 'items_count', jsonb_array_length(p_items), 'invoice_images', p_invoice_images));
end;
$$;


--
-- Name: update_receipt_invoice_images(uuid, text[], uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_receipt_invoice_images(p_id uuid, p_invoice_images text[], p_by uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_status public.receipt_status;
  v_created_by uuid;
  v_old_images text[];
  v_removed_img text;
  v_is_dev boolean;
  v_is_mgr boolean;
begin
  if auth.uid() is null and p_by is null then raise exception 'Chưa đăng nhập'; end if;
  if p_by is null then p_by := auth.uid(); end if;

  v_is_dev := public.is_superuser();
  v_is_mgr := public.is_manager();

  if not v_is_mgr and not v_is_dev then
    raise exception 'Chỉ quản lý hoặc dev mới được cập nhật ảnh hóa đơn';
  end if;

  select status, created_by, coalesce(invoice_images, '{}')
  into v_status, v_created_by, v_old_images
  from public.receipts where id = p_id for update;

  if v_status is null then raise exception 'Không tìm thấy phiếu nhập kho'; end if;

  -- Kiểm tra quyền xoá đối với từng ảnh bị gỡ
  if not v_is_dev then
    foreach v_removed_img in array v_old_images loop
      if not (v_removed_img = any(coalesce(p_invoice_images, '{}'))) then
        if not (
          v_removed_img like '%' || p_by::text || '%'
          or (
            p_by = v_created_by
            and not exists (
              select 1 from public.profiles p
              where p.id <> p_by and v_removed_img like '%' || p.id::text || '%'
            )
          )
        ) then
          raise exception 'Bạn chỉ được quyền xoá ảnh do chính mình tải lên. Không được xoá ảnh hoá đơn do người khác tải lên.';
        end if;
      end if;
    end loop;
  end if;

  update public.receipts
  set invoice_images = coalesce(p_invoice_images, '{}'),
      updated_at = now()
  where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (p_by, 'receipt.update_invoices', 'receipt', p_id,
          jsonb_build_object('status', v_status, 'invoice_images', v_old_images),
          jsonb_build_object('status', v_status, 'invoice_images', p_invoice_images));
end;
$$;


--
-- Name: validate_bom_header_active_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_bom_header_active_version() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if new.active_version_id is not null and not exists(
    select 1 from public.bom_versions v where v.id=new.active_version_id and v.bom_header_id=new.id and v.status='active'
  ) then raise exception 'Phiên bản BOM active không thuộc header hoặc chưa active'; end if;
  return new;
end $$;


--
-- Name: validate_bom_item_one_level(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_bom_item_one_level() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_parent uuid;
begin
  select h.sku_id into v_parent from public.bom_versions v join public.bom_headers h on h.id=v.bom_header_id where v.id=new.bom_version_id;
  if v_parent=new.component_sku_id then raise exception 'BOM không được tự tham chiếu'; end if;
  if exists(select 1 from public.bom_headers h join public.bom_versions v on v.bom_header_id=h.id where h.sku_id=new.component_sku_id and v.status in ('scheduled','active')) then
    raise exception 'BOM lồng nhau không được hỗ trợ';
  end if;
  return new;
end $$;


--
-- Name: validate_sku_attribute_value(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_sku_attribute_value() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_type text; v_product uuid; v_dimension text; v_unit_dimension text;
begin
  select a.data_type,a.measurement_dimension into v_type,v_dimension
  from public.attribute_definitions a where a.id=new.attribute_definition_id;
  select product_id into v_product from public.skus where id=new.sku_id;
  if not exists(select 1 from public.product_attribute_definitions p where p.product_id=v_product and p.attribute_definition_id=new.attribute_definition_id) then
    raise exception 'Thuộc tính không thuộc hợp đồng Product';
  end if;
  if (v_type='option' and new.option_value_id is null)
    or (v_type='text' and new.text_value is null)
    or (v_type='number' and (new.numeric_value is null or new.unit_id is not null))
    or (v_type='measurement' and (new.numeric_value is null or new.unit_id is null))
    or (v_type='boolean' and new.boolean_value is null) then
    raise exception 'Giá trị không khớp kiểu thuộc tính %',v_type;
  end if;
  if v_type='measurement' then
    select dimension into v_unit_dimension from public.units where id=new.unit_id;
    if v_unit_dimension is distinct from v_dimension then raise exception 'Đơn vị không khớp đại lượng thuộc tính'; end if;
  end if;
  return new;
end $$;


--
-- Name: validate_sku_transaction_unit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_sku_transaction_unit() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_base uuid; v_scale smallint; v_tracking text;
begin
  select base_unit_id,tracking_policy into v_base,v_tracking from public.skus where id=new.sku_id;
  select decimal_scale into v_scale from public.units where id=new.unit_id;
  if new.is_base and (new.factor_to_base<>1 or new.unit_id<>v_base) then raise exception 'Đơn vị cơ sở phải có factor 1 và trùng base_unit_id'; end if;
  if v_tracking='serial' and (new.allow_fraction or v_scale<>0) then raise exception 'SKU serial không cho phép số lẻ'; end if;
  return new;
end $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text DEFAULT 'Cuộc trò chuyện mới'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_knowledge_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_knowledge_chunks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    chunk_index integer NOT NULL,
    content text NOT NULL,
    tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, content)) STORED,
    embedding extensions.vector(1536),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_knowledge_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_knowledge_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_key text NOT NULL,
    content_hash text NOT NULL,
    title text NOT NULL,
    category text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ai_knowledge_documents_category_check CHECK ((category = ANY (ARRAY['sop'::text, 'user_guide'::text, 'catalog'::text, 'policy'::text, 'general'::text])))
);


--
-- Name: ai_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    tool_calls jsonb,
    tool_results jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ai_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text, 'tool'::text])))
);


--
-- Name: ai_quick_prompts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_quick_prompts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    label text NOT NULL,
    prompt text NOT NULL,
    icon text DEFAULT 'PackageSearch'::text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_system_settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid
);


--
-- Name: attribute_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attribute_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    data_type text NOT NULL,
    measurement_dimension text,
    default_unit_id uuid,
    allow_custom_value boolean DEFAULT true NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attribute_definitions_check CHECK (((data_type = 'measurement'::text) = (measurement_dimension IS NOT NULL))),
    CONSTRAINT attribute_definitions_code_check CHECK (((code = lower(code)) AND (code ~ '^[a-z0-9_]+$'::text))),
    CONSTRAINT attribute_definitions_data_type_check CHECK ((data_type = ANY (ARRAY['option'::text, 'number'::text, 'measurement'::text, 'text'::text, 'boolean'::text])))
);


--
-- Name: attribute_option_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attribute_option_values (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    attribute_definition_id uuid NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    entity_type text,
    entity_id uuid,
    before jsonb,
    after jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: barcode_registry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.barcode_registry (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    barcode text NOT NULL,
    sku_id uuid,
    transaction_unit_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT barcode_registry_barcode_check CHECK ((btrim(barcode) <> ''::text)),
    CONSTRAINT barcode_registry_check CHECK ((num_nonnulls(sku_id, transaction_unit_id) = 1))
);


--
-- Name: bom_headers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom_headers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sku_id uuid NOT NULL,
    inventory_policy text NOT NULL,
    active_version_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bom_headers_inventory_policy_check CHECK ((inventory_policy = ANY (ARRAY['virtual_kit'::text, 'stocked_assembly'::text])))
);


--
-- Name: bom_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bom_version_id uuid NOT NULL,
    component_sku_id uuid NOT NULL,
    base_quantity numeric(20,6) NOT NULL,
    wastage_percent numeric(7,4) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bom_items_base_quantity_check CHECK ((base_quantity > (0)::numeric)),
    CONSTRAINT bom_items_wastage_percent_check CHECK (((wastage_percent >= (0)::numeric) AND (wastage_percent <= (100)::numeric)))
);


--
-- Name: bom_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bom_header_id uuid NOT NULL,
    version_number integer NOT NULL,
    status text NOT NULL,
    effective_period tstzrange NOT NULL,
    change_reason text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bom_versions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'active'::text, 'retired'::text]))),
    CONSTRAINT bom_versions_version_number_check CHECK ((version_number > 0))
);


--
-- Name: catalog_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid,
    owner_id uuid NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    revision bigint DEFAULT 1 NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT catalog_drafts_payload_check CHECK ((jsonb_typeof(payload) = 'object'::text)),
    CONSTRAINT catalog_drafts_revision_check CHECK ((revision > 0)),
    CONSTRAINT catalog_drafts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'activated'::text, 'abandoned'::text])))
);


--
-- Name: catalog_migration_issues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalog_migration_issues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    issue_type text NOT NULL,
    source_table text NOT NULL,
    source_id uuid,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    CONSTRAINT catalog_migration_issues_status_check CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text, 'accepted_legacy_gap'::text])))
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    icon text,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    phone text,
    address text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: defect_note_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.defect_note_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    defect_note_id uuid NOT NULL,
    sku_id uuid NOT NULL,
    quantity numeric(20,6) DEFAULT 1 NOT NULL,
    damage_detail text,
    damage_type public.damage_type,
    severity public.severity_level,
    images text[] DEFAULT '{}'::text[] NOT NULL,
    unit_cost numeric(12,2),
    resolution public.defect_resolution,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    note text,
    transaction_unit_id uuid,
    entered_quantity numeric(20,6),
    conversion_factor_snapshot numeric(20,9),
    snapshot_quality text DEFAULT 'legacy_unknown'::text NOT NULL,
    CONSTRAINT defect_note_items_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT defect_note_items_snapshot_quality_check CHECK ((snapshot_quality = ANY (ARRAY['complete'::text, 'legacy_unknown'::text])))
);


--
-- Name: defect_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.defect_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    source_location_id uuid,
    reported_by uuid,
    status public.defect_status DEFAULT 'staging'::public.defect_status NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    repair_requested_by uuid,
    repair_requested_at timestamp with time zone,
    collected_at timestamp with time zone,
    collected_by uuid
);


--
-- Name: defect_notes_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.defect_notes_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exchange_note_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exchange_note_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exchange_note_id uuid NOT NULL,
    sku_id uuid NOT NULL,
    quantity numeric(20,6) NOT NULL,
    transaction_unit_id uuid,
    entered_quantity numeric(20,6),
    conversion_factor_snapshot numeric(20,9),
    snapshot_quality text DEFAULT 'legacy_unknown'::text NOT NULL,
    CONSTRAINT exchange_note_items_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT exchange_note_items_snapshot_quality_check CHECK ((snapshot_quality = ANY (ARRAY['complete'::text, 'legacy_unknown'::text])))
);


--
-- Name: exchange_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exchange_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    linked_defect_id uuid NOT NULL,
    status public.exchange_status DEFAULT 'pending'::public.exchange_status NOT NULL,
    created_by uuid,
    approved_by uuid,
    issued_by uuid,
    received_by uuid,
    rejected_by uuid,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_at timestamp with time zone,
    issued_at timestamp with time zone,
    received_at timestamp with time zone,
    rejected_at timestamp with time zone,
    cancelled_at timestamp with time zone
);


--
-- Name: exchange_notes_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exchange_notes_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fuel_dispenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fuel_dispenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    vehicle_id uuid,
    zone_id uuid,
    fuel_type_id uuid NOT NULL,
    quantity numeric(12,2) NOT NULL,
    previous_odo numeric(12,2),
    current_odo numeric(12,2),
    usage_diff numeric(12,2),
    consumption_rate numeric(10,2),
    driver_name text,
    dispenser_id uuid NOT NULL,
    meter_images text[] DEFAULT '{}'::text[] NOT NULL,
    notes text,
    status text DEFAULT 'completed'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sub_zone_id uuid,
    CONSTRAINT fuel_dispenses_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT fuel_dispenses_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: fuel_dispenses_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fuel_dispenses_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fuel_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fuel_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fuel_type_id uuid NOT NULL,
    movement_type public.fuel_movement_type NOT NULL,
    quantity numeric(12,2) NOT NULL,
    balance_after numeric(12,2) NOT NULL,
    ref_type text NOT NULL,
    ref_id uuid NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fuel_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fuel_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    supplier_id uuid,
    fuel_type_id uuid NOT NULL,
    quantity numeric(12,2) NOT NULL,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    total_amount numeric(14,2) DEFAULT 0 NOT NULL,
    invoice_number text,
    invoice_images text[] DEFAULT '{}'::text[] NOT NULL,
    received_by uuid NOT NULL,
    notes text,
    status text DEFAULT 'completed'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fuel_receipts_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT fuel_receipts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'completed'::text, 'cancelled'::text]))),
    CONSTRAINT fuel_receipts_total_amount_check CHECK ((total_amount >= (0)::numeric)),
    CONSTRAINT fuel_receipts_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: fuel_receipts_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fuel_receipts_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fuel_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fuel_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    unit text DEFAULT 'lít'::text NOT NULL,
    current_stock numeric(12,2) DEFAULT 0 NOT NULL,
    min_stock numeric(12,2) DEFAULT 0 NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fuel_types_current_stock_check CHECK ((current_stock >= (0)::numeric))
);


--
-- Name: inventory_lots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_lots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sku_id uuid NOT NULL,
    lot_number text NOT NULL,
    expiry_date date,
    migration_status text DEFAULT 'resolved'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_lots_migration_status_check CHECK ((migration_status = ANY (ARRAY['resolved'::text, 'legacy_unresolved'::text]))),
    CONSTRAINT inventory_lots_status_check CHECK ((status = ANY (ARRAY['active'::text, 'quarantined'::text, 'expired'::text, 'exhausted'::text])))
);


--
-- Name: inventory_posting_command_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_posting_command_movements (
    command_id uuid NOT NULL,
    movement_id uuid NOT NULL,
    sequence_no integer NOT NULL,
    CONSTRAINT inventory_posting_command_movements_sequence_no_check CHECK ((sequence_no >= 0))
);


--
-- Name: inventory_posting_commands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_posting_commands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    idempotency_key text NOT NULL,
    command_hash text NOT NULL,
    command_type text NOT NULL,
    command_payload jsonb NOT NULL,
    status text DEFAULT 'processing'::text NOT NULL,
    first_movement_id uuid,
    actor_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT inventory_posting_commands_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: issue_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.issue_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    issue_id uuid NOT NULL,
    sku_id uuid NOT NULL,
    quantity numeric(20,6) NOT NULL,
    unit_price numeric(12,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    transaction_unit_id uuid,
    entered_quantity numeric(20,6),
    conversion_factor_snapshot numeric(20,9),
    sku_name_snapshot text,
    uom_name_snapshot text,
    snapshot_quality text DEFAULT 'legacy_unknown'::text NOT NULL,
    CONSTRAINT issue_items_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT issue_items_snapshot_quality_check CHECK ((snapshot_quality = ANY (ARRAY['complete'::text, 'legacy_unknown'::text])))
);


--
-- Name: issues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.issues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    destination_type text NOT NULL,
    zone_id uuid,
    customer_id uuid,
    vehicle_plate text,
    driver_name text,
    creator_id uuid NOT NULL,
    notes text,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    invoice_images text[] DEFAULT '{}'::text[] NOT NULL,
    sub_zone_id uuid,
    CONSTRAINT issues_check CHECK ((((destination_type = 'zone'::text) AND (zone_id IS NOT NULL) AND (customer_id IS NULL)) OR ((destination_type = 'customer'::text) AND (customer_id IS NOT NULL) AND (zone_id IS NULL)))),
    CONSTRAINT issues_destination_type_check CHECK ((destination_type = ANY (ARRAY['zone'::text, 'customer'::text]))),
    CONSTRAINT issues_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'posted'::text, 'cancelled'::text])))
);


--
-- Name: issues_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.issues_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: liquidation_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquidation_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    liquidation_note_id uuid NOT NULL,
    sku_id uuid NOT NULL,
    source_item_id uuid,
    quantity numeric(20,6) DEFAULT 1 NOT NULL,
    method public.liquidation_method DEFAULT 'dispose'::public.liquidation_method NOT NULL,
    unit_value numeric(12,2),
    proceeds numeric(12,2) DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    transaction_unit_id uuid,
    entered_quantity numeric(20,6),
    conversion_factor_snapshot numeric(20,9),
    snapshot_quality text DEFAULT 'legacy_unknown'::text NOT NULL,
    CONSTRAINT liquidation_items_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT liquidation_items_snapshot_quality_check CHECK ((snapshot_quality = ANY (ARRAY['complete'::text, 'legacy_unknown'::text])))
);


--
-- Name: liquidation_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquidation_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    reason text,
    status public.liquidation_status DEFAULT 'pending'::public.liquidation_status NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    completed_at timestamp with time zone,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: liquidation_notes_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.liquidation_notes_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sku_id uuid NOT NULL,
    location_id uuid NOT NULL,
    quantity numeric(20,6) DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    reserved_quantity numeric(20,6) DEFAULT 0 NOT NULL,
    base_unit_id uuid,
    CONSTRAINT stock_balances_quantity_check CHECK ((quantity >= (0)::numeric)),
    CONSTRAINT stock_balances_reserved_quantity_check CHECK ((reserved_quantity >= (0)::numeric))
);


--
-- Name: skus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skus (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    price numeric(12,2),
    images text[] DEFAULT '{}'::text[] NOT NULL,
    min_stock integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    sku_code text,
    sku_status text DEFAULT 'active'::text NOT NULL,
    base_unit_id uuid,
    tracking_policy text DEFAULT 'none'::text NOT NULL,
    inventory_policy text DEFAULT 'normal'::text NOT NULL,
    allow_fraction boolean DEFAULT false NOT NULL,
    CONSTRAINT skus_inventory_policy_check CHECK ((inventory_policy = ANY (ARRAY['normal'::text, 'virtual_kit'::text, 'stocked_assembly'::text]))),
    CONSTRAINT skus_sku_status_check CHECK ((sku_status = ANY (ARRAY['draft'::text, 'active'::text, 'inactive'::text]))),
    CONSTRAINT skus_tracking_policy_check CHECK ((tracking_policy = ANY (ARRAY['none'::text, 'lot'::text, 'lot_expiry'::text, 'serial'::text])))
);


--
-- Name: location_stock; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.location_stock AS
 SELECT loc.location_id,
    v.id AS sku_id,
    v.product_id,
        CASE
            WHEN ((v.inventory_policy = 'virtual_kit'::text) AND (bh.id IS NOT NULL) AND (bv.id IS NOT NULL)) THEN COALESCE(( SELECT min((sb.quantity / GREATEST(bi.base_quantity, 0.000001))) AS min
               FROM (public.bom_items bi
                 JOIN public.stock_balances sb ON (((sb.sku_id = bi.component_sku_id) AND (sb.location_id = loc.location_id))))
              WHERE (bi.bom_version_id = bv.id)), (0)::numeric)
            ELSE COALESCE(( SELECT sb.quantity
               FROM public.stock_balances sb
              WHERE ((sb.sku_id = v.id) AND (sb.location_id = loc.location_id))), (0)::numeric)
        END AS quantity
   FROM (((public.skus v
     LEFT JOIN public.bom_headers bh ON ((bh.sku_id = v.id)))
     LEFT JOIN public.bom_versions bv ON ((bv.id = bh.active_version_id)))
     CROSS JOIN ( SELECT DISTINCT stock_balances.location_id
           FROM public.stock_balances) loc);


--
-- Name: lot_stock_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lot_stock_balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lot_id uuid NOT NULL,
    location_id uuid NOT NULL,
    quantity numeric(20,6) DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lot_stock_balances_quantity_check CHECK ((quantity >= (0)::numeric))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text DEFAULT 'info'::text NOT NULL,
    title text NOT NULL,
    body text,
    link text,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_attribute_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_attribute_definitions (
    product_id uuid NOT NULL,
    attribute_definition_id uuid NOT NULL,
    is_required boolean DEFAULT true NOT NULL,
    is_variant_axis boolean DEFAULT true NOT NULL,
    display_order smallint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_attribute_definitions_display_order_check CHECK ((display_order >= 0))
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    images text[] DEFAULT '{}'::text[] NOT NULL,
    category_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    catalog_status text DEFAULT 'active'::text NOT NULL,
    search_keywords text[] DEFAULT '{}'::text[] NOT NULL,
    internal_notes text,
    CONSTRAINT products_catalog_status_check CHECK ((catalog_status = ANY (ARRAY['draft'::text, 'active'::text, 'archived'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    name text NOT NULL,
    role text NOT NULL,
    zone_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    username text NOT NULL,
    is_protected boolean DEFAULT false NOT NULL,
    sub_zone_id uuid,
    email text,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['superuser'::text, 'owner'::text, 'accountant'::text, 'warehouse'::text, 'technician'::text, 'requester'::text, 'driver'::text])))
);


--
-- Name: receipt_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receipt_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    receipt_id uuid NOT NULL,
    sku_id uuid NOT NULL,
    quantity numeric(20,6) NOT NULL,
    unit_cost numeric(12,2),
    batch_no text,
    expiry_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    transaction_unit_id uuid,
    entered_quantity numeric(20,6),
    conversion_factor_snapshot numeric(20,9),
    sku_name_snapshot text,
    uom_name_snapshot text,
    snapshot_quality text DEFAULT 'legacy_unknown'::text NOT NULL,
    CONSTRAINT receipt_items_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT receipt_items_snapshot_quality_check CHECK ((snapshot_quality = ANY (ARRAY['complete'::text, 'legacy_unknown'::text])))
);


--
-- Name: receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    supplier_id uuid,
    status public.receipt_status DEFAULT 'draft'::public.receipt_status NOT NULL,
    notes text,
    created_by uuid,
    linked_requisition_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    invoice_images text[] DEFAULT '{}'::text[] NOT NULL
);


--
-- Name: receipts_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.receipts_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: repair_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    repair_order_id uuid NOT NULL,
    defect_item_id uuid,
    sku_id uuid NOT NULL,
    quantity numeric(20,6) DEFAULT 1 NOT NULL,
    repair_detail text,
    cost numeric(12,2),
    outcome public.repair_outcome,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    transaction_unit_id uuid,
    entered_quantity numeric(20,6),
    conversion_factor_snapshot numeric(20,9),
    snapshot_quality text DEFAULT 'legacy_unknown'::text NOT NULL,
    CONSTRAINT repair_order_items_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT repair_order_items_snapshot_quality_check CHECK ((snapshot_quality = ANY (ARRAY['complete'::text, 'legacy_unknown'::text])))
);


--
-- Name: repair_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    vendor text NOT NULL,
    sent_at date,
    expected_return_at date,
    returned_at timestamp with time zone,
    status public.repair_status DEFAULT 'in_repair'::public.repair_status NOT NULL,
    total_cost numeric(12,2),
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: repair_orders_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.repair_orders_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: requisition_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.requisition_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requisition_id uuid NOT NULL,
    sku_id uuid NOT NULL,
    quantity numeric(20,6) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    transaction_unit_id uuid,
    entered_quantity numeric(20,6),
    conversion_factor_snapshot numeric(20,9),
    sku_name_snapshot text,
    uom_name_snapshot text,
    snapshot_quality text DEFAULT 'legacy_unknown'::text NOT NULL,
    CONSTRAINT requisition_items_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT requisition_items_snapshot_quality_check CHECK ((snapshot_quality = ANY (ARRAY['complete'::text, 'legacy_unknown'::text])))
);


--
-- Name: requisition_return_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.requisition_return_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    return_id uuid NOT NULL,
    sku_id uuid NOT NULL,
    quantity numeric(20,6) NOT NULL,
    transaction_unit_id uuid,
    entered_quantity numeric(20,6),
    conversion_factor_snapshot numeric(20,9),
    snapshot_quality text DEFAULT 'legacy_unknown'::text NOT NULL,
    CONSTRAINT requisition_return_items_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT requisition_return_items_snapshot_quality_check CHECK ((snapshot_quality = ANY (ARRAY['complete'::text, 'legacy_unknown'::text])))
);


--
-- Name: requisition_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.requisition_returns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requisition_id uuid NOT NULL,
    returned_by uuid,
    operation_key text,
    payload_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT requisition_returns_operation_key_key UNIQUE NULLS NOT DISTINCT (requisition_id, operation_key)
);


--
-- Name: requisitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.requisitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    requester_id uuid NOT NULL,
    zone_id uuid,
    purpose text NOT NULL,
    requisition_type public.requisition_type DEFAULT 'new_supply'::public.requisition_type NOT NULL,
    linked_defect_id uuid,
    status public.requisition_status DEFAULT 'draft'::public.requisition_status NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    rejection_reason text,
    fulfilled_by uuid,
    fulfilled_at timestamp with time zone,
    fulfillment_notes text,
    received_by uuid,
    received_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sub_zone_id uuid
);


--
-- Name: requisitions_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.requisitions_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: serial_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.serial_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sku_id uuid NOT NULL,
    lot_id uuid,
    serial_code text NOT NULL,
    location_id uuid,
    status text DEFAULT 'available'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT serial_items_status_check CHECK ((status = ANY (ARRAY['available'::text, 'reserved'::text, 'issued'::text, 'defect'::text, 'repair'::text, 'liquidated'::text])))
);


--
-- Name: sku_attribute_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sku_attribute_values (
    sku_id uuid NOT NULL,
    attribute_definition_id uuid NOT NULL,
    option_value_id uuid,
    text_value text,
    numeric_value numeric(20,6),
    boolean_value boolean,
    unit_id uuid,
    legacy_text_value text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sku_attribute_values_check CHECK ((num_nonnulls(option_value_id, text_value, numeric_value, boolean_value) = 1)),
    CONSTRAINT sku_attribute_values_check1 CHECK ((((numeric_value IS NULL) AND (unit_id IS NULL)) OR (numeric_value IS NOT NULL)))
);


--
-- Name: sku_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sku_prices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sku_id uuid NOT NULL,
    transaction_unit_id uuid,
    price_type text NOT NULL,
    price_basis text NOT NULL,
    amount numeric(18,2) NOT NULL,
    base_unit_amount numeric(20,6),
    currency text DEFAULT 'VND'::text NOT NULL,
    effective_period tstzrange DEFAULT tstzrange(now(), NULL::timestamp with time zone, '[)'::text) NOT NULL,
    source text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sku_prices_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT sku_prices_check CHECK (((price_basis = 'transaction_uom'::text) = (transaction_unit_id IS NOT NULL))),
    CONSTRAINT sku_prices_price_basis_check CHECK ((price_basis = ANY (ARRAY['base_uom'::text, 'transaction_uom'::text]))),
    CONSTRAINT sku_prices_price_type_check CHECK ((price_type = ANY (ARRAY['purchase'::text, 'sale'::text, 'reference'::text])))
);


--
-- Name: sku_transaction_units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sku_transaction_units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sku_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    code text NOT NULL,
    display_name text NOT NULL,
    factor_to_base numeric(20,9) NOT NULL,
    allow_receipt boolean DEFAULT true NOT NULL,
    allow_issue boolean DEFAULT true NOT NULL,
    allow_fraction boolean DEFAULT false NOT NULL,
    is_base boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    legacy_parent_sku_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sku_transaction_units_factor_to_base_check CHECK ((factor_to_base > (0)::numeric))
);


--
-- Name: skus_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.skus_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stock_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    type public.location_type DEFAULT 'main'::public.location_type NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_movement_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movement_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    movement_id uuid NOT NULL,
    lot_id uuid,
    serial_id uuid,
    base_quantity numeric(20,6) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_movement_allocations_base_quantity_check CHECK ((base_quantity > (0)::numeric)),
    CONSTRAINT stock_movement_allocations_check CHECK ((num_nonnulls(lot_id, serial_id) <= 1))
);


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sku_id uuid NOT NULL,
    from_location_id uuid,
    to_location_id uuid,
    movement_type public.movement_type NOT NULL,
    quantity numeric(20,6) NOT NULL,
    ref_type text,
    ref_id uuid,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    base_unit_id uuid,
    entered_quantity numeric(20,6),
    transaction_unit_id uuid,
    conversion_factor_snapshot numeric(20,9),
    base_quantity numeric(20,6),
    unit_cost numeric(20,6),
    sku_name_snapshot text,
    uom_name_snapshot text,
    snapshot_quality text DEFAULT 'legacy_unknown'::text NOT NULL,
    idempotency_key text,
    reversal_of_movement_id uuid,
    bom_version_id uuid,
    CONSTRAINT stock_movements_snapshot_quality_check CHECK ((snapshot_quality = ANY (ARRAY['complete'::text, 'legacy_unknown'::text])))
);


--
-- Name: stock_reservation_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_reservation_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reservation_id uuid NOT NULL,
    lot_id uuid,
    serial_id uuid,
    reserved_quantity numeric(20,6) NOT NULL,
    consumed_quantity numeric(20,6) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_reservation_allocations_check CHECK ((consumed_quantity <= reserved_quantity)),
    CONSTRAINT stock_reservation_allocations_check1 CHECK ((num_nonnulls(lot_id, serial_id) <= 1)),
    CONSTRAINT stock_reservation_allocations_consumed_quantity_check CHECK ((consumed_quantity >= (0)::numeric)),
    CONSTRAINT stock_reservation_allocations_reserved_quantity_check CHECK ((reserved_quantity > (0)::numeric))
);


--
-- Name: stock_reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_reservations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sku_id uuid NOT NULL,
    location_id uuid NOT NULL,
    source_document_type text NOT NULL,
    source_document_id uuid NOT NULL,
    source_document_line_id uuid,
    base_unit_id uuid,
    reserved_quantity numeric(20,6) NOT NULL,
    consumed_quantity numeric(20,6) DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    bom_version_id uuid,
    idempotency_key text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    command_hash text,
    CONSTRAINT stock_reservations_check CHECK ((consumed_quantity <= reserved_quantity)),
    CONSTRAINT stock_reservations_consumed_quantity_check CHECK ((consumed_quantity >= (0)::numeric)),
    CONSTRAINT stock_reservations_reserved_quantity_check CHECK ((reserved_quantity > (0)::numeric)),
    CONSTRAINT stock_reservations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'partially_consumed'::text, 'consumed'::text, 'released'::text, 'expired'::text])))
);


--
-- Name: stocktake_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stocktake_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    sku_id uuid NOT NULL,
    system_qty numeric(20,6) DEFAULT 0 NOT NULL,
    actual_qty numeric(20,6) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    checked boolean DEFAULT false NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    transaction_unit_id uuid,
    conversion_factor_snapshot numeric(20,9),
    entered_quantity numeric(20,6),
    snapshot_quality text DEFAULT 'legacy_unknown'::text NOT NULL,
    CONSTRAINT stocktake_items_snapshot_quality_check CHECK ((snapshot_quality = ANY (ARRAY['complete'::text, 'legacy_unknown'::text])))
);


--
-- Name: stocktake_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stocktake_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stocktake_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stocktake_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    location_id uuid NOT NULL,
    status public.stocktake_status DEFAULT 'draft'::public.stocktake_status NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    posted_at timestamp with time zone,
    name text
);


--
-- Name: sub_zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sub_zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    zone_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    contact_name text,
    phone text,
    email text,
    address text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: tool_borrowing_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tool_borrowing_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    borrowing_id uuid NOT NULL,
    sku_id uuid NOT NULL,
    quantity numeric(20,6) NOT NULL,
    returned_quantity integer DEFAULT 0 NOT NULL,
    notes text,
    transaction_unit_id uuid,
    entered_quantity numeric(20,6),
    conversion_factor_snapshot numeric(20,9),
    snapshot_quality text DEFAULT 'legacy_unknown'::text NOT NULL,
    CONSTRAINT tool_borrowing_items_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT tool_borrowing_items_returned_quantity_check CHECK ((returned_quantity >= 0)),
    CONSTRAINT tool_borrowing_items_snapshot_quality_check CHECK ((snapshot_quality = ANY (ARRAY['complete'::text, 'legacy_unknown'::text])))
);


--
-- Name: tool_borrowings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tool_borrowings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    borrower_id uuid NOT NULL,
    zone_id uuid,
    purpose text NOT NULL,
    borrowed_at timestamp with time zone DEFAULT now() NOT NULL,
    expected_return_date date,
    returned_at timestamp with time zone,
    issued_by uuid,
    received_back_by uuid,
    notes text,
    status public.tool_borrowing_status DEFAULT 'borrowed'::public.tool_borrowing_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sub_zone_id uuid
);


--
-- Name: tool_borrowings_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tool_borrowings_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    symbol text NOT NULL,
    dimension text NOT NULL,
    factor_to_reference numeric(20,9) DEFAULT 1 NOT NULL,
    decimal_scale smallint DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT units_code_check CHECK (((code = lower(code)) AND (code ~ '^[a-z0-9_]+$'::text))),
    CONSTRAINT units_decimal_scale_check CHECK (((decimal_scale >= 0) AND (decimal_scale <= 6))),
    CONSTRAINT units_dimension_check CHECK ((dimension = ANY (ARRAY['count'::text, 'mass'::text, 'volume'::text, 'length'::text, 'area'::text, 'power'::text, 'voltage'::text, 'current'::text, 'time'::text, 'package'::text]))),
    CONSTRAINT units_factor_to_reference_check CHECK ((factor_to_reference > (0)::numeric))
);


--
-- Name: sku_stock; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.sku_stock AS
 SELECT v.id AS sku_id,
    v.product_id,
    v.min_stock,
    u.name AS unit,
        CASE
            WHEN ((v.inventory_policy = 'virtual_kit'::text) AND (bh.id IS NOT NULL) AND (bv.id IS NOT NULL)) THEN COALESCE(( SELECT min((sb.quantity / GREATEST(bi.base_quantity, 0.000001))) AS min
               FROM ((public.bom_items bi
                 JOIN public.stock_balances sb ON ((sb.sku_id = bi.component_sku_id)))
                 JOIN public.stock_locations sl ON (((sl.id = sb.location_id) AND (sl.code = 'KHO_CHINH'::text))))
              WHERE (bi.bom_version_id = bv.id)), (0)::numeric)
            ELSE COALESCE(( SELECT sb.quantity
               FROM (public.stock_balances sb
                 JOIN public.stock_locations sl ON (((sl.id = sb.location_id) AND (sl.code = 'KHO_CHINH'::text))))
              WHERE (sb.sku_id = v.id)), (0)::numeric)
        END AS quantity
   FROM (((public.skus v
     LEFT JOIN public.units u ON ((u.id = v.base_unit_id)))
     LEFT JOIN public.bom_headers bh ON ((bh.sku_id = v.id)))
     LEFT JOIN public.bom_versions bv ON ((bv.id = bh.active_version_id)));


--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    type public.vehicle_type DEFAULT 'truck'::public.vehicle_type NOT NULL,
    zone_id uuid,
    default_driver text,
    fuel_type_id uuid,
    current_odo numeric(12,2) DEFAULT 0 NOT NULL,
    odo_unit public.fuel_calc_unit DEFAULT 'km'::public.fuel_calc_unit NOT NULL,
    fuel_norm numeric(10,2),
    qr_token text NOT NULL,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sub_zone_id uuid
);


--
-- Name: zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: ai_conversations ai_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_pkey PRIMARY KEY (id);


--
-- Name: ai_knowledge_chunks ai_knowledge_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_chunks
    ADD CONSTRAINT ai_knowledge_chunks_pkey PRIMARY KEY (id);


--
-- Name: ai_knowledge_documents ai_knowledge_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_documents
    ADD CONSTRAINT ai_knowledge_documents_pkey PRIMARY KEY (id);


--
-- Name: ai_knowledge_documents ai_knowledge_documents_source_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_documents
    ADD CONSTRAINT ai_knowledge_documents_source_key_key UNIQUE (source_key);


--
-- Name: ai_messages ai_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_pkey PRIMARY KEY (id);


--
-- Name: ai_quick_prompts ai_quick_prompts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_quick_prompts
    ADD CONSTRAINT ai_quick_prompts_pkey PRIMARY KEY (id);


--
-- Name: ai_system_settings ai_system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_system_settings
    ADD CONSTRAINT ai_system_settings_pkey PRIMARY KEY (key);


--
-- Name: attribute_definitions attribute_definitions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attribute_definitions
    ADD CONSTRAINT attribute_definitions_code_key UNIQUE (code);


--
-- Name: attribute_definitions attribute_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attribute_definitions
    ADD CONSTRAINT attribute_definitions_pkey PRIMARY KEY (id);


--
-- Name: attribute_option_values attribute_option_values_attribute_definition_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attribute_option_values
    ADD CONSTRAINT attribute_option_values_attribute_definition_id_code_key UNIQUE (attribute_definition_id, code);


--
-- Name: attribute_option_values attribute_option_values_id_attribute_definition_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attribute_option_values
    ADD CONSTRAINT attribute_option_values_id_attribute_definition_id_key UNIQUE (id, attribute_definition_id);


--
-- Name: attribute_option_values attribute_option_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attribute_option_values
    ADD CONSTRAINT attribute_option_values_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: barcode_registry barcode_registry_barcode_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barcode_registry
    ADD CONSTRAINT barcode_registry_barcode_key UNIQUE (barcode);


--
-- Name: barcode_registry barcode_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barcode_registry
    ADD CONSTRAINT barcode_registry_pkey PRIMARY KEY (id);


--
-- Name: bom_headers bom_headers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_headers
    ADD CONSTRAINT bom_headers_pkey PRIMARY KEY (id);


--
-- Name: bom_headers bom_headers_sku_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_headers
    ADD CONSTRAINT bom_headers_sku_id_key UNIQUE (sku_id);


--
-- Name: bom_items bom_items_bom_version_id_component_sku_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_items
    ADD CONSTRAINT bom_items_bom_version_id_component_sku_id_key UNIQUE (bom_version_id, component_sku_id);


--
-- Name: bom_items bom_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_items
    ADD CONSTRAINT bom_items_pkey PRIMARY KEY (id);


--
-- Name: bom_versions bom_versions_bom_header_id_effective_period_excl; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_versions
    ADD CONSTRAINT bom_versions_bom_header_id_effective_period_excl EXCLUDE USING gist (bom_header_id WITH =, effective_period WITH &&) WHERE ((status = ANY (ARRAY['scheduled'::text, 'active'::text])));


--
-- Name: bom_versions bom_versions_bom_header_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_versions
    ADD CONSTRAINT bom_versions_bom_header_id_version_number_key UNIQUE (bom_header_id, version_number);


--
-- Name: bom_versions bom_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_versions
    ADD CONSTRAINT bom_versions_pkey PRIMARY KEY (id);


--
-- Name: catalog_drafts catalog_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_drafts
    ADD CONSTRAINT catalog_drafts_pkey PRIMARY KEY (id);


--
-- Name: catalog_migration_issues catalog_migration_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_migration_issues
    ADD CONSTRAINT catalog_migration_issues_pkey PRIMARY KEY (id);


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: defect_note_items defect_note_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.defect_note_items
    ADD CONSTRAINT defect_note_items_pkey PRIMARY KEY (id);


--
-- Name: defect_notes defect_notes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.defect_notes
    ADD CONSTRAINT defect_notes_code_key UNIQUE (code);


--
-- Name: defect_notes defect_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.defect_notes
    ADD CONSTRAINT defect_notes_pkey PRIMARY KEY (id);


--
-- Name: exchange_note_items exchange_note_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_note_items
    ADD CONSTRAINT exchange_note_items_pkey PRIMARY KEY (id);


--
-- Name: exchange_notes exchange_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_notes
    ADD CONSTRAINT exchange_notes_pkey PRIMARY KEY (id);


--
-- Name: fuel_dispenses fuel_dispenses_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_dispenses
    ADD CONSTRAINT fuel_dispenses_code_key UNIQUE (code);


--
-- Name: fuel_dispenses fuel_dispenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_dispenses
    ADD CONSTRAINT fuel_dispenses_pkey PRIMARY KEY (id);


--
-- Name: fuel_movements fuel_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_movements
    ADD CONSTRAINT fuel_movements_pkey PRIMARY KEY (id);


--
-- Name: fuel_receipts fuel_receipts_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_receipts
    ADD CONSTRAINT fuel_receipts_code_key UNIQUE (code);


--
-- Name: fuel_receipts fuel_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_receipts
    ADD CONSTRAINT fuel_receipts_pkey PRIMARY KEY (id);


--
-- Name: fuel_types fuel_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_types
    ADD CONSTRAINT fuel_types_code_key UNIQUE (code);


--
-- Name: fuel_types fuel_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_types
    ADD CONSTRAINT fuel_types_pkey PRIMARY KEY (id);


--
-- Name: inventory_lots inventory_lots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_lots
    ADD CONSTRAINT inventory_lots_pkey PRIMARY KEY (id);


--
-- Name: inventory_lots inventory_lots_sku_id_lot_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_lots
    ADD CONSTRAINT inventory_lots_sku_id_lot_number_key UNIQUE (sku_id, lot_number);


--
-- Name: inventory_posting_command_movements inventory_posting_command_movements_movement_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_posting_command_movements
    ADD CONSTRAINT inventory_posting_command_movements_movement_id_key UNIQUE (movement_id);


--
-- Name: inventory_posting_command_movements inventory_posting_command_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_posting_command_movements
    ADD CONSTRAINT inventory_posting_command_movements_pkey PRIMARY KEY (command_id, sequence_no);


--
-- Name: inventory_posting_commands inventory_posting_commands_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_posting_commands
    ADD CONSTRAINT inventory_posting_commands_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: inventory_posting_commands inventory_posting_commands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_posting_commands
    ADD CONSTRAINT inventory_posting_commands_pkey PRIMARY KEY (id);


--
-- Name: issue_items issue_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_items
    ADD CONSTRAINT issue_items_pkey PRIMARY KEY (id);


--
-- Name: issues issues_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issues
    ADD CONSTRAINT issues_code_key UNIQUE (code);


--
-- Name: issues issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issues
    ADD CONSTRAINT issues_pkey PRIMARY KEY (id);


--
-- Name: liquidation_items liquidation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquidation_items
    ADD CONSTRAINT liquidation_items_pkey PRIMARY KEY (id);


--
-- Name: liquidation_notes liquidation_notes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquidation_notes
    ADD CONSTRAINT liquidation_notes_code_key UNIQUE (code);


--
-- Name: liquidation_notes liquidation_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquidation_notes
    ADD CONSTRAINT liquidation_notes_pkey PRIMARY KEY (id);


--
-- Name: lot_stock_balances lot_stock_balances_lot_id_location_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lot_stock_balances
    ADD CONSTRAINT lot_stock_balances_lot_id_location_id_key UNIQUE (lot_id, location_id);


--
-- Name: lot_stock_balances lot_stock_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lot_stock_balances
    ADD CONSTRAINT lot_stock_balances_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: product_attribute_definitions product_attribute_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_attribute_definitions
    ADD CONSTRAINT product_attribute_definitions_pkey PRIMARY KEY (product_id, attribute_definition_id);


--
-- Name: product_attribute_definitions product_attribute_definitions_product_id_display_order_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_attribute_definitions
    ADD CONSTRAINT product_attribute_definitions_product_id_display_order_key UNIQUE (product_id, display_order);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: receipt_items receipt_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_items
    ADD CONSTRAINT receipt_items_pkey PRIMARY KEY (id);


--
-- Name: receipts receipts_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_code_key UNIQUE (code);


--
-- Name: receipts receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_pkey PRIMARY KEY (id);


--
-- Name: repair_order_items repair_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_order_items
    ADD CONSTRAINT repair_order_items_pkey PRIMARY KEY (id);


--
-- Name: repair_orders repair_orders_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_orders
    ADD CONSTRAINT repair_orders_code_key UNIQUE (code);


--
-- Name: repair_orders repair_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_orders
    ADD CONSTRAINT repair_orders_pkey PRIMARY KEY (id);


--
-- Name: requisition_items requisition_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requisition_items
    ADD CONSTRAINT requisition_items_pkey PRIMARY KEY (id);


--
-- Name: requisition_return_items requisition_return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requisition_return_items
    ADD CONSTRAINT requisition_return_items_pkey PRIMARY KEY (id);


--
-- Name: requisition_returns requisition_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requisition_returns
    ADD CONSTRAINT requisition_returns_pkey PRIMARY KEY (id);


--
-- Name: requisitions requisitions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requisitions
    ADD CONSTRAINT requisitions_code_key UNIQUE (code);


--
-- Name: requisitions requisitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requisitions
    ADD CONSTRAINT requisitions_pkey PRIMARY KEY (id);


--
-- Name: serial_items serial_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.serial_items
    ADD CONSTRAINT serial_items_pkey PRIMARY KEY (id);


--
-- Name: serial_items serial_items_sku_id_serial_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.serial_items
    ADD CONSTRAINT serial_items_sku_id_serial_code_key UNIQUE (sku_id, serial_code);


--
-- Name: sku_attribute_values sku_attribute_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_attribute_values
    ADD CONSTRAINT sku_attribute_values_pkey PRIMARY KEY (sku_id, attribute_definition_id);


--
-- Name: sku_prices sku_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_prices
    ADD CONSTRAINT sku_prices_pkey PRIMARY KEY (id);


--
-- Name: sku_transaction_units sku_transaction_units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_transaction_units
    ADD CONSTRAINT sku_transaction_units_pkey PRIMARY KEY (id);


--
-- Name: sku_transaction_units sku_transaction_units_sku_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_transaction_units
    ADD CONSTRAINT sku_transaction_units_sku_id_code_key UNIQUE (sku_id, code);


--
-- Name: stock_balances stock_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_balances
    ADD CONSTRAINT stock_balances_pkey PRIMARY KEY (id);


--
-- Name: stock_balances stock_balances_sku_id_location_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_balances
    ADD CONSTRAINT stock_balances_sku_id_location_id_key UNIQUE (sku_id, location_id);


--
-- Name: stock_locations stock_locations_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_locations
    ADD CONSTRAINT stock_locations_code_key UNIQUE (code);


--
-- Name: stock_locations stock_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_locations
    ADD CONSTRAINT stock_locations_pkey PRIMARY KEY (id);


--
-- Name: stock_movement_allocations stock_movement_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movement_allocations
    ADD CONSTRAINT stock_movement_allocations_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: stock_reservation_allocations stock_reservation_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservation_allocations
    ADD CONSTRAINT stock_reservation_allocations_pkey PRIMARY KEY (id);


--
-- Name: stock_reservations stock_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_pkey PRIMARY KEY (id);


--
-- Name: stock_reservations stock_reservations_source_document_type_source_document_lin_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_source_document_type_source_document_lin_key UNIQUE (source_document_type, source_document_line_id, sku_id);


--
-- Name: stocktake_items stocktake_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stocktake_items
    ADD CONSTRAINT stocktake_items_pkey PRIMARY KEY (id);


--
-- Name: stocktake_sessions stocktake_sessions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stocktake_sessions
    ADD CONSTRAINT stocktake_sessions_code_key UNIQUE (code);


--
-- Name: stocktake_sessions stocktake_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stocktake_sessions
    ADD CONSTRAINT stocktake_sessions_pkey PRIMARY KEY (id);


--
-- Name: sub_zones sub_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_zones
    ADD CONSTRAINT sub_zones_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_name_key UNIQUE (name);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: tool_borrowing_items tool_borrowing_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_borrowing_items
    ADD CONSTRAINT tool_borrowing_items_pkey PRIMARY KEY (id);


--
-- Name: tool_borrowings tool_borrowings_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_borrowings
    ADD CONSTRAINT tool_borrowings_code_key UNIQUE (code);


--
-- Name: tool_borrowings tool_borrowings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_borrowings
    ADD CONSTRAINT tool_borrowings_pkey PRIMARY KEY (id);


--
-- Name: units units_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_code_key UNIQUE (code);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: skus skus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skus
    ADD CONSTRAINT skus_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_code_key UNIQUE (code);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_qr_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_qr_token_key UNIQUE (qr_token);


--
-- Name: zones zones_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_name_key UNIQUE (name);


--
-- Name: zones zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zones
    ADD CONSTRAINT zones_pkey PRIMARY KEY (id);


--
-- Name: ai_knowledge_chunks_doc_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_knowledge_chunks_doc_idx ON public.ai_knowledge_chunks USING btree (document_id);


--
-- Name: ai_knowledge_chunks_tsv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_knowledge_chunks_tsv_idx ON public.ai_knowledge_chunks USING gin (tsv);


--
-- Name: ai_messages_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_messages_conversation_idx ON public.ai_messages USING btree (conversation_id, created_at);


--
-- Name: bom_items_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bom_items_component ON public.bom_items USING btree (component_sku_id);


--
-- Name: catalog_drafts_owner_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX catalog_drafts_owner_status ON public.catalog_drafts USING btree (owner_id, status, updated_at DESC);


--
-- Name: catalog_migration_issues_source_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX catalog_migration_issues_source_unique ON public.catalog_migration_issues USING btree (issue_type, source_table, source_id) WHERE (source_id IS NOT NULL);


--
-- Name: catalog_migration_issues_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX catalog_migration_issues_status ON public.catalog_migration_issues USING btree (status, issue_type);


--
-- Name: customers_name_active_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customers_name_active_key ON public.customers USING btree (name) WHERE ((deleted_at IS NULL) AND is_active);


--
-- Name: exchange_note_items_note_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exchange_note_items_note_idx ON public.exchange_note_items USING btree (exchange_note_id);


--
-- Name: exchange_notes_active_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX exchange_notes_active_unique ON public.exchange_notes USING btree (linked_defect_id) WHERE (status = ANY (ARRAY['pending'::public.exchange_status, 'approved'::public.exchange_status, 'issued'::public.exchange_status, 'received'::public.exchange_status]));


--
-- Name: exchange_notes_defect_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exchange_notes_defect_idx ON public.exchange_notes USING btree (linked_defect_id);


--
-- Name: idx_audit_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_entity ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_balances_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_balances_location ON public.stock_balances USING btree (location_id);


--
-- Name: idx_balances_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_balances_variant ON public.stock_balances USING btree (sku_id);


--
-- Name: idx_categories_deleted_display; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_deleted_display ON public.categories USING btree (deleted_at, display_order) WHERE (deleted_at IS NULL);


--
-- Name: idx_customers_deleted_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_deleted_name ON public.customers USING btree (deleted_at, name) WHERE (deleted_at IS NULL);


--
-- Name: idx_defect_items_note; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_defect_items_note ON public.defect_note_items USING btree (defect_note_id);


--
-- Name: idx_defect_notes_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_defect_notes_created_at ON public.defect_notes USING btree (created_at DESC);


--
-- Name: idx_defect_notes_reported_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_defect_notes_reported_by ON public.defect_notes USING btree (reported_by);


--
-- Name: idx_defect_notes_source_loc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_defect_notes_source_loc ON public.defect_notes USING btree (source_location_id);


--
-- Name: idx_defect_notes_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_defect_notes_status_created ON public.defect_notes USING btree (status, created_at DESC);


--
-- Name: idx_exchange_notes_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exchange_notes_created_at ON public.exchange_notes USING btree (created_at DESC);


--
-- Name: idx_exchange_notes_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exchange_notes_created_by ON public.exchange_notes USING btree (created_by);


--
-- Name: idx_exchange_notes_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exchange_notes_status_created ON public.exchange_notes USING btree (status, created_at DESC);


--
-- Name: idx_fuel_dispenses_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fuel_dispenses_date ON public.fuel_dispenses USING btree (created_at DESC);


--
-- Name: idx_fuel_dispenses_sub_zone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fuel_dispenses_sub_zone_id ON public.fuel_dispenses USING btree (sub_zone_id);


--
-- Name: idx_fuel_dispenses_vehicle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fuel_dispenses_vehicle ON public.fuel_dispenses USING btree (vehicle_id);


--
-- Name: idx_fuel_dispenses_zone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fuel_dispenses_zone ON public.fuel_dispenses USING btree (zone_id);


--
-- Name: idx_fuel_movements_type_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fuel_movements_type_date ON public.fuel_movements USING btree (fuel_type_id, created_at DESC);


--
-- Name: idx_fuel_receipts_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fuel_receipts_date ON public.fuel_receipts USING btree (created_at DESC);


--
-- Name: idx_fuel_receipts_fuel_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fuel_receipts_fuel_type ON public.fuel_receipts USING btree (fuel_type_id);


--
-- Name: idx_issues_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_issues_created_at ON public.issues USING btree (created_at DESC);


--
-- Name: idx_issues_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_issues_creator ON public.issues USING btree (creator_id);


--
-- Name: idx_issues_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_issues_customer ON public.issues USING btree (customer_id);


--
-- Name: idx_issues_sub_zone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_issues_sub_zone_id ON public.issues USING btree (sub_zone_id);


--
-- Name: idx_issues_zone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_issues_zone ON public.issues USING btree (zone_id);


--
-- Name: idx_liquidation_items_note; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_liquidation_items_note ON public.liquidation_items USING btree (liquidation_note_id);


--
-- Name: idx_liquidation_notes_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_liquidation_notes_created_at ON public.liquidation_notes USING btree (created_at DESC);


--
-- Name: idx_liquidation_notes_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_liquidation_notes_status_created ON public.liquidation_notes USING btree (status, created_at DESC);


--
-- Name: idx_movements_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movements_type ON public.stock_movements USING btree (movement_type);


--
-- Name: idx_movements_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movements_variant ON public.stock_movements USING btree (sku_id);


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category ON public.products USING btree (category_id);


--
-- Name: idx_products_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_deleted_at ON public.products USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_products_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_name ON public.products USING btree (name);


--
-- Name: idx_profiles_sub_zone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_sub_zone_id ON public.profiles USING btree (sub_zone_id);


--
-- Name: idx_receipt_items_receipt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receipt_items_receipt ON public.receipt_items USING btree (receipt_id);


--
-- Name: idx_receipts_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receipts_created_at ON public.receipts USING btree (created_at DESC);


--
-- Name: idx_receipts_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receipts_created_by ON public.receipts USING btree (created_by);


--
-- Name: idx_receipts_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receipts_status_created ON public.receipts USING btree (status, created_at DESC);


--
-- Name: idx_receipts_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receipts_supplier ON public.receipts USING btree (supplier_id);


--
-- Name: idx_repair_items_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repair_items_order ON public.repair_order_items USING btree (repair_order_id);


--
-- Name: idx_repair_orders_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repair_orders_created_at ON public.repair_orders USING btree (created_at DESC);


--
-- Name: idx_repair_orders_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repair_orders_status_created ON public.repair_orders USING btree (status, created_at DESC);


--
-- Name: idx_requisition_items_req; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requisition_items_req ON public.requisition_items USING btree (requisition_id);


--
-- Name: idx_requisitions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requisitions_created_at ON public.requisitions USING btree (created_at DESC);


--
-- Name: idx_requisitions_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requisitions_requester ON public.requisitions USING btree (requester_id, created_at DESC);


--
-- Name: idx_requisitions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requisitions_status ON public.requisitions USING btree (status);


--
-- Name: idx_requisitions_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requisitions_status_created ON public.requisitions USING btree (status, created_at DESC);


--
-- Name: idx_requisitions_sub_zone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requisitions_sub_zone_id ON public.requisitions USING btree (sub_zone_id);


--
-- Name: idx_requisitions_unique_replacement; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_requisitions_unique_replacement ON public.requisitions USING btree (linked_defect_id) WHERE ((requisition_type = 'replacement'::public.requisition_type) AND (linked_defect_id IS NOT NULL) AND (status <> ALL (ARRAY['cancelled'::public.requisition_status, 'rejected'::public.requisition_status])));


--
-- Name: idx_requisitions_zone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_requisitions_zone ON public.requisitions USING btree (zone_id);


--
-- Name: idx_stock_movements_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_created_at ON public.stock_movements USING btree (created_at DESC);


--
-- Name: idx_stock_movements_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_ref ON public.stock_movements USING btree (ref_type, ref_id);


--
-- Name: idx_stock_movements_type_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_type_created ON public.stock_movements USING btree (movement_type, created_at DESC);


--
-- Name: idx_stocktake_items_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stocktake_items_session ON public.stocktake_items USING btree (session_id);


--
-- Name: idx_stocktake_sessions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stocktake_sessions_created_at ON public.stocktake_sessions USING btree (created_at DESC);


--
-- Name: idx_sub_zones_zone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sub_zones_zone_id ON public.sub_zones USING btree (zone_id);


--
-- Name: idx_sub_zones_zone_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_sub_zones_zone_name_unique ON public.sub_zones USING btree (zone_id, lower(name)) WHERE (deleted_at IS NULL);


--
-- Name: idx_suppliers_deleted_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_deleted_name ON public.suppliers USING btree (deleted_at, name) WHERE (deleted_at IS NULL);


--
-- Name: idx_tool_borrowings_sub_zone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tool_borrowings_sub_zone_id ON public.tool_borrowings USING btree (sub_zone_id);


--
-- Name: idx_skus_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skus_product ON public.skus USING btree (product_id);


--
-- Name: idx_skus_product_is_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skus_product_is_default ON public.skus USING btree (product_id, is_default DESC, price);


--
-- Name: idx_vehicles_qr; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicles_qr ON public.vehicles USING btree (qr_token);


--
-- Name: idx_vehicles_sub_zone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicles_sub_zone_id ON public.vehicles USING btree (sub_zone_id);


--
-- Name: idx_vehicles_zone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vehicles_zone ON public.vehicles USING btree (zone_id);


--
-- Name: idx_zones_deleted_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_zones_deleted_name ON public.zones USING btree (deleted_at, name) WHERE (deleted_at IS NULL);


--
-- Name: inventory_lots_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_lots_expiry ON public.inventory_lots USING btree (expiry_date) WHERE (expiry_date IS NOT NULL);


--
-- Name: inventory_lots_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_lots_sku ON public.inventory_lots USING btree (sku_id);


--
-- Name: issue_items_issue_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX issue_items_issue_idx ON public.issue_items USING btree (issue_id);


--
-- Name: issues_status_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX issues_status_created_idx ON public.issues USING btree (status, created_at);


--
-- Name: lot_stock_balances_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lot_stock_balances_location ON public.lot_stock_balances USING btree (location_id);


--
-- Name: lot_stock_balances_lot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lot_stock_balances_lot ON public.lot_stock_balances USING btree (lot_id);


--
-- Name: notifications_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_created_idx ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: profiles_username_lower_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_username_lower_idx ON public.profiles USING btree (lower(username));


--
-- Name: requisition_return_items_return_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX requisition_return_items_return_id_idx ON public.requisition_return_items USING btree (return_id);


--
-- Name: requisition_returns_requisition_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX requisition_returns_requisition_id_idx ON public.requisition_returns USING btree (requisition_id);


--
-- Name: serial_items_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX serial_items_location ON public.serial_items USING btree (location_id) WHERE (location_id IS NOT NULL);


--
-- Name: serial_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX serial_items_status ON public.serial_items USING btree (sku_id, status);


--
-- Name: sku_attribute_values_attribute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sku_attribute_values_attribute ON public.sku_attribute_values USING btree (attribute_definition_id);


--
-- Name: sku_prices_sku_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sku_prices_sku_type ON public.sku_prices USING btree (sku_id, price_type);


--
-- Name: sku_transaction_units_one_base; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sku_transaction_units_one_base ON public.sku_transaction_units USING btree (sku_id) WHERE is_base;


--
-- Name: sku_transaction_units_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sku_transaction_units_sku ON public.sku_transaction_units USING btree (sku_id);


--
-- Name: stock_movement_allocations_lot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movement_allocations_lot ON public.stock_movement_allocations USING btree (lot_id) WHERE (lot_id IS NOT NULL);


--
-- Name: stock_movement_allocations_movement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movement_allocations_movement ON public.stock_movement_allocations USING btree (movement_id);


--
-- Name: stock_movement_allocations_serial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movement_allocations_serial ON public.stock_movement_allocations USING btree (serial_id) WHERE (serial_id IS NOT NULL);


--
-- Name: stock_movements_idempotency_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX stock_movements_idempotency_key_unique ON public.stock_movements USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: stock_movements_one_reversal; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX stock_movements_one_reversal ON public.stock_movements USING btree (reversal_of_movement_id) WHERE (reversal_of_movement_id IS NOT NULL);


--
-- Name: stock_movements_ref_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movements_ref_doc ON public.stock_movements USING btree (ref_type, ref_id) WHERE (ref_id IS NOT NULL);


--
-- Name: stock_movements_reversal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movements_reversal ON public.stock_movements USING btree (reversal_of_movement_id) WHERE (reversal_of_movement_id IS NOT NULL);


--
-- Name: stock_movements_sku_location_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movements_sku_location_time ON public.stock_movements USING btree (sku_id, COALESCE(from_location_id, to_location_id), created_at DESC);


--
-- Name: stock_reservation_allocations_reservation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_reservation_allocations_reservation ON public.stock_reservation_allocations USING btree (reservation_id);


--
-- Name: stock_reservations_idempotency_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX stock_reservations_idempotency_key_unique ON public.stock_reservations USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: stock_reservations_sku_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_reservations_sku_location ON public.stock_reservations USING btree (sku_id, location_id, status);


--
-- Name: stock_reservations_source_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_reservations_source_doc ON public.stock_reservations USING btree (source_document_type, source_document_id);


--
-- Name: tool_borrowing_items_borrowing_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tool_borrowing_items_borrowing_idx ON public.tool_borrowing_items USING btree (borrowing_id);


--
-- Name: tool_borrowings_borrower_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tool_borrowings_borrower_idx ON public.tool_borrowings USING btree (borrower_id);


--
-- Name: tool_borrowings_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tool_borrowings_status_idx ON public.tool_borrowings USING btree (status);


--
-- Name: skus_one_default_per_product; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX skus_one_default_per_product ON public.skus USING btree (product_id) WHERE (is_default = true);


--
-- Name: skus_sku_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX skus_sku_code_unique ON public.skus USING btree (lower(sku_code)) WHERE (sku_code IS NOT NULL);


--
-- Name: attribute_definitions trg_attribute_definitions_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_attribute_definitions_updated BEFORE UPDATE ON public.attribute_definitions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: attribute_definitions trg_audit_attribute_definitions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_attribute_definitions AFTER INSERT OR DELETE OR UPDATE ON public.attribute_definitions FOR EACH ROW EXECUTE FUNCTION public.audit_normalized_catalog_change();


--
-- Name: bom_headers trg_audit_bom_headers; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_bom_headers AFTER INSERT OR DELETE OR UPDATE ON public.bom_headers FOR EACH ROW EXECUTE FUNCTION public.audit_normalized_catalog_change();


--
-- Name: bom_items trg_audit_bom_items; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_bom_items AFTER INSERT OR DELETE OR UPDATE ON public.bom_items FOR EACH ROW EXECUTE FUNCTION public.audit_normalized_catalog_change();


--
-- Name: bom_versions trg_audit_bom_versions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_bom_versions AFTER INSERT OR DELETE OR UPDATE ON public.bom_versions FOR EACH ROW EXECUTE FUNCTION public.audit_normalized_catalog_change();


--
-- Name: product_attribute_definitions trg_audit_product_attribute_definitions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_product_attribute_definitions AFTER INSERT OR DELETE OR UPDATE ON public.product_attribute_definitions FOR EACH ROW EXECUTE FUNCTION public.audit_normalized_catalog_change();


--
-- Name: sku_attribute_values trg_audit_sku_attribute_values; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_sku_attribute_values AFTER INSERT OR DELETE OR UPDATE ON public.sku_attribute_values FOR EACH ROW EXECUTE FUNCTION public.audit_normalized_catalog_change();


--
-- Name: sku_transaction_units trg_audit_sku_transaction_units; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_sku_transaction_units AFTER INSERT OR DELETE OR UPDATE ON public.sku_transaction_units FOR EACH ROW EXECUTE FUNCTION public.audit_normalized_catalog_change();


--
-- Name: bom_headers trg_bom_headers_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bom_headers_updated BEFORE UPDATE ON public.bom_headers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: catalog_drafts trg_catalog_drafts_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_catalog_drafts_updated BEFORE UPDATE ON public.catalog_drafts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: categories trg_categories_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: customers trg_customers_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: defect_notes trg_defect_notes_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_defect_notes_updated BEFORE UPDATE ON public.defect_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: skus trg_generate_sku_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_generate_sku_code BEFORE INSERT ON public.skus FOR EACH ROW EXECUTE FUNCTION public.generate_sku_code_if_null();


--
-- Name: bom_headers trg_guard_bom_header_activation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_guard_bom_header_activation BEFORE UPDATE OF active_version_id ON public.bom_headers FOR EACH ROW EXECUTE FUNCTION public.guard_bom_header_activation();


--
-- Name: bom_versions trg_guard_bom_version_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_guard_bom_version_mutation BEFORE INSERT OR UPDATE ON public.bom_versions FOR EACH ROW EXECUTE FUNCTION public.guard_bom_version_mutation();


--
-- Name: issues trg_issues_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_issues_updated BEFORE UPDATE ON public.issues FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: liquidation_notes trg_liquidation_notes_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_liquidation_notes_updated BEFORE UPDATE ON public.liquidation_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: lot_stock_balances trg_lot_balance_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lot_balance_updated BEFORE UPDATE ON public.lot_stock_balances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: inventory_lots trg_lot_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_lot_updated BEFORE UPDATE ON public.inventory_lots FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: products trg_products_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles trg_profiles_no_escalation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_no_escalation BEFORE UPDATE ON public.profiles FOR EACH ROW WHEN (((auth.uid() = old.id) AND (NOT public.is_manager()))) EXECUTE FUNCTION public.prevent_role_escalation();


--
-- Name: profiles trg_profiles_prevent_identity_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_prevent_identity_change BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_identity_change();


--
-- Name: profiles trg_profiles_protect_system_account; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_protect_system_account BEFORE DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_system_account();


--
-- Name: profiles trg_profiles_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: receipts trg_receipts_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_receipts_updated BEFORE UPDATE ON public.receipts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: repair_orders trg_repair_orders_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_repair_orders_updated BEFORE UPDATE ON public.repair_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: requisitions trg_requisitions_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_requisitions_updated BEFORE UPDATE ON public.requisitions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: stock_reservation_allocations trg_reservation_alloc_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reservation_alloc_updated BEFORE UPDATE ON public.stock_reservation_allocations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: stock_reservations trg_reservation_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reservation_updated BEFORE UPDATE ON public.stock_reservations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: serial_items trg_serial_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_serial_updated BEFORE UPDATE ON public.serial_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sku_attribute_values trg_sku_attribute_values_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sku_attribute_values_updated BEFORE UPDATE ON public.sku_attribute_values FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sku_transaction_units trg_sku_transaction_units_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sku_transaction_units_updated BEFORE UPDATE ON public.sku_transaction_units FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: stock_locations trg_stock_locations_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_stock_locations_updated BEFORE UPDATE ON public.stock_locations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: suppliers trg_suppliers_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: bom_versions trg_sync_bom_header_active_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_bom_header_active_version AFTER INSERT OR UPDATE OF status ON public.bom_versions FOR EACH ROW EXECUTE FUNCTION public.sync_bom_header_active_version();


--
-- Name: units trg_units_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_units_updated BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: bom_headers trg_validate_bom_header_active_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER trg_validate_bom_header_active_version AFTER INSERT OR UPDATE OF active_version_id ON public.bom_headers DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_bom_header_active_version();


--
-- Name: bom_items trg_validate_bom_item_one_level; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_bom_item_one_level BEFORE INSERT OR UPDATE ON public.bom_items FOR EACH ROW EXECUTE FUNCTION public.validate_bom_item_one_level();


--
-- Name: sku_attribute_values trg_validate_sku_attribute_value; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_sku_attribute_value BEFORE INSERT OR UPDATE ON public.sku_attribute_values FOR EACH ROW EXECUTE FUNCTION public.validate_sku_attribute_value();


--
-- Name: sku_transaction_units trg_validate_sku_transaction_unit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_sku_transaction_unit BEFORE INSERT OR UPDATE ON public.sku_transaction_units FOR EACH ROW EXECUTE FUNCTION public.validate_sku_transaction_unit();


--
-- Name: skus trg_skus_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_skus_updated BEFORE UPDATE ON public.skus FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: zones trg_zones_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_zones_updated BEFORE UPDATE ON public.zones FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: ai_conversations ai_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ai_knowledge_chunks ai_knowledge_chunks_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_chunks
    ADD CONSTRAINT ai_knowledge_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.ai_knowledge_documents(id) ON DELETE CASCADE;


--
-- Name: ai_messages ai_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(id) ON DELETE CASCADE;


--
-- Name: ai_system_settings ai_system_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_system_settings
    ADD CONSTRAINT ai_system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: attribute_definitions attribute_definitions_default_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attribute_definitions
    ADD CONSTRAINT attribute_definitions_default_unit_id_fkey FOREIGN KEY (default_unit_id) REFERENCES public.units(id);


--
-- Name: attribute_option_values attribute_option_values_attribute_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attribute_option_values
    ADD CONSTRAINT attribute_option_values_attribute_definition_id_fkey FOREIGN KEY (attribute_definition_id) REFERENCES public.attribute_definitions(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id);


--
-- Name: barcode_registry barcode_registry_sku_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barcode_registry
    ADD CONSTRAINT barcode_registry_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.skus(id) ON DELETE CASCADE;


--
-- Name: barcode_registry barcode_registry_transaction_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.barcode_registry
    ADD CONSTRAINT barcode_registry_transaction_unit_id_fkey FOREIGN KEY (transaction_unit_id) REFERENCES public.sku_transaction_units(id) ON DELETE CASCADE;


--
-- Name: bom_headers bom_headers_active_version_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_headers
    ADD CONSTRAINT bom_headers_active_version_fkey FOREIGN KEY (active_version_id) REFERENCES public.bom_versions(id);


--
-- Name: bom_headers bom_headers_sku_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_headers
    ADD CONSTRAINT bom_headers_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.skus(id) ON DELETE CASCADE;


--
-- Name: bom_items bom_items_bom_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_items
    ADD CONSTRAINT bom_items_bom_version_id_fkey FOREIGN KEY (bom_version_id) REFERENCES public.bom_versions(id) ON DELETE CASCADE;


--
-- Name: bom_items bom_items_component_sku_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_items
    ADD CONSTRAINT bom_items_component_sku_id_fkey FOREIGN KEY (component_sku_id) REFERENCES public.skus(id);


--
-- Name: bom_versions bom_versions_bom_header_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_versions
    ADD CONSTRAINT bom_versions_bom_header_id_fkey FOREIGN KEY (bom_header_id) REFERENCES public.bom_headers(id) ON DELETE CASCADE;


--
-- Name: bom_versions bom_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_versions
    ADD CONSTRAINT bom_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: catalog_drafts catalog_drafts_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_drafts
    ADD CONSTRAINT catalog_drafts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id);


--
-- Name: catalog_drafts catalog_drafts_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalog_drafts
    ADD CONSTRAINT catalog_drafts_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: defect_note_items defect_note_items_defect_note_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.defect_note_items
    ADD CONSTRAINT defect_note_items_defect_note_id_fkey FOREIGN KEY (defect_note_id) REFERENCES public.defect_notes(id) ON DELETE CASCADE;


--
-- Name: defect_note_items defect_note_items_transaction_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.defect_note_items
    ADD CONSTRAINT defect_note_items_transaction_unit_id_fkey FOREIGN KEY (transaction_unit_id) REFERENCES public.sku_transaction_units(id);


--
-- Name: defect_note_items defect_note_items_sku_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.defect_note_items
    ADD CONSTRAINT defect_note_items_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.skus(id);


--
-- Name: defect_notes defect_notes_collected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.defect_notes
    ADD CONSTRAINT defect_notes_collected_by_fkey FOREIGN KEY (collected_by) REFERENCES public.profiles(id);


--
-- Name: defect_notes defect_notes_repair_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.defect_notes
    ADD CONSTRAINT defect_notes_repair_requested_by_fkey FOREIGN KEY (repair_requested_by) REFERENCES public.profiles(id);


--
-- Name: defect_notes defect_notes_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.defect_notes
    ADD CONSTRAINT defect_notes_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.profiles(id);


--
-- Name: defect_notes defect_notes_source_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.defect_notes
    ADD CONSTRAINT defect_notes_source_location_id_fkey FOREIGN KEY (source_location_id) REFERENCES public.stock_locations(id);


--
-- Name: exchange_note_items exchange_note_items_exchange_note_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_note_items
    ADD CONSTRAINT exchange_note_items_exchange_note_id_fkey FOREIGN KEY (exchange_note_id) REFERENCES public.exchange_notes(id) ON DELETE CASCADE;


--
-- Name: exchange_note_items exchange_note_items_transaction_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_note_items
    ADD CONSTRAINT exchange_note_items_transaction_unit_id_fkey FOREIGN KEY (transaction_unit_id) REFERENCES public.sku_transaction_units(id);


--
-- Name: exchange_note_items exchange_note_items_sku_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_note_items
    ADD CONSTRAINT exchange_note_items_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.skus(id);


--
-- Name: exchange_notes exchange_notes_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_notes
    ADD CONSTRAINT exchange_notes_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id);


--
-- Name: exchange_notes exchange_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_notes
    ADD CONSTRAINT exchange_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: exchange_notes exchange_notes_issued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_notes
    ADD CONSTRAINT exchange_notes_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.profiles(id);


--
-- Name: exchange_notes exchange_notes_linked_defect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_notes
    ADD CONSTRAINT exchange_notes_linked_defect_id_fkey FOREIGN KEY (linked_defect_id) REFERENCES public.defect_notes(id);


--
-- Name: exchange_notes exchange_notes_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_notes
    ADD CONSTRAINT exchange_notes_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.profiles(id);


--
-- Name: exchange_notes exchange_notes_rejected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_notes
    ADD CONSTRAINT exchange_notes_rejected_by_fkey FOREIGN KEY (rejected_by) REFERENCES public.profiles(id);


--
-- Name: fuel_dispenses fuel_dispenses_dispenser_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_dispenses
    ADD CONSTRAINT fuel_dispenses_dispenser_id_fkey FOREIGN KEY (dispenser_id) REFERENCES public.profiles(id);


--
-- Name: fuel_dispenses fuel_dispenses_fuel_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_dispenses
    ADD CONSTRAINT fuel_dispenses_fuel_type_id_fkey FOREIGN KEY (fuel_type_id) REFERENCES public.fuel_types(id) ON DELETE RESTRICT;


--
-- Name: fuel_dispenses fuel_dispenses_sub_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_dispenses
    ADD CONSTRAINT fuel_dispenses_sub_zone_id_fkey FOREIGN KEY (sub_zone_id) REFERENCES public.sub_zones(id) ON DELETE SET NULL;


--
-- Name: fuel_dispenses fuel_dispenses_vehicle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_dispenses
    ADD CONSTRAINT fuel_dispenses_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;


--
-- Name: fuel_dispenses fuel_dispenses_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_dispenses
    ADD CONSTRAINT fuel_dispenses_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE SET NULL;


--
-- Name: fuel_movements fuel_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_movements
    ADD CONSTRAINT fuel_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: fuel_movements fuel_movements_fuel_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_movements
    ADD CONSTRAINT fuel_movements_fuel_type_id_fkey FOREIGN KEY (fuel_type_id) REFERENCES public.fuel_types(id);


--
-- Name: fuel_receipts fuel_receipts_fuel_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_receipts
    ADD CONSTRAINT fuel_receipts_fuel_type_id_fkey FOREIGN KEY (fuel_type_id) REFERENCES public.fuel_types(id) ON DELETE RESTRICT;


--
-- Name: fuel_receipts fuel_receipts_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_receipts
    ADD CONSTRAINT fuel_receipts_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.profiles(id);


--
-- Name: fuel_receipts fuel_receipts_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_receipts
    ADD CONSTRAINT fuel_receipts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE RESTRICT;


--
-- Name: inventory_lots inventory_lots_sku_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_lots
    ADD CONSTRAINT inventory_lots_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.skus(id);


--
-- Name: inventory_posting_command_movements inventory_posting_command_movements_command_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_posting_command_movements
    ADD CONSTRAINT inventory_posting_command_movements_command_id_fkey FOREIGN KEY (command_id) REFERENCES public.inventory_posting_commands(id) ON DELETE CASCADE;


--
-- Name: inventory_posting_command_movements inventory_posting_command_movements_movement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_posting_command_movements
    ADD CONSTRAINT inventory_posting_command_movements_movement_id_fkey FOREIGN KEY (movement_id) REFERENCES public.stock_movements(id);


--
-- Name: inventory_posting_commands inventory_posting_commands_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_posting_commands
    ADD CONSTRAINT inventory_posting_commands_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id);


--
-- Name: inventory_posting_commands inventory_posting_commands_first_movement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_posting_commands
    ADD CONSTRAINT inventory_posting_commands_first_movement_id_fkey FOREIGN KEY (first_movement_id) REFERENCES public.stock_movements(id);


--
-- Name: issue_items issue_items_issue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_items
    ADD CONSTRAINT issue_items_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES public.issues(id) ON DELETE CASCADE;


--
-- Name: issue_items issue_items_transaction_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_items
    ADD CONSTRAINT issue_items_transaction_unit_id_fkey FOREIGN KEY (transaction_unit_id) REFERENCES public.sku_transaction_units(id);


--
-- Name: issue_items issue_items_sku_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_items
    ADD CONSTRAINT issue_items_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.skus(id);


--
-- Name: issues issues_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issues
    ADD CONSTRAINT issues_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profiles(id);


--
-- Name: issues issues_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issues
    ADD CONSTRAINT issues_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: issues issues_sub_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issues
    ADD CONSTRAINT issues_sub_zone_id_fkey FOREIGN KEY (sub_zone_id) REFERENCES public.sub_zones(id) ON DELETE SET NULL;


--
-- Name: issues issues_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issues
    ADD CONSTRAINT issues_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id);


--
-- Name: liquidation_items liquidation_items_liquidation_note_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquidation_items
    ADD CONSTRAINT liquidation_items_liquidation_note_id_fkey FOREIGN KEY (liquidation_note_id) REFERENCES public.liquidation_notes(id) ON DELETE CASCADE;


--
-- Name: liquidation_items liquidation_items_transaction_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquidation_items
    ADD CONSTRAINT liquidation_items_transaction_unit_id_fkey FOREIGN KEY (transaction_unit_id) REFERENCES public.sku_transaction_units(id);


--
-- Name: liquidation_items liquidation_items_sku_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquidation_items
    ADD CONSTRAINT liquidation_items_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.skus(id);


--
-- Name: liquidation_notes liquidation_notes_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquidation_notes
    ADD CONSTRAINT liquidation_notes_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id);


--
-- Name: liquidation_notes liquidation_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquidation_notes
    ADD CONSTRAINT liquidation_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: lot_stock_balances lot_stock_balances_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lot_stock_balances
    ADD CONSTRAINT lot_stock_balances_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.stock_locations(id) ON DELETE CASCADE;


--
-- Name: lot_stock_balances lot_stock_balances_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lot_stock_balances
    ADD CONSTRAINT lot_stock_balances_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.inventory_lots(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: product_attribute_definitions product_attribute_definitions_attribute_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_attribute_definitions
    ADD CONSTRAINT product_attribute_definitions_attribute_definition_id_fkey FOREIGN KEY (attribute_definition_id) REFERENCES public.attribute_definitions(id);


--
-- Name: product_attribute_definitions product_attribute_definitions_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_attribute_definitions
    ADD CONSTRAINT product_attribute_definitions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_sub_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_sub_zone_id_fkey FOREIGN KEY (sub_zone_id) REFERENCES public.sub_zones(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE SET NULL;


--
-- Name: receipt_items receipt_items_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_items
    ADD CONSTRAINT receipt_items_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.receipts(id) ON DELETE CASCADE;


--
-- Name: receipt_items receipt_items_transaction_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_items
    ADD CONSTRAINT receipt_items_transaction_unit_id_fkey FOREIGN KEY (transaction_unit_id) REFERENCES public.sku_transaction_units(id);


--
-- Name: receipt_items receipt_items_sku_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipt_items
    ADD CONSTRAINT receipt_items_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.skus(id);


--
-- Name: receipts receipts_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: receipts receipts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: receipts receipts_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: repair_order_items repair_order_items_defect_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_order_items
    ADD CONSTRAINT repair_order_items_defect_item_id_fkey FOREIGN KEY (defect_item_id) REFERENCES public.defect_note_items(id);


--
-- Name: repair_order_items repair_order_items_repair_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_order_items
    ADD CONSTRAINT repair_order_items_repair_order_id_fkey FOREIGN KEY (repair_order_id) REFERENCES public.repair_orders(id) ON DELETE CASCADE;


--
-- Name: repair_order_items repair_order_items_transaction_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_order_items
    ADD CONSTRAINT repair_order_items_transaction_unit_id_fkey FOREIGN KEY (transaction_unit_id) REFERENCES public.sku_transaction_units(id);


--
-- Name: repair_order_items repair_order_items_sku_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_order_items
    ADD CONSTRAINT repair_order_items_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.skus(id);


--
-- Name: repair_orders repair_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_orders
    ADD CONSTRAINT repair_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: requisition_items requisition_items_requisition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requisition_items
    ADD CONSTRAINT requisition_items_requisition_id_fkey FOREIGN KEY (requisition_id) REFERENCES public.requisitions(id) ON DELETE CASCADE;


--
-- Name: requisition_items requisition_items_transaction_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requisition_items
    ADD CONSTRAINT requisition_items_transaction_unit_id_fkey FOREIGN KEY (transaction_unit_id) REFERENCES public.sku_transaction_units(id);


--
-- Name: requisition_items requisition_items_sku_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requisition_items
    ADD CONSTRAINT requisition_items_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.skus(id);


--
-- Name: requisition_return_items requisition_return_items_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requisition_return_items
    ADD CONSTRAINT requisition_return_items_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.requisition_returns(id) ON DELETE CASCADE;


--
-- Name: requisition_return_items requisition_return_items_transaction_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requisition_return_items
    ADD CONSTRAINT requisition_return_items_transaction_unit_id_fkey FOREIGN KEY (transaction_unit_id) REFERENCES public.sku_transaction_units(id);


--
-- Name: requisition_return_items requisition_return_items_sku_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requisition_return_items
    ADD CONSTRAINT requisition_return_items_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.skus(id);


--
-- Name: requisition_returns requisition_returns_requisition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requisition_returns
    ADD CONSTRAINT requisition_returns_requisition_id_fkey FOREIGN KEY (requisition_id) REFERENCES public.requisitions(id) ON DELETE CASCADE;


--
-- Name: requisition_returns requisition_returns_returned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requisition_returns
    ADD CONSTRAINT requisition_returns_returned_by_fkey FOREIGN KEY (returned_by) REFERENCES public.profiles(id);


--
-- Name: requisitions requisitions_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requisitions
    ADD CONSTRAINT requisitions_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id);


--
-- Name: requisitions requisitions_fulfilled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requisitions
    ADD CONSTRAINT requisitions_fulfilled_by_fkey FOREIGN KEY (fulfilled_by) REFERENCES public.profiles(id);


--
-- Name: requisitions requisitions_linked_defect_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requisitions
    ADD CONSTRAINT requisitions_linked_defect_id_fkey FOREIGN KEY (linked_defect_id) REFERENCES public.defect_notes(id);


--
-- Name: requisitions requisitions_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requisitions
    ADD CONSTRAINT requisitions_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.profiles(id);


--
-- Name: requisitions requisitions_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requisitions
    ADD CONSTRAINT requisitions_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.profiles(id);


--
-- Name: requisitions requisitions_sub_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requisitions
    ADD CONSTRAINT requisitions_sub_zone_id_fkey FOREIGN KEY (sub_zone_id) REFERENCES public.sub_zones(id) ON DELETE SET NULL;


--
-- Name: requisitions requisitions_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requisitions
    ADD CONSTRAINT requisitions_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE SET NULL;


--
-- Name: serial_items serial_items_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.serial_items
    ADD CONSTRAINT serial_items_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.stock_locations(id);


--
-- Name: serial_items serial_items_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.serial_items
    ADD CONSTRAINT serial_items_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.inventory_lots(id);


--
-- Name: serial_items serial_items_sku_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.serial_items
    ADD CONSTRAINT serial_items_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.skus(id);


--
-- Name: sku_attribute_values sku_attribute_values_attribute_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_attribute_values
    ADD CONSTRAINT sku_attribute_values_attribute_definition_id_fkey FOREIGN KEY (attribute_definition_id) REFERENCES public.attribute_definitions(id);


--
-- Name: sku_attribute_values sku_attribute_values_option_value_id_attribute_definition__fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_attribute_values
    ADD CONSTRAINT sku_attribute_values_option_value_id_attribute_definition__fkey FOREIGN KEY (option_value_id, attribute_definition_id) REFERENCES public.attribute_option_values(id, attribute_definition_id);


--
-- Name: sku_attribute_values sku_attribute_values_option_value_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_attribute_values
    ADD CONSTRAINT sku_attribute_values_option_value_id_fkey FOREIGN KEY (option_value_id) REFERENCES public.attribute_option_values(id);


--
-- Name: sku_attribute_values sku_attribute_values_sku_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_attribute_values
    ADD CONSTRAINT sku_attribute_values_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.skus(id) ON DELETE CASCADE;


--
-- Name: sku_attribute_values sku_attribute_values_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_attribute_values
    ADD CONSTRAINT sku_attribute_values_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: sku_prices sku_prices_sku_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_prices
    ADD CONSTRAINT sku_prices_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.skus(id) ON DELETE CASCADE;


--
-- Name: sku_prices sku_prices_transaction_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_prices
    ADD CONSTRAINT sku_prices_transaction_unit_id_fkey FOREIGN KEY (transaction_unit_id) REFERENCES public.sku_transaction_units(id);


--
-- Name: sku_transaction_units sku_transaction_units_legacy_parent_sku_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_transaction_units
    ADD CONSTRAINT sku_transaction_units_legacy_parent_sku_id_fkey FOREIGN KEY (legacy_parent_sku_id) REFERENCES public.skus(id) ON DELETE SET NULL;


--
-- Name: sku_transaction_units sku_transaction_units_sku_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_transaction_units
    ADD CONSTRAINT sku_transaction_units_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.skus(id) ON DELETE CASCADE;


--
-- Name: sku_transaction_units sku_transaction_units_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sku_transaction_units
    ADD CONSTRAINT sku_transaction_units_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: stock_balances stock_balances_base_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_balances
    ADD CONSTRAINT stock_balances_base_unit_id_fkey FOREIGN KEY (base_unit_id) REFERENCES public.units(id);


--
-- Name: stock_balances stock_balances_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_balances
    ADD CONSTRAINT stock_balances_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.stock_locations(id) ON DELETE CASCADE;


--
-- Name: stock_balances stock_balances_sku_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_balances
    ADD CONSTRAINT stock_balances_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.skus(id) ON DELETE CASCADE;


--
-- Name: stock_movement_allocations stock_movement_allocations_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movement_allocations
    ADD CONSTRAINT stock_movement_allocations_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.inventory_lots(id);


--
-- Name: stock_movement_allocations stock_movement_allocations_movement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movement_allocations
    ADD CONSTRAINT stock_movement_allocations_movement_id_fkey FOREIGN KEY (movement_id) REFERENCES public.stock_movements(id);


--
-- Name: stock_movement_allocations stock_movement_allocations_serial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movement_allocations
    ADD CONSTRAINT stock_movement_allocations_serial_id_fkey FOREIGN KEY (serial_id) REFERENCES public.serial_items(id);


--
-- Name: stock_movements stock_movements_base_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_base_unit_id_fkey FOREIGN KEY (base_unit_id) REFERENCES public.units(id);


--
-- Name: stock_movements stock_movements_bom_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_bom_version_id_fkey FOREIGN KEY (bom_version_id) REFERENCES public.bom_versions(id);


--
-- Name: stock_movements stock_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: stock_movements stock_movements_from_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_from_location_id_fkey FOREIGN KEY (from_location_id) REFERENCES public.stock_locations(id);


--
-- Name: stock_movements stock_movements_reversal_of_movement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_reversal_of_movement_id_fkey FOREIGN KEY (reversal_of_movement_id) REFERENCES public.stock_movements(id);


--
-- Name: stock_movements stock_movements_to_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_to_location_id_fkey FOREIGN KEY (to_location_id) REFERENCES public.stock_locations(id);


--
-- Name: stock_movements stock_movements_transaction_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_transaction_unit_id_fkey FOREIGN KEY (transaction_unit_id) REFERENCES public.sku_transaction_units(id);


--
-- Name: stock_movements stock_movements_sku_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.skus(id);


--
-- Name: stock_reservation_allocations stock_reservation_allocations_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservation_allocations
    ADD CONSTRAINT stock_reservation_allocations_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.inventory_lots(id);


--
-- Name: stock_reservation_allocations stock_reservation_allocations_reservation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservation_allocations
    ADD CONSTRAINT stock_reservation_allocations_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.stock_reservations(id) ON DELETE CASCADE;


--
-- Name: stock_reservation_allocations stock_reservation_allocations_serial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservation_allocations
    ADD CONSTRAINT stock_reservation_allocations_serial_id_fkey FOREIGN KEY (serial_id) REFERENCES public.serial_items(id);


--
-- Name: stock_reservations stock_reservations_base_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_base_unit_id_fkey FOREIGN KEY (base_unit_id) REFERENCES public.units(id);


--
-- Name: stock_reservations stock_reservations_bom_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_bom_version_id_fkey FOREIGN KEY (bom_version_id) REFERENCES public.bom_versions(id);


--
-- Name: stock_reservations stock_reservations_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.stock_locations(id);


--
-- Name: stock_reservations stock_reservations_sku_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.skus(id);


--
-- Name: stocktake_items stocktake_items_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stocktake_items
    ADD CONSTRAINT stocktake_items_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.stocktake_sessions(id) ON DELETE CASCADE;


--
-- Name: stocktake_items stocktake_items_transaction_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stocktake_items
    ADD CONSTRAINT stocktake_items_transaction_unit_id_fkey FOREIGN KEY (transaction_unit_id) REFERENCES public.sku_transaction_units(id);


--
-- Name: stocktake_items stocktake_items_sku_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stocktake_items
    ADD CONSTRAINT stocktake_items_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.skus(id);


--
-- Name: stocktake_sessions stocktake_sessions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stocktake_sessions
    ADD CONSTRAINT stocktake_sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: stocktake_sessions stocktake_sessions_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stocktake_sessions
    ADD CONSTRAINT stocktake_sessions_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.stock_locations(id);


--
-- Name: sub_zones sub_zones_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_zones
    ADD CONSTRAINT sub_zones_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE CASCADE;


--
-- Name: tool_borrowing_items tool_borrowing_items_borrowing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_borrowing_items
    ADD CONSTRAINT tool_borrowing_items_borrowing_id_fkey FOREIGN KEY (borrowing_id) REFERENCES public.tool_borrowings(id) ON DELETE CASCADE;


--
-- Name: tool_borrowing_items tool_borrowing_items_transaction_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_borrowing_items
    ADD CONSTRAINT tool_borrowing_items_transaction_unit_id_fkey FOREIGN KEY (transaction_unit_id) REFERENCES public.sku_transaction_units(id);


--
-- Name: tool_borrowing_items tool_borrowing_items_sku_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_borrowing_items
    ADD CONSTRAINT tool_borrowing_items_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.skus(id);


--
-- Name: tool_borrowings tool_borrowings_borrower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_borrowings
    ADD CONSTRAINT tool_borrowings_borrower_id_fkey FOREIGN KEY (borrower_id) REFERENCES public.profiles(id);


--
-- Name: tool_borrowings tool_borrowings_issued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_borrowings
    ADD CONSTRAINT tool_borrowings_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.profiles(id);


--
-- Name: tool_borrowings tool_borrowings_received_back_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_borrowings
    ADD CONSTRAINT tool_borrowings_received_back_by_fkey FOREIGN KEY (received_back_by) REFERENCES public.profiles(id);


--
-- Name: tool_borrowings tool_borrowings_sub_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_borrowings
    ADD CONSTRAINT tool_borrowings_sub_zone_id_fkey FOREIGN KEY (sub_zone_id) REFERENCES public.sub_zones(id) ON DELETE SET NULL;


--
-- Name: tool_borrowings tool_borrowings_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tool_borrowings
    ADD CONSTRAINT tool_borrowings_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id);


--
-- Name: skus skus_base_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skus
    ADD CONSTRAINT skus_base_unit_id_fkey FOREIGN KEY (base_unit_id) REFERENCES public.units(id);


--
-- Name: skus skus_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skus
    ADD CONSTRAINT skus_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: vehicles vehicles_fuel_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_fuel_type_id_fkey FOREIGN KEY (fuel_type_id) REFERENCES public.fuel_types(id) ON DELETE RESTRICT;


--
-- Name: vehicles vehicles_sub_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_sub_zone_id_fkey FOREIGN KEY (sub_zone_id) REFERENCES public.sub_zones(id) ON DELETE SET NULL;


--
-- Name: vehicles vehicles_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE SET NULL;


--
-- Name: ai_quick_prompts Authenticated users can read active quick prompts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read active quick prompts" ON public.ai_quick_prompts FOR SELECT TO authenticated USING (true);


--
-- Name: ai_knowledge_chunks Authenticated users can read ai knowledge chunks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read ai knowledge chunks" ON public.ai_knowledge_chunks FOR SELECT TO authenticated USING (true);


--
-- Name: ai_knowledge_documents Authenticated users can read ai knowledge documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read ai knowledge documents" ON public.ai_knowledge_documents FOR SELECT TO authenticated USING (true);


--
-- Name: ai_system_settings Authenticated users can read ai settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read ai settings" ON public.ai_system_settings FOR SELECT TO authenticated USING (true);


--
-- Name: ai_conversations Managers can view all conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers can view all conversations" ON public.ai_conversations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['owner'::text, 'warehouse'::text, 'accountant'::text, 'superuser'::text]))))));


--
-- Name: ai_messages Managers can view all messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Managers can view all messages" ON public.ai_messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['owner'::text, 'warehouse'::text, 'accountant'::text, 'superuser'::text]))))));


--
-- Name: ai_conversations Users can manage their own ai conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own ai conversations" ON public.ai_conversations TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: ai_messages Users can manage their own ai messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own ai messages" ON public.ai_messages TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.ai_conversations c
  WHERE ((c.id = ai_messages.conversation_id) AND (c.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.ai_conversations c
  WHERE ((c.id = ai_messages.conversation_id) AND (c.user_id = auth.uid())))));


--
-- Name: ai_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_knowledge_chunks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_knowledge_chunks ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_knowledge_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_knowledge_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_quick_prompts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_quick_prompts ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_system_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_system_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: attribute_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attribute_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: attribute_definitions attribute_definitions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attribute_definitions_select ON public.attribute_definitions FOR SELECT TO authenticated USING (true);


--
-- Name: attribute_definitions attribute_definitions_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attribute_definitions_write ON public.attribute_definitions TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: attribute_option_values; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attribute_option_values ENABLE ROW LEVEL SECURITY;

--
-- Name: attribute_option_values attribute_option_values_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attribute_option_values_select ON public.attribute_option_values FOR SELECT TO authenticated USING (true);


--
-- Name: attribute_option_values attribute_option_values_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attribute_option_values_write ON public.attribute_option_values TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_logs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT TO authenticated USING (public.is_manager());


--
-- Name: barcode_registry; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.barcode_registry ENABLE ROW LEVEL SECURITY;

--
-- Name: barcode_registry barcode_registry_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY barcode_registry_select ON public.barcode_registry FOR SELECT TO authenticated USING (true);


--
-- Name: barcode_registry barcode_registry_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY barcode_registry_write ON public.barcode_registry TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: bom_headers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bom_headers ENABLE ROW LEVEL SECURITY;

--
-- Name: bom_headers bom_headers_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bom_headers_delete ON public.bom_headers FOR DELETE TO authenticated USING ((public.is_warehouse() AND (active_version_id IS NULL)));


--
-- Name: bom_headers bom_headers_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bom_headers_insert ON public.bom_headers FOR INSERT TO authenticated WITH CHECK (public.is_technician());


--
-- Name: bom_headers bom_headers_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bom_headers_select ON public.bom_headers FOR SELECT TO authenticated USING (true);


--
-- Name: bom_headers bom_headers_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bom_headers_update ON public.bom_headers FOR UPDATE TO authenticated USING (public.is_technician()) WITH CHECK (public.is_technician());


--
-- Name: bom_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bom_items ENABLE ROW LEVEL SECURITY;

--
-- Name: bom_items bom_items_delete_draft; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bom_items_delete_draft ON public.bom_items FOR DELETE TO authenticated USING ((public.is_technician() AND (EXISTS ( SELECT 1
   FROM public.bom_versions v
  WHERE ((v.id = bom_items.bom_version_id) AND (v.status = 'draft'::text))))));


--
-- Name: bom_items bom_items_insert_draft; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bom_items_insert_draft ON public.bom_items FOR INSERT TO authenticated WITH CHECK ((public.is_technician() AND (EXISTS ( SELECT 1
   FROM public.bom_versions v
  WHERE ((v.id = bom_items.bom_version_id) AND (v.status = 'draft'::text))))));


--
-- Name: bom_items bom_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bom_items_select ON public.bom_items FOR SELECT TO authenticated USING (true);


--
-- Name: bom_items bom_items_update_draft; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bom_items_update_draft ON public.bom_items FOR UPDATE TO authenticated USING ((public.is_technician() AND (EXISTS ( SELECT 1
   FROM public.bom_versions v
  WHERE ((v.id = bom_items.bom_version_id) AND (v.status = 'draft'::text)))))) WITH CHECK ((public.is_technician() AND (EXISTS ( SELECT 1
   FROM public.bom_versions v
  WHERE ((v.id = bom_items.bom_version_id) AND (v.status = 'draft'::text))))));


--
-- Name: bom_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bom_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: bom_versions bom_versions_delete_draft; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bom_versions_delete_draft ON public.bom_versions FOR DELETE TO authenticated USING ((public.is_warehouse() AND (status = 'draft'::text)));


--
-- Name: bom_versions bom_versions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bom_versions_insert ON public.bom_versions FOR INSERT TO authenticated WITH CHECK ((public.is_technician() AND (status = 'draft'::text)));


--
-- Name: bom_versions bom_versions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bom_versions_select ON public.bom_versions FOR SELECT TO authenticated USING (true);


--
-- Name: bom_versions bom_versions_update_draft; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bom_versions_update_draft ON public.bom_versions FOR UPDATE TO authenticated USING (((public.is_technician() AND (status = 'draft'::text)) OR public.is_warehouse())) WITH CHECK (((public.is_technician() AND (status = 'draft'::text)) OR public.is_warehouse()));


--
-- Name: catalog_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.catalog_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: catalog_drafts catalog_drafts_manager; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalog_drafts_manager ON public.catalog_drafts TO authenticated USING (public.is_manager()) WITH CHECK ((public.is_manager() AND (owner_id = auth.uid())));


--
-- Name: catalog_migration_issues; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.catalog_migration_issues ENABLE ROW LEVEL SECURITY;

--
-- Name: catalog_migration_issues catalog_migration_issues_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalog_migration_issues_select ON public.catalog_migration_issues FOR SELECT TO authenticated USING (public.is_owner());


--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: categories categories_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_delete ON public.categories FOR DELETE TO authenticated USING (public.is_manager());


--
-- Name: categories categories_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_insert ON public.categories FOR INSERT TO authenticated WITH CHECK (public.is_manager());


--
-- Name: categories categories_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_select ON public.categories FOR SELECT TO authenticated USING (true);


--
-- Name: categories categories_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_update ON public.categories FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: customers customers_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_delete ON public.customers FOR DELETE TO authenticated USING (public.is_manager());


--
-- Name: customers customers_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_insert ON public.customers FOR INSERT TO authenticated WITH CHECK (public.is_manager());


--
-- Name: customers customers_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_select ON public.customers FOR SELECT TO authenticated USING (true);


--
-- Name: customers customers_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_update ON public.customers FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: defect_note_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.defect_note_items ENABLE ROW LEVEL SECURITY;

--
-- Name: defect_note_items defect_note_items_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY defect_note_items_delete ON public.defect_note_items FOR DELETE TO authenticated USING (public.is_manager());


--
-- Name: defect_note_items defect_note_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY defect_note_items_insert ON public.defect_note_items FOR INSERT TO authenticated WITH CHECK ((public.is_manager() OR (EXISTS ( SELECT 1
   FROM public.defect_notes d
  WHERE ((d.id = defect_note_items.defect_note_id) AND (d.reported_by = auth.uid()))))));


--
-- Name: defect_note_items defect_note_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY defect_note_items_select ON public.defect_note_items FOR SELECT TO authenticated USING ((public.is_manager() OR (EXISTS ( SELECT 1
   FROM public.defect_notes d
  WHERE ((d.id = defect_note_items.defect_note_id) AND (d.reported_by = auth.uid()))))));


--
-- Name: defect_note_items defect_note_items_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY defect_note_items_update ON public.defect_note_items FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: defect_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.defect_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: defect_notes defect_notes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY defect_notes_delete ON public.defect_notes FOR DELETE TO authenticated USING (public.is_manager());


--
-- Name: defect_notes defect_notes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY defect_notes_insert ON public.defect_notes FOR INSERT TO authenticated WITH CHECK (((auth.uid() = reported_by) OR public.is_manager()));


--
-- Name: defect_notes defect_notes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY defect_notes_select ON public.defect_notes FOR SELECT TO authenticated USING (((auth.uid() = reported_by) OR public.is_manager()));


--
-- Name: defect_notes defect_notes_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY defect_notes_update ON public.defect_notes FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: exchange_note_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exchange_note_items ENABLE ROW LEVEL SECURITY;

--
-- Name: exchange_note_items exchange_note_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exchange_note_items_select ON public.exchange_note_items FOR SELECT TO authenticated USING ((public.is_manager() OR (EXISTS ( SELECT 1
   FROM (public.exchange_notes en
     JOIN public.defect_notes d ON ((d.id = en.linked_defect_id)))
  WHERE ((en.id = exchange_note_items.exchange_note_id) AND (d.reported_by = auth.uid()))))));


--
-- Name: exchange_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exchange_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: exchange_notes exchange_notes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exchange_notes_select ON public.exchange_notes FOR SELECT TO authenticated USING ((public.is_manager() OR (EXISTS ( SELECT 1
   FROM public.defect_notes d
  WHERE ((d.id = exchange_notes.linked_defect_id) AND (d.reported_by = auth.uid()))))));


--
-- Name: fuel_dispenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fuel_dispenses ENABLE ROW LEVEL SECURITY;

--
-- Name: fuel_dispenses fuel_dispenses_all_mgr; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fuel_dispenses_all_mgr ON public.fuel_dispenses TO authenticated USING (public.is_manager());


--
-- Name: fuel_dispenses fuel_dispenses_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fuel_dispenses_select ON public.fuel_dispenses FOR SELECT TO authenticated USING (true);


--
-- Name: fuel_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fuel_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: fuel_movements fuel_movements_all_mgr; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fuel_movements_all_mgr ON public.fuel_movements TO authenticated USING (public.is_manager());


--
-- Name: fuel_movements fuel_movements_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fuel_movements_select ON public.fuel_movements FOR SELECT TO authenticated USING (true);


--
-- Name: fuel_receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fuel_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: fuel_receipts fuel_receipts_all_mgr; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fuel_receipts_all_mgr ON public.fuel_receipts TO authenticated USING (public.is_manager());


--
-- Name: fuel_receipts fuel_receipts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fuel_receipts_select ON public.fuel_receipts FOR SELECT TO authenticated USING (true);


--
-- Name: fuel_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fuel_types ENABLE ROW LEVEL SECURITY;

--
-- Name: fuel_types fuel_types_all_mgr; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fuel_types_all_mgr ON public.fuel_types TO authenticated USING (public.is_manager());


--
-- Name: fuel_types fuel_types_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fuel_types_select ON public.fuel_types FOR SELECT TO authenticated USING (true);


--
-- Name: inventory_lots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_lots ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_posting_command_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_posting_command_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_posting_commands; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_posting_commands ENABLE ROW LEVEL SECURITY;

--
-- Name: issue_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.issue_items ENABLE ROW LEVEL SECURITY;

--
-- Name: issue_items issue_items_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY issue_items_delete ON public.issue_items FOR DELETE TO authenticated USING (public.is_manager());


--
-- Name: issue_items issue_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY issue_items_insert ON public.issue_items FOR INSERT TO authenticated WITH CHECK (public.is_manager());


--
-- Name: issue_items issue_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY issue_items_select ON public.issue_items FOR SELECT TO authenticated USING (public.is_manager());


--
-- Name: issue_items issue_items_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY issue_items_update ON public.issue_items FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: issues; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

--
-- Name: issues issues_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY issues_delete ON public.issues FOR DELETE TO authenticated USING (public.is_manager());


--
-- Name: issues issues_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY issues_insert ON public.issues FOR INSERT TO authenticated WITH CHECK (public.is_manager());


--
-- Name: issues issues_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY issues_select ON public.issues FOR SELECT TO authenticated USING (public.is_manager());


--
-- Name: issues issues_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY issues_update ON public.issues FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: liquidation_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.liquidation_items ENABLE ROW LEVEL SECURITY;

--
-- Name: liquidation_items liquidation_items_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY liquidation_items_delete ON public.liquidation_items FOR DELETE TO authenticated USING (public.is_manager());


--
-- Name: liquidation_items liquidation_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY liquidation_items_insert ON public.liquidation_items FOR INSERT TO authenticated WITH CHECK (public.is_manager());


--
-- Name: liquidation_items liquidation_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY liquidation_items_select ON public.liquidation_items FOR SELECT TO authenticated USING (public.is_manager());


--
-- Name: liquidation_items liquidation_items_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY liquidation_items_update ON public.liquidation_items FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: liquidation_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.liquidation_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: liquidation_notes liquidation_notes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY liquidation_notes_delete ON public.liquidation_notes FOR DELETE TO authenticated USING (public.is_manager());


--
-- Name: liquidation_notes liquidation_notes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY liquidation_notes_insert ON public.liquidation_notes FOR INSERT TO authenticated WITH CHECK (public.is_manager());


--
-- Name: liquidation_notes liquidation_notes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY liquidation_notes_select ON public.liquidation_notes FOR SELECT TO authenticated USING (public.is_manager());


--
-- Name: liquidation_notes liquidation_notes_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY liquidation_notes_update ON public.liquidation_notes FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: lot_stock_balances lot_balance_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lot_balance_select ON public.lot_stock_balances FOR SELECT TO authenticated USING (true);


--
-- Name: lot_stock_balances lot_balance_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lot_balance_write ON public.lot_stock_balances TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: inventory_lots lot_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lot_select ON public.inventory_lots FOR SELECT TO authenticated USING (true);


--
-- Name: lot_stock_balances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lot_stock_balances ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_lots lot_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lot_write ON public.inventory_lots TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: stock_movement_allocations movement_alloc_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY movement_alloc_select ON public.stock_movement_allocations FOR SELECT TO authenticated USING (true);


--
-- Name: stock_movement_allocations movement_alloc_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY movement_alloc_write ON public.stock_movement_allocations TO authenticated USING (public.is_warehouse()) WITH CHECK (public.is_warehouse());


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_select_own ON public.notifications FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: notifications notifications_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: inventory_posting_command_movements posting_command_movements_service_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY posting_command_movements_service_read ON public.inventory_posting_command_movements FOR SELECT TO service_role USING (true);


--
-- Name: inventory_posting_commands posting_commands_service_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY posting_commands_service_read ON public.inventory_posting_commands FOR SELECT TO service_role USING (true);


--
-- Name: product_attribute_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_attribute_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: product_attribute_definitions product_attribute_definitions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_attribute_definitions_select ON public.product_attribute_definitions FOR SELECT TO authenticated USING (true);


--
-- Name: product_attribute_definitions product_attribute_definitions_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_attribute_definitions_write ON public.product_attribute_definitions TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: products products_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_delete ON public.products FOR DELETE TO authenticated USING (public.is_manager());


--
-- Name: products products_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_insert ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_manager());


--
-- Name: products products_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_select ON public.products FOR SELECT TO authenticated USING (true);


--
-- Name: products products_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_update ON public.products FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: profiles profiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: receipt_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;

--
-- Name: receipt_items receipt_items_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY receipt_items_delete ON public.receipt_items FOR DELETE TO authenticated USING (public.is_manager());


--
-- Name: receipt_items receipt_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY receipt_items_insert ON public.receipt_items FOR INSERT TO authenticated WITH CHECK (public.is_manager());


--
-- Name: receipt_items receipt_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY receipt_items_select ON public.receipt_items FOR SELECT TO authenticated USING (public.is_manager());


--
-- Name: receipt_items receipt_items_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY receipt_items_update ON public.receipt_items FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: receipts receipts_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY receipts_delete ON public.receipts FOR DELETE TO authenticated USING (public.is_manager());


--
-- Name: receipts receipts_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY receipts_insert ON public.receipts FOR INSERT TO authenticated WITH CHECK (public.is_manager());


--
-- Name: receipts receipts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY receipts_select ON public.receipts FOR SELECT TO authenticated USING (public.is_manager());


--
-- Name: receipts receipts_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY receipts_update ON public.receipts FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: repair_order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.repair_order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: repair_order_items repair_order_items_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY repair_order_items_delete ON public.repair_order_items FOR DELETE TO authenticated USING (public.is_manager());


--
-- Name: repair_order_items repair_order_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY repair_order_items_insert ON public.repair_order_items FOR INSERT TO authenticated WITH CHECK (public.is_manager());


--
-- Name: repair_order_items repair_order_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY repair_order_items_select ON public.repair_order_items FOR SELECT TO authenticated USING (public.is_manager());


--
-- Name: repair_order_items repair_order_items_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY repair_order_items_update ON public.repair_order_items FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: repair_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.repair_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: repair_orders repair_orders_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY repair_orders_delete ON public.repair_orders FOR DELETE TO authenticated USING (public.is_manager());


--
-- Name: repair_orders repair_orders_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY repair_orders_insert ON public.repair_orders FOR INSERT TO authenticated WITH CHECK (public.is_manager());


--
-- Name: repair_orders repair_orders_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY repair_orders_select ON public.repair_orders FOR SELECT TO authenticated USING (public.is_manager());


--
-- Name: repair_orders repair_orders_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY repair_orders_update ON public.repair_orders FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: requisition_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.requisition_items ENABLE ROW LEVEL SECURITY;

--
-- Name: requisition_items requisition_items_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY requisition_items_delete ON public.requisition_items FOR DELETE TO authenticated USING (public.is_manager());


--
-- Name: requisition_items requisition_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY requisition_items_insert ON public.requisition_items FOR INSERT TO authenticated WITH CHECK ((public.is_manager() OR (EXISTS ( SELECT 1
   FROM public.requisitions r
  WHERE ((r.id = requisition_items.requisition_id) AND (r.requester_id = auth.uid()))))));


--
-- Name: requisition_items requisition_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY requisition_items_select ON public.requisition_items FOR SELECT TO authenticated USING ((public.is_manager() OR (EXISTS ( SELECT 1
   FROM public.requisitions r
  WHERE ((r.id = requisition_items.requisition_id) AND (r.requester_id = auth.uid()))))));


--
-- Name: requisition_items requisition_items_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY requisition_items_update ON public.requisition_items FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: requisition_return_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.requisition_return_items ENABLE ROW LEVEL SECURITY;

--
-- Name: requisition_return_items requisition_return_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY requisition_return_items_select ON public.requisition_return_items FOR SELECT TO authenticated USING ((public.is_manager() OR (EXISTS ( SELECT 1
   FROM (public.requisition_returns rr
     JOIN public.requisitions r ON ((r.id = rr.requisition_id)))
  WHERE ((rr.id = requisition_return_items.return_id) AND (r.requester_id = auth.uid()))))));


--
-- Name: requisition_returns; Type: ROW SECURITY; Schema: public; Owner: -
--


ALTER TABLE public.requisition_returns ENABLE ROW LEVEL SECURITY;

--
-- Name: requisition_returns requisition_returns_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY requisition_returns_select ON public.requisition_returns FOR SELECT TO authenticated USING ((public.is_manager() OR (EXISTS ( SELECT 1
   FROM public.requisitions r
  WHERE ((r.id = requisition_returns.requisition_id) AND (r.requester_id = auth.uid()))))));


--
-- Name: requisitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.requisitions ENABLE ROW LEVEL SECURITY;

--
-- Name: requisitions requisitions_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY requisitions_delete ON public.requisitions FOR DELETE TO authenticated USING (((auth.uid() = requester_id) AND (status = 'draft'::public.requisition_status)));


--
-- Name: requisitions requisitions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY requisitions_insert ON public.requisitions FOR INSERT TO authenticated WITH CHECK ((auth.uid() = requester_id));


--
-- Name: requisitions requisitions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY requisitions_select ON public.requisitions FOR SELECT TO authenticated USING (((auth.uid() = requester_id) OR public.is_manager()));


--
-- Name: requisitions requisitions_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY requisitions_update ON public.requisitions FOR UPDATE TO authenticated USING ((public.is_manager() OR ((auth.uid() = requester_id) AND (status = ANY (ARRAY['draft'::public.requisition_status, 'pending'::public.requisition_status]))))) WITH CHECK ((public.is_manager() OR ((auth.uid() = requester_id) AND (status = ANY (ARRAY['draft'::public.requisition_status, 'pending'::public.requisition_status])))));


--
-- Name: stock_reservation_allocations reservation_alloc_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reservation_alloc_select ON public.stock_reservation_allocations FOR SELECT TO authenticated USING (true);


--
-- Name: stock_reservation_allocations reservation_alloc_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reservation_alloc_write ON public.stock_reservation_allocations TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: stock_reservations reservation_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reservation_select ON public.stock_reservations FOR SELECT TO authenticated USING (true);


--
-- Name: stock_reservations reservation_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reservation_write ON public.stock_reservations TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: serial_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.serial_items ENABLE ROW LEVEL SECURITY;

--
-- Name: serial_items serial_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY serial_select ON public.serial_items FOR SELECT TO authenticated USING (true);


--
-- Name: serial_items serial_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY serial_write ON public.serial_items TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: sku_attribute_values; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sku_attribute_values ENABLE ROW LEVEL SECURITY;

--
-- Name: sku_attribute_values sku_attribute_values_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sku_attribute_values_select ON public.sku_attribute_values FOR SELECT TO authenticated USING (true);


--
-- Name: sku_attribute_values sku_attribute_values_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sku_attribute_values_write ON public.sku_attribute_values TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: sku_prices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sku_prices ENABLE ROW LEVEL SECURITY;

--
-- Name: sku_prices sku_prices_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sku_prices_select ON public.sku_prices FOR SELECT TO authenticated USING (public.is_accountant());


--
-- Name: sku_prices sku_prices_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sku_prices_write ON public.sku_prices TO authenticated USING (public.is_accountant()) WITH CHECK (public.is_accountant());


--
-- Name: sku_transaction_units; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sku_transaction_units ENABLE ROW LEVEL SECURITY;

--
-- Name: sku_transaction_units sku_transaction_units_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sku_transaction_units_select ON public.sku_transaction_units FOR SELECT TO authenticated USING (true);


--
-- Name: sku_transaction_units sku_transaction_units_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sku_transaction_units_write ON public.sku_transaction_units TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: stock_balances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_balances ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_balances stock_balances_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stock_balances_insert ON public.stock_balances FOR INSERT TO authenticated WITH CHECK (public.is_manager());


--
-- Name: stock_balances stock_balances_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stock_balances_select ON public.stock_balances FOR SELECT TO authenticated USING (true);


--
-- Name: stock_balances stock_balances_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stock_balances_update ON public.stock_balances FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: stock_locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_locations ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_locations stock_locations_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stock_locations_delete ON public.stock_locations FOR DELETE TO authenticated USING (public.is_manager());


--
-- Name: stock_locations stock_locations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stock_locations_insert ON public.stock_locations FOR INSERT TO authenticated WITH CHECK (public.is_manager());


--
-- Name: stock_locations stock_locations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stock_locations_select ON public.stock_locations FOR SELECT TO authenticated USING (true);


--
-- Name: stock_locations stock_locations_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stock_locations_update ON public.stock_locations FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: stock_movement_allocations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_movement_allocations ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_movements stock_movements_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stock_movements_select ON public.stock_movements FOR SELECT TO authenticated USING (public.is_manager());


--
-- Name: stock_reservation_allocations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_reservation_allocations ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_reservations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;

--
-- Name: stocktake_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stocktake_items ENABLE ROW LEVEL SECURITY;

--
-- Name: stocktake_items stocktake_items_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stocktake_items_delete ON public.stocktake_items FOR DELETE TO authenticated USING (public.is_manager());


--
-- Name: stocktake_items stocktake_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stocktake_items_insert ON public.stocktake_items FOR INSERT TO authenticated WITH CHECK (public.is_manager());


--
-- Name: stocktake_items stocktake_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stocktake_items_select ON public.stocktake_items FOR SELECT TO authenticated USING (public.is_manager());


--
-- Name: stocktake_items stocktake_items_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stocktake_items_update ON public.stocktake_items FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: stocktake_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stocktake_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: stocktake_sessions stocktake_sessions_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stocktake_sessions_delete ON public.stocktake_sessions FOR DELETE TO authenticated USING (public.is_manager());


--
-- Name: stocktake_sessions stocktake_sessions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stocktake_sessions_insert ON public.stocktake_sessions FOR INSERT TO authenticated WITH CHECK (public.is_manager());


--
-- Name: stocktake_sessions stocktake_sessions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stocktake_sessions_select ON public.stocktake_sessions FOR SELECT TO authenticated USING (public.is_manager());


--
-- Name: stocktake_sessions stocktake_sessions_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stocktake_sessions_update ON public.stocktake_sessions FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: sub_zones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sub_zones ENABLE ROW LEVEL SECURITY;

--
-- Name: sub_zones sub_zones_manager_modify; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sub_zones_manager_modify ON public.sub_zones TO authenticated USING (public.is_manager());


--
-- Name: sub_zones sub_zones_read_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sub_zones_read_all ON public.sub_zones FOR SELECT TO authenticated USING (true);


--
-- Name: suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers suppliers_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suppliers_delete ON public.suppliers FOR DELETE TO authenticated USING (public.is_manager());


--
-- Name: suppliers suppliers_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suppliers_insert ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.is_manager());


--
-- Name: suppliers suppliers_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suppliers_select ON public.suppliers FOR SELECT TO authenticated USING (true);


--
-- Name: suppliers suppliers_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suppliers_update ON public.suppliers FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: tool_borrowing_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tool_borrowing_items ENABLE ROW LEVEL SECURITY;

--
-- Name: tool_borrowing_items tool_borrowing_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tool_borrowing_items_select ON public.tool_borrowing_items FOR SELECT TO authenticated USING ((public.is_manager() OR (EXISTS ( SELECT 1
   FROM public.tool_borrowings b
  WHERE ((b.id = tool_borrowing_items.borrowing_id) AND (b.borrower_id = auth.uid()))))));


--
-- Name: tool_borrowings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tool_borrowings ENABLE ROW LEVEL SECURITY;

--
-- Name: tool_borrowings tool_borrowings_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tool_borrowings_select ON public.tool_borrowings FOR SELECT TO authenticated USING ((public.is_manager() OR (borrower_id = auth.uid())));


--
-- Name: units; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

--
-- Name: units units_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY units_select ON public.units FOR SELECT TO authenticated USING (true);


--
-- Name: units units_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY units_write ON public.units TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: skus; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.skus ENABLE ROW LEVEL SECURITY;

--
-- Name: skus skus_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY skus_delete ON public.skus FOR DELETE TO authenticated USING (public.is_manager());


--
-- Name: skus skus_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY skus_insert ON public.skus FOR INSERT TO authenticated WITH CHECK (public.is_manager());


--
-- Name: skus skus_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY skus_select ON public.skus FOR SELECT TO authenticated USING (true);


--
-- Name: skus skus_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY skus_update ON public.skus FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: vehicles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicles vehicles_all_mgr; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vehicles_all_mgr ON public.vehicles TO authenticated USING (public.is_manager());


--
-- Name: vehicles vehicles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vehicles_select ON public.vehicles FOR SELECT TO authenticated USING (true);


--
-- Name: zones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

--
-- Name: zones zones_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY zones_delete ON public.zones FOR DELETE TO authenticated USING (public.is_manager());


--
-- Name: zones zones_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY zones_insert ON public.zones FOR INSERT TO authenticated WITH CHECK (public.is_manager());


--
-- Name: zones zones_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY zones_select ON public.zones FOR SELECT TO authenticated USING (true);


--
-- Name: zones zones_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY zones_update ON public.zones FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION _move_stock(p_sku uuid, p_from uuid, p_to uuid, p_qty integer, p_mtype public.movement_type, p_ref_type text, p_ref_id uuid, p_by uuid, p_notes text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public._move_stock(p_sku uuid, p_from uuid, p_to uuid, p_qty integer, p_mtype public.movement_type, p_ref_type text, p_ref_id uuid, p_by uuid, p_notes text) TO anon;
GRANT ALL ON FUNCTION public._move_stock(p_sku uuid, p_from uuid, p_to uuid, p_qty integer, p_mtype public.movement_type, p_ref_type text, p_ref_id uuid, p_by uuid, p_notes text) TO authenticated;
GRANT ALL ON FUNCTION public._move_stock(p_sku uuid, p_from uuid, p_to uuid, p_qty integer, p_mtype public.movement_type, p_ref_type text, p_ref_id uuid, p_by uuid, p_notes text) TO service_role;


--
-- Name: FUNCTION _post_inventory_movement(p_command jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._post_inventory_movement(p_command jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public._post_inventory_movement(p_command jsonb) TO service_role;


--
-- Name: FUNCTION _posting_actor_has_role(p_actor uuid, p_roles text[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public._posting_actor_has_role(p_actor uuid, p_roles text[]) TO anon;
GRANT ALL ON FUNCTION public._posting_actor_has_role(p_actor uuid, p_roles text[]) TO authenticated;
GRANT ALL ON FUNCTION public._posting_actor_has_role(p_actor uuid, p_roles text[]) TO service_role;


--
-- Name: FUNCTION _posting_lock_balance(p_sku_id uuid, p_location_id uuid, p_base_unit_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._posting_lock_balance(p_sku_id uuid, p_location_id uuid, p_base_unit_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public._posting_lock_balance(p_sku_id uuid, p_location_id uuid, p_base_unit_id uuid) TO service_role;


--
-- Name: FUNCTION _posting_pick_lots(p_sku_id uuid, p_location_id uuid, p_needed numeric); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._posting_pick_lots(p_sku_id uuid, p_location_id uuid, p_needed numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public._posting_pick_lots(p_sku_id uuid, p_location_id uuid, p_needed numeric) TO service_role;


--
-- Name: FUNCTION _posting_resolve_unit(p_sku_id uuid, p_transaction_unit_id uuid, p_entered numeric); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._posting_resolve_unit(p_sku_id uuid, p_transaction_unit_id uuid, p_entered numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public._posting_resolve_unit(p_sku_id uuid, p_transaction_unit_id uuid, p_entered numeric) TO service_role;


--
-- Name: FUNCTION _posting_round_base(p_value numeric, p_scale smallint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public._posting_round_base(p_value numeric, p_scale smallint) TO anon;
GRANT ALL ON FUNCTION public._posting_round_base(p_value numeric, p_scale smallint) TO authenticated;
GRANT ALL ON FUNCTION public._posting_round_base(p_value numeric, p_scale smallint) TO service_role;


--
-- Name: FUNCTION _posting_validate_operation_shape(p_type text, p_lines jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public._posting_validate_operation_shape(p_type text, p_lines jsonb) TO anon;
GRANT ALL ON FUNCTION public._posting_validate_operation_shape(p_type text, p_lines jsonb) TO authenticated;
GRANT ALL ON FUNCTION public._posting_validate_operation_shape(p_type text, p_lines jsonb) TO service_role;


--
-- Name: FUNCTION _rebuild_defect_notes(p_repair_id uuid, p_mode text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public._rebuild_defect_notes(p_repair_id uuid, p_mode text) TO anon;
GRANT ALL ON FUNCTION public._rebuild_defect_notes(p_repair_id uuid, p_mode text) TO authenticated;
GRANT ALL ON FUNCTION public._rebuild_defect_notes(p_repair_id uuid, p_mode text) TO service_role;


--
-- Name: FUNCTION _receipt_has_active_linked(p_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public._receipt_has_active_linked(p_id uuid) TO anon;
GRANT ALL ON FUNCTION public._receipt_has_active_linked(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public._receipt_has_active_linked(p_id uuid) TO service_role;


--
-- Name: FUNCTION _revert_movements(p_ref_type text, p_ref_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public._revert_movements(p_ref_type text, p_ref_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public._revert_movements(p_ref_type text, p_ref_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public._revert_movements(p_ref_type text, p_ref_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION adjust_stock(p_sku_id uuid, p_location_id uuid, p_delta numeric, p_reason text, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.adjust_stock(p_sku_id uuid, p_location_id uuid, p_delta numeric, p_reason text, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.adjust_stock(p_sku_id uuid, p_location_id uuid, p_delta numeric, p_reason text, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.adjust_stock(p_sku_id uuid, p_location_id uuid, p_delta numeric, p_reason text, p_by uuid) TO service_role;


--
-- Name: FUNCTION admin_purge_user_data(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.admin_purge_user_data(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.admin_purge_user_data(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.admin_purge_user_data(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION admin_update_profile(p_user_id uuid, p_name text, p_role text, p_zone_id uuid, p_is_active boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.admin_update_profile(p_user_id uuid, p_name text, p_role text, p_zone_id uuid, p_is_active boolean) TO anon;
GRANT ALL ON FUNCTION public.admin_update_profile(p_user_id uuid, p_name text, p_role text, p_zone_id uuid, p_is_active boolean) TO authenticated;
GRANT ALL ON FUNCTION public.admin_update_profile(p_user_id uuid, p_name text, p_role text, p_zone_id uuid, p_is_active boolean) TO service_role;


--
-- Name: FUNCTION admin_update_profile(p_user_id uuid, p_name text, p_role text, p_zone_id uuid, p_is_active boolean, p_sub_zone_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.admin_update_profile(p_user_id uuid, p_name text, p_role text, p_zone_id uuid, p_is_active boolean, p_sub_zone_id uuid) TO anon;
GRANT ALL ON FUNCTION public.admin_update_profile(p_user_id uuid, p_name text, p_role text, p_zone_id uuid, p_is_active boolean, p_sub_zone_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.admin_update_profile(p_user_id uuid, p_name text, p_role text, p_zone_id uuid, p_is_active boolean, p_sub_zone_id uuid) TO service_role;


--
-- Name: FUNCTION admin_update_profile(p_user_id uuid, p_name text, p_role text, p_zone_id uuid, p_is_active boolean, p_sub_zone_id uuid, p_email text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.admin_update_profile(p_user_id uuid, p_name text, p_role text, p_zone_id uuid, p_is_active boolean, p_sub_zone_id uuid, p_email text) TO anon;
GRANT ALL ON FUNCTION public.admin_update_profile(p_user_id uuid, p_name text, p_role text, p_zone_id uuid, p_is_active boolean, p_sub_zone_id uuid, p_email text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_update_profile(p_user_id uuid, p_name text, p_role text, p_zone_id uuid, p_is_active boolean, p_sub_zone_id uuid, p_email text) TO service_role;


--
-- Name: FUNCTION admin_update_username(p_user_id uuid, p_username text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.admin_update_username(p_user_id uuid, p_username text) TO anon;
GRANT ALL ON FUNCTION public.admin_update_username(p_user_id uuid, p_username text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_update_username(p_user_id uuid, p_username text) TO service_role;


--
-- Name: FUNCTION ai_get_fuel_summary(p_start_date date, p_end_date date, p_vehicle_id uuid, p_limit integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.ai_get_fuel_summary(p_start_date date, p_end_date date, p_vehicle_id uuid, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.ai_get_fuel_summary(p_start_date date, p_end_date date, p_vehicle_id uuid, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.ai_get_fuel_summary(p_start_date date, p_end_date date, p_vehicle_id uuid, p_limit integer) TO service_role;


--
-- Name: FUNCTION ai_get_stock_summary(p_query text, p_location_id uuid, p_limit integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.ai_get_stock_summary(p_query text, p_location_id uuid, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.ai_get_stock_summary(p_query text, p_location_id uuid, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.ai_get_stock_summary(p_query text, p_location_id uuid, p_limit integer) TO service_role;


--
-- Name: FUNCTION approve_exchange(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.approve_exchange(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.approve_exchange(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.approve_exchange(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION approve_liquidation(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.approve_liquidation(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.approve_liquidation(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.approve_liquidation(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION approve_receipt(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.approve_receipt(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.approve_receipt(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.approve_receipt(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION approve_requisition(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.approve_requisition(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.approve_requisition(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.approve_requisition(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION audit_normalized_catalog_change(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.audit_normalized_catalog_change() TO anon;
GRANT ALL ON FUNCTION public.audit_normalized_catalog_change() TO authenticated;
GRANT ALL ON FUNCTION public.audit_normalized_catalog_change() TO service_role;


--
-- Name: FUNCTION can_activate_bom(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.can_activate_bom() TO anon;
GRANT ALL ON FUNCTION public.can_activate_bom() TO authenticated;
GRANT ALL ON FUNCTION public.can_activate_bom() TO service_role;


--
-- Name: FUNCTION can_approve_stocktake_adjustment(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.can_approve_stocktake_adjustment() TO anon;
GRANT ALL ON FUNCTION public.can_approve_stocktake_adjustment() TO authenticated;
GRANT ALL ON FUNCTION public.can_approve_stocktake_adjustment() TO service_role;


--
-- Name: FUNCTION can_edit_bom(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.can_edit_bom() TO anon;
GRANT ALL ON FUNCTION public.can_edit_bom() TO authenticated;
GRANT ALL ON FUNCTION public.can_edit_bom() TO service_role;


--
-- Name: FUNCTION can_post_inventory(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.can_post_inventory() TO anon;
GRANT ALL ON FUNCTION public.can_post_inventory() TO authenticated;
GRANT ALL ON FUNCTION public.can_post_inventory() TO service_role;


--
-- Name: FUNCTION can_post_technician_inventory(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.can_post_technician_inventory() TO anon;
GRANT ALL ON FUNCTION public.can_post_technician_inventory() TO authenticated;
GRANT ALL ON FUNCTION public.can_post_technician_inventory() TO service_role;


--
-- Name: FUNCTION cancel_defect(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cancel_defect(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.cancel_defect(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_defect(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION cancel_exchange(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cancel_exchange(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.cancel_exchange(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_exchange(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION cancel_fuel_dispense(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cancel_fuel_dispense(p_id uuid, p_by uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cancel_fuel_dispense(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.cancel_fuel_dispense(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_fuel_dispense(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION cancel_fuel_receipt(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cancel_fuel_receipt(p_id uuid, p_by uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cancel_fuel_receipt(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.cancel_fuel_receipt(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_fuel_receipt(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION cancel_issue(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cancel_issue(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.cancel_issue(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_issue(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION cancel_liquidation(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cancel_liquidation(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.cancel_liquidation(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_liquidation(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION cancel_receipt(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cancel_receipt(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.cancel_receipt(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_receipt(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION cancel_repair(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cancel_repair(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.cancel_repair(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_repair(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION cancel_repair_request(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cancel_repair_request(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.cancel_repair_request(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_repair_request(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION cancel_requisition(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cancel_requisition(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.cancel_requisition(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_requisition(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION cancel_tool_borrowing(p_borrowing_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cancel_tool_borrowing(p_borrowing_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.cancel_tool_borrowing(p_borrowing_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_tool_borrowing(p_borrowing_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION complete_liquidation(p_id uuid, p_items_outcome jsonb, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.complete_liquidation(p_id uuid, p_items_outcome jsonb, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.complete_liquidation(p_id uuid, p_items_outcome jsonb, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.complete_liquidation(p_id uuid, p_items_outcome jsonb, p_by uuid) TO service_role;


--
-- Name: FUNCTION complete_repair(p_repair_id uuid, p_outcomes jsonb, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.complete_repair(p_repair_id uuid, p_outcomes jsonb, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.complete_repair(p_repair_id uuid, p_outcomes jsonb, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.complete_repair(p_repair_id uuid, p_outcomes jsonb, p_by uuid) TO service_role;


--
-- Name: FUNCTION consume_reservation(p_reservation_id uuid, p_quantity numeric, p_actor uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.consume_reservation(p_reservation_id uuid, p_quantity numeric, p_actor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.consume_reservation(p_reservation_id uuid, p_quantity numeric, p_actor uuid) TO service_role;


--
-- Name: FUNCTION create_exchange(p_defect_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_exchange(p_defect_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.create_exchange(p_defect_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.create_exchange(p_defect_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION create_fuel_dispense(p_vehicle_id uuid, p_zone_id uuid, p_fuel_type_id uuid, p_quantity numeric, p_current_odo numeric, p_driver_name text, p_meter_images text[], p_notes text, p_by uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_fuel_dispense(p_vehicle_id uuid, p_zone_id uuid, p_fuel_type_id uuid, p_quantity numeric, p_current_odo numeric, p_driver_name text, p_meter_images text[], p_notes text, p_by uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_fuel_dispense(p_vehicle_id uuid, p_zone_id uuid, p_fuel_type_id uuid, p_quantity numeric, p_current_odo numeric, p_driver_name text, p_meter_images text[], p_notes text, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.create_fuel_dispense(p_vehicle_id uuid, p_zone_id uuid, p_fuel_type_id uuid, p_quantity numeric, p_current_odo numeric, p_driver_name text, p_meter_images text[], p_notes text, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.create_fuel_dispense(p_vehicle_id uuid, p_zone_id uuid, p_fuel_type_id uuid, p_quantity numeric, p_current_odo numeric, p_driver_name text, p_meter_images text[], p_notes text, p_by uuid) TO service_role;


--
-- Name: FUNCTION create_fuel_dispense(p_vehicle_id uuid, p_zone_id uuid, p_fuel_type_id uuid, p_quantity numeric, p_current_odo numeric, p_driver_name text, p_meter_images text[], p_notes text, p_by uuid, p_sub_zone_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_fuel_dispense(p_vehicle_id uuid, p_zone_id uuid, p_fuel_type_id uuid, p_quantity numeric, p_current_odo numeric, p_driver_name text, p_meter_images text[], p_notes text, p_by uuid, p_sub_zone_id uuid) TO anon;
GRANT ALL ON FUNCTION public.create_fuel_dispense(p_vehicle_id uuid, p_zone_id uuid, p_fuel_type_id uuid, p_quantity numeric, p_current_odo numeric, p_driver_name text, p_meter_images text[], p_notes text, p_by uuid, p_sub_zone_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.create_fuel_dispense(p_vehicle_id uuid, p_zone_id uuid, p_fuel_type_id uuid, p_quantity numeric, p_current_odo numeric, p_driver_name text, p_meter_images text[], p_notes text, p_by uuid, p_sub_zone_id uuid) TO service_role;


--
-- Name: FUNCTION create_fuel_receipt(p_supplier_id uuid, p_fuel_type_id uuid, p_quantity numeric, p_unit_price numeric, p_invoice_number text, p_invoice_images text[], p_notes text, p_by uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_fuel_receipt(p_supplier_id uuid, p_fuel_type_id uuid, p_quantity numeric, p_unit_price numeric, p_invoice_number text, p_invoice_images text[], p_notes text, p_by uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_fuel_receipt(p_supplier_id uuid, p_fuel_type_id uuid, p_quantity numeric, p_unit_price numeric, p_invoice_number text, p_invoice_images text[], p_notes text, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.create_fuel_receipt(p_supplier_id uuid, p_fuel_type_id uuid, p_quantity numeric, p_unit_price numeric, p_invoice_number text, p_invoice_images text[], p_notes text, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.create_fuel_receipt(p_supplier_id uuid, p_fuel_type_id uuid, p_quantity numeric, p_unit_price numeric, p_invoice_number text, p_invoice_images text[], p_notes text, p_by uuid) TO service_role;


--
-- Name: FUNCTION create_issue(p_items jsonb, p_destination_type text, p_zone_id uuid, p_customer_id uuid, p_vehicle_plate text, p_driver_name text, p_notes text, p_by uuid, p_sub_zone_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_issue(p_items jsonb, p_destination_type text, p_zone_id uuid, p_customer_id uuid, p_vehicle_plate text, p_driver_name text, p_notes text, p_by uuid, p_sub_zone_id uuid) TO anon;
GRANT ALL ON FUNCTION public.create_issue(p_items jsonb, p_destination_type text, p_zone_id uuid, p_customer_id uuid, p_vehicle_plate text, p_driver_name text, p_notes text, p_by uuid, p_sub_zone_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.create_issue(p_items jsonb, p_destination_type text, p_zone_id uuid, p_customer_id uuid, p_vehicle_plate text, p_driver_name text, p_notes text, p_by uuid, p_sub_zone_id uuid) TO service_role;


--
-- Name: FUNCTION create_liquidation(p_items jsonb, p_reason text, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_liquidation(p_items jsonb, p_reason text, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.create_liquidation(p_items jsonb, p_reason text, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.create_liquidation(p_items jsonb, p_reason text, p_by uuid) TO service_role;


--
-- Name: FUNCTION create_notification(p_user_id uuid, p_type text, p_title text, p_body text, p_link text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_notification(p_user_id uuid, p_type text, p_title text, p_body text, p_link text) TO anon;
GRANT ALL ON FUNCTION public.create_notification(p_user_id uuid, p_type text, p_title text, p_body text, p_link text) TO authenticated;
GRANT ALL ON FUNCTION public.create_notification(p_user_id uuid, p_type text, p_title text, p_body text, p_link text) TO service_role;


--
-- Name: FUNCTION create_receipt(p_items jsonb, p_supplier_id uuid, p_by uuid, p_notes text, p_invoice_images text[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_receipt(p_items jsonb, p_supplier_id uuid, p_by uuid, p_notes text, p_invoice_images text[]) TO anon;
GRANT ALL ON FUNCTION public.create_receipt(p_items jsonb, p_supplier_id uuid, p_by uuid, p_notes text, p_invoice_images text[]) TO authenticated;
GRANT ALL ON FUNCTION public.create_receipt(p_items jsonb, p_supplier_id uuid, p_by uuid, p_notes text, p_invoice_images text[]) TO service_role;


--
-- Name: FUNCTION create_requisition(p_items jsonb, p_zone_id uuid, p_purpose text, p_type public.requisition_type, p_linked_defect_id uuid, p_requester_id uuid, p_sub_zone_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_requisition(p_items jsonb, p_zone_id uuid, p_purpose text, p_type public.requisition_type, p_linked_defect_id uuid, p_requester_id uuid, p_sub_zone_id uuid) TO anon;
GRANT ALL ON FUNCTION public.create_requisition(p_items jsonb, p_zone_id uuid, p_purpose text, p_type public.requisition_type, p_linked_defect_id uuid, p_requester_id uuid, p_sub_zone_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.create_requisition(p_items jsonb, p_zone_id uuid, p_purpose text, p_type public.requisition_type, p_linked_defect_id uuid, p_requester_id uuid, p_sub_zone_id uuid) TO service_role;


--
-- Name: FUNCTION create_stocktake(p_location_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_stocktake(p_location_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.create_stocktake(p_location_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.create_stocktake(p_location_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION create_stocktake(p_location_id uuid, p_name text, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_stocktake(p_location_id uuid, p_name text, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.create_stocktake(p_location_id uuid, p_name text, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.create_stocktake(p_location_id uuid, p_name text, p_by uuid) TO service_role;


--
-- Name: FUNCTION create_tool_borrowing(p_items jsonb, p_zone_id uuid, p_purpose text, p_expected_return_date date, p_borrower_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_tool_borrowing(p_items jsonb, p_zone_id uuid, p_purpose text, p_expected_return_date date, p_borrower_id uuid) TO anon;
GRANT ALL ON FUNCTION public.create_tool_borrowing(p_items jsonb, p_zone_id uuid, p_purpose text, p_expected_return_date date, p_borrower_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.create_tool_borrowing(p_items jsonb, p_zone_id uuid, p_purpose text, p_expected_return_date date, p_borrower_id uuid) TO service_role;


--
-- Name: FUNCTION create_tool_borrowing(p_items jsonb, p_zone_id uuid, p_purpose text, p_expected_return_date date, p_borrower_id uuid, p_sub_zone_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_tool_borrowing(p_items jsonb, p_zone_id uuid, p_purpose text, p_expected_return_date date, p_borrower_id uuid, p_sub_zone_id uuid) TO anon;
GRANT ALL ON FUNCTION public.create_tool_borrowing(p_items jsonb, p_zone_id uuid, p_purpose text, p_expected_return_date date, p_borrower_id uuid, p_sub_zone_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.create_tool_borrowing(p_items jsonb, p_zone_id uuid, p_purpose text, p_expected_return_date date, p_borrower_id uuid, p_sub_zone_id uuid) TO service_role;


--
-- Name: FUNCTION delete_defect(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_defect(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.delete_defect(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_defect(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION delete_issue(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_issue(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.delete_issue(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_issue(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION delete_liquidation(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_liquidation(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.delete_liquidation(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_liquidation(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION delete_receipt(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_receipt(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.delete_receipt(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_receipt(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION delete_repair(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_repair(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.delete_repair(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_repair(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION delete_requisition(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_requisition(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.delete_requisition(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_requisition(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION delete_stocktake(p_session_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.delete_stocktake(p_session_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.delete_stocktake(p_session_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_stocktake(p_session_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION enforce_movement_append_only(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.enforce_movement_append_only() TO anon;
GRANT ALL ON FUNCTION public.enforce_movement_append_only() TO authenticated;
GRANT ALL ON FUNCTION public.enforce_movement_append_only() TO service_role;


--
-- Name: FUNCTION fulfill_requisition(p_id uuid, p_by uuid, p_notes text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fulfill_requisition(p_id uuid, p_by uuid, p_notes text) TO anon;
GRANT ALL ON FUNCTION public.fulfill_requisition(p_id uuid, p_by uuid, p_notes text) TO authenticated;
GRANT ALL ON FUNCTION public.fulfill_requisition(p_id uuid, p_by uuid, p_notes text) TO service_role;


--
-- Name: FUNCTION generate_sku_code_if_null(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.generate_sku_code_if_null() TO anon;
GRANT ALL ON FUNCTION public.generate_sku_code_if_null() TO authenticated;
GRANT ALL ON FUNCTION public.generate_sku_code_if_null() TO service_role;


--
-- Name: FUNCTION get_login_email(p_username text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_login_email(p_username text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_login_email(p_username text) TO service_role;


--
-- Name: FUNCTION get_vehicle_by_qr(p_qr_text text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_vehicle_by_qr(p_qr_text text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_vehicle_by_qr(p_qr_text text) TO anon;
GRANT ALL ON FUNCTION public.get_vehicle_by_qr(p_qr_text text) TO authenticated;
GRANT ALL ON FUNCTION public.get_vehicle_by_qr(p_qr_text text) TO service_role;


--
-- Name: FUNCTION guard_bom_header_activation(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.guard_bom_header_activation() TO anon;
GRANT ALL ON FUNCTION public.guard_bom_header_activation() TO authenticated;
GRANT ALL ON FUNCTION public.guard_bom_header_activation() TO service_role;


--
-- Name: FUNCTION guard_bom_version_mutation(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.guard_bom_version_mutation() TO anon;
GRANT ALL ON FUNCTION public.guard_bom_version_mutation() TO authenticated;
GRANT ALL ON FUNCTION public.guard_bom_version_mutation() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION is_accountant(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_accountant() TO anon;
GRANT ALL ON FUNCTION public.is_accountant() TO authenticated;
GRANT ALL ON FUNCTION public.is_accountant() TO service_role;


--
-- Name: FUNCTION is_manager(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_manager() TO anon;
GRANT ALL ON FUNCTION public.is_manager() TO authenticated;
GRANT ALL ON FUNCTION public.is_manager() TO service_role;


--
-- Name: FUNCTION is_owner(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_owner() TO anon;
GRANT ALL ON FUNCTION public.is_owner() TO authenticated;
GRANT ALL ON FUNCTION public.is_owner() TO service_role;


--
-- Name: FUNCTION is_superuser(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_superuser() TO anon;
GRANT ALL ON FUNCTION public.is_superuser() TO authenticated;
GRANT ALL ON FUNCTION public.is_superuser() TO service_role;


--
-- Name: FUNCTION is_technician(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_technician() TO anon;
GRANT ALL ON FUNCTION public.is_technician() TO authenticated;
GRANT ALL ON FUNCTION public.is_technician() TO service_role;


--
-- Name: FUNCTION is_warehouse(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_warehouse() TO anon;
GRANT ALL ON FUNCTION public.is_warehouse() TO authenticated;
GRANT ALL ON FUNCTION public.is_warehouse() TO service_role;


--
-- Name: FUNCTION issue_exchange(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.issue_exchange(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.issue_exchange(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.issue_exchange(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION liquidate_defects(p_id uuid, p_items_outcome jsonb, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.liquidate_defects(p_id uuid, p_items_outcome jsonb, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.liquidate_defects(p_id uuid, p_items_outcome jsonb, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.liquidate_defects(p_id uuid, p_items_outcome jsonb, p_by uuid) TO service_role;


--
-- Name: FUNCTION list_requester_accounts(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.list_requester_accounts() TO anon;
GRANT ALL ON FUNCTION public.list_requester_accounts() TO authenticated;
GRANT ALL ON FUNCTION public.list_requester_accounts() TO service_role;


--
-- Name: FUNCTION mark_defect_collected(p_id uuid, p_by uuid, p_collected boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mark_defect_collected(p_id uuid, p_by uuid, p_collected boolean) TO anon;
GRANT ALL ON FUNCTION public.mark_defect_collected(p_id uuid, p_by uuid, p_collected boolean) TO authenticated;
GRANT ALL ON FUNCTION public.mark_defect_collected(p_id uuid, p_by uuid, p_collected boolean) TO service_role;


--
-- Name: FUNCTION next_code(prefix text, seq regclass); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.next_code(prefix text, seq regclass) TO anon;
GRANT ALL ON FUNCTION public.next_code(prefix text, seq regclass) TO authenticated;
GRANT ALL ON FUNCTION public.next_code(prefix text, seq regclass) TO service_role;


--
-- Name: FUNCTION next_sku_code(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.next_sku_code() TO anon;
GRANT ALL ON FUNCTION public.next_sku_code() TO authenticated;
GRANT ALL ON FUNCTION public.next_sku_code() TO service_role;


--
-- Name: FUNCTION post_assembly(p_kit_sku_id uuid, p_bom_version_id uuid, p_quantity numeric, p_component_location_id uuid, p_finished_location_id uuid, p_document_id uuid, p_idempotency_key text, p_actor uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.post_assembly(p_kit_sku_id uuid, p_bom_version_id uuid, p_quantity numeric, p_component_location_id uuid, p_finished_location_id uuid, p_document_id uuid, p_idempotency_key text, p_actor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.post_assembly(p_kit_sku_id uuid, p_bom_version_id uuid, p_quantity numeric, p_component_location_id uuid, p_finished_location_id uuid, p_document_id uuid, p_idempotency_key text, p_actor uuid) TO service_role;


--
-- Name: FUNCTION post_defect_command(p_command jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.post_defect_command(p_command jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.post_defect_command(p_command jsonb) TO service_role;


--
-- Name: FUNCTION post_direct_issue_command(p_command jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.post_direct_issue_command(p_command jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.post_direct_issue_command(p_command jsonb) TO service_role;


--
-- Name: FUNCTION post_disassembly(p_kit_sku_id uuid, p_bom_version_id uuid, p_quantity numeric, p_from_location_id uuid, p_items jsonb, p_document_id uuid, p_idempotency_key text, p_actor uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.post_disassembly(p_kit_sku_id uuid, p_bom_version_id uuid, p_quantity numeric, p_from_location_id uuid, p_items jsonb, p_document_id uuid, p_idempotency_key text, p_actor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.post_disassembly(p_kit_sku_id uuid, p_bom_version_id uuid, p_quantity numeric, p_from_location_id uuid, p_items jsonb, p_document_id uuid, p_idempotency_key text, p_actor uuid) TO service_role;


--
-- Name: FUNCTION post_inventory_movement(p_command jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.post_inventory_movement(p_command jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.post_inventory_movement(p_command jsonb) TO service_role;


--
-- Name: FUNCTION post_issue(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.post_issue(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.post_issue(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.post_issue(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION post_liquidation_command(p_command jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.post_liquidation_command(p_command jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.post_liquidation_command(p_command jsonb) TO service_role;


--
-- Name: FUNCTION post_receipt(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.post_receipt(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.post_receipt(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.post_receipt(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION post_receipt_command(p_command jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.post_receipt_command(p_command jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.post_receipt_command(p_command jsonb) TO service_role;


--
-- Name: FUNCTION post_repair_command(p_command jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.post_repair_command(p_command jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.post_repair_command(p_command jsonb) TO service_role;


--
-- Name: FUNCTION post_reserved_issue(p_reservation_id uuid, p_quantity numeric, p_document_id uuid, p_allocations jsonb, p_idempotency_key text, p_actor uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.post_reserved_issue(p_reservation_id uuid, p_quantity numeric, p_document_id uuid, p_allocations jsonb, p_idempotency_key text, p_actor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.post_reserved_issue(p_reservation_id uuid, p_quantity numeric, p_document_id uuid, p_allocations jsonb, p_idempotency_key text, p_actor uuid) TO service_role;


--
-- Name: FUNCTION post_return_command(p_command jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.post_return_command(p_command jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.post_return_command(p_command jsonb) TO service_role;


--
-- Name: FUNCTION post_stocktake(p_session_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.post_stocktake(p_session_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.post_stocktake(p_session_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.post_stocktake(p_session_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION post_stocktake_adjustment_command(p_command jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.post_stocktake_adjustment_command(p_command jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.post_stocktake_adjustment_command(p_command jsonb) TO service_role;


--
-- Name: FUNCTION post_transfer_command(p_command jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.post_transfer_command(p_command jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.post_transfer_command(p_command jsonb) TO service_role;


--
-- Name: FUNCTION post_virtual_kit_issue(p_kit_sku_id uuid, p_location_id uuid, p_kit_quantity numeric, p_bom_version_id uuid, p_document_id uuid, p_idempotency_key text, p_actor uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.post_virtual_kit_issue(p_kit_sku_id uuid, p_location_id uuid, p_kit_quantity numeric, p_bom_version_id uuid, p_document_id uuid, p_idempotency_key text, p_actor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.post_virtual_kit_issue(p_kit_sku_id uuid, p_location_id uuid, p_kit_quantity numeric, p_bom_version_id uuid, p_document_id uuid, p_idempotency_key text, p_actor uuid) TO service_role;


--
-- Name: FUNCTION prevent_profile_identity_change(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.prevent_profile_identity_change() TO anon;
GRANT ALL ON FUNCTION public.prevent_profile_identity_change() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_profile_identity_change() TO service_role;


--
-- Name: FUNCTION prevent_role_escalation(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.prevent_role_escalation() TO anon;
GRANT ALL ON FUNCTION public.prevent_role_escalation() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_role_escalation() TO service_role;


--
-- Name: FUNCTION protect_system_account(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.protect_system_account() TO anon;
GRANT ALL ON FUNCTION public.protect_system_account() TO authenticated;
GRANT ALL ON FUNCTION public.protect_system_account() TO service_role;


--
-- Name: FUNCTION receive_exchange(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.receive_exchange(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.receive_exchange(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.receive_exchange(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION receive_requisition(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.receive_requisition(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.receive_requisition(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.receive_requisition(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION record_defect(p_items jsonb, p_source_loc uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.record_defect(p_items jsonb, p_source_loc uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.record_defect(p_items jsonb, p_source_loc uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.record_defect(p_items jsonb, p_source_loc uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION reject_exchange(p_id uuid, p_by uuid, p_reason text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.reject_exchange(p_id uuid, p_by uuid, p_reason text) TO anon;
GRANT ALL ON FUNCTION public.reject_exchange(p_id uuid, p_by uuid, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.reject_exchange(p_id uuid, p_by uuid, p_reason text) TO service_role;


--
-- Name: FUNCTION reject_liquidation(p_id uuid, p_by uuid, p_reason text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.reject_liquidation(p_id uuid, p_by uuid, p_reason text) TO anon;
GRANT ALL ON FUNCTION public.reject_liquidation(p_id uuid, p_by uuid, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.reject_liquidation(p_id uuid, p_by uuid, p_reason text) TO service_role;


--
-- Name: FUNCTION reject_requisition(p_id uuid, p_by uuid, p_reason text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.reject_requisition(p_id uuid, p_by uuid, p_reason text) TO anon;
GRANT ALL ON FUNCTION public.reject_requisition(p_id uuid, p_by uuid, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.reject_requisition(p_id uuid, p_by uuid, p_reason text) TO service_role;


--
-- Name: FUNCTION release_reservation(p_reservation_id uuid, p_actor uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.release_reservation(p_reservation_id uuid, p_actor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.release_reservation(p_reservation_id uuid, p_actor uuid) TO service_role;


--
-- Name: FUNCTION request_repair(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.request_repair(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.request_repair(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.request_repair(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION reserve_stock(p_command jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reserve_stock(p_command jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reserve_stock(p_command jsonb) TO service_role;


--
-- Name: FUNCTION return_requisition_items(p_requisition_id uuid, p_items jsonb, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.return_requisition_items(p_requisition_id uuid, p_items jsonb, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.return_requisition_items(p_requisition_id uuid, p_items jsonb, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.return_requisition_items(p_requisition_id uuid, p_items jsonb, p_by uuid) TO service_role;


--
-- Name: FUNCTION return_tool_borrowing(p_borrowing_id uuid, p_items jsonb, p_notes text, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.return_tool_borrowing(p_borrowing_id uuid, p_items jsonb, p_notes text, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.return_tool_borrowing(p_borrowing_id uuid, p_items jsonb, p_notes text, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.return_tool_borrowing(p_borrowing_id uuid, p_items jsonb, p_notes text, p_by uuid) TO service_role;


--
-- Name: FUNCTION reverse_inventory_command(p_idempotency_key text, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reverse_inventory_command(p_idempotency_key text, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reverse_inventory_command(p_idempotency_key text, p_reason text) TO service_role;


--
-- Name: FUNCTION reverse_inventory_command(p_idempotency_key text, p_reason text, p_actor uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reverse_inventory_command(p_idempotency_key text, p_reason text, p_actor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reverse_inventory_command(p_idempotency_key text, p_reason text, p_actor uuid) TO service_role;


--
-- Name: FUNCTION reverse_inventory_movement(p_movement_id uuid, p_reason text, p_actor uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reverse_inventory_movement(p_movement_id uuid, p_reason text, p_actor uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reverse_inventory_movement(p_movement_id uuid, p_reason text, p_actor uuid) TO service_role;


--
-- Name: FUNCTION revert_issue(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.revert_issue(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.revert_issue(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.revert_issue(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION revert_liquidation(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.revert_liquidation(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.revert_liquidation(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.revert_liquidation(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION revert_receipt(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.revert_receipt(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.revert_receipt(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.revert_receipt(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION revert_repair(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.revert_repair(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.revert_repair(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.revert_repair(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION revert_requisition(p_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.revert_requisition(p_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.revert_requisition(p_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.revert_requisition(p_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION revert_stocktake(p_session_id uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.revert_stocktake(p_session_id uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.revert_stocktake(p_session_id uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.revert_stocktake(p_session_id uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION search_ai_knowledge(p_query text, p_category text, p_limit integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.search_ai_knowledge(p_query text, p_category text, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.search_ai_knowledge(p_query text, p_category text, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.search_ai_knowledge(p_query text, p_category text, p_limit integer) TO service_role;


--
-- Name: FUNCTION search_catalog(p_query text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.search_catalog(p_query text) TO anon;
GRANT ALL ON FUNCTION public.search_catalog(p_query text) TO authenticated;
GRANT ALL ON FUNCTION public.search_catalog(p_query text) TO service_role;


--
-- Name: FUNCTION search_skus(p_query text, p_limit integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.search_skus(p_query text, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.search_skus(p_query text, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.search_skus(p_query text, p_limit integer) TO service_role;


--
-- Name: FUNCTION send_to_repair(p_defect_item_ids uuid[], p_vendor text, p_sent_at date, p_expected_return_at date, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.send_to_repair(p_defect_item_ids uuid[], p_vendor text, p_sent_at date, p_expected_return_at date, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.send_to_repair(p_defect_item_ids uuid[], p_vendor text, p_sent_at date, p_expected_return_at date, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.send_to_repair(p_defect_item_ids uuid[], p_vendor text, p_sent_at date, p_expected_return_at date, p_by uuid) TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION submit_requisition(p_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.submit_requisition(p_id uuid) TO anon;
GRANT ALL ON FUNCTION public.submit_requisition(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.submit_requisition(p_id uuid) TO service_role;


--
-- Name: FUNCTION sync_bom_header_active_version(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sync_bom_header_active_version() TO anon;
GRANT ALL ON FUNCTION public.sync_bom_header_active_version() TO authenticated;
GRANT ALL ON FUNCTION public.sync_bom_header_active_version() TO service_role;


--
-- Name: FUNCTION transfer_stock(p_items jsonb, p_from_loc uuid, p_to_loc uuid, p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.transfer_stock(p_items jsonb, p_from_loc uuid, p_to_loc uuid, p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.transfer_stock(p_items jsonb, p_from_loc uuid, p_to_loc uuid, p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.transfer_stock(p_items jsonb, p_from_loc uuid, p_to_loc uuid, p_by uuid) TO service_role;


--
-- Name: FUNCTION unaccent_text(p_text text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.unaccent_text(p_text text) TO anon;
GRANT ALL ON FUNCTION public.unaccent_text(p_text text) TO authenticated;
GRANT ALL ON FUNCTION public.unaccent_text(p_text text) TO service_role;


--
-- Name: FUNCTION update_defect_item_images(p_item_id uuid, p_images text[], p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_defect_item_images(p_item_id uuid, p_images text[], p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.update_defect_item_images(p_item_id uuid, p_images text[], p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.update_defect_item_images(p_item_id uuid, p_images text[], p_by uuid) TO service_role;


--
-- Name: FUNCTION update_issue_invoice_images(p_id uuid, p_invoice_images text[], p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_issue_invoice_images(p_id uuid, p_invoice_images text[], p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.update_issue_invoice_images(p_id uuid, p_invoice_images text[], p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.update_issue_invoice_images(p_id uuid, p_invoice_images text[], p_by uuid) TO service_role;


--
-- Name: FUNCTION update_receipt(p_id uuid, p_items jsonb, p_supplier_id uuid, p_by uuid, p_notes text, p_invoice_images text[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_receipt(p_id uuid, p_items jsonb, p_supplier_id uuid, p_by uuid, p_notes text, p_invoice_images text[]) TO anon;
GRANT ALL ON FUNCTION public.update_receipt(p_id uuid, p_items jsonb, p_supplier_id uuid, p_by uuid, p_notes text, p_invoice_images text[]) TO authenticated;
GRANT ALL ON FUNCTION public.update_receipt(p_id uuid, p_items jsonb, p_supplier_id uuid, p_by uuid, p_notes text, p_invoice_images text[]) TO service_role;


--
-- Name: FUNCTION update_receipt_invoice_images(p_id uuid, p_invoice_images text[], p_by uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_receipt_invoice_images(p_id uuid, p_invoice_images text[], p_by uuid) TO anon;
GRANT ALL ON FUNCTION public.update_receipt_invoice_images(p_id uuid, p_invoice_images text[], p_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.update_receipt_invoice_images(p_id uuid, p_invoice_images text[], p_by uuid) TO service_role;


--
-- Name: FUNCTION validate_bom_header_active_version(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_bom_header_active_version() TO anon;
GRANT ALL ON FUNCTION public.validate_bom_header_active_version() TO authenticated;
GRANT ALL ON FUNCTION public.validate_bom_header_active_version() TO service_role;


--
-- Name: FUNCTION validate_bom_item_one_level(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_bom_item_one_level() TO anon;
GRANT ALL ON FUNCTION public.validate_bom_item_one_level() TO authenticated;
GRANT ALL ON FUNCTION public.validate_bom_item_one_level() TO service_role;


--
-- Name: FUNCTION validate_sku_attribute_value(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_sku_attribute_value() TO anon;
GRANT ALL ON FUNCTION public.validate_sku_attribute_value() TO authenticated;
GRANT ALL ON FUNCTION public.validate_sku_attribute_value() TO service_role;


--
-- Name: FUNCTION validate_sku_transaction_unit(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_sku_transaction_unit() TO anon;
GRANT ALL ON FUNCTION public.validate_sku_transaction_unit() TO authenticated;
GRANT ALL ON FUNCTION public.validate_sku_transaction_unit() TO service_role;


--
-- Name: TABLE ai_conversations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_conversations TO anon;
GRANT ALL ON TABLE public.ai_conversations TO authenticated;
GRANT ALL ON TABLE public.ai_conversations TO service_role;


--
-- Name: TABLE ai_knowledge_chunks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_knowledge_chunks TO anon;
GRANT ALL ON TABLE public.ai_knowledge_chunks TO authenticated;
GRANT ALL ON TABLE public.ai_knowledge_chunks TO service_role;


--
-- Name: TABLE ai_knowledge_documents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_knowledge_documents TO anon;
GRANT ALL ON TABLE public.ai_knowledge_documents TO authenticated;
GRANT ALL ON TABLE public.ai_knowledge_documents TO service_role;


--
-- Name: TABLE ai_messages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_messages TO anon;
GRANT ALL ON TABLE public.ai_messages TO authenticated;
GRANT ALL ON TABLE public.ai_messages TO service_role;


--
-- Name: TABLE ai_quick_prompts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_quick_prompts TO anon;
GRANT ALL ON TABLE public.ai_quick_prompts TO authenticated;
GRANT ALL ON TABLE public.ai_quick_prompts TO service_role;


--
-- Name: TABLE ai_system_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_system_settings TO anon;
GRANT ALL ON TABLE public.ai_system_settings TO authenticated;
GRANT ALL ON TABLE public.ai_system_settings TO service_role;


--
-- Name: TABLE attribute_definitions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.attribute_definitions TO anon;
GRANT ALL ON TABLE public.attribute_definitions TO authenticated;
GRANT ALL ON TABLE public.attribute_definitions TO service_role;


--
-- Name: TABLE attribute_option_values; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.attribute_option_values TO anon;
GRANT ALL ON TABLE public.attribute_option_values TO authenticated;
GRANT ALL ON TABLE public.attribute_option_values TO service_role;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_logs TO anon;
GRANT ALL ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;


--
-- Name: TABLE barcode_registry; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.barcode_registry TO anon;
GRANT ALL ON TABLE public.barcode_registry TO authenticated;
GRANT ALL ON TABLE public.barcode_registry TO service_role;


--
-- Name: TABLE bom_headers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.bom_headers TO anon;
GRANT ALL ON TABLE public.bom_headers TO authenticated;
GRANT ALL ON TABLE public.bom_headers TO service_role;


--
-- Name: TABLE bom_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.bom_items TO anon;
GRANT ALL ON TABLE public.bom_items TO authenticated;
GRANT ALL ON TABLE public.bom_items TO service_role;


--
-- Name: TABLE bom_versions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.bom_versions TO anon;
GRANT ALL ON TABLE public.bom_versions TO authenticated;
GRANT ALL ON TABLE public.bom_versions TO service_role;


--
-- Name: TABLE catalog_drafts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.catalog_drafts TO anon;
GRANT ALL ON TABLE public.catalog_drafts TO authenticated;
GRANT ALL ON TABLE public.catalog_drafts TO service_role;


--
-- Name: TABLE catalog_migration_issues; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.catalog_migration_issues TO anon;
GRANT ALL ON TABLE public.catalog_migration_issues TO authenticated;
GRANT ALL ON TABLE public.catalog_migration_issues TO service_role;


--
-- Name: TABLE categories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.categories TO anon;
GRANT ALL ON TABLE public.categories TO authenticated;
GRANT ALL ON TABLE public.categories TO service_role;


--
-- Name: TABLE customers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.customers TO anon;
GRANT ALL ON TABLE public.customers TO authenticated;
GRANT ALL ON TABLE public.customers TO service_role;


--
-- Name: TABLE defect_note_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.defect_note_items TO anon;
GRANT ALL ON TABLE public.defect_note_items TO authenticated;
GRANT ALL ON TABLE public.defect_note_items TO service_role;


--
-- Name: TABLE defect_notes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.defect_notes TO anon;
GRANT ALL ON TABLE public.defect_notes TO authenticated;
GRANT ALL ON TABLE public.defect_notes TO service_role;


--
-- Name: SEQUENCE defect_notes_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.defect_notes_seq TO anon;
GRANT ALL ON SEQUENCE public.defect_notes_seq TO authenticated;
GRANT ALL ON SEQUENCE public.defect_notes_seq TO service_role;


--
-- Name: TABLE exchange_note_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.exchange_note_items TO anon;
GRANT ALL ON TABLE public.exchange_note_items TO authenticated;
GRANT ALL ON TABLE public.exchange_note_items TO service_role;


--
-- Name: TABLE exchange_notes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.exchange_notes TO anon;
GRANT ALL ON TABLE public.exchange_notes TO authenticated;
GRANT ALL ON TABLE public.exchange_notes TO service_role;


--
-- Name: SEQUENCE exchange_notes_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.exchange_notes_seq TO anon;
GRANT ALL ON SEQUENCE public.exchange_notes_seq TO authenticated;
GRANT ALL ON SEQUENCE public.exchange_notes_seq TO service_role;


--
-- Name: TABLE fuel_dispenses; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fuel_dispenses TO anon;
GRANT ALL ON TABLE public.fuel_dispenses TO authenticated;
GRANT ALL ON TABLE public.fuel_dispenses TO service_role;


--
-- Name: SEQUENCE fuel_dispenses_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.fuel_dispenses_seq TO anon;
GRANT ALL ON SEQUENCE public.fuel_dispenses_seq TO authenticated;
GRANT ALL ON SEQUENCE public.fuel_dispenses_seq TO service_role;


--
-- Name: TABLE fuel_movements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fuel_movements TO anon;
GRANT ALL ON TABLE public.fuel_movements TO authenticated;
GRANT ALL ON TABLE public.fuel_movements TO service_role;


--
-- Name: TABLE fuel_receipts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fuel_receipts TO anon;
GRANT ALL ON TABLE public.fuel_receipts TO authenticated;
GRANT ALL ON TABLE public.fuel_receipts TO service_role;


--
-- Name: SEQUENCE fuel_receipts_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.fuel_receipts_seq TO anon;
GRANT ALL ON SEQUENCE public.fuel_receipts_seq TO authenticated;
GRANT ALL ON SEQUENCE public.fuel_receipts_seq TO service_role;


--
-- Name: TABLE fuel_types; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fuel_types TO anon;
GRANT ALL ON TABLE public.fuel_types TO authenticated;
GRANT ALL ON TABLE public.fuel_types TO service_role;


--
-- Name: TABLE inventory_lots; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.inventory_lots TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.inventory_lots TO authenticated;
GRANT ALL ON TABLE public.inventory_lots TO service_role;


--
-- Name: TABLE inventory_posting_command_movements; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.inventory_posting_command_movements TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.inventory_posting_command_movements TO authenticated;
GRANT ALL ON TABLE public.inventory_posting_command_movements TO service_role;


--
-- Name: TABLE inventory_posting_commands; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.inventory_posting_commands TO anon;
GRANT ALL ON TABLE public.inventory_posting_commands TO authenticated;
GRANT ALL ON TABLE public.inventory_posting_commands TO service_role;


--
-- Name: TABLE issue_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.issue_items TO anon;
GRANT ALL ON TABLE public.issue_items TO authenticated;
GRANT ALL ON TABLE public.issue_items TO service_role;


--
-- Name: TABLE issues; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.issues TO anon;
GRANT ALL ON TABLE public.issues TO authenticated;
GRANT ALL ON TABLE public.issues TO service_role;


--
-- Name: SEQUENCE issues_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.issues_seq TO anon;
GRANT ALL ON SEQUENCE public.issues_seq TO authenticated;
GRANT ALL ON SEQUENCE public.issues_seq TO service_role;


--
-- Name: TABLE liquidation_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.liquidation_items TO anon;
GRANT ALL ON TABLE public.liquidation_items TO authenticated;
GRANT ALL ON TABLE public.liquidation_items TO service_role;


--
-- Name: TABLE liquidation_notes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.liquidation_notes TO anon;
GRANT ALL ON TABLE public.liquidation_notes TO authenticated;
GRANT ALL ON TABLE public.liquidation_notes TO service_role;


--
-- Name: SEQUENCE liquidation_notes_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.liquidation_notes_seq TO anon;
GRANT ALL ON SEQUENCE public.liquidation_notes_seq TO authenticated;
GRANT ALL ON SEQUENCE public.liquidation_notes_seq TO service_role;


--
-- Name: TABLE stock_balances; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stock_balances TO anon;
GRANT ALL ON TABLE public.stock_balances TO authenticated;
GRANT ALL ON TABLE public.stock_balances TO service_role;


--
-- Name: TABLE skus; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.skus TO anon;
GRANT ALL ON TABLE public.skus TO authenticated;
GRANT ALL ON TABLE public.skus TO service_role;


--
-- Name: TABLE location_stock; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.location_stock TO anon;
GRANT ALL ON TABLE public.location_stock TO authenticated;
GRANT ALL ON TABLE public.location_stock TO service_role;


--
-- Name: TABLE lot_stock_balances; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.lot_stock_balances TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.lot_stock_balances TO authenticated;
GRANT ALL ON TABLE public.lot_stock_balances TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: TABLE product_attribute_definitions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.product_attribute_definitions TO anon;
GRANT ALL ON TABLE public.product_attribute_definitions TO authenticated;
GRANT ALL ON TABLE public.product_attribute_definitions TO service_role;


--
-- Name: TABLE products; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.products TO anon;
GRANT ALL ON TABLE public.products TO authenticated;
GRANT ALL ON TABLE public.products TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE receipt_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.receipt_items TO anon;
GRANT ALL ON TABLE public.receipt_items TO authenticated;
GRANT ALL ON TABLE public.receipt_items TO service_role;


--
-- Name: TABLE receipts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.receipts TO anon;
GRANT ALL ON TABLE public.receipts TO authenticated;
GRANT ALL ON TABLE public.receipts TO service_role;


--
-- Name: SEQUENCE receipts_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.receipts_seq TO anon;
GRANT ALL ON SEQUENCE public.receipts_seq TO authenticated;
GRANT ALL ON SEQUENCE public.receipts_seq TO service_role;


--
-- Name: TABLE repair_order_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.repair_order_items TO anon;
GRANT ALL ON TABLE public.repair_order_items TO authenticated;
GRANT ALL ON TABLE public.repair_order_items TO service_role;


--
-- Name: TABLE repair_orders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.repair_orders TO anon;
GRANT ALL ON TABLE public.repair_orders TO authenticated;
GRANT ALL ON TABLE public.repair_orders TO service_role;


--
-- Name: SEQUENCE repair_orders_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.repair_orders_seq TO anon;
GRANT ALL ON SEQUENCE public.repair_orders_seq TO authenticated;
GRANT ALL ON SEQUENCE public.repair_orders_seq TO service_role;


--
-- Name: TABLE requisition_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.requisition_items TO anon;
GRANT ALL ON TABLE public.requisition_items TO authenticated;
GRANT ALL ON TABLE public.requisition_items TO service_role;


--
-- Name: TABLE requisition_return_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.requisition_return_items TO anon;
GRANT ALL ON TABLE public.requisition_return_items TO authenticated;
GRANT ALL ON TABLE public.requisition_return_items TO service_role;


--
-- Name: TABLE requisition_returns; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.requisition_returns TO anon;
GRANT ALL ON TABLE public.requisition_returns TO authenticated;
GRANT ALL ON TABLE public.requisition_returns TO service_role;


--
-- Name: TABLE requisitions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.requisitions TO anon;
GRANT ALL ON TABLE public.requisitions TO authenticated;
GRANT ALL ON TABLE public.requisitions TO service_role;


--
-- Name: SEQUENCE requisitions_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.requisitions_seq TO anon;
GRANT ALL ON SEQUENCE public.requisitions_seq TO authenticated;
GRANT ALL ON SEQUENCE public.requisitions_seq TO service_role;


--
-- Name: TABLE serial_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.serial_items TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.serial_items TO authenticated;
GRANT ALL ON TABLE public.serial_items TO service_role;


--
-- Name: TABLE sku_attribute_values; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sku_attribute_values TO anon;
GRANT ALL ON TABLE public.sku_attribute_values TO authenticated;
GRANT ALL ON TABLE public.sku_attribute_values TO service_role;


--
-- Name: TABLE sku_prices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sku_prices TO anon;
GRANT ALL ON TABLE public.sku_prices TO authenticated;
GRANT ALL ON TABLE public.sku_prices TO service_role;


--
-- Name: TABLE sku_transaction_units; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sku_transaction_units TO anon;
GRANT ALL ON TABLE public.sku_transaction_units TO authenticated;
GRANT ALL ON TABLE public.sku_transaction_units TO service_role;


--
-- Name: SEQUENCE skus_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.skus_seq TO anon;
GRANT ALL ON SEQUENCE public.skus_seq TO authenticated;
GRANT ALL ON SEQUENCE public.skus_seq TO service_role;


--
-- Name: TABLE stock_locations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stock_locations TO anon;
GRANT ALL ON TABLE public.stock_locations TO authenticated;
GRANT ALL ON TABLE public.stock_locations TO service_role;


--
-- Name: TABLE stock_movement_allocations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.stock_movement_allocations TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.stock_movement_allocations TO authenticated;
GRANT ALL ON TABLE public.stock_movement_allocations TO service_role;


--
-- Name: TABLE stock_movements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stock_movements TO anon;
GRANT ALL ON TABLE public.stock_movements TO authenticated;
GRANT ALL ON TABLE public.stock_movements TO service_role;


--
-- Name: TABLE stock_reservation_allocations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.stock_reservation_allocations TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.stock_reservation_allocations TO authenticated;
GRANT ALL ON TABLE public.stock_reservation_allocations TO service_role;


--
-- Name: TABLE stock_reservations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.stock_reservations TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.stock_reservations TO authenticated;
GRANT ALL ON TABLE public.stock_reservations TO service_role;


--
-- Name: TABLE stocktake_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stocktake_items TO anon;
GRANT ALL ON TABLE public.stocktake_items TO authenticated;
GRANT ALL ON TABLE public.stocktake_items TO service_role;


--
-- Name: SEQUENCE stocktake_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.stocktake_seq TO anon;
GRANT ALL ON SEQUENCE public.stocktake_seq TO authenticated;
GRANT ALL ON SEQUENCE public.stocktake_seq TO service_role;


--
-- Name: TABLE stocktake_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stocktake_sessions TO anon;
GRANT ALL ON TABLE public.stocktake_sessions TO authenticated;
GRANT ALL ON TABLE public.stocktake_sessions TO service_role;


--
-- Name: TABLE sub_zones; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sub_zones TO anon;
GRANT ALL ON TABLE public.sub_zones TO authenticated;
GRANT ALL ON TABLE public.sub_zones TO service_role;


--
-- Name: TABLE suppliers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.suppliers TO anon;
GRANT ALL ON TABLE public.suppliers TO authenticated;
GRANT ALL ON TABLE public.suppliers TO service_role;


--
-- Name: TABLE tool_borrowing_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tool_borrowing_items TO anon;
GRANT ALL ON TABLE public.tool_borrowing_items TO authenticated;
GRANT ALL ON TABLE public.tool_borrowing_items TO service_role;


--
-- Name: TABLE tool_borrowings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tool_borrowings TO anon;
GRANT ALL ON TABLE public.tool_borrowings TO authenticated;
GRANT ALL ON TABLE public.tool_borrowings TO service_role;


--
-- Name: SEQUENCE tool_borrowings_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.tool_borrowings_seq TO anon;
GRANT ALL ON SEQUENCE public.tool_borrowings_seq TO authenticated;
GRANT ALL ON SEQUENCE public.tool_borrowings_seq TO service_role;


--
-- Name: TABLE units; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.units TO anon;
GRANT ALL ON TABLE public.units TO authenticated;
GRANT ALL ON TABLE public.units TO service_role;


--
-- Name: TABLE sku_stock; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sku_stock TO anon;
GRANT ALL ON TABLE public.sku_stock TO authenticated;
GRANT ALL ON TABLE public.sku_stock TO service_role;


--
-- Name: TABLE vehicles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.vehicles TO anon;
GRANT ALL ON TABLE public.vehicles TO authenticated;
GRANT ALL ON TABLE public.vehicles TO service_role;


--
-- Name: TABLE zones; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.zones TO anon;
GRANT ALL ON TABLE public.zones TO authenticated;
GRANT ALL ON TABLE public.zones TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--




-- Storage buckets and policies used by active upload workflows.

-- Source contract: supabase/migrations/0024_storage.sql
-- 0024_storage.sql — bucket ảnh sản phẩm (public read, authenticated write)
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read"
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "product_images_auth_write" on storage.objects;
create policy "product_images_auth_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images');

-- Source contract: supabase/migrations/0030_defect_images.sql
-- 0030_defect_images.sql — bucket ảnh vật tư hỏng (public read, authenticated write)
insert into storage.buckets (id, name, public)
values ('defect-images', 'defect-images', true)
on conflict (id) do nothing;

drop policy if exists "defect_images_public_read" on storage.objects;
create policy "defect_images_public_read"
  on storage.objects for select
  using (bucket_id = 'defect-images');

drop policy if exists "defect_images_auth_write" on storage.objects;
create policy "defect_images_auth_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'defect-images');

-- Source contract: supabase/migrations/0039_category_icons.sql
-- 0039_category_icons.sql — bucket ảnh icon danh mục (public read, authenticated write)
insert into storage.buckets (id, name, public)
values ('category-icons', 'category-icons', true)
on conflict (id) do nothing;

drop policy if exists "category_icons_public_read" on storage.objects;
create policy "category_icons_public_read"
  on storage.objects for select
  using (bucket_id = 'category-icons');

drop policy if exists "category_icons_auth_write" on storage.objects;
create policy "category_icons_auth_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'category-icons');

-- Source contract: supabase/migrations/0054_receipt_invoice_images.sql
-- 0054_receipt_invoice_images.sql — Hỗ trợ tải ảnh hóa đơn / chứng từ mua hàng cho phiếu nhập kho

-- 1. Tạo storage bucket receipt-images
insert into storage.buckets (id, name, public)
values ('receipt-images', 'receipt-images', true)
on conflict (id) do nothing;

drop policy if exists "receipt_images_public_read" on storage.objects;
create policy "receipt_images_public_read"
  on storage.objects for select
  using (bucket_id = 'receipt-images');

drop policy if exists "receipt_images_auth_write" on storage.objects;
create policy "receipt_images_auth_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'receipt-images');

-- Source contract: supabase/migrations/0057_issue_invoice_images.sql
-- 0057_issue_invoice_images.sql — Hỗ trợ tải ảnh hóa đơn / chứng từ cho phiếu xuất kho
-- (giống 0054/0055 cho phiếu nhập: cột invoice_images + bucket riêng + RPC cập nhật bất kỳ lúc nào)

-- 1. Tạo storage bucket issue-images
insert into storage.buckets (id, name, public)
values ('issue-images', 'issue-images', true)
on conflict (id) do nothing;

drop policy if exists "issue_images_public_read" on storage.objects;
create policy "issue_images_public_read"
  on storage.objects for select
  using (bucket_id = 'issue-images');

drop policy if exists "issue_images_auth_write" on storage.objects;
create policy "issue_images_auth_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'issue-images');
