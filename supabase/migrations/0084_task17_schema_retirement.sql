-- Task 17: Destructive schema retirement for Material Catalog Replacement
-- Drops legacy columns (products.options, variants.attributes, variants.unit, variants.is_trackable_lot),
-- drops legacy variant_components table and constraints/triggers/functions,
-- and recreates views (variant_stock, location_stock) and search/AI functions using normalized BOM and unit tables.

-- 1. Recreate views location_stock and variant_stock without variant_components / variants.unit
CREATE OR REPLACE VIEW public.variant_stock AS
SELECT
  v.id AS variant_id,
  v.product_id,
  v.min_stock,
  u.name AS unit,
  CASE
    WHEN v.inventory_policy = 'virtual_kit' AND bh.id IS NOT NULL AND bv.id IS NOT NULL THEN
      COALESCE((
        SELECT min(sb.quantity / greatest(bi.base_quantity, 0.000001))
        FROM public.bom_items bi
        JOIN public.stock_balances sb ON sb.variant_id = bi.component_sku_id
        JOIN public.stock_locations sl ON sl.id = sb.location_id AND sl.code = 'KHO_CHINH'
        WHERE bi.bom_version_id = bv.id
      ), 0)
    ELSE
      COALESCE((
        SELECT sb.quantity
        FROM public.stock_balances sb
        JOIN public.stock_locations sl ON sl.id = sb.location_id AND sl.code = 'KHO_CHINH'
        WHERE sb.variant_id = v.id
      ), 0)
  END AS quantity
FROM public.variants v
LEFT JOIN public.units u ON u.id = v.base_unit_id
LEFT JOIN public.bom_headers bh ON bh.sku_id = v.id
LEFT JOIN public.bom_versions bv ON bv.id = bh.active_version_id;

CREATE OR REPLACE VIEW public.location_stock AS
SELECT
  loc.location_id,
  v.id AS variant_id,
  v.product_id,
  CASE
    WHEN v.inventory_policy = 'virtual_kit' AND bh.id IS NOT NULL AND bv.id IS NOT NULL THEN
      COALESCE((
        SELECT min(sb.quantity / greatest(bi.base_quantity, 0.000001))
        FROM public.bom_items bi
        JOIN public.stock_balances sb ON sb.variant_id = bi.component_sku_id AND sb.location_id = loc.location_id
        WHERE bi.bom_version_id = bv.id
      ), 0)
    ELSE
      COALESCE((
        SELECT sb.quantity
        FROM public.stock_balances sb
        WHERE sb.variant_id = v.id AND sb.location_id = loc.location_id
      ), 0)
  END AS quantity
FROM public.variants v
LEFT JOIN public.bom_headers bh ON bh.sku_id = v.id
LEFT JOIN public.bom_versions bv ON bv.id = bh.active_version_id
CROSS JOIN (
  SELECT DISTINCT location_id FROM public.stock_balances
) loc;

-- 2. Update search_catalog and ai_get_stock_summary
CREATE OR REPLACE FUNCTION public.search_catalog(p_query text)
RETURNS TABLE (id uuid)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT DISTINCT p.id
  FROM public.products p
  LEFT JOIN public.variants v ON v.product_id = p.id
  LEFT JOIN public.sku_attribute_values sav ON sav.sku_id = v.id
  WHERE p.deleted_at IS NULL
    AND (
      p.name ILIKE '%' || p_query || '%'
      OR COALESCE(p.description, '') ILIKE '%' || p_query || '%'
      OR COALESCE(sav.text_value, '') ILIKE '%' || p_query || '%'
      OR COALESCE(sav.legacy_text_value, '') ILIKE '%' || p_query || '%'
      OR COALESCE(v.sku_code, '') ILIKE '%' || p_query || '%'
    )
  ORDER BY p.id;
$$;

CREATE OR REPLACE FUNCTION public.ai_get_stock_summary(
  p_query text DEFAULT NULL,
  p_location_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  product_id uuid,
  variant_id uuid,
  product_name text,
  category_name text,
  attributes jsonb,
  unit text,
  price numeric,
  min_stock integer,
  total_stock bigint,
  location_details text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    p.id AS product_id,
    v.id AS variant_id,
    p.name AS product_name,
    COALESCE(c.name, 'Chưa phân loại') AS category_name,
    COALESCE((
      SELECT jsonb_object_agg(ad.name, COALESCE(sav.text_value, sav.legacy_text_value, sav.numeric_value::text, ''))
      FROM public.sku_attribute_values sav
      JOIN public.attribute_definitions ad ON ad.id = sav.attribute_definition_id
      WHERE sav.sku_id = v.id
    ), '{}'::jsonb) AS attributes,
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
    ) AS location_details
  FROM public.products p
  LEFT JOIN public.categories c ON c.id = p.category_id
  JOIN public.variants v ON v.product_id = p.id
  LEFT JOIN public.units u ON u.id = v.base_unit_id
  LEFT JOIN public.stock_balances sb ON sb.variant_id = v.id
  LEFT JOIN public.stock_locations loc ON loc.id = sb.location_id
  WHERE p.deleted_at IS NULL
    AND (
      p_query IS NULL
      OR p.name ILIKE '%' || p_query || '%'
      OR COALESCE(p.description, '') ILIKE '%' || p_query || '%'
      OR COALESCE(v.sku_code, '') ILIKE '%' || p_query || '%'
      OR EXISTS (
        SELECT 1 FROM public.sku_attribute_values sav
        WHERE sav.sku_id = v.id
          AND (sav.text_value ILIKE '%' || p_query || '%' OR sav.legacy_text_value ILIKE '%' || p_query || '%')
      )
    )
    AND (p_location_id IS NULL OR sb.location_id = p_location_id)
  GROUP BY p.id, v.id, p.name, c.name, u.name, v.price, v.min_stock
  ORDER BY total_stock DESC, p.name ASC
  LIMIT p_limit;
$$;

-- 3. Drop legacy triggers & functions
DROP TRIGGER IF EXISTS trg_sync_legacy_product_attributes ON public.products;
DROP FUNCTION IF EXISTS public.sync_legacy_product_attributes();

DROP TRIGGER IF EXISTS trg_prepare_legacy_variant_catalog ON public.variants;
DROP FUNCTION IF EXISTS public.prepare_legacy_variant_catalog();

DROP TRIGGER IF EXISTS trg_sync_legacy_variant_children ON public.variants;
DROP FUNCTION IF EXISTS public.sync_legacy_variant_children();

DROP FUNCTION IF EXISTS public._effective_demand(uuid);
DROP FUNCTION IF EXISTS public._expand_variant_demand(jsonb);
DROP FUNCTION IF EXISTS public._validate_variant_attributes(text[], jsonb);

DROP INDEX IF EXISTS public.variants_product_attributes_unique;
DROP FUNCTION IF EXISTS public.canonical_variant_attributes(jsonb);

DROP FUNCTION IF EXISTS public.update_product_options(uuid, text[], text[], text[]);
DROP FUNCTION IF EXISTS public.create_variant_with_contract(uuid, jsonb, numeric, text, integer, boolean, text[]);
DROP FUNCTION IF EXISTS public.update_variant_with_contract(uuid, jsonb, numeric, text, integer, boolean, text[]);

-- 4. Drop legacy variant_components table & its objects
ALTER TABLE public.bom_items DROP CONSTRAINT IF EXISTS bom_items_legacy_component_id_fkey;
ALTER TABLE public.bom_items DROP COLUMN IF EXISTS legacy_component_id;

DROP TRIGGER IF EXISTS trg_check_variant_components_integrity ON public.variant_components;
DROP FUNCTION IF EXISTS public._check_variant_components_integrity();
DROP FUNCTION IF EXISTS public.save_variant_components(uuid, text, jsonb);

DROP POLICY IF EXISTS "variant_components_select" ON public.variant_components;
DROP POLICY IF EXISTS "variant_components_insert" ON public.variant_components;
DROP POLICY IF EXISTS "variant_components_update" ON public.variant_components;
DROP POLICY IF EXISTS "variant_components_delete" ON public.variant_components;

DROP TABLE IF EXISTS public.variant_components CASCADE;

-- 5. Drop legacy columns on products and variants
ALTER TABLE public.products DROP COLUMN IF EXISTS options;
ALTER TABLE public.variants DROP COLUMN IF EXISTS attributes;
ALTER TABLE public.variants DROP COLUMN IF EXISTS unit;
ALTER TABLE public.variants DROP COLUMN IF EXISTS is_trackable_lot;
