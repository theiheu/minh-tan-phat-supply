"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { PowerSyncContext } from "@powersync/react";
import { PowerSyncDatabase } from "@powersync/web";
import {
  getPowerSyncDatabase,
  connectPowerSync,
  disconnectPowerSync,
} from "./db";
import { createClient } from "@/lib/supabase/client";

interface PowerSyncProviderState {
  db: PowerSyncDatabase | null;
  isReady: boolean;
  error: Error | null;
}

const PowerSyncStateContext = createContext<PowerSyncProviderState>({
  db: null,
  isReady: false,
  error: null,
});

export function usePowerSyncState() {
  return useContext(PowerSyncStateContext);
}

export function PowerSyncProvider({
  children,
  powersyncUrl,
}: {
  children: React.ReactNode;
  powersyncUrl?: string;
}) {
  const [db, setDb] = useState<PowerSyncDatabase | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    try {
      const instance = getPowerSyncDatabase();

      if (!instance) {
        if (isMounted) setIsReady(true);
        return;
      }

      if (isMounted) {
        setDb(instance);
        setIsReady(true);
      }
    } catch (err) {
      console.warn("[PowerSyncProvider] Lỗi khi tạo database instance:", err);
      if (isMounted) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsReady(true);
      }
      return;
    }

    const targetUrl = powersyncUrl || process.env.NEXT_PUBLIC_POWERSYNC_URL;
    const supabase = createClient();

    // 1. Kiểm tra phiên đăng nhập ban đầu và kết nối nếu đã xác thực
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (!isMounted) return;
        if (session?.access_token && targetUrl) {
          try {
            await connectPowerSync({ powersyncUrl: targetUrl });
          } catch (err) {
            console.warn("[PowerSyncProvider] Lỗi kết nối ban đầu:", err);
          }
        }
      })
      .catch((err) => {
        console.warn("[PowerSyncProvider] Không thể lấy session:", err);
      });

    // 2. Lắng nghe thay đổi trạng thái xác thực (đăng nhập, làm mới token, đăng xuất)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (session?.access_token && targetUrl) {
          try {
            await connectPowerSync({ powersyncUrl: targetUrl });
          } catch (err) {
            console.warn("[PowerSyncProvider] Lỗi kết nối sau khi đăng nhập:", err);
          }
        }
      } else if (event === "SIGNED_OUT" || !session) {
        try {
          await disconnectPowerSync();
        } catch (err) {
          console.warn("[PowerSyncProvider] Lỗi ngắt kết nối sau khi đăng xuất:", err);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [powersyncUrl]);

  if (!db) {
    // Trong khi chờ khởi tạo SQLite local trên client, render children bình thường
    return (
      <PowerSyncStateContext.Provider value={{ db: null, isReady: false, error }}>
        {children}
      </PowerSyncStateContext.Provider>
    );
  }

  return (
    <PowerSyncContext.Provider value={db}>
      <PowerSyncStateContext.Provider value={{ db, isReady, error }}>
        {children}
      </PowerSyncStateContext.Provider>
    </PowerSyncContext.Provider>
  );
}
