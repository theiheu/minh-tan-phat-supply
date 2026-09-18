-- 0085_shorten_sku_codes.sql
-- Create sequence for short, readable sequential SKU codes (SKU-0001, SKU-0002, ...)
CREATE SEQUENCE IF NOT EXISTS public.skus_seq;

-- Function to generate next SKU code
CREATE OR REPLACE FUNCTION public.next_sku_code()
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  RETURN public.next_code('SKU', 'public.skus_seq');
END;
$$;

-- Re-assign short, clean, sequential SKU codes for existing variants with long UUID/timestamp SKU codes
WITH ordered_variants AS (
  SELECT 
    v.id,
    row_number() OVER (ORDER BY p.name ASC, v.is_default DESC, v.created_at ASC, v.id ASC) AS row_num
  FROM public.variants v
  JOIN public.products p ON p.id = v.product_id
  WHERE v.sku_code IS NULL 
     OR length(v.sku_code) > 15 
     OR v.sku_code ~* '^SKU-[0-9a-f]{20,}'
     OR v.sku_code ~* '^SKU-[0-9]{10,}'
)
UPDATE public.variants v
SET sku_code = 'SKU-' || lpad(ov.row_num::text, 4, '0'),
    updated_at = now()
FROM ordered_variants ov
WHERE v.id = ov.id;

-- Sync the sequence to current max number
SELECT setval(
  'public.skus_seq', 
  GREATEST(
    COALESCE(
      (SELECT MAX(SUBSTRING(sku_code FROM '[0-9]+')::bigint) 
       FROM public.variants 
       WHERE sku_code ~ '^SKU-[0-9]+$'), 
      0
    ), 
    1
  )
);

-- Trigger function to auto-assign short SKU code if null or blank on insert
CREATE OR REPLACE FUNCTION public.generate_sku_code_if_null()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF new.sku_code IS NULL OR btrim(new.sku_code) = '' THEN
    new.sku_code := public.next_code('SKU', 'public.skus_seq');
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_sku_code ON public.variants;
CREATE TRIGGER trg_generate_sku_code
BEFORE INSERT ON public.variants
FOR EACH ROW EXECUTE FUNCTION public.generate_sku_code_if_null();
