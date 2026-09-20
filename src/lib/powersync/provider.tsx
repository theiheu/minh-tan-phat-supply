"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { PowerSyncContext } from "@powersync/react";
import { PowerSyncDatabase } from "@powersync/web";
import { getPowerSyncDatabase, initPowerSync } from "./db";

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

    async function setup() {
      try {
        const instance = getPowerSyncDatabase();
        if (!instance) return;

        if (isMounted) {
          setDb(instance);
        }

        // Tự động kết nối backend nếu có URL hoặc môi trường hỗ trợ
        await initPowerSync({ powersyncUrl });

        if (isMounted) {
          setIsReady(true);
        }
      } catch (err) {
        console.warn("[PowerSyncProvider] Lỗi khi khởi tạo PowerSync:", err);
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsReady(true); // Vẫn đánh dấu ready để không chặn render app
        }
      }
    }

    setup();

    return () => {
      isMounted = false;
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
