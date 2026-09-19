-- 0096_role_email_notifications.sql
-- Add driver linkage to fuel_dispenses, email delivery attempt tracking, and tool reminder claims.

-- 1. Add driver_id to fuel_dispenses
ALTER TABLE public.fuel_dispenses
  ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fuel_dispenses_driver_id ON public.fuel_dispenses(driver_id);

-- 2. Email delivery attempts ledger (for delivery status and idempotency)
CREATE TABLE IF NOT EXISTS public.email_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  event_key text NOT NULL,
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  recipient_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  template_kind text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_delivery_attempts_event ON public.email_delivery_attempts(event_key);
CREATE INDEX IF NOT EXISTS idx_email_delivery_attempts_recipient ON public.email_delivery_attempts(recipient_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_attempts_status ON public.email_delivery_attempts(status);

ALTER TABLE public.email_delivery_attempts ENABLE ROW LEVEL SECURITY;

-- Service role and superusers can read delivery logs
CREATE POLICY "service_role_all_delivery_attempts" ON public.email_delivery_attempts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "superusers_read_delivery_attempts" ON public.email_delivery_attempts
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superuser'));

-- 3. Tool reminder claims (durable idempotency for 24h due-soon and overdue notices)
CREATE TABLE IF NOT EXISTS public.tool_reminder_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  borrowing_id uuid NOT NULL REFERENCES public.tool_borrowings(id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (reminder_type IN ('due_soon', 'overdue')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_tool_reminder_claim UNIQUE (borrowing_id, reminder_type)
);

CREATE INDEX IF NOT EXISTS idx_tool_reminder_claims_borrowing ON public.tool_reminder_claims(borrowing_id);

ALTER TABLE public.tool_reminder_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_reminder_claims" ON public.tool_reminder_claims
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. RPC to claim tool reminders idempotently in one atomic batch
CREATE OR REPLACE FUNCTION public.claim_tool_reminders(p_now timestamptz DEFAULT now())
RETURNS TABLE (
  borrowing_id uuid,
  reminder_type text,
  code text,
  borrower_id uuid,
  tool_names text,
  expected_return_date timestamptz,
  overdue_days integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec record;
BEGIN
  -- A. Claim due_soon: status = 'borrowed', expected_return_date between p_now and (p_now + 24 hours), not yet claimed
  FOR v_rec IN
    SELECT
      tb.id AS b_id,
      tb.code AS b_code,
      tb.borrower_id AS b_borrower_id,
      coalesce(
        (SELECT string_agg(coalesce(p.name, s.sku_code), ', ')
         FROM public.tool_borrowing_items tbi
         LEFT JOIN public.skus s ON s.id = tbi.sku_id
         LEFT JOIN public.products p ON p.id = s.product_id
         WHERE tbi.borrowing_id = tb.id),
        tb.code
      ) AS b_tool_name,
      tb.expected_return_date AS b_expected_date
    FROM public.tool_borrowings tb
    WHERE tb.status = 'borrowed'
      AND tb.expected_return_date IS NOT NULL
      AND tb.expected_return_date > p_now
      AND tb.expected_return_date <= (p_now + interval '24 hours')
      AND NOT EXISTS (
        SELECT 1 FROM public.tool_reminder_claims trc
        WHERE trc.borrowing_id = tb.id AND trc.reminder_type = 'due_soon'
      )
    FOR UPDATE OF tb SKIP LOCKED
  LOOP
    INSERT INTO public.tool_reminder_claims (borrowing_id, reminder_type, claimed_at)
    VALUES (v_rec.b_id, 'due_soon', p_now)
    ON CONFLICT DO NOTHING;

    IF FOUND THEN
      borrowing_id := v_rec.b_id;
      reminder_type := 'due_soon';
      code := v_rec.b_code;
      borrower_id := v_rec.b_borrower_id;
      tool_names := v_rec.b_tool_name;
      expected_return_date := v_rec.b_expected_date;
      overdue_days := 0;
      RETURN NEXT;
    END IF;
  END LOOP;

  -- B. Claim overdue: status = 'borrowed', expected_return_date < p_now, not yet claimed
  FOR v_rec IN
    SELECT
      tb.id AS b_id,
      tb.code AS b_code,
      tb.borrower_id AS b_borrower_id,
      coalesce(
        (SELECT string_agg(coalesce(p.name, s.sku_code), ', ')
         FROM public.tool_borrowing_items tbi
         LEFT JOIN public.skus s ON s.id = tbi.sku_id
         LEFT JOIN public.products p ON p.id = s.product_id
         WHERE tbi.borrowing_id = tb.id),
        tb.code
      ) AS b_tool_name,
      tb.expected_return_date AS b_expected_date,
      greatest(1, ceil(extract(epoch from (p_now - tb.expected_return_date)) / 86400)::integer) AS b_overdue_days
    FROM public.tool_borrowings tb
    WHERE tb.status = 'borrowed'
      AND tb.expected_return_date IS NOT NULL
      AND tb.expected_return_date < p_now
      AND NOT EXISTS (
        SELECT 1 FROM public.tool_reminder_claims trc
        WHERE trc.borrowing_id = tb.id AND trc.reminder_type = 'overdue'
      )
    FOR UPDATE OF tb SKIP LOCKED
  LOOP
    INSERT INTO public.tool_reminder_claims (borrowing_id, reminder_type, claimed_at)
    VALUES (v_rec.b_id, 'overdue', p_now)
    ON CONFLICT DO NOTHING;

    IF FOUND THEN
      borrowing_id := v_rec.b_id;
      reminder_type := 'overdue';
      code := v_rec.b_code;
      borrower_id := v_rec.b_borrower_id;
      tool_names := v_rec.b_tool_name;
      expected_return_date := v_rec.b_expected_date;
      overdue_days := v_rec.b_overdue_days;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_tool_reminders(timestamptz) TO service_role;
REVOKE ALL ON FUNCTION public.claim_tool_reminders(timestamptz) FROM PUBLIC;

-- 5. Canonical create_fuel_dispense with driver_id support
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
  p_driver_id uuid DEFAULT NULL::uuid
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
  v_driver := coalesce(v_driver, nullif(trim(p_driver_name), ''));

  v_code := public.next_code('CPD', 'public.fuel_dispenses_seq'::regclass);
  v_new_stock := v_cur_stock - p_quantity;

  -- Ghi nhận phiếu cấp phát
  insert into public.fuel_dispenses (
    code, vehicle_id, zone_id, sub_zone_id, fuel_type_id, quantity,
    previous_odo, current_odo, usage_diff, consumption_rate,
    driver_name, driver_id, dispenser_id, meter_images, notes, status
  ) values (
    v_code, p_vehicle_id, v_target_zone, v_target_sub_zone, p_fuel_type_id, p_quantity,
    v_prev_odo, p_current_odo, v_usage_diff, v_rate,
    v_driver, p_driver_id, p_by, coalesce(p_meter_images, '{}'), nullif(trim(p_notes), ''), 'completed'
  ) returning id into v_id;

  -- Ghi sổ cái
  insert into public.fuel_movements (
    fuel_type_id, movement_type, quantity, balance_after, ref_type, ref_id, notes, created_by
  ) values (
    p_fuel_type_id, 'dispense_out', p_quantity, v_new_stock, 'fuel_dispenses', v_id,
    'Cấp phát dầu: ' || v_code, p_by
  );

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

-- Keep compatibility overload for 9-parameter call
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
    p_driver_id => null
  );
end;
$$;

GRANT ALL ON FUNCTION public.create_fuel_dispense(uuid, uuid, uuid, numeric, numeric, text, text[], text, uuid, uuid, uuid) TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.create_fuel_dispense(uuid, uuid, uuid, numeric, numeric, text, text[], text, uuid) TO anon, authenticated, service_role;
