BEGIN;
select plan(7);

DO $$
DECLARE
  v_user_id uuid := '00000000-0000-0000-0000-000000000001';
  v_unit_id uuid;
  v_cat_id uuid;
  v_prod_id uuid;
  v_sku_id uuid;
  v_req_id uuid;
  v_loc_id uuid;
BEGIN
  -- User & Profile
  insert into auth.users (id, email) values (v_user_id, 'wh@test.com') on conflict (id) do nothing;
  insert into public.profiles (id, username, name, role, is_active)
  values (v_user_id, 'wh_test', 'Thủ kho Test', 'warehouse', true)
  on conflict (id) do update set role = 'warehouse', is_active = true;

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);

  -- Location KHO_CHINH
  select id into v_loc_id from public.stock_locations where code = 'KHO_CHINH';
  if v_loc_id is null then
    insert into public.stock_locations(code, name, type) values ('KHO_CHINH', 'Kho Chính', 'main')
    returning id into v_loc_id;
  end if;

  -- Unit, Cat, Prod, SKU
  select id into v_unit_id from public.units limit 1;
  select id into v_cat_id from public.categories limit 1;
  
  insert into public.products(name, category_id) values ('Sản phẩm Test Return', v_cat_id)
  returning id into v_prod_id;

  insert into public.skus(product_id, sku_code, base_unit_id, inventory_policy)
  values (v_prod_id, 'SKU_TEST_RET_' || substr(gen_random_uuid()::text, 1, 8), v_unit_id, 'normal')
  returning id into v_sku_id;

  -- Requisition
  insert into public.requisitions(code, requester_id, purpose, status)
  values ('REQ_RET_' || substr(gen_random_uuid()::text, 1, 8), v_user_id, 'Mục đích test', 'issued')
  returning id into v_req_id;

  insert into public.requisition_items(requisition_id, sku_id, quantity)
  values (v_req_id, v_sku_id, 10);

  -- Store test variables in temporary table for pgTAP assertions
  create temp table _wp06_tmp (req_id uuid, sku_id uuid, user_id uuid);
  insert into _wp06_tmp values (v_req_id, v_sku_id, v_user_id);
END $$;

-- 1. Lỗi nếu operation_key missing
prepare do_return_missing as
  select public.return_requisition_items(
    (select req_id from _wp06_tmp),
    jsonb_build_array(jsonb_build_object('sku_id', (select sku_id from _wp06_tmp), 'quantity', 1)),
    (select user_id from _wp06_tmp),
    ''
  );
select throws_ok('do_return_missing', 'Operation key bắt buộc để đảm bảo idempotency', 'Ném lỗi nếu thiếu operation_key');

-- 2. Trả hàng lần đầu thành công
select lives_ok(
  $$ select public.return_requisition_items(
       (select req_id from _wp06_tmp),
       jsonb_build_array(jsonb_build_object('sku_id', (select sku_id from _wp06_tmp), 'quantity', 3)),
       (select user_id from _wp06_tmp),
       'op-key-1'
     ); $$,
  'Trả hàng lần 1'
);

-- 3. Số lượng trả lần đầu chạy đúng
select results_eq(
  $$ select quantity::int from public.requisition_return_items where return_id in (select id from public.requisition_returns where requisition_id = (select req_id from _wp06_tmp)) $$,
  $$ values(3::int) $$,
  'Số lượng trả lần đầu chạy đúng'
);

-- 4. Idempotent: Replay lần 1 không ném lỗi
select lives_ok(
  $$ select public.return_requisition_items(
       (select req_id from _wp06_tmp),
       jsonb_build_array(jsonb_build_object('sku_id', (select sku_id from _wp06_tmp), 'quantity', 3)),
       (select user_id from _wp06_tmp),
       'op-key-1'
     ); $$,
  'Idempotent: Replay lần 1'
);

-- 5. Idempotent: Không tạo thêm dòng requisition_returns
select results_eq(
  $$ select count(*)::int from public.requisition_returns where requisition_id = (select req_id from _wp06_tmp) $$,
  $$ values(1::int) $$,
  'Idempotent: Không nhân bản record return'
);

-- 6. Cùng key khác payload -> Lỗi conflict
prepare do_return_conflict as
  select public.return_requisition_items(
    (select req_id from _wp06_tmp),
    jsonb_build_array(jsonb_build_object('sku_id', (select sku_id from _wp06_tmp), 'quantity', 5)),
    (select user_id from _wp06_tmp),
    'op-key-1'
  );
select throws_ok('do_return_conflict', 'Conflict: Return operation key already used with different payload', 'Lỗi khi gửi trùng key nhưng khác payload');

-- 7. Khác key khác payload (thêm số lượng) -> OK
select lives_ok(
  $$ select public.return_requisition_items(
       (select req_id from _wp06_tmp),
       jsonb_build_array(jsonb_build_object('sku_id', (select sku_id from _wp06_tmp), 'quantity', 4)),
       (select user_id from _wp06_tmp),
       'op-key-2'
     ); $$,
  'Lần 2 khác key'
);

select * from finish();
ROLLBACK;
