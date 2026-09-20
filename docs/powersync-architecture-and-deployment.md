# Hướng Dẫn Kiến Trúc & Triển Khai PowerSync (Offline-First Sync Engine)

## 1. Tổng Quan Kiến Trúc (Architecture Overview)

Hệ thống ERP **Minh Tân Phát Supply** sử dụng kiến trúc **Local-First / Offline-First** kết hợp giữa **Supabase PostgreSQL 17** ở Backend và **SQLite WASM/OPFS** ở Client Trình duyệt thông qua **PowerSync Sync Engine**.

### Luồng Hoạt Động:
1. **Backend Supabase PostgreSQL**: Lưu trữ dữ liệu chuẩn với Append-Only Ledger và 73+ Security Definer Stored Procedures.
2. **PowerSync Service**: Nhận luồng WAL CDC từ Postgres và đồng bộ có phân quyền (Sync Rules) xuống Client.
3. **Client SQLite**: Truy vấn tức thì 0ms (useQuery) từ SQLite cục bộ, lưu thay đổi vào Upload Queue và gửi lên Supabase RPC khi có mạng.

---

## 2. Bảng Dữ Liệu Đồng Bộ (Synced Tables)

Các bảng dữ liệu được đồng bộ về SQLite cục bộ trên máy người dùng:

1. **Danh mục & Quy chuẩn**:
   - `categories`: Nhóm danh mục vật tư.
   - `products`: Vật tư cấp tổng thể.
   - `skus`: Mã quản lý kho chi tiết kèm giá, mức tồn tối thiểu.
   - `units`: Đơn vị tính cơ sở (cái, kg, lít, cuộn...).
   - `sku_transaction_units`: Hệ số quy đổi đơn vị giao dịch.
2. **Khu vực Trang trại & Xe cơ giới**:
   - `zones` & `sub_zones`: Danh sách dãy trại (Trại A, Trại B, Trại C...) và các ô chuồng.
   - `vehicles`: Danh sách xe cơ giới, máy cày, xe tải, số công tơ mét hiện tại.
   - `fuel_types`: Danh mục nhiên liệu (Dầu DO 0.05S, Xăng RON 95...).
3. **Nghiệp vụ Thực địa**:
   - `requisitions` & `requisition_items`: Phiếu yêu cầu cấp phát vật tư.
   - `fuel_dispenses`: Nhật ký cấp phát xăng dầu xe cơ giới.
   - `tool_borrowings` & `tool_borrowing_items`: Sổ mượn trả dụng cụ.

---

## 3. Cấu Hình Đồng Bộ Dữ Liệu (`powersync/sync_rules.yaml`)

File `powersync/sync_rules.yaml` phân vùng dữ liệu thành 3 nhóm bucket:
- **Bucket 1: `global_metadata`**: Tải toàn bộ danh mục vật tư, đơn vị, xe, khu vực về máy (áp dụng cho mọi nhân viên).
- **Bucket 2: `user_requisitions`**: Tải danh sách phiếu yêu cầu của chính người dùng (hoặc toàn bộ nếu là Quản lý/Thủ kho).
- **Bucket 3: `field_operations`**: Tải lịch sử cấp phát nhiên liệu và phiếu mượn công cụ chưa hoàn trả.

---

## 4. Hướng Dẫn Triển Khai Backend (Deployment Guide)

### Bước 1: Bật Logical Replication trên PostgreSQL (Supabase)
Chạy câu lệnh sau trong SQL Editor của Supabase:
```sql
-- 1. Đảm bảo wal_level là logical (trên Supabase Cloud đã bật mặc định)
-- 2. Tạo publication cho PowerSync
CREATE PUBLICATION powersync FOR ALL TABLES;
```

### Bước 2: Chạy PowerSync Service bằng Docker Compose
Tệp `powersync/docker-compose.powersync.yml` đã được chuẩn bị sẵn:
```bash
docker compose -f powersync/docker-compose.powersync.yml up -d
```

### Bước 3: Cấu hình biến môi trường Client (`.env.local` hoặc `.env`)
Thêm biến môi trường trỏ đến PowerSync Service:
```env
NEXT_PUBLIC_POWERSYNC_URL=http://127.0.0.1:8080
```

---

## 5. Hướng Dẫn Lập Trình Viên Sử Dụng (Developer Guide)

### 1. Truy vấn Danh mục Vật tư Ngoại tuyến
```tsx
import { usePowerSyncCatalog } from "@/lib/powersync/hooks";

export function SkuList() {
  const { items, isLoading } = usePowerSyncCatalog({ q: "bóng đèn", activeOnly: true });

  if (isLoading) return <div>Đang nạp...</div>;

  return (
    <ul>
      {items.map((sku) => (
        <li key={sku.id}>{sku.name} - {sku.sku_code}</li>
      ))}
    </ul>
  );
}
```

### 2. Truy vấn Danh sách Xe Cơ giới Ngoại tuyến
```tsx
import { usePowerSyncVehicles } from "@/lib/powersync/hooks";

export function VehicleSelector() {
  const { vehicles } = usePowerSyncVehicles({ activeOnly: true });
  return (
    <select>
      {vehicles.map((v) => (
        <option key={v.id} value={v.id}>{v.name} ({v.code})</option>
      ))}
    </select>
  );
}
```

### 3. Theo dõi Trạng thái Đồng bộ
```tsx
import { usePowerSyncSyncStatus } from "@/lib/powersync/hooks";

export function StatusIndicator() {
  const { isConnected, hasSynced, uploading, downloading } = usePowerSyncSyncStatus();
  return (
    <div>
      {downloading && "Đang tải dữ liệu..."}
      {uploading && "Đang gửi thay đổi lên máy chủ..."}
      {isConnected && "Đã kết nối"}
    </div>
  );
}
```
