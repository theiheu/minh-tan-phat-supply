-- Migration: 0094_seed_canonical_units.sql
-- Seed 40 standard canonical units for agriculture, livestock, machinery & supply warehouse operations

INSERT INTO public.units (code, name, symbol, dimension, factor_to_reference, decimal_scale, is_active)
VALUES
  -- Đơn vị đếm (count)
  ('cai', 'Cái', 'cái', 'count', 1.0, 0, true),
  ('bo', 'Bộ', 'bộ', 'count', 1.0, 0, true),
  ('chiec', 'Chiếc', 'chiếc', 'count', 1.0, 0, true),
  ('con', 'Con', 'con', 'count', 1.0, 0, true),
  ('tam', 'Tấm', 'tấm', 'count', 1.0, 0, true),
  ('cay', 'Cây', 'cây', 'count', 1.0, 0, true),
  ('soi', 'Sợi', 'sợi', 'count', 1.0, 0, true),
  ('ong', 'Ống', 'ống', 'count', 1.0, 0, true),
  ('vien', 'Viên', 'viên', 'count', 1.0, 0, true),
  ('bong', 'Bóng', 'bóng', 'count', 1.0, 0, true),
  ('vong', 'Vòng', 'vòng', 'count', 1.0, 0, true),
  ('doi', 'Đôi', 'đôi', 'count', 1.0, 0, true),
  ('cap', 'Cặp', 'cặp', 'count', 1.0, 0, true),

  -- Đơn vị đóng gói (package)
  ('hop', 'Hộp', 'hộp', 'package', 1.0, 0, true),
  ('thung', 'Thùng', 'thùng', 'package', 1.0, 0, true),
  ('bao', 'Bao', 'bao', 'package', 1.0, 0, true),
  ('can', 'Can', 'can', 'package', 1.0, 0, true),
  ('chai', 'Chai', 'chai', 'package', 1.0, 0, true),
  ('cuon', 'Cuộn', 'cuộn', 'package', 1.0, 0, true),
  ('bich', 'Bịch', 'bịch', 'package', 1.0, 0, true),
  ('goi', 'Gói', 'gói', 'package', 1.0, 0, true),
  ('binh', 'Bình', 'bình', 'package', 1.0, 0, true),
  ('phuy', 'Phuy', 'phuy', 'package', 1.0, 0, true),
  ('xo', 'Xô', 'xô', 'package', 1.0, 0, true),
  ('tuyp', 'Tuýp', 'tuýp', 'package', 1.0, 0, true),
  ('vi', 'Vỉ', 'vỉ', 'package', 1.0, 0, true),
  ('kien', 'Kiện', 'kiện', 'package', 1.0, 0, true),
  ('pallet', 'Pallet', 'pallet', 'package', 1.0, 0, true),

  -- Khối lượng (mass)
  ('kg', 'Kg', 'kg', 'mass', 1.0, 3, true),
  ('gam', 'Gam', 'g', 'mass', 0.001, 2, true),
  ('tan', 'Tấn', 'tấn', 'mass', 1000.0, 3, true),
  ('ta', 'Tạ', 'tạ', 'mass', 100.0, 3, true),
  ('yen', 'Yến', 'yến', 'mass', 10.0, 3, true),

  -- Chiều dài (length)
  ('met', 'Mét', 'm', 'length', 1.0, 3, true),
  ('cm', 'Centimét', 'cm', 'length', 0.01, 2, true),
  ('mm', 'Milimét', 'mm', 'length', 0.001, 2, true),

  -- Thể tích (volume)
  ('lit', 'Lít', 'l', 'volume', 1.0, 3, true),
  ('ml', 'Mililít', 'ml', 'volume', 0.001, 1, true),
  ('m3', 'Mét khối', 'm³', 'volume', 1000.0, 3, true),

  -- Diện tích (area)
  ('m2', 'Mét vuông', 'm²', 'area', 1.0, 2, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  symbol = EXCLUDED.symbol,
  dimension = EXCLUDED.dimension,
  factor_to_reference = EXCLUDED.factor_to_reference,
  decimal_scale = EXCLUDED.decimal_scale,
  is_active = true;
