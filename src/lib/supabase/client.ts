"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

export function createClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getPublicEnv();
  // Always proxy Supabase requests through Next.js server (rewrites) in the browser
  // to avoid CORS and port-forwarding issues in cloud/homelab environments.
  const url = typeof window !== "undefined"
    ? window.location.origin
    : NEXT_PUBLIC_SUPABASE_URL;

  return createBrowserClient<Database>(url, NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
