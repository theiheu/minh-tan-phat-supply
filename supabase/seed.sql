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

-- Zones
insert into public.zones (name) values ('Khu 1'),('Khu 2'),('Khu 3'),('Khu 4')
on conflict (name) do nothing;

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
