import { PowerSyncDatabase } from "@powersync/web";
import { AppSchema } from "./schema";
import { MinhTanPhatPowerSyncConnector } from "./connector";

let powerSyncDbInstance: PowerSyncDatabase | null = null;
let connectorInstance: MinhTanPhatPowerSyncConnector | null = null;
let isConnected = false;

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
 * Khởi tạo và kết nối PowerSync với Supabase Backend Connector
 */
export async function initPowerSync(config?: { powersyncUrl?: string }): Promise<PowerSyncDatabase | null> {
  const db = getPowerSyncDatabase();
  if (!db) return null;

  if (!connectorInstance) {
    connectorInstance = new MinhTanPhatPowerSyncConnector(config);
  }

  if (!isConnected) {
    try {
      await db.connect(connectorInstance);
      isConnected = true;
      console.log("[PowerSync] Đã kết nối thành công với PowerSync Service.");
    } catch (err) {
      console.warn("[PowerSync] Chưa thể kết nối tới PowerSync Service (chạy ở chế độ offline/local):", err);
    }
  }

  return db;
}

/**
 * Lấy connector instance
 */
export function getPowerSyncConnector(): MinhTanPhatPowerSyncConnector {
  if (!connectorInstance) {
    connectorInstance = new MinhTanPhatPowerSyncConnector();
  }
  return connectorInstance;
}
