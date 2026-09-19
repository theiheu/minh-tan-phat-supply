BEGIN;
SELECT plan(5);

DO $$
DECLARE
  v_movement_id uuid := gen_random_uuid();
  v_user_id uuid;
  v_sku_id uuid;
  v_loc_id uuid;
BEGIN
  select id into v_sku_id from public.skus limit 1;
  select id into v_loc_id from public.stock_locations limit 1;
  select id into v_user_id from public.profiles where role in ('warehouse', 'superuser') and is_active limit 1;

  -- Insert base movement
  insert into public.stock_movements (
    id, sku_id, from_location_id, to_location_id, quantity, base_quantity,
    entered_quantity, movement_type, ref_type, created_by, snapshot_quality
  ) values (
    v_movement_id, v_sku_id, v_loc_id, null, 10, 10,
    10, 'issue_out', 'test', v_user_id, 'complete'
  );

  create temp table _ledger_tmp (movement_id uuid, user_id uuid);
  insert into _ledger_tmp values (v_movement_id, v_user_id);
END $$;

-- 1. Base movement exists
select results_eq(
  $$ select count(*)::int from public.stock_movements where id = (select movement_id from _ledger_tmp) $$,
  $$ values(1::int) $$,
  'Base movement inserted'
);

-- 2. UPDATE rejected
prepare do_update_movement as
  update public.stock_movements set quantity = 20 where id = (select movement_id from _ledger_tmp);
select throws_matching(
  'do_update_movement',
  'append-only',
  'UPDATE rejected by append-only rule'
);

-- 3. DELETE rejected
prepare do_delete_movement as
  delete from public.stock_movements where id = (select movement_id from _ledger_tmp);
select throws_matching(
  'do_delete_movement',
  'append-only',
  'DELETE rejected by append-only rule'
);

-- 4. Reverse succeeds and double reverse fails
select lives_ok(
  $$ select public.reverse_inventory_movement(
       (select movement_id from _ledger_tmp),
       'Test reverse',
       (select user_id from _ledger_tmp)
     ); $$,
  'First reverse succeeds'
);

prepare do_double_reverse as
  select public.reverse_inventory_movement(
    (select movement_id from _ledger_tmp),
    'Double reverse',
    (select user_id from _ledger_tmp)
  );
select throws_matching(
  'do_double_reverse',
  'đã được đảo',
  'Double reverse rejected'
);

select * from finish();
ROLLBACK;
