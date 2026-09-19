-- seed.sql — dữ liệu mẫu (idempotent). Chạy sau `supabase db reset`.
-- Tài khoản người dùng được tạo qua invite (Phase 1) — không seed auth.users ở đây.

-- Categories (12 danh mục tiêu chuẩn)
insert into public.categories (name, icon, display_order) values
('Điện - Điện tử', 'electric', 1),
('Phụ tùng Xe - Máy móc', 'machinery', 2),
('Dụng cụ - Bảo hộ', 'tools_ppe', 3),
('Thiết bị Chăn nuôi', 'livestock', 4),
('Nước - Khí nén', 'plumbing_pneumatics', 5),
('Vòng bi - Bạc đạn', 'bearings', 6),
('Dây curoa - Nhông xích', 'belts_chains', 7),
('Dầu mỡ - Hóa chất', 'oil_chemicals', 8),
('Hàn - Cắt - Gia công', 'welding_cutting', 9),
('Kim khí - Bulong - Ốc vít', 'hardware_fasteners', 10),
('Đóng gói - Bạt - Dây', 'packaging_ropes', 11),
('Vật tư Khác', 'other', 12)
on conflict (name) do update set
  icon = excluded.icon,
  display_order = excluded.display_order,
  deleted_at = null;

-- Zones & Sub-Zones
insert into public.zones (name) values ('Khu 1'),('Khu 2'),('Khu 3'),('Khu 4')
on conflict (name) do nothing;

insert into public.sub_zones (zone_id, name, display_order)
select z.id, s.name, s.display_order
from public.zones z
cross join (values
  ('Trại 1', 1),
  ('Trại 2', 2),
  ('Trại 3', 3)
) as s(name, display_order)
where z.name = 'Khu 1'
on conflict (zone_id, lower(name)) where deleted_at is null do nothing;

insert into public.sub_zones (zone_id, name, display_order)
select z.id, 'Xưởng phân', 1
from public.zones z
where z.name = 'Khu 4'
on conflict (zone_id, lower(name)) where deleted_at is null do nothing;

-- Stock locations
insert into public.stock_locations (code, name, type) values
('KHO_CHINH','Kho chính','main'),
('KHO_HONG','Kho hỏng tập kết','defect'),
('KHO_DANG_SUA','Đang sửa chữa','repair')
on conflict (code) do nothing;

-- Suppliers
insert into public.suppliers (name, contact_name, phone) values
('Công ty TNHH Thức ăn Chăn nuôi Minh Phát','Ô. Hùng','0900000001'),
('Công ty Thuốc Thú y An Bình','Bà. Lan','0900000002')
on conflict (name) do nothing;

-- Canonical Units (40 đơn vị tính chuẩn)
insert into public.units (code, name, symbol, dimension, factor_to_reference, decimal_scale, is_active) values
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
  ('kg', 'Kg', 'kg', 'mass', 1.0, 3, true),
  ('gam', 'Gam', 'g', 'mass', 0.001, 2, true),
  ('tan', 'Tấn', 'tấn', 'mass', 1000.0, 3, true),
  ('ta', 'Tạ', 'tạ', 'mass', 100.0, 3, true),
  ('yen', 'Yến', 'yến', 'mass', 10.0, 3, true),
  ('met', 'Mét', 'm', 'length', 1.0, 3, true),
  ('cm', 'Centimét', 'cm', 'length', 0.01, 2, true),
  ('mm', 'Milimét', 'mm', 'length', 0.001, 2, true),
  ('lit', 'Lít', 'l', 'volume', 1.0, 3, true),
  ('ml', 'Mililít', 'ml', 'volume', 0.001, 1, true),
  ('m3', 'Mét khối', 'm³', 'volume', 1000.0, 3, true),
  ('m2', 'Mét vuông', 'm²', 'area', 1.0, 2, true)
on conflict (code) do update set
  name = excluded.name,
  symbol = excluded.symbol,
  dimension = excluded.dimension,
  factor_to_reference = excluded.factor_to_reference,
  decimal_scale = excluded.decimal_scale,
  is_active = true;
