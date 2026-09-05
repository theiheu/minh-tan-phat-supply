-- seed.sql — dữ liệu mẫu (idempotent). Chạy sau `supabase db reset`.
-- Tài khoản người dùng được tạo qua invite (Phase 1) — không seed auth.users ở đây.

-- Categories (8)
insert into public.categories (name, icon, display_order) values
('Thức ăn chăn nuôi','feed',1),('Thuốc & Vắc-xin','medicine',2),
('Dụng cụ chăn nuôi','tool',3),('Hệ thống chuồng trại','coop',4),
('Vệ sinh & Sát trùng','clean',5),('Bảo hộ lao động','ppe',6),
('Phụ tùng & Sửa chữa','repair',7),('Khác','other',8)
on conflict (name) do nothing;

-- Zones
insert into public.zones (name) values ('Khu 1'),('Khu 2'),('Khu 3'),('Khu 4')
on conflict (name) do nothing;

-- Stock locations
insert into public.stock_locations (code, name, type) values
('KHO_CHINH','Kho chính','main'),('KHO_HONG','Kho hỏng tập kết','defect'),('KHO_DANG_SUA','Đang sửa chữa','repair')
on conflict (code) do nothing;

-- Suppliers
insert into public.suppliers (name, contact_name, phone) values
('Công ty TNHH Thức ăn Chăn nuôi Minh Phát','Ô. Hùng','0900000001'),
('Công ty Thuốc Thú y An Bình','Bà. Lan','0900000002')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Products + variants (12)
-- ---------------------------------------------------------------------------

-- 1. Cám gà con
insert into public.products (name, category_id, options)
select 'Cám gà con', c.id, '{"Trọng lượng"}'::text[]
from public.categories c
where c.name = 'Thức ăn chăn nuôi'
  and not exists (select 1 from public.products p where p.name = 'Cám gà con');
insert into public.variants (product_id, attributes, price, unit, min_stock)
select p.id, v.attributes, v.price, v.unit, v.min_stock
from (values
  ('{"Trọng lượng":"Bao 10kg"}'::jsonb, 180000::numeric, 'Bao', 20),
  ('{"Trọng lượng":"Bao 25kg"}'::jsonb, 420000::numeric, 'Bao', 10)
) as v(attributes, price, unit, min_stock)
cross join public.products p
where p.name = 'Cám gà con'
  and not exists (select 1 from public.variants x where x.product_id = p.id and x.attributes = v.attributes);

-- 2. Vắc-xin Newcastle (theo lô/hạn)
insert into public.products (name, category_id, options)
select 'Vắc-xin Newcastle', c.id, '{"Liều"}'::text[]
from public.categories c
where c.name = 'Thuốc & Vắc-xin'
  and not exists (select 1 from public.products p where p.name = 'Vắc-xin Newcastle');
insert into public.variants (product_id, attributes, price, unit, min_stock, is_trackable_lot)
select p.id, v.attributes, v.price, v.unit, v.min_stock, true
from (values
  ('{"Liều":"Lọ 100 liều"}'::jsonb, 15000::numeric, 'Lọ', 30),
  ('{"Liều":"Lọ 500 liều"}'::jsonb, 60000::numeric, 'Lọ', 10)
) as v(attributes, price, unit, min_stock)
cross join public.products p
where p.name = 'Vắc-xin Newcastle'
  and not exists (select 1 from public.variants x where x.product_id = p.id and x.attributes = v.attributes);

-- 3. Máng ăn dài cho gà
insert into public.products (name, category_id, options)
select 'Máng ăn dài cho gà', c.id, '{"Chiều dài"}'::text[]
from public.categories c
where c.name = 'Dụng cụ chăn nuôi'
  and not exists (select 1 from public.products p where p.name = 'Máng ăn dài cho gà');
insert into public.variants (product_id, attributes, price, unit, min_stock)
select p.id, v.attributes, v.price, v.unit, v.min_stock
from (values
  ('{"Chiều dài":"50cm"}'::jsonb, 25000::numeric, 'Cái', 5),
  ('{"Chiều dài":"75cm"}'::jsonb, 32000::numeric, 'Cái', 5),
  ('{"Chiều dài":"100cm"}'::jsonb, 40000::numeric, 'Cái', 5)
) as v(attributes, price, unit, min_stock)
cross join public.products p
where p.name = 'Máng ăn dài cho gà'
  and not exists (select 1 from public.variants x where x.product_id = p.id and x.attributes = v.attributes);

-- 4. Quạt thông gió công nghiệp
insert into public.products (name, category_id, options)
select 'Quạt thông gió công nghiệp', c.id, '{}'::text[]
from public.categories c
where c.name = 'Hệ thống chuồng trại'
  and not exists (select 1 from public.products p where p.name = 'Quạt thông gió công nghiệp');
insert into public.variants (product_id, attributes, price, unit, min_stock)
select p.id, '{}'::jsonb, 1250000::numeric, 'Cái', 1
from public.products p
where p.name = 'Quạt thông gió công nghiệp'
  and not exists (select 1 from public.variants x where x.product_id = p.id);

-- 5. Thuốc sát trùng Vimekon (theo lô/hạn)
insert into public.products (name, category_id, options)
select 'Thuốc sát trùng Vimekon', c.id, '{"Dung tích"}'::text[]
from public.categories c
where c.name = 'Vệ sinh & Sát trùng'
  and not exists (select 1 from public.products p where p.name = 'Thuốc sát trùng Vimekon');
insert into public.variants (product_id, attributes, price, unit, min_stock, is_trackable_lot)
select p.id, '{"Dung tích":"Chai 1L"}'::jsonb, 220000::numeric, 'Chai', 10, true
from public.products p
where p.name = 'Thuốc sát trùng Vimekon'
  and not exists (select 1 from public.variants x where x.product_id = p.id);

-- 6. Ủng bảo hộ cao su
insert into public.products (name, category_id, options)
select 'Ủng bảo hộ cao su', c.id, '{"Kích cỡ"}'::text[]
from public.categories c
where c.name = 'Bảo hộ lao động'
  and not exists (select 1 from public.products p where p.name = 'Ủng bảo hộ cao su');
insert into public.variants (product_id, attributes, price, unit, min_stock)
select p.id, '{"Kích cỡ":"39-42"}'::jsonb, 85000::numeric, 'Đôi', 5
from public.products p
where p.name = 'Ủng bảo hộ cao su'
  and not exists (select 1 from public.variants x where x.product_id = p.id);

-- 7. Bóng đèn úm hồng ngoại
insert into public.products (name, category_id, options)
select 'Bóng đèn úm hồng ngoại', c.id, '{"Công suất"}'::text[]
from public.categories c
where c.name = 'Phụ tùng & Sửa chữa'
  and not exists (select 1 from public.products p where p.name = 'Bóng đèn úm hồng ngoại');
insert into public.variants (product_id, attributes, price, unit, min_stock)
select p.id, v.attributes, v.price, v.unit, v.min_stock
from (values
  ('{"Công suất":"100W"}'::jsonb, 45000::numeric, 'Cái', 10),
  ('{"Công suất":"150W"}'::jsonb, 55000::numeric, 'Cái', 10),
  ('{"Công suất":"250W"}'::jsonb, 70000::numeric, 'Cái', 10)
) as v(attributes, price, unit, min_stock)
cross join public.products p
where p.name = 'Bóng đèn úm hồng ngoại'
  and not exists (select 1 from public.variants x where x.product_id = p.id and x.attributes = v.attributes);

-- 8. Men tiêu hóa gia cầm (theo lô/hạn)
insert into public.products (name, category_id, options)
select 'Men tiêu hóa gia cầm', c.id, '{}'::text[]
from public.categories c
where c.name = 'Thuốc & Vắc-xin'
  and not exists (select 1 from public.products p where p.name = 'Men tiêu hóa gia cầm');
insert into public.variants (product_id, attributes, price, unit, min_stock, is_trackable_lot)
select p.id, '{}'::jsonb, 95000::numeric, 'Gói', 20, true
from public.products p
where p.name = 'Men tiêu hóa gia cầm'
  and not exists (select 1 from public.variants x where x.product_id = p.id);

-- 9. Tấm lót chuồng trấu
insert into public.products (name, category_id, options)
select 'Tấm lót chuồng trấu', c.id, '{}'::text[]
from public.categories c
where c.name = 'Hệ thống chuồng trại'
  and not exists (select 1 from public.products p where p.name = 'Tấm lót chuồng trấu');
insert into public.variants (product_id, attributes, price, unit, min_stock)
select p.id, '{}'::jsonb, 30000::numeric, 'Bao', 20
from public.products p
where p.name = 'Tấm lót chuồng trấu'
  and not exists (select 1 from public.variants x where x.product_id = p.id);

-- 10. Xẻng xúc cám
insert into public.products (name, category_id, options)
select 'Xẻng xúc cám', c.id, '{"Loại"}'::text[]
from public.categories c
where c.name = 'Dụng cụ chăn nuôi'
  and not exists (select 1 from public.products p where p.name = 'Xẻng xúc cám');
insert into public.variants (product_id, attributes, price, unit, min_stock)
select p.id, v.attributes, v.price, v.unit, v.min_stock
from (values
  ('{"Loại":"Nhựa"}'::jsonb, 20000::numeric, 'Cái', 5),
  ('{"Loại":"Inox"}'::jsonb, 65000::numeric, 'Cái', 5)
) as v(attributes, price, unit, min_stock)
cross join public.products p
where p.name = 'Xẻng xúc cám'
  and not exists (select 1 from public.variants x where x.product_id = p.id and x.attributes = v.attributes);

-- 11. Bộ máng uống núm tự động — COMPOSITE: Bộ = 1 Núm + 1 Cốc
insert into public.products (name, category_id, options)
select 'Bộ máng uống núm tự động', c.id, '{"Loại"}'::text[]
from public.categories c
where c.name = 'Dụng cụ chăn nuôi'
  and not exists (select 1 from public.products p where p.name = 'Bộ máng uống núm tự động');
insert into public.variants (product_id, attributes, price, unit, min_stock)
select p.id, v.attributes, v.price, v.unit, v.min_stock
from (values
  ('{"Loại":"Bộ"}'::jsonb, 7500::numeric, 'Bộ', 10),
  ('{"Loại":"Núm"}'::jsonb, 5000::numeric, 'Cái', 20),
  ('{"Loại":"Cốc"}'::jsonb, 2500::numeric, 'Cái', 20)
) as v(attributes, price, unit, min_stock)
cross join public.products p
where p.name = 'Bộ máng uống núm tự động'
  and not exists (select 1 from public.variants x where x.product_id = p.id and x.attributes = v.attributes);

insert into public.variant_components (parent_variant_id, child_variant_id, quantity)
select bo.id, n.id, 1
from public.variants bo
join public.products pb on pb.id = bo.product_id and pb.name = 'Bộ máng uống núm tự động'
join public.variants n on n.product_id = pb.id and n.attributes = '{"Loại":"Núm"}'::jsonb
where bo.attributes = '{"Loại":"Bộ"}'::jsonb
  and not exists (select 1 from public.variant_components vc where vc.parent_variant_id = bo.id and vc.child_variant_id = n.id);

insert into public.variant_components (parent_variant_id, child_variant_id, quantity)
select bo.id, c.id, 1
from public.variants bo
join public.products pb on pb.id = bo.product_id and pb.name = 'Bộ máng uống núm tự động'
join public.variants c on c.product_id = pb.id and c.attributes = '{"Loại":"Cốc"}'::jsonb
where bo.attributes = '{"Loại":"Bộ"}'::jsonb
  and not exists (select 1 from public.variant_components vc where vc.parent_variant_id = bo.id and vc.child_variant_id = c.id);

-- 12. Vôi bột khử trùng
insert into public.products (name, category_id, options)
select 'Vôi bột khử trùng', c.id, '{}'::text[]
from public.categories c
where c.name = 'Vệ sinh & Sát trùng'
  and not exists (select 1 from public.products p where p.name = 'Vôi bột khử trùng');
insert into public.variants (product_id, attributes, price, unit, min_stock)
select p.id, '{}'::jsonb, 50000::numeric, 'Bao', 20
from public.products p
where p.name = 'Vôi bột khử trùng'
  and not exists (select 1 from public.variants x where x.product_id = p.id);

-- ---------------------------------------------------------------------------
-- Stock balances: 100 cho mọi variant KHÔNG phải composite (composite = min theo linh kiện)
-- ---------------------------------------------------------------------------
insert into public.stock_balances (variant_id, location_id, quantity)
select v.id, l.id, 100
from public.variants v
cross join (select id from public.stock_locations where code = 'KHO_CHINH') l
where not exists (select 1 from public.variant_components vc where vc.parent_variant_id = v.id)
on conflict (variant_id, location_id) do nothing;
