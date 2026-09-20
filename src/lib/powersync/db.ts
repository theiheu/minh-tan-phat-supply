import { PowerSyncDatabase } from "@powersync/web";
import { AppSchema } from "./schema";
import { MinhTanPhatPowerSyncConnector } from "./connector";
import { createClient } from "@/lib/supabase/client";

let powerSyncDbInstance: PowerSyncDatabase | null = null;
let connectorInstance: MinhTanPhatPowerSyncConnector | null = null;

/**
 * Lấy đối tượng PowerSyncDatabase singleton trên client
 */
export function getPowerSyncDatabase(): PowerSyncDatabase | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!powerSyncDbInstance) {
    powerSyncDbInstance = new PowerSyncDatabase({
      schema: AppSchema,
      database: {
        dbFilename: "minh_tan_phat_powersync.db",
        worker: "/@powersync/worker.js",
      },
      sync: {
        worker: "/@powersync/worker.js",
      },
    });
  }

  return powerSyncDbInstance;
}

/**
 * Lấy connector instance
 */
export function getPowerSyncConnector(config?: { powersyncUrl?: string }): MinhTanPhatPowerSyncConnector {
  if (!connectorInstance) {
    connectorInstance = new MinhTanPhatPowerSyncConnector(config);
  } else if (config?.powersyncUrl !== undefined && connectorInstance.getPowersyncUrl() !== config.powersyncUrl) {
    connectorInstance.setPowersyncUrl(config.powersyncUrl);
  }
  return connectorInstance;
}

/**
 * Kết nối PowerSync Database tới PowerSync Service nếu có URL và Session hợp lệ
 */
export async function connectPowerSync(config?: { powersyncUrl?: string }): Promise<boolean> {
  const db = getPowerSyncDatabase();
  if (!db) return false;

  const connector = getPowerSyncConnector(config);
  const targetUrl = config?.powersyncUrl !== undefined ? config.powersyncUrl : connector.getPowersyncUrl();

  if (!targetUrl) {
    // Không có URL PowerSync -> chạy ở chế độ SQLite local hoàn toàn
    return false;
  }

  try {
    const supabase = createClient();
    const result = await supabase.auth.getSession();
    const session = result?.data?.session;
    const error = result?.error;

    if (error || !session?.access_token) {
      // Chưa đăng nhập -> không kết nối sync stream để tránh lỗi 'Not signed in' trong worker
      return false;
    }

    if (!db.connected) {
      await db.connect(connector);
      console.log("[PowerSync] Đã kết nối thành công với PowerSync Service.");
    }
    return true;
  } catch (err) {
    console.warn("[PowerSync] Chưa thể kết nối tới PowerSync Service (chạy ở chế độ offline/local):", err);
    return false;
  }
}

/**
 * Ngắt kết nối PowerSync Service (khi đăng xuất hoặc chuyển sang offline)
 */
export async function disconnectPowerSync(): Promise<void> {
  const db = getPowerSyncDatabase();
  if (!db) return;

  try {
    if (db.connected) {
      await db.disconnect();
      console.log("[PowerSync] Đã ngắt kết nối PowerSync Service.");
    }
  } catch (err) {
    console.warn("[PowerSync] Lỗi khi ngắt kết nối PowerSync Service:", err);
  }
}

/**
 * Khởi tạo PowerSync singleton và tự động kết nối nếu người dùng đã đăng nhập
 */
export async function initPowerSync(config?: { powersyncUrl?: string }): Promise<PowerSyncDatabase | null> {
  const db = getPowerSyncDatabase();
  if (!db) return null;

  await connectPowerSync(config);
  return db;
}
