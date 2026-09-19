BEGIN;
SELECT plan(1);

SELECT lives_ok(
  $$
  DO $blk$ 
  DECLARE
    v_supplier uuid;
    v_uom_thung uuid;
    v_uom_hop uuid;
    v_cat uuid;
    v_product uuid;
    v_sku uuid;
    v_tu_thung uuid;
    v_receipt uuid;
    v_by uuid;
    v_lot uuid;
    v_lines jsonb;
  BEGIN
    select id into v_by from public.profiles where role = 'warehouse' and is_active limit 1;
    perform set_config('request.jwt.claim.sub', v_by::text, true);

    -- Master data
    select id into v_supplier from public.suppliers limit 1;
    if v_supplier is null then
      insert into public.suppliers(name) values('Nhà cung cấp Test') returning id into v_supplier;
    end if;

    insert into public.units(code, name, symbol, dimension)
    values('thung_test_' || substr(gen_random_uuid()::text, 1, 6), 'Thùng', 'thung', 'package')
    returning id into v_uom_thung;

    insert into public.units(code, name, symbol, dimension)
    values('hop_test_' || substr(gen_random_uuid()::text, 1, 6), 'Hộp', 'hop', 'package')
    returning id into v_uom_hop;

    select id into v_cat from public.categories limit 1;
    
    insert into public.products(name, category_id) values('Sản phẩm Test Lot', v_cat) returning id into v_product;

    insert into public.skus(product_id, base_unit_id, sku_code, tracking_policy)
    values(v_product, v_uom_hop, 'SKU_LOT_' || substr(gen_random_uuid()::text, 1, 6), 'lot')
    returning id into v_sku;

    insert into public.sku_transaction_units(sku_id, unit_id, code, display_name, factor_to_base)
    values(v_sku, v_uom_thung, 'thung', 'Thùng', 12)
    returning id into v_tu_thung;

    -- 1. Receipt with factor 12, entered 2 => base 24
    v_lines := jsonb_build_array(
      jsonb_build_object(
        'sku_id', v_sku,
        'entered_quantity', 2,
        'transaction_unit_id', v_tu_thung,
        'unit_cost', 100,
        'allocations', jsonb_build_array(
           jsonb_build_object('lot_number', 'L1', 'quantity', 2)
        )
      )
    );

    select public.create_receipt(v_lines, v_supplier, v_by) into v_receipt;
    
    -- Approve and post
    update public.receipts set status = 'approved' where id = v_receipt;
    perform public.post_receipt(v_receipt, v_by);

    -- Verification: Check stock_movement_allocations has base quantity 24
    select l.id into v_lot from public.inventory_lots l where l.sku_id = v_sku and l.lot_number = 'L1';
    IF v_lot IS NULL THEN raise exception 'Missing lot'; END IF;

    IF NOT EXISTS (
      select 1 from public.stock_movement_allocations sma
      join public.stock_movements sm on sm.id = sma.movement_id
      where sm.ref_id = v_receipt and sma.base_quantity = 24 and sma.lot_id = v_lot
    ) THEN
      raise exception 'Allocation not set to 24!';
    END IF;
  END $blk$;
  $$,
  'Test WP-05: Receipt lot base quantity properly calculated as 24'
);

SELECT * FROM finish();
ROLLBACK;
