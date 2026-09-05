import { z } from "zod";

// Env validation (zod). Validate LẠI ở nơi sử dụng thật (request-time) để không
// làm fail build khi chưa có .env.local. Service role key chỉ đọc ở server.

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

let cachedPublic: PublicEnv | null = null;

export function getPublicEnv(): PublicEnv {
  if (!cachedPublic) {
    cachedPublic = publicEnvSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });
  }
  return cachedPublic;
}

let cachedServer: z.infer<typeof serverEnvSchema> | null = null;

export function getServerEnv(): z.infer<typeof serverEnvSchema> {
  if (!cachedServer) {
    cachedServer = serverEnvSchema.parse(process.env);
  }
  return cachedServer;
}
