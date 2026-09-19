BEGIN;
SELECT plan(1);

SELECT lives_ok(
  $$
  DO $blk$
  DECLARE
    v_user_id uuid;
    v_sku_id uuid;
    v_receipt_id uuid;
    v_outcome jsonb;
  BEGIN
    select id into v_user_id from public.profiles where role = 'warehouse' and is_active limit 1;
    perform set_config('request.jwt.claim.sub', v_user_id::text, true);

    select id into v_sku_id from public.skus limit 1;

    -- Create receipt
    v_receipt_id := gen_random_uuid();
    insert into public.receipts (id, code, status, created_by)
    values (v_receipt_id, 'PNK-TEST-' || substr(gen_random_uuid()::text, 1, 8), 'approved', v_user_id);

    insert into public.receipt_items (receipt_id, sku_id, quantity, unit_cost)
    values (v_receipt_id, v_sku_id, 10, 50000);

    -- Execute post_receipt
    v_outcome := public.post_receipt(v_receipt_id, v_user_id);

    if not (v_outcome ? 'linked') or not (v_outcome ? 'skipped') or not (v_outcome ? 'failed') then
      raise exception 'Outcome missing required keys: %', v_outcome;
    end if;
  END $blk$;
  $$,
  'post_receipt returns outcome with linked, skipped, failed'
);

SELECT * FROM finish();
ROLLBACK;
