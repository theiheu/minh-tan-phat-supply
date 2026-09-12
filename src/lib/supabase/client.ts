"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

export function createClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getPublicEnv();
  const url =
    typeof window !== "undefined" && window.location.protocol === "https:" && NEXT_PUBLIC_SUPABASE_URL.startsWith("http://")
      ? window.location.origin
      : NEXT_PUBLIC_SUPABASE_URL;

  return createBrowserClient<Database>(url, NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
