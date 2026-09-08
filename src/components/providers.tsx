"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { makeQueryClient } from "@/lib/query-client";
import { OfflineSyncProvider } from "@/components/offline/offline-sync-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
        <OfflineSyncProvider>
          {children}
        </OfflineSyncProvider>
        <Toaster position="top-center" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
