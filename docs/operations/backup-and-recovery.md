# 💾 QUY TRÌNH SAO LƯU & PHỤC HỒI DỮ LIỆU (BACKUP & DISASTER RECOVERY)

> Tài liệu hướng dẫn quy trình sao lưu cơ sở dữ liệu PostgreSQL định kỳ, sao lưu ảnh chứng từ trên Supabase Storage và kịch bản phục hồi thảm họa (Disaster Recovery) cho hệ thống **Minh Tân Phát Supply**.

---

## 1. TỔNG QUAN CHIẾN LƯỢC SAO LƯU (BACKUP STRATEGY)

Dữ liệu của trang trại bao gồm 2 thành phần cốt lõi:
1. **Cơ sở dữ liệu quan hệ (PostgreSQL 17):** Chứa toàn bộ 39 bảng danh mục, số dư tồn kho, sổ cái kế toán và tài khoản người dùng.
2. **Đối tượng tệp (Supabase Storage):** Chứa toàn bộ ảnh chụp hóa đơn đỏ VAT, phiếu giao hàng của NCC và ảnh chụp hiện trường thiết bị hỏng.

| Loại dữ liệu | Tần suất sao lưu | Thời điểm thực hiện | Thời gian lưu trữ (Retention) |
|---|---|---|---|
| **Cơ sở dữ liệu (Database Dump)** | Hằng ngày (Daily) | 02:00 sáng mỗi ngày | Lưu 14 ngày gần nhất |
| **Sổ cái & Cấu hình Schema** | Hằng tuần (Weekly) | 03:00 sáng Chủ nhật | Lưu 8 tuần gần nhất |
| **Ảnh hóa đơn (Storage Objects)** | Hằng tháng (Monthly) | Ngày 01 đầu tháng | Lưu trữ vĩnh viễn (Cold Storage) |

---

## 2. QUY TRÌNH SAO LƯU CƠ SỞ DỮ LIỆU (MANUAL BACKUP)

### A. Sao lưu toàn bộ Database (Full Dump)
Chạy lệnh xuất file SQL nén từ máy chủ:

```bash
# Tạo thư mục chứa backup nếu chưa có
mkdir -p ~/backups/database

# Xuất bản backup có gắn dấu thời gian
PGPASSWORD="your_postgres_password" pg_dump -h 127.0.0.1 -p 5432 -U postgres -d postgres -F c -b -v -f ~/backups/database/mtp_supply_$(date +%Y%m%d_%H%M%S).dump
```

### B. Sao lưu dạng văn bản SQL đọc được (Plain SQL)
```bash
PGPASSWORD="your_postgres_password" pg_dump -h 127.0.0.1 -p 5432 -U postgres -d postgres > ~/backups/database/mtp_supply_$(date +%F).sql
```

---

## 3. THIẾT LẬP TỰ ĐỘNG HÓA QUA CRONJOB (AUTOMATED DAILY BACKUP)

Tạo script sao lưu tự động tại `/root/scripts/cron-backup.sh`:

```bash
#!/bin/bash
set -e

BACKUP_DIR="/root/backups/database"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"

# 1. Thực hiện pg_dump
PGPASSWORD="your_postgres_password" pg_dump -h 127.0.0.1 -p 5432 -U postgres -d postgres -F c -f "$BACKUP_DIR/mtp_db_$DATE.dump"

# 2. Xóa các file backup cũ hơn 14 ngày
find "$BACKUP_DIR" -name "mtp_db_*.dump" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Backup thành công: mtp_db_$DATE.dump"
```

Phân quyền và thêm vào Crontab:
```bash
chmod +x /root/scripts/cron-backup.sh

# Mở crontab để lập lịch chạy lúc 02:00 sáng hằng ngày
crontab -e
# Thêm dòng sau:
0 2 * * * /root/scripts/cron-backup.sh >> /var/log/mtp-backup.log 2>&1
```

---

## 4. QUY TRÌNH PHỤC HỒI DỮ LIỆU (DISASTER RECOVERY / RESTORE)

Trong trường hợp máy chủ bị hỏng ổ cứng hoặc dữ liệu bị lỗi cần phục hồi về trạng thái trước đó:

### Bước 1: Dừng các dịch vụ web đang kết nối vào cơ sở dữ liệu
```bash
sudo systemctl stop mtp-web
```

### Bước 2: Phục hồi Database từ file Dump
```bash
# Phục hồi bằng pg_restore (đối với định dạng -F c)
PGPASSWORD="your_postgres_password" pg_restore -h 127.0.0.1 -p 5432 -U postgres -d postgres -c -v ~/backups/database/mtp_supply_20260913_020000.dump

# Hoặc phục hồi từ file Plain SQL:
# PGPASSWORD="your_postgres_password" psql -h 127.0.0.1 -p 5432 -U postgres -d postgres < ~/backups/database/mtp_supply_2026-09-13.sql
```

### Bước 3: Kiểm tra tính toàn vẹn dữ liệu
```bash
# Chạy script kiểm tra chất lượng TypeScript & Test suite
pnpm typecheck
pnpm test
```

### Bước 4: Khởi động lại dịch vụ web và kiểm tra hoạt động
```bash
sudo systemctl start mtp-web
curl -I http://127.0.0.1:3000/login
```