-- 0078_sku_posting_rpcs.sql
-- Canonical posting kernel. ONE owner for every stock mutation.
--
-- Boundary rules for this phase (additive, before Task 13 cutover):
--   * Nothing in the current runtime calls these functions.
--   * EXECUTE is granted to service_role/postgres only. Task 13 grants it to
--     authenticated after consumers migrate and old writers are revoked.
--   * Old write paths (_move_stock, _revert_movements, adjust_stock,
--     transfer_stock, admin_purge_user_data) are intentionally untouched.
--   * enforce_movement_append_only() stays unattached.
--
-- Quantity convention:
--   quantity        = absolute magnitude (backward compatible with old readers)
--   base_quantity   = signed NET change to total on-hand in the SKU base UOM
--                     receipt +qty, issue -qty, transfer 0
--   Availability    = quantity - reserved_quantity (checked before every decrease)


-- Whole-command idempotency owner. One key represents one complete command,
-- including every movement in a multi-line kit/assembly transaction.
create table if not exists public.inventory_posting_commands (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  command_hash text not null,
  command_type text not null,
  command_payload jsonb not null,
  status text not null default 'processing' check (status in ('processing','completed','failed')),
  first_movement_id uuid references public.stock_movements(id),
  actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index if not exists stock_movements_one_reversal
  on public.stock_movements(reversal_of_movement_id)
  where reversal_of_movement_id is not null;

create table if not exists public.inventory_posting_command_movements (
  command_id uuid not null references public.inventory_posting_commands(id) on delete cascade,
  movement_id uuid not null unique references public.stock_movements(id),
  sequence_no integer not null check (sequence_no >= 0),
  primary key(command_id, sequence_no)
);
alter table public.inventory_posting_command_movements enable row level security;
drop policy if exists posting_command_movements_service_read on public.inventory_posting_command_movements;
create policy posting_command_movements_service_read
  on public.inventory_posting_command_movements for select to service_role using (true);
revoke insert,update,delete on public.inventory_posting_command_movements from public,anon,authenticated;


alter table public.inventory_posting_commands enable row level security;
drop policy if exists posting_commands_service_read on public.inventory_posting_commands;
create policy posting_commands_service_read on public.inventory_posting_commands
  for select to service_role using (true);

-- New owner tables are not directly writable by browser/authenticated clients.
-- All writes must pass the security-definer posting commands.
revoke insert, update, delete on public.inventory_lots from anon, authenticated;
revoke insert, update, delete on public.lot_stock_balances from anon, authenticated;
revoke insert, update, delete on public.serial_items from anon, authenticated;
revoke insert, update, delete on public.stock_movement_allocations from anon, authenticated;
revoke insert, update, delete on public.stock_reservations from anon, authenticated;
revoke insert, update, delete on public.stock_reservation_allocations from anon, authenticated;

-- ── Capability helpers (replace broad is_manager() for new operations) ─────
create or replace function public.can_post_inventory() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles
    where id=auth.uid() and is_active
      and role in ('superuser','owner','accountant','warehouse'));
$$;

create or replace function public.can_post_technician_inventory() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles
    where id=auth.uid() and is_active
      and role in ('superuser','owner','warehouse','technician'));
$$;

create or replace function public.can_approve_stocktake_adjustment() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles
    where id=auth.uid() and is_active
      and role in ('superuser','owner','accountant'));
$$;

create or replace function public.can_edit_bom() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles
    where id=auth.uid() and is_active
      and role in ('superuser','owner','warehouse','technician'));
$$;

create or replace function public.can_activate_bom() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles
    where id=auth.uid() and is_active
      and role in ('superuser','owner','warehouse'));
$$;


create or replace function public._posting_actor_has_role(p_actor uuid, p_roles text[])
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles
    where id=p_actor and is_active and role=any(p_roles));
$$;

-- ── Precision / validation helpers ────────────────────────────────────────
create or replace function public._posting_round_base(p_value numeric, p_scale smallint)
returns numeric language sql immutable as $$
  select round(p_value, p_scale);
$$;

create or replace function public._posting_resolve_unit(
  p_sku_id uuid, p_transaction_unit_id uuid, p_entered numeric
) returns table(
  unit_id uuid, factor numeric, entered_quantity numeric,
  base_quantity numeric, base_scale smallint,
  tracking_policy text, allow_fraction boolean
)
language plpgsql stable security definer set search_path=public as $$
declare
  v_sku public.variants%rowtype;
  v_base_scale smallint;
  v_tu public.sku_transaction_units%rowtype;
begin
  select * into v_sku from public.variants where id=p_sku_id;
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

-- ── Balance lock (deterministic, creates row when absent) ─────────────────
create or replace function public._posting_lock_balance(p_sku_id uuid, p_location_id uuid, p_base_unit_id uuid)
returns numeric
language plpgsql security definer set search_path=public as $$
declare v_qty numeric;
begin
  select quantity into v_qty from public.stock_balances
   where variant_id=p_sku_id and location_id=p_location_id for update;
  if found then return v_qty; end if;
  begin
    insert into public.stock_balances(variant_id,location_id,quantity,base_unit_id)
    values(p_sku_id,p_location_id,0,p_base_unit_id);
  exception when unique_violation then null;
  end;
  select quantity into v_qty from public.stock_balances
   where variant_id=p_sku_id and location_id=p_location_id for update;
  return coalesce(v_qty,0);
end $$;

-- ─ FEFO lot selection ────────────────────────────────────────────────────
create or replace function public._posting_pick_lots(p_sku_id uuid, p_location_id uuid, p_needed numeric)
returns table(lot_id uuid, take numeric)
language plpgsql security definer set search_path=public as $$
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


create or replace function public._posting_validate_operation_shape(p_type text,p_lines jsonb)
returns void language plpgsql immutable as $$
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

-- ── Generic posting command ───────────────────────────────────────────────
-- p_command = {
--   "document_type": "receipt"|"issue_envelope"...,
--   "document_id": uuid,
--   "idempotency_key": text,
--   "notes": text,
--   "lines": [{
--      "sku_id": uuid,
--      "from_location_id": uuid|null,
--      "to_location_id": uuid|null,
--      "entered_quantity": numeric,
--      "transaction_unit_id": uuid|null,
--      "unit_cost": numeric|null,
--      "source_line_id": uuid|null,
--      "allocations": [{"lot_id": uuid, "quantity": numeric}]|null
--   }]
-- }
create or replace function public._post_inventory_movement(p_command jsonb)
returns uuid
language plpgsql security definer set search_path=public as $$
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
    from keys k join public.variants v on v.id=k.sku_id
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
                           where variant_id=v_line_id
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
      id, variant_id, from_location_id, to_location_id, movement_type, quantity,
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
      (select name from public.products p join public.variants vv on vv.product_id=p.id where vv.id=v_line_id),
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
        where variant_id=v_line_id and location_id=(v_line->>'from_location_id')::uuid;
    end if;
    if nullif(v_line->>'to_location_id','') is not null then
      update public.stock_balances set quantity=quantity+v_base, updated_at=now()
        where variant_id=v_line_id and location_id=(v_line->>'to_location_id')::uuid;
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

-- Browser/authenticated wrapper. Runtime access remains revoked until Task 13.
create or replace function public.post_inventory_movement(p_command jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  return public._post_inventory_movement(p_command||jsonb_build_object('actor_id',auth.uid()));
end $$;

-- ─ Reversal ─────────────────────────────────────────────────────────────
create or replace function public.reverse_inventory_movement(p_movement_id uuid, p_reason text, p_actor uuid)
returns uuid
language plpgsql security definer set search_path=public as $$
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
    id, variant_id, from_location_id, to_location_id, movement_type, quantity,
    ref_type, ref_id, notes, created_by,
    base_unit_id, entered_quantity, transaction_unit_id, conversion_factor_snapshot,
    base_quantity, unit_cost, snapshot_quality, reversal_of_movement_id,
    sku_name_snapshot, uom_name_snapshot)
  values(
    v_new, v_src.variant_id, v_src.to_location_id, v_src.from_location_id,
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
    perform public._posting_lock_balance(v_src.variant_id,v_src.from_location_id,v_src.base_unit_id);
  end if;
  if v_src.to_location_id is not null then
    perform public._posting_lock_balance(v_src.variant_id,v_src.to_location_id,v_src.base_unit_id);
  end if;

  -- Undo the effect on the ORIGINAL source location, which lost stock.
  if v_src.from_location_id is not null then
    update public.stock_balances set quantity=quantity+v_src.quantity, updated_at=now()
      where variant_id=v_src.variant_id and location_id=v_src.from_location_id;
  end if;
  -- Undo the effect on the ORIGINAL destination location, which gained stock.
  if v_src.to_location_id is not null then
    if (select quantity from public.stock_balances
         where variant_id=v_src.variant_id and location_id=v_src.to_location_id) < v_src.quantity then
      raise exception 'Không thể đảo: tồn kho đích đã thay đổi, không đủ % để hoàn ngược', v_src.quantity;
    end if;
    update public.stock_balances set quantity=quantity-v_src.quantity, updated_at=now()
      where variant_id=v_src.variant_id and location_id=v_src.to_location_id;
  end if;

  return v_new;
end $$;


create or replace function public.reverse_inventory_command(p_idempotency_key text,p_reason text,p_actor uuid)
returns uuid[] language plpgsql security definer set search_path=public as $$
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

-- ── Reservations ──────────────────────────────────────────────────────────
create or replace function public.reserve_stock(p_command jsonb)
returns uuid
language plpgsql security definer set search_path=public as $$
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
    (select base_unit_id from public.variants where id=v_sku));

  select quantity - reserved_quantity into v_avail from public.stock_balances
    where variant_id=v_sku and location_id=v_loc for update;
  if coalesce(v_avail,0) < v_qty then
    raise exception 'Không đủ tồn khả dụng để giữ: khả dụng %, cần %', coalesce(v_avail,0), v_qty;
  end if;

  insert into public.stock_reservations(
    sku_id, location_id, source_document_type, source_document_id, source_document_line_id,
    base_unit_id, reserved_quantity, status, idempotency_key,command_hash)
  select v_sku, v_loc, p_command->>'source_document_type', (p_command->>'source_document_id')::uuid,
         nullif(p_command->>'source_document_line_id','')::uuid,
         (select base_unit_id from public.variants where id=v_sku),
         v_qty, 'active', nullif(p_command->>'idempotency_key',''),md5((p_command-'actor_id')::text)
  returning id into v_id;

  update public.stock_balances set reserved_quantity=reserved_quantity+v_qty, updated_at=now()
    where variant_id=v_sku and location_id=v_loc;

  return v_id;
end $$;

create or replace function public.release_reservation(p_reservation_id uuid, p_actor uuid)
returns void
language plpgsql security definer set search_path=public as $$
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
    where variant_id=v_r.sku_id and location_id=v_r.location_id;
  update public.stock_reservations set status='released', updated_at=now() where id=p_reservation_id;
end $$;

create or replace function public.consume_reservation(p_reservation_id uuid, p_quantity numeric, p_actor uuid)
returns void
language plpgsql security definer set search_path=public as $$
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
    where variant_id=v_r.sku_id and location_id=v_r.location_id;
end $$;

-- ── Virtual-kit issue (one level, locked BOM version) ─────────────────────
create or replace function public.post_virtual_kit_issue(
  p_kit_sku_id uuid, p_location_id uuid, p_kit_quantity numeric,
  p_bom_version_id uuid, p_document_id uuid, p_idempotency_key text, p_actor uuid)
returns uuid
language plpgsql security definer set search_path=public as $$
declare
  v_actor uuid := coalesce(auth.uid(),p_actor);
  v_header uuid; v_version uuid; v_lines jsonb := '[]'::jsonb;
  v_item record; v_kit public.variants%rowtype; v_req numeric;
begin
  if v_actor is null then raise exception 'Thiếu actor_id'; end if;
  if not public._posting_actor_has_role(v_actor,array['superuser','owner','accountant','warehouse']) then
    raise exception 'Actor không có quyền xuất bộ'; end if;
  if p_kit_quantity <= 0 then raise exception 'Số lượng bộ phải lớn hơn 0'; end if;

  select * into v_kit from public.variants where id=p_kit_sku_id;
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

-- ── Assembly / disassembly ────────────────────────────────────────────────
create or replace function public.post_assembly(
  p_kit_sku_id uuid, p_bom_version_id uuid, p_quantity numeric,
  p_component_location_id uuid, p_finished_location_id uuid,
  p_document_id uuid, p_idempotency_key text, p_actor uuid)
returns uuid
language plpgsql security definer set search_path=public as $$
declare v_actor uuid := coalesce(auth.uid(),p_actor); v_lines jsonb := '[]'::jsonb; v_item record; v_req numeric; v_header uuid;
begin
  if v_actor is null then raise exception 'Thiếu actor_id'; end if;
  if not public._posting_actor_has_role(v_actor,array['superuser','owner','warehouse']) then
    raise exception 'Actor không có quyền lắp ráp'; end if;
  if p_quantity <= 0 then raise exception 'Số lượng phải lớn hơn 0'; end if;
  if (select inventory_policy from public.variants where id=p_kit_sku_id) <> 'stocked_assembly' then
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



-- p_items = [{"component_sku_id":uuid,"recovered_quantity":n,
--             "damaged_quantity":n,"lost_quantity":n,
--             "recovery_location_id":uuid,"damaged_location_id":uuid|null}]
create or replace function public.post_disassembly(
  p_kit_sku_id uuid, p_bom_version_id uuid, p_quantity numeric,
  p_from_location_id uuid, p_items jsonb,
  p_document_id uuid, p_idempotency_key text, p_actor uuid)
returns uuid
language plpgsql security definer set search_path=public as $$
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
  if (select inventory_policy from public.variants where id=p_kit_sku_id) <> 'stocked_assembly' then
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



-- Atomic reserved issue: consumes reservation and posts against its locked SKU/location.
create or replace function public.post_reserved_issue(
  p_reservation_id uuid, p_quantity numeric, p_document_id uuid,
  p_allocations jsonb, p_idempotency_key text, p_actor uuid)
returns uuid language plpgsql security definer set search_path=public as $$
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
    where variant_id=v_r.sku_id and location_id=v_r.location_id;
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

-- Operation-specific wrappers. All validate a fixed document type and delegate to the kernel.
create or replace function public.post_receipt_command(p_command jsonb) returns uuid
language plpgsql security definer set search_path=public as $$ begin
  return public._post_inventory_movement(p_command||jsonb_build_object('document_type','receipt','actor_id',coalesce(auth.uid(),nullif(p_command->>'actor_id','')::uuid))); end $$;
create or replace function public.post_direct_issue_command(p_command jsonb) returns uuid
language plpgsql security definer set search_path=public as $$ begin
  return public._post_inventory_movement(p_command||jsonb_build_object('document_type','direct_issue','actor_id',coalesce(auth.uid(),nullif(p_command->>'actor_id','')::uuid))); end $$;
create or replace function public.post_transfer_command(p_command jsonb) returns uuid
language plpgsql security definer set search_path=public as $$ begin
  return public._post_inventory_movement(p_command||jsonb_build_object('document_type','transfer','actor_id',coalesce(auth.uid(),nullif(p_command->>'actor_id','')::uuid))); end $$;
create or replace function public.post_return_command(p_command jsonb) returns uuid
language plpgsql security definer set search_path=public as $$ begin
  return public._post_inventory_movement(p_command||jsonb_build_object('document_type','return','actor_id',coalesce(auth.uid(),nullif(p_command->>'actor_id','')::uuid))); end $$;
create or replace function public.post_defect_command(p_command jsonb) returns uuid
language plpgsql security definer set search_path=public as $$ declare v_actor uuid:=coalesce(auth.uid(),nullif(p_command->>'actor_id','')::uuid); begin
  if not public._posting_actor_has_role(v_actor,array['superuser','owner','warehouse','technician']) then raise exception 'Actor không có quyền chuyển kho hỏng'; end if;
  return public._post_inventory_movement(p_command||jsonb_build_object(
    'document_type','defect','actor_id',v_actor,'required_roles',jsonb_build_array('superuser','owner','warehouse','technician'))); end $$;
create or replace function public.post_repair_command(p_command jsonb) returns uuid
language plpgsql security definer set search_path=public as $$ declare v_actor uuid:=coalesce(auth.uid(),nullif(p_command->>'actor_id','')::uuid); begin
  if not public._posting_actor_has_role(v_actor,array['superuser','owner','warehouse','technician']) then raise exception 'Actor không có quyền chuyển sửa chữa'; end if;
  return public._post_inventory_movement(p_command||jsonb_build_object(
    'document_type','repair','actor_id',v_actor,'required_roles',jsonb_build_array('superuser','owner','warehouse','technician'))); end $$;
create or replace function public.post_liquidation_command(p_command jsonb) returns uuid
language plpgsql security definer set search_path=public as $$ declare v_actor uuid:=coalesce(auth.uid(),nullif(p_command->>'actor_id','')::uuid); begin
  if not public._posting_actor_has_role(v_actor,array['superuser','owner','warehouse']) then raise exception 'Actor không có quyền thanh lý'; end if;
  return public._post_inventory_movement(p_command||jsonb_build_object('document_type','liquidation','actor_id',v_actor,'required_roles',jsonb_build_array('superuser','owner','warehouse'))); end $$;
create or replace function public.post_stocktake_adjustment_command(p_command jsonb) returns uuid
language plpgsql security definer set search_path=public as $$ declare v_actor uuid:=coalesce(auth.uid(),nullif(p_command->>'actor_id','')::uuid); begin
  if not public._posting_actor_has_role(v_actor,array['superuser','owner','accountant']) then raise exception 'Actor không có quyền duyệt điều chỉnh kiểm kê'; end if;
  return public._post_inventory_movement(p_command||jsonb_build_object('document_type','stocktake_adjustment','actor_id',v_actor,'required_roles',jsonb_build_array('superuser','owner','accountant'))); end $$;


-- Remove pre-actor signatures if this migration is replayed over a rehearsal schema.
drop function if exists public.reverse_inventory_movement(uuid,text);
drop function if exists public.release_reservation(uuid);
drop function if exists public.consume_reservation(uuid,numeric);
drop function if exists public.post_virtual_kit_issue(uuid,uuid,numeric,uuid,uuid,text);
drop function if exists public.post_assembly(uuid,uuid,numeric,uuid,uuid,uuid,text);
drop function if exists public.post_disassembly(uuid,uuid,numeric,uuid,jsonb,uuid,text);
drop function if exists public.post_reserved_issue(uuid,numeric,uuid,jsonb,text);

-- ── Grants: NOT reachable by the old runtime yet ──────────────────────────
revoke all on function public.post_inventory_movement(jsonb) from public, anon, authenticated;
revoke all on function public._post_inventory_movement(jsonb) from public, anon, authenticated;
revoke all on function public.reverse_inventory_movement(uuid,text,uuid) from public, anon, authenticated;
revoke all on function public.reverse_inventory_command(text,text,uuid) from public,anon,authenticated;
revoke all on function public.reserve_stock(jsonb) from public, anon, authenticated;
revoke all on function public.release_reservation(uuid,uuid) from public, anon, authenticated;
revoke all on function public.consume_reservation(uuid,numeric,uuid) from public, anon, authenticated;
revoke all on function public.post_virtual_kit_issue(uuid,uuid,numeric,uuid,uuid,text,uuid) from public, anon, authenticated;
revoke all on function public.post_assembly(uuid,uuid,numeric,uuid,uuid,uuid,text,uuid) from public, anon, authenticated;
revoke all on function public.post_disassembly(uuid,uuid,numeric,uuid,jsonb,uuid,text,uuid) from public, anon, authenticated;
revoke all on function public._posting_resolve_unit(uuid,uuid,numeric) from public, anon, authenticated;
revoke all on function public._posting_lock_balance(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public._posting_pick_lots(uuid,uuid,numeric) from public, anon, authenticated;

grant execute on function public._post_inventory_movement(jsonb) to service_role;
grant execute on function public.post_inventory_movement(jsonb) to service_role;
grant execute on function public.reverse_inventory_movement(uuid,text,uuid) to service_role;
grant execute on function public.reverse_inventory_command(text,text,uuid) to service_role;
grant execute on function public.reserve_stock(jsonb) to service_role;
grant execute on function public.release_reservation(uuid,uuid) to service_role;
grant execute on function public.consume_reservation(uuid,numeric,uuid) to service_role;
grant execute on function public.post_virtual_kit_issue(uuid,uuid,numeric,uuid,uuid,text,uuid) to service_role;
grant execute on function public.post_assembly(uuid,uuid,numeric,uuid,uuid,uuid,text,uuid) to service_role;
grant execute on function public.post_disassembly(uuid,uuid,numeric,uuid,jsonb,uuid,text,uuid) to service_role;
revoke all on function public.post_reserved_issue(uuid,numeric,uuid,jsonb,text,uuid) from public, anon, authenticated;
revoke all on function public.post_receipt_command(jsonb) from public, anon, authenticated;
revoke all on function public.post_direct_issue_command(jsonb) from public, anon, authenticated;
revoke all on function public.post_transfer_command(jsonb) from public, anon, authenticated;
revoke all on function public.post_return_command(jsonb) from public, anon, authenticated;
revoke all on function public.post_defect_command(jsonb) from public, anon, authenticated;
revoke all on function public.post_repair_command(jsonb) from public, anon, authenticated;
revoke all on function public.post_liquidation_command(jsonb) from public, anon, authenticated;
revoke all on function public.post_stocktake_adjustment_command(jsonb) from public, anon, authenticated;
grant execute on function public.post_reserved_issue(uuid,numeric,uuid,jsonb,text,uuid) to service_role;
grant execute on function public.post_receipt_command(jsonb) to service_role;
grant execute on function public.post_direct_issue_command(jsonb) to service_role;
grant execute on function public.post_transfer_command(jsonb) to service_role;
grant execute on function public.post_return_command(jsonb) to service_role;
grant execute on function public.post_defect_command(jsonb) to service_role;
grant execute on function public.post_repair_command(jsonb) to service_role;
grant execute on function public.post_liquidation_command(jsonb) to service_role;
grant execute on function public.post_stocktake_adjustment_command(jsonb) to service_role;
revoke all on function public.post_reserved_issue(uuid,numeric,uuid,jsonb,text,uuid) from public,anon,authenticated;
revoke all on function public.reverse_inventory_movement(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.release_reservation(uuid,uuid) from public,anon,authenticated;
revoke all on function public.consume_reservation(uuid,numeric,uuid) from public,anon,authenticated;
revoke all on function public.post_virtual_kit_issue(uuid,uuid,numeric,uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.post_assembly(uuid,uuid,numeric,uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.post_disassembly(uuid,uuid,numeric,uuid,jsonb,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.reverse_inventory_command(text,text,uuid) from public,anon,authenticated;
grant execute on function public.post_reserved_issue(uuid,numeric,uuid,jsonb,text,uuid) to service_role;
grant execute on function public.reverse_inventory_movement(uuid,text,uuid) to service_role;
grant execute on function public.release_reservation(uuid,uuid) to service_role;
grant execute on function public.consume_reservation(uuid,numeric,uuid) to service_role;
grant execute on function public.post_virtual_kit_issue(uuid,uuid,numeric,uuid,uuid,text,uuid) to service_role;
grant execute on function public.post_assembly(uuid,uuid,numeric,uuid,uuid,uuid,text,uuid) to service_role;
grant execute on function public.post_disassembly(uuid,uuid,numeric,uuid,jsonb,uuid,text,uuid) to service_role;
grant execute on function public.reverse_inventory_command(text,text,uuid) to service_role;
