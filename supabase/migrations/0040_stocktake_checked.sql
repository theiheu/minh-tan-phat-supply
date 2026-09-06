-- 0040_stocktake_checked.sql — đánh dấu từng dòng kiểm kê đã kiểm/chưa kiểm.
-- Người kiểm kê tick checkbox khi đã đếm xong dòng vật tư đó; trạng thái lưu DB
-- nên giữ nguyên khi tải lại trang. Phiếu tạo mới: mọi dòng bắt đầu chưa kiểm.
alter table public.stocktake_items
  add column checked boolean not null default false;
