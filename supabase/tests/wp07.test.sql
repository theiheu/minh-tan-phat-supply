BEGIN;
SELECT plan(1);

SELECT lives_ok(
  $$
  DO $blk$
  DECLARE
    v_product_id uuid := gen_random_uuid();
    v_sku_kit uuid := gen_random_uuid();
    v_sku_comp1 uuid := gen_random_uuid();
    v_sku_comp2 uuid := gen_random_uuid();
    v_bom_header uuid := gen_random_uuid();
    v_bom_version uuid := gen_random_uuid();
    v_loc1 uuid;
    v_loc2 uuid := gen_random_uuid();
    v_unit uuid := gen_random_uuid();
    v_res numeric;
  BEGIN
    -- Setup units and locations
    INSERT INTO public.units (id, code, name, symbol, dimension) VALUES (v_unit, 'cai_test_wp07_' || substr(gen_random_uuid()::text, 1, 6), 'Cai', 'cai', 'count');
    
    SELECT id INTO v_loc1 FROM public.stock_locations WHERE code = 'KHO_CHINH' LIMIT 1;
    IF v_loc1 IS NULL THEN
      v_loc1 := gen_random_uuid();
      INSERT INTO public.stock_locations (id, code, name) VALUES (v_loc1, 'KHO_CHINH', 'Kho Chinh');
    END IF;

    INSERT INTO public.stock_locations (id, code, name) VALUES (v_loc2, 'KHO_PHU_TEST_' || substr(gen_random_uuid()::text, 1, 6), 'Kho Phu');

    -- Setup Dummy Product
    INSERT INTO public.products (id, name) VALUES (v_product_id, 'Prod Prod WP07');

    -- Setup SKUs
    INSERT INTO public.skus (id, product_id, sku_code, base_unit_id, inventory_policy)
    VALUES
      (v_sku_kit, v_product_id, 'KIT_WP07_' || substr(gen_random_uuid()::text, 1, 6), v_unit, 'virtual_kit'),
      (v_sku_comp1, v_product_id, 'COMP1_WP07_' || substr(gen_random_uuid()::text, 1, 6), v_unit, 'normal'),
      (v_sku_comp2, v_product_id, 'COMP2_WP07_' || substr(gen_random_uuid()::text, 1, 6), v_unit, 'normal');

    -- Setup BOM
    INSERT INTO public.bom_headers (id, sku_id, inventory_policy, active_version_id) VALUES (v_bom_header, v_sku_kit, 'virtual_kit', null);
    INSERT INTO public.bom_versions (id, bom_header_id, version_number, status, effective_period) VALUES (v_bom_version, v_bom_header, 1, 'active', tstzrange(now() - interval '1 day', null));
    UPDATE public.bom_headers SET active_version_id = v_bom_version WHERE id = v_bom_header;

    INSERT INTO public.bom_items (id, bom_version_id, component_sku_id, base_quantity) 
    VALUES 
      (gen_random_uuid(), v_bom_version, v_sku_comp1, 2.5),
      (gen_random_uuid(), v_bom_version, v_sku_comp2, 1.0);

    -- Test 1: Missing row in KHO_CHINH for COMP2
    INSERT INTO public.stock_balances (sku_id, location_id, quantity, reserved_quantity) VALUES (v_sku_comp1, v_loc1, 10, 0);
    
    SELECT quantity INTO v_res FROM public.sku_stock WHERE sku_id = v_sku_kit;
    IF v_res <> 0 THEN
      RAISE EXCEPTION 'Expected missing balance row to result in kit = 0, got %', v_res;
    END IF;

    -- Test 2: Balance inserted for COMP2, calculate FLOOR
    INSERT INTO public.stock_balances (sku_id, location_id, quantity, reserved_quantity) VALUES (v_sku_comp2, v_loc1, 5, 0);
    SELECT quantity INTO v_res FROM public.sku_stock WHERE sku_id = v_sku_kit;
    IF v_res <> 4 THEN
      RAISE EXCEPTION 'Expected kit to be 4 from baseline stock, got %', v_res;
    END IF;

    -- Test 3: Reserved quantity
    UPDATE public.stock_balances SET reserved_quantity = 5 WHERE sku_id = v_sku_comp1 AND location_id = v_loc1;
    SELECT quantity INTO v_res FROM public.sku_stock WHERE sku_id = v_sku_kit;
    IF v_res <> 2 THEN
      RAISE EXCEPTION 'Expected kit to be 2 after reserving stock, got %', v_res;
    END IF;

    -- Test 4: Multiple locations in location_stock
    INSERT INTO public.stock_balances (sku_id, location_id, quantity, reserved_quantity) VALUES 
      (v_sku_comp1, v_loc2, 10, 0),
      (v_sku_comp2, v_loc2, 3, 0);
    
    SELECT quantity INTO v_res FROM public.location_stock WHERE sku_id = v_sku_kit AND location_id = v_loc2;
    IF v_res <> 3 THEN
      RAISE EXCEPTION 'Expected kit in loc2 to be 3, got %', v_res;
    END IF;
  END $blk$;
  $$,
  'All virtual-kit availability tests pass'
);

SELECT * FROM finish();
ROLLBACK;
