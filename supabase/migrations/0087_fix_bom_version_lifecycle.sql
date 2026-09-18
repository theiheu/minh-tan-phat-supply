-- 0087_fix_bom_version_lifecycle.sql
-- Cho phép chuyển trạng thái BOM version từ active/scheduled sang retired khi cập nhật hoặc thay thế BOM version mới.
-- Đảm bảo tính bất biến của BOM version đã retire, và bảo toàn toàn vẹn dữ liệu cho định danh (bom_header_id, version_number).

CREATE OR REPLACE FUNCTION public.guard_bom_version_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- 1. Phiên bản đã retired là bất biến tuyệt đối
  IF tg_op = 'UPDATE' AND old.status = 'retired' THEN
    RAISE EXCEPTION 'BOM version đã retire là bất biến';
  END IF;

  -- 2. Phiên bản đã scheduled hoặc active chỉ được phép chuyển sang retired (hoặc giữ nguyên khi đóng period)
  IF tg_op = 'UPDATE' AND old.status IN ('scheduled', 'active') THEN
    IF new.status <> 'retired' AND new.status <> old.status THEN
      RAISE EXCEPTION 'BOM version đã kích hoạt chỉ có thể chuyển sang trạng thái retired';
    END IF;
    IF auth.uid() IS NOT NULL AND NOT public.is_warehouse() THEN
      RAISE EXCEPTION 'Chỉ quản kho/chủ trại/superuser được thay đổi trạng thái BOM';
    END IF;
    IF new.bom_header_id <> old.bom_header_id OR new.version_number <> old.version_number THEN
      RAISE EXCEPTION 'Không thể thay đổi cấu trúc định danh của BOM version đã kích hoạt';
    END IF;
  END IF;

  -- 3. Kiểm tra phân quyền và điều kiện khi kích hoạt / lên lịch BOM
  IF new.status IN ('scheduled', 'active') THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_warehouse() THEN
      RAISE EXCEPTION 'Chỉ quản kho/chủ trại/superuser được kích hoạt BOM';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.bom_items parent_item
      JOIN public.bom_versions parent_version ON parent_version.id = parent_item.bom_version_id
      WHERE parent_item.component_sku_id = (SELECT sku_id FROM public.bom_headers WHERE id = new.bom_header_id)
        AND parent_version.status IN ('scheduled', 'active')
    ) THEN
      RAISE EXCEPTION 'SKU đang là linh kiện của BOM active nên không thể kích hoạt BOM riêng';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.bom_items item
      JOIN public.bom_headers child_header ON child_header.sku_id = item.component_sku_id
      JOIN public.bom_versions child_version ON child_version.bom_header_id = child_header.id
      WHERE item.bom_version_id = new.id AND child_version.status IN ('scheduled', 'active')
    ) THEN
      RAISE EXCEPTION 'Linh kiện không được có BOM active';
    END IF;
  END IF;

  RETURN new;
END;
$$;
