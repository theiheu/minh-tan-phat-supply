-- =============================================================================
-- Migration 0101: Support fuel dispensing for entire zone (Cấp dầu cho toàn khu)
-- =============================================================================

-- 1. Add dispense_type column to fuel_dispenses
ALTER TABLE public.fuel_dispenses
  ADD COLUMN IF NOT EXISTS dispense_type text NOT NULL DEFAULT 'vehicle'
  CONSTRAINT fuel_dispenses_dispense_type_check CHECK (dispense_type IN ('vehicle', 'zone'));

CREATE INDEX IF NOT EXISTS idx_fuel_dispenses_dispense_type ON public.fuel_dispenses(dispense_type);

-- 2. Update get_vehicle_by_qr to return sub_zone_id, sub_zone_name and last dispense details
CREATE OR REPLACE FUNCTION public.get_vehicle_by_qr(p_qr_text text) RETURNS jsonb
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

  select v.*, z.name as zone_name, sz.name as sub_zone_name, ft.name as fuel_type_name, ft.code as fuel_type_code, ft.unit as fuel_unit
  into v_veh
  from public.vehicles v
  left join public.zones z on z.id = v.zone_id
  left join public.sub_zones sz on sz.id = v.sub_zone_id
  left join public.fuel_types ft on ft.id = v.fuel_type_id
  where v.qr_token = trim(p_qr_text)
     or upper(v.code) = upper(trim(p_qr_text))
  limit 1;

  if v_veh.id is null then
    return null;
  end if;

  select code, quantity, current_odo, consumption_rate, created_at, dispense_type
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
    'sub_zone_id', v_veh.sub_zone_id,
    'sub_zone_name', v_veh.sub_zone_name,
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
        'dispense_type', v_last_dispense.dispense_type,
        'created_at', v_last_dispense.created_at
      ) else null end
  );
end;
$$;

-- Drop existing create_fuel_dispense overloads to allow clean recreation
DROP FUNCTION IF EXISTS public.create_fuel_dispense(uuid, uuid, uuid, numeric, numeric, text, text[], text, uuid);
DROP FUNCTION IF EXISTS public.create_fuel_dispense(uuid, uuid, uuid, numeric, numeric, text, text[], text, uuid, uuid);
DROP FUNCTION IF EXISTS public.create_fuel_dispense(uuid, uuid, uuid, numeric, numeric, text, text[], text, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.create_fuel_dispense(uuid, uuid, uuid, numeric, numeric, text, text[], text, uuid, uuid, uuid, text);

-- 3. Canonical create_fuel_dispense stored procedure
CREATE OR REPLACE FUNCTION public.create_fuel_dispense(
  p_vehicle_id uuid,
  p_zone_id uuid,
  p_fuel_type_id uuid,
  p_quantity numeric,
  p_current_odo numeric,
  p_driver_name text,
  p_meter_images text[],
  p_notes text,
  p_by uuid,
  p_sub_zone_id uuid DEFAULT NULL::uuid,
  p_driver_id uuid DEFAULT NULL::uuid,
  p_dispense_type text DEFAULT 'vehicle'::text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
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
  v_driver_profile record;
  v_disp_type text := coalesce(nullif(trim(p_dispense_type), ''), 'vehicle');
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

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Số lượng cấp dầu phải lớn hơn 0';
  end if;

  if v_disp_type not in ('vehicle', 'zone') then
    v_disp_type := 'vehicle';
  end if;

  -- Xác thực tài khoản tài xế nếu có truyền driver_id
  if p_driver_id is not null then
    select id, name, role, is_active into v_driver_profile
    from public.profiles
    where id = p_driver_id;

    if v_driver_profile.id is null or v_driver_profile.is_active is not true or v_driver_profile.role != 'driver' then
      raise exception 'Tài xế được chọn không hợp lệ hoặc không có vai trò driver đang hoạt động';
    end if;

    v_driver := coalesce(nullif(trim(v_driver_profile.name), ''), nullif(trim(p_driver_name), ''));
  end if;

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

    -- Chỉ tính tiêu hao và cập nhật ODO nếu hình thức cấp là 'vehicle' (cấp trực tiếp cho xe)
    if v_disp_type = 'vehicle' then
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
    else
      -- Cấp cho khu: Xe chỉ là phương tiện lấy/chở dầu, không tính tiêu hao L/100km vào xe này
      v_usage_diff := null;
      v_rate := null;
    end if;
  end if;

  -- Xác định khu vực & người lái
  v_target_zone := coalesce(p_zone_id, v_vehicle_zone);
  v_target_sub_zone := coalesce(p_sub_zone_id, v_vehicle_sub_zone);
  v_driver := coalesce(v_driver, nullif(trim(p_driver_name), ''));

  if v_disp_type = 'zone' and v_target_zone is null then
    raise exception 'Vui lòng chọn khu vực nhận dầu';
  end if;

  v_code := public.next_code('CPD', 'public.fuel_dispenses_seq'::regclass);
  v_new_stock := v_cur_stock - p_quantity;

  -- Ghi nhận phiếu cấp phát
  insert into public.fuel_dispenses (
    code, vehicle_id, zone_id, sub_zone_id, fuel_type_id, quantity,
    previous_odo, current_odo, usage_diff, consumption_rate,
    driver_name, driver_id, dispenser_id, meter_images, notes, status,
    dispense_type
  ) values (
    v_code, p_vehicle_id, v_target_zone, v_target_sub_zone, p_fuel_type_id, p_quantity,
    case when v_disp_type = 'vehicle' then v_prev_odo else null end,
    case when v_disp_type = 'vehicle' then p_current_odo else null end,
    v_usage_diff, v_rate,
    v_driver, p_driver_id, p_by, coalesce(p_meter_images, '{}'), nullif(trim(p_notes), ''), 'completed',
    v_disp_type
  ) returning id into v_id;

  -- Ghi sổ cái
  insert into public.fuel_movements (
    fuel_type_id, movement_type, quantity, balance_after, ref_type, ref_id, notes, created_by
  ) values (
    p_fuel_type_id, 'dispense_out', p_quantity, v_new_stock, 'fuel_dispenses', v_id,
    'Cấp phát dầu: ' || v_code || (case when v_disp_type = 'zone' then ' (Cấp cho khu)' else ' (Cấp cho xe)' end),
    p_by
  );

  -- Cập nhật tồn kho loại dầu
  update public.fuel_types
  set current_stock = v_new_stock, updated_at = now()
  where id = p_fuel_type_id;

  -- Cập nhật ODO xe nếu có nhập ODO mới hợp lệ VÀ cấp cho xe (v_disp_type = 'vehicle')
  if v_disp_type = 'vehicle' and p_vehicle_id is not null and p_current_odo is not null and (v_prev_odo is null or p_current_odo >= v_prev_odo) then
    update public.vehicles
    set current_odo = p_current_odo, updated_at = now()
    where id = p_vehicle_id;
  end if;

  return v_id;
end;
$$;

-- Compatibility Overload: 9 parameters
CREATE OR REPLACE FUNCTION public.create_fuel_dispense(
  p_vehicle_id uuid,
  p_zone_id uuid,
  p_fuel_type_id uuid,
  p_quantity numeric,
  p_current_odo numeric,
  p_driver_name text,
  p_meter_images text[],
  p_notes text,
  p_by uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  return public.create_fuel_dispense(
    p_vehicle_id => p_vehicle_id,
    p_zone_id => p_zone_id,
    p_fuel_type_id => p_fuel_type_id,
    p_quantity => p_quantity,
    p_current_odo => p_current_odo,
    p_driver_name => p_driver_name,
    p_meter_images => p_meter_images,
    p_notes => p_notes,
    p_by => p_by,
    p_sub_zone_id => null,
    p_driver_id => null,
    p_dispense_type => 'vehicle'
  );
end;
$$;

-- Compatibility Overload: 10 parameters
CREATE OR REPLACE FUNCTION public.create_fuel_dispense(
  p_vehicle_id uuid,
  p_zone_id uuid,
  p_fuel_type_id uuid,
  p_quantity numeric,
  p_current_odo numeric,
  p_driver_name text,
  p_meter_images text[],
  p_notes text,
  p_by uuid,
  p_sub_zone_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  return public.create_fuel_dispense(
    p_vehicle_id => p_vehicle_id,
    p_zone_id => p_zone_id,
    p_fuel_type_id => p_fuel_type_id,
    p_quantity => p_quantity,
    p_current_odo => p_current_odo,
    p_driver_name => p_driver_name,
    p_meter_images => p_meter_images,
    p_notes => p_notes,
    p_by => p_by,
    p_sub_zone_id => p_sub_zone_id,
    p_driver_id => null,
    p_dispense_type => 'vehicle'
  );
end;
$$;

-- Compatibility Overload: 11 parameters
CREATE OR REPLACE FUNCTION public.create_fuel_dispense(
  p_vehicle_id uuid,
  p_zone_id uuid,
  p_fuel_type_id uuid,
  p_quantity numeric,
  p_current_odo numeric,
  p_driver_name text,
  p_meter_images text[],
  p_notes text,
  p_by uuid,
  p_sub_zone_id uuid,
  p_driver_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  return public.create_fuel_dispense(
    p_vehicle_id => p_vehicle_id,
    p_zone_id => p_zone_id,
    p_fuel_type_id => p_fuel_type_id,
    p_quantity => p_quantity,
    p_current_odo => p_current_odo,
    p_driver_name => p_driver_name,
    p_meter_images => p_meter_images,
    p_notes => p_notes,
    p_by => p_by,
    p_sub_zone_id => p_sub_zone_id,
    p_driver_id => p_driver_id,
    p_dispense_type => 'vehicle'
  );
end;
$$;

GRANT ALL ON FUNCTION public.create_fuel_dispense(uuid, uuid, uuid, numeric, numeric, text, text[], text, uuid, uuid, uuid, text) TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.create_fuel_dispense(uuid, uuid, uuid, numeric, numeric, text, text[], text, uuid, uuid, uuid) TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.create_fuel_dispense(uuid, uuid, uuid, numeric, numeric, text, text[], text, uuid, uuid) TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.create_fuel_dispense(uuid, uuid, uuid, numeric, numeric, text, text[], text, uuid) TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.get_vehicle_by_qr(text) TO anon, authenticated, service_role;
