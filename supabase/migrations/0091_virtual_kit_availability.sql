-- Create migration 0091 for virtual kit availability
-- Fix virtual kit availability to consider missing balances as zero, apply floor, and consider reserved_quantity
CREATE OR REPLACE VIEW public.location_stock AS
 SELECT loc.location_id,
    v.id AS sku_id,
    v.product_id,
        CASE
            WHEN ((v.inventory_policy = 'virtual_kit'::text) AND (bh.id IS NOT NULL) AND (bv.id IS NOT NULL)) THEN COALESCE(( SELECT FLOOR(min(((COALESCE(sb.quantity, (0)::numeric) - COALESCE(sb.reserved_quantity, (0)::numeric)) / GREATEST(bi.base_quantity, 0.000001)))) AS min
               FROM (public.bom_items bi
                 LEFT JOIN public.stock_balances sb ON (((sb.sku_id = bi.component_sku_id) AND (sb.location_id = loc.location_id))))
              WHERE (bi.bom_version_id = bv.id)), (0)::numeric)
            ELSE COALESCE(( SELECT sb.quantity
               FROM public.stock_balances sb
              WHERE ((sb.sku_id = v.id) AND (sb.location_id = loc.location_id))), (0)::numeric)
        END AS quantity
   FROM (((public.skus v
     LEFT JOIN public.bom_headers bh ON ((bh.sku_id = v.id)))
     LEFT JOIN public.bom_versions bv ON ((bv.id = bh.active_version_id)))
     CROSS JOIN ( SELECT DISTINCT stock_balances.location_id
           FROM public.stock_balances) loc);

CREATE OR REPLACE VIEW public.sku_stock AS
 SELECT v.id AS sku_id,
    v.product_id,
    v.min_stock,
    u.name AS unit,
        CASE
            WHEN ((v.inventory_policy = 'virtual_kit'::text) AND (bh.id IS NOT NULL) AND (bv.id IS NOT NULL)) THEN COALESCE(( SELECT FLOOR(min(((COALESCE(sb.quantity, (0)::numeric) - COALESCE(sb.reserved_quantity, (0)::numeric)) / GREATEST(bi.base_quantity, 0.000001)))) AS min
               FROM (public.bom_items bi
                 LEFT JOIN (public.stock_balances sb 
                   JOIN public.stock_locations sl ON (((sl.id = sb.location_id) AND (sl.code = 'KHO_CHINH'::text))))
                 ON ((sb.sku_id = bi.component_sku_id)))
              WHERE (bi.bom_version_id = bv.id)), (0)::numeric)
            ELSE COALESCE(( SELECT sb.quantity
               FROM (public.stock_balances sb
                 JOIN public.stock_locations sl ON (((sl.id = sb.location_id) AND (sl.code = 'KHO_CHINH'::text))))
              WHERE (sb.sku_id = v.id)), (0)::numeric)
        END AS quantity
   FROM (((public.skus v
     LEFT JOIN public.units u ON ((u.id = v.base_unit_id)))
     LEFT JOIN public.bom_headers bh ON ((bh.sku_id = v.id)))
     LEFT JOIN public.bom_versions bv ON ((bv.id = bh.active_version_id)));
