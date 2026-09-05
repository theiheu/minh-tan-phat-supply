import { z } from "zod";

// Server-only env. NEVER import this module from a Client Component —
// SUPABASE_SERVICE_ROLE_KEY must not leak to the browser bundle.
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
});

export const env = envSchema.parse(process.env); // fail sớm nếu thiếu
