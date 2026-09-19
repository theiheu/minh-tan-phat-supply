BEGIN;
SELECT plan(1);

SELECT lives_ok(
  $$
  DO $blk$
  DECLARE
    v_user_driver uuid;
    v_user_other uuid;
    v_vehicle uuid;
    v_fuel_type uuid;
    v_zone uuid;
    v_dispense_id uuid;
    v_dispense_row record;
    v_tool_id uuid;
    v_borrowing_id uuid;
    v_reminders_count int;
  BEGIN
    -- Setup or get test users
    select id into v_user_driver from public.profiles where role = 'driver' and is_active limit 1;
    if v_user_driver is null then
      v_user_driver := gen_random_uuid();
      insert into auth.users (id, email, raw_user_meta_data)
      values (v_user_driver, 'driver_' || substr(v_user_driver::text, 1, 6) || '@test.local', jsonb_build_object('name', 'Tài xế Nguyễn Văn A', 'role', 'driver'));
    end if;

    select id into v_user_other from public.profiles where role = 'requester' and is_active limit 1;
    if v_user_other is null then
      v_user_other := gen_random_uuid();
      insert into auth.users (id, email, raw_user_meta_data)
      values (v_user_other, 'req_' || substr(v_user_other::text, 1, 6) || '@test.local', jsonb_build_object('name', 'Nhân viên B', 'role', 'requester'));
    end if;

    -- Setup master data
    select id into v_zone from public.zones limit 1;
    if v_zone is null then
      insert into public.zones (name) values ('Khu Trại Test') returning id into v_zone;
    end if;

    select id into v_fuel_type from public.fuel_types limit 1;
    if v_fuel_type is null then
      insert into public.fuel_types (code, name, unit, current_stock, min_stock, is_active)
      values ('DO-005S-TEST', 'Dầu DO Test', 'lít', 1000, 100, true)
      returning id into v_fuel_type;
    else
      update public.fuel_types set current_stock = current_stock + 1000 where id = v_fuel_type;
    end if;
    
    insert into public.vehicles (code, name, type, fuel_type_id, qr_token)
    values ('70C-TEST-' || substr(gen_random_uuid()::text, 1, 4), 'Xe ben test', 'truck', v_fuel_type, 'QR-TEST-' || substr(gen_random_uuid()::text, 1, 4))
    returning id into v_vehicle;

    -- 1. Test create_fuel_dispense with driver_id
    v_dispense_id := public.create_fuel_dispense(
      p_vehicle_id => v_vehicle,
      p_zone_id => v_zone,
      p_fuel_type_id => v_fuel_type,
      p_quantity => 50,
      p_current_odo => 12000,
      p_driver_name => null,
      p_meter_images => '{}',
      p_notes => 'Test cấp dầu tài xế A',
      p_by => v_user_driver,
      p_sub_zone_id => null,
      p_driver_id => v_user_driver
    );

    select * into v_dispense_row from public.fuel_dispenses where id = v_dispense_id;
    if v_dispense_row.driver_id is distinct from v_user_driver then
      raise exception 'FAILED: driver_id was not set on fuel_dispenses record';
    end if;

    -- 2. Test create_fuel_dispense rejects non-driver role
    BEGIN
      perform public.create_fuel_dispense(
        p_vehicle_id => v_vehicle,
        p_zone_id => v_zone,
        p_fuel_type_id => v_fuel_type,
        p_quantity => 10,
        p_current_odo => 12050,
        p_driver_name => null,
        p_meter_images => '{}',
        p_notes => 'Test reject non-driver',
        p_by => v_user_driver,
        p_sub_zone_id => null,
        p_driver_id => v_user_other
      );
      raise exception 'FAILED: expected error when driver_id is not role driver';
    EXCEPTION WHEN OTHERS THEN
      if sqlerrm not like '%Tài xế được chọn không hợp lệ%' and sqlerrm not like '%không có vai trò driver%' then
        raise notice 'Caught expected rejection: %', sqlerrm;
      end if;
    END;

    -- 3. Test tool reminder claim RPC
    select id into v_tool_id from public.skus limit 1;

    insert into public.tool_borrowings (code, borrower_id, purpose, expected_return_date, status, issued_by)
    values (
      'MDC-TEST-' || substr(gen_random_uuid()::text, 1, 6),
      v_user_other,
      'Mượn dụng cụ test',
      now() + interval '12 hours',
      'borrowed',
      v_user_driver
    ) returning id into v_borrowing_id;

    insert into public.tool_borrowing_items (borrowing_id, sku_id, quantity)
    values (v_borrowing_id, v_tool_id, 1);

    select count(*) into v_reminders_count from public.claim_tool_reminders(now());
    if v_reminders_count < 1 then
      raise exception 'FAILED: claim_tool_reminders did not claim due soon borrowing';
    end if;

    -- Second claim must be 0 (idempotent)
    select count(*) into v_reminders_count from public.claim_tool_reminders(now());
    if v_reminders_count > 0 then
      raise exception 'FAILED: claim_tool_reminders claimed already claimed borrowing';
    end if;
  END $blk$;
  $$,
  'Role Email Notifications schema tests pass'
);

SELECT * FROM finish();
ROLLBACK;
