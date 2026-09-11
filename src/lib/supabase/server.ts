import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

// Server client dùng cookies (request-scoped). Chỉ dùng trong Server Components,
// Server Actions, Route Handlers. Được bọc trong React cache() để dùng lại cùng
// một instance trong suốt một lượt render (tránh khởi tạo lại nhiều lần).
export const createClient = cache(async () => {
  const cookieStore = await cookies();
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getPublicEnv();

  return createServerClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — can be ignored if middleware refreshes sessions.
        }
      },
    },
  });
});
