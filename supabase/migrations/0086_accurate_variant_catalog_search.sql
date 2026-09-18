-- 0086_accurate_variant_catalog_search.sql
-- Cải tiến toàn diện chức năng tìm kiếm danh mục và biến thể vật tư (Accurate Multi-token & Variant Search)
-- Hỗ trợ:
-- 1. Tìm kiếm không dấu / có dấu tiếng Việt (Unaccent)
-- 2. Tìm kiếm tổ hợp từ khóa (Tên sản phẩm + Thuộc tính biến thể, ví dụ: 'CB tép 20A', 'Bạc đạn 6203 SKF')
-- 3. Tìm kiếm theo mã SKU, Barcode, Danh mục, Từ khóa tùy chỉnh, Đơn vị tính
-- 4. Khớp chính xác cả option_value, text_value, numeric_value, legacy_text_value

CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.unaccent_text(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT extensions.unaccent('extensions.unaccent', COALESCE(p_text, ''));
$$;

-- 1. Hàm tìm kiếm sản phẩm: search_catalog(p_query text) -> Trả về ID các sản phẩm phù hợp
CREATE OR REPLACE FUNCTION public.search_catalog(p_query text)
RETURNS TABLE (id uuid)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH query_tokens AS (
    SELECT array_agg(DISTINCT t) AS tokens
    FROM unnest(regexp_split_to_array(public.unaccent_text(lower(trim(COALESCE(p_query, '')))), '[[:space:]]+')) t
    WHERE length(t) > 0
  ),
  variant_attrs AS (
    SELECT
      sav.sku_id,
      string_agg(
        COALESCE(sav.text_value, '') || ' ' ||
        COALESCE(sav.legacy_text_value, '') || ' ' ||
        COALESCE(sav.numeric_value::text, '') || ' ' ||
        COALESCE(aov.label, '') || ' ' ||
        COALESCE(aov.code, '') || ' ' ||
        COALESCE(ad.name, '') || ' ' ||
        COALESCE(u.symbol, '') || ' ' ||
        COALESCE(u.name, ''),
        ' '
      ) AS attr_text
    FROM public.sku_attribute_values sav
    LEFT JOIN public.attribute_definitions ad ON ad.id = sav.attribute_definition_id
    LEFT JOIN public.attribute_option_values aov ON aov.id = sav.option_value_id
    LEFT JOIN public.units u ON u.id = sav.unit_id
    GROUP BY sav.sku_id
  ),
  variant_barcodes AS (
    SELECT
      br.sku_id,
      string_agg(br.barcode, ' ') AS barcode_text
    FROM public.barcode_registry br
    WHERE br.is_active = true
    GROUP BY br.sku_id
  ),
  variant_uoms AS (
    SELECT
      stu.sku_id,
      string_agg(stu.code || ' ' || stu.display_name, ' ') AS uom_text
    FROM public.sku_transaction_units stu
    WHERE stu.is_active = true
    GROUP BY stu.sku_id
  ),
  item_pool AS (
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      public.unaccent_text(
        lower(
          p.name || ' ' ||
          COALESCE(c.name, '') || ' ' ||
          COALESCE(array_to_string(p.search_keywords, ' '), '') || ' ' ||
          COALESCE(p.description, '') || ' ' ||
          COALESCE(v.sku_code, '') || ' ' ||
          COALESCE(vu.symbol, '') || ' ' ||
          COALESCE(vu.name, '') || ' ' ||
          COALESCE(va.attr_text, '') || ' ' ||
          COALESCE(vb.barcode_text, '') || ' ' ||
          COALESCE(vuom.uom_text, '')
        )
      ) AS search_text,
      -- Điểm số ưu tiên sắp xếp
      CASE
        WHEN lower(p.name) = lower(trim(p_query)) THEN 100
        WHEN public.unaccent_text(lower(p.name)) = public.unaccent_text(lower(trim(p_query))) THEN 90
        WHEN lower(p.name) LIKE lower(trim(p_query)) || '%' THEN 80
        WHEN public.unaccent_text(lower(p.name)) LIKE public.unaccent_text(lower(trim(p_query))) || '%' THEN 70
        WHEN lower(p.name) LIKE '%' || lower(trim(p_query)) || '%' THEN 60
        WHEN public.unaccent_text(lower(p.name)) LIKE '%' || public.unaccent_text(lower(trim(p_query))) || '%' THEN 50
        WHEN lower(COALESCE(v.sku_code, '')) = lower(trim(p_query)) THEN 45
        ELSE 10
      END AS score
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    LEFT JOIN public.variants v ON v.product_id = p.id AND v.sku_status != 'inactive'
    LEFT JOIN public.units vu ON vu.id = v.base_unit_id
    LEFT JOIN variant_attrs va ON va.sku_id = v.id
    LEFT JOIN variant_barcodes vb ON vb.sku_id = v.id
    LEFT JOIN variant_uoms vuom ON vuom.sku_id = v.id
    WHERE p.deleted_at IS NULL
  ),
  matched AS (
    SELECT
      ip.product_id,
      MAX(ip.score) AS max_score,
      MIN(ip.product_name) AS sort_name
    FROM item_pool ip, query_tokens qt
    WHERE cardinality(qt.tokens) IS NULL OR cardinality(qt.tokens) = 0 OR NOT EXISTS (
      SELECT 1
      FROM unnest(qt.tokens) tok
      WHERE ip.search_text NOT LIKE '%' || tok || '%'
    )
    GROUP BY ip.product_id
  )
  SELECT m.product_id AS id
  FROM matched m
  ORDER BY m.max_score DESC, m.sort_name ASC;
$$;

-- 2. Hàm tìm kiếm biến thể (SKU): search_skus(p_query text, p_limit integer) -> Trả về danh sách SKU_ID và PRODUCT_ID
CREATE OR REPLACE FUNCTION public.search_skus(p_query text, p_limit integer DEFAULT 50)
RETURNS TABLE (sku_id uuid, product_id uuid)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH query_tokens AS (
    SELECT array_agg(DISTINCT t) AS tokens
    FROM unnest(regexp_split_to_array(public.unaccent_text(lower(trim(COALESCE(p_query, '')))), '[[:space:]]+')) t
    WHERE length(t) > 0
  ),
  variant_attrs AS (
    SELECT
      sav.sku_id,
      string_agg(
        COALESCE(sav.text_value, '') || ' ' ||
        COALESCE(sav.legacy_text_value, '') || ' ' ||
        COALESCE(sav.numeric_value::text, '') || ' ' ||
        COALESCE(aov.label, '') || ' ' ||
        COALESCE(aov.code, '') || ' ' ||
        COALESCE(ad.name, '') || ' ' ||
        COALESCE(u.symbol, '') || ' ' ||
        COALESCE(u.name, ''),
        ' '
      ) AS attr_text
    FROM public.sku_attribute_values sav
    LEFT JOIN public.attribute_definitions ad ON ad.id = sav.attribute_definition_id
    LEFT JOIN public.attribute_option_values aov ON aov.id = sav.option_value_id
    LEFT JOIN public.units u ON u.id = sav.unit_id
    GROUP BY sav.sku_id
  ),
  variant_barcodes AS (
    SELECT
      br.sku_id,
      string_agg(br.barcode, ' ') AS barcode_text
    FROM public.barcode_registry br
    WHERE br.is_active = true
    GROUP BY br.sku_id
  ),
  variant_uoms AS (
    SELECT
      stu.sku_id,
      string_agg(stu.code || ' ' || stu.display_name, ' ') AS uom_text
    FROM public.sku_transaction_units stu
    WHERE stu.is_active = true
    GROUP BY stu.sku_id
  ),
  sku_pool AS (
    SELECT
      v.id AS sku_id,
      p.id AS product_id,
      p.name AS product_name,
      v.sku_code,
      public.unaccent_text(
        lower(
          p.name || ' ' ||
          COALESCE(c.name, '') || ' ' ||
          COALESCE(array_to_string(p.search_keywords, ' '), '') || ' ' ||
          COALESCE(p.description, '') || ' ' ||
          COALESCE(v.sku_code, '') || ' ' ||
          COALESCE(vu.symbol, '') || ' ' ||
          COALESCE(vu.name, '') || ' ' ||
          COALESCE(va.attr_text, '') || ' ' ||
          COALESCE(vb.barcode_text, '') || ' ' ||
          COALESCE(vuom.uom_text, '')
        )
      ) AS search_text,
      -- Điểm số ưu tiên sắp xếp
      CASE
        WHEN lower(COALESCE(v.sku_code, '')) = lower(trim(p_query)) THEN 100
        WHEN vb.barcode_text ILIKE '%' || trim(p_query) || '%' THEN 95
        WHEN lower(p.name) = lower(trim(p_query)) THEN 90
        WHEN public.unaccent_text(lower(p.name)) = public.unaccent_text(lower(trim(p_query))) THEN 85
        WHEN lower(p.name) LIKE lower(trim(p_query)) || '%' THEN 80
        WHEN public.unaccent_text(lower(p.name)) LIKE public.unaccent_text(lower(trim(p_query))) || '%' THEN 70
        WHEN va.attr_text ILIKE '%' || trim(p_query) || '%' THEN 65
        WHEN public.unaccent_text(lower(va.attr_text)) LIKE '%' || public.unaccent_text(lower(trim(p_query))) || '%' THEN 60
        WHEN lower(p.name) LIKE '%' || lower(trim(p_query)) || '%' THEN 50
        ELSE 20
      END AS score
    FROM public.variants v
    JOIN public.products p ON p.id = v.product_id
    LEFT JOIN public.categories c ON c.id = p.category_id
    LEFT JOIN public.units vu ON vu.id = v.base_unit_id
    LEFT JOIN variant_attrs va ON va.sku_id = v.id
    LEFT JOIN variant_barcodes vb ON vb.sku_id = v.id
    LEFT JOIN variant_uoms vuom ON vuom.sku_id = v.id
    WHERE p.deleted_at IS NULL AND v.sku_status = 'active'
  )
  SELECT
    sp.sku_id,
    sp.product_id
  FROM sku_pool sp, query_tokens qt
  WHERE cardinality(qt.tokens) IS NULL OR cardinality(qt.tokens) = 0 OR NOT EXISTS (
    SELECT 1
    FROM unnest(qt.tokens) tok
    WHERE sp.search_text NOT LIKE '%' || tok || '%'
  )
  ORDER BY sp.score DESC, sp.product_name ASC, sp.sku_code ASC
  LIMIT COALESCE(p_limit, 50);
$$;

-- 3. Cập nhật hàm ai_get_stock_summary hỗ trợ tìm kiếm đa từ khóa & biến thể
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
  WITH query_tokens AS (
    SELECT array_agg(DISTINCT t) AS tokens
    FROM unnest(regexp_split_to_array(public.unaccent_text(lower(trim(COALESCE(p_query, '')))), '[[:space:]]+')) t
    WHERE length(t) > 0
  ),
  variant_attrs AS (
    SELECT
      sav.sku_id,
      jsonb_object_agg(
        ad.name,
        COALESCE(sav.text_value, aov.label, sav.legacy_text_value, sav.numeric_value::text, '')
      ) AS attributes_json,
      string_agg(
        COALESCE(sav.text_value, '') || ' ' ||
        COALESCE(sav.legacy_text_value, '') || ' ' ||
        COALESCE(sav.numeric_value::text, '') || ' ' ||
        COALESCE(aov.label, '') || ' ' ||
        COALESCE(aov.code, '') || ' ' ||
        COALESCE(ad.name, '') || ' ' ||
        COALESCE(u.symbol, '') || ' ' ||
        COALESCE(u.name, ''),
        ' '
      ) AS attr_text
    FROM public.sku_attribute_values sav
    LEFT JOIN public.attribute_definitions ad ON ad.id = sav.attribute_definition_id
    LEFT JOIN public.attribute_option_values aov ON aov.id = sav.option_value_id
    LEFT JOIN public.units u ON u.id = sav.unit_id
    GROUP BY sav.sku_id
  ),
  variant_barcodes AS (
    SELECT
      br.sku_id,
      string_agg(br.barcode, ' ') AS barcode_text
    FROM public.barcode_registry br
    WHERE br.is_active = true
    GROUP BY br.sku_id
  ),
  variant_uoms AS (
    SELECT
      stu.sku_id,
      string_agg(stu.code || ' ' || stu.display_name, ' ') AS uom_text
    FROM public.sku_transaction_units stu
    WHERE stu.is_active = true
    GROUP BY stu.sku_id
  ),
  sku_pool AS (
    SELECT
      p.id AS product_id,
      v.id AS variant_id,
      p.name AS product_name,
      COALESCE(c.name, 'Chưa phân loại') AS category_name,
      COALESCE(va.attributes_json, '{}'::jsonb) AS attributes,
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
      ) AS location_details,
      public.unaccent_text(
        lower(
          p.name || ' ' ||
          COALESCE(c.name, '') || ' ' ||
          COALESCE(array_to_string(p.search_keywords, ' '), '') || ' ' ||
          COALESCE(p.description, '') || ' ' ||
          COALESCE(v.sku_code, '') || ' ' ||
          COALESCE(u.symbol, '') || ' ' ||
          COALESCE(u.name, '') || ' ' ||
          COALESCE(va.attr_text, '') || ' ' ||
          COALESCE(vb.barcode_text, '') || ' ' ||
          COALESCE(vuom.uom_text, '')
        )
      ) AS search_text
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    JOIN public.variants v ON v.product_id = p.id
    LEFT JOIN public.units u ON u.id = v.base_unit_id
    LEFT JOIN variant_attrs va ON va.sku_id = v.id
    LEFT JOIN variant_barcodes vb ON vb.sku_id = v.id
    LEFT JOIN variant_uoms vuom ON vuom.sku_id = v.id
    LEFT JOIN public.stock_balances sb ON sb.variant_id = v.id
    LEFT JOIN public.stock_locations loc ON loc.id = sb.location_id
    WHERE p.deleted_at IS NULL AND v.sku_status = 'active'
      AND (p_location_id IS NULL OR sb.location_id = p_location_id)
    GROUP BY p.id, v.id, p.name, c.name, u.name, u.symbol, v.price, v.min_stock, v.sku_code, p.search_keywords, p.description, va.attributes_json, va.attr_text, vb.barcode_text, vuom.uom_text
  )
  SELECT
    sp.product_id,
    sp.variant_id,
    sp.product_name,
    sp.category_name,
    sp.attributes,
    sp.unit,
    sp.price,
    sp.min_stock,
    sp.total_stock,
    sp.location_details
  FROM sku_pool sp, query_tokens qt
  WHERE cardinality(qt.tokens) IS NULL OR cardinality(qt.tokens) = 0 OR NOT EXISTS (
    SELECT 1
    FROM unnest(qt.tokens) tok
    WHERE sp.search_text NOT LIKE '%' || tok || '%'
  )
  ORDER BY sp.total_stock DESC, sp.product_name ASC
  LIMIT COALESCE(p_limit, 20);
$$;

-- Phân quyền cho các roles
GRANT EXECUTE ON FUNCTION public.unaccent_text(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_catalog(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_skus(text, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_get_stock_summary(text, uuid, integer) TO anon, authenticated, service_role;
