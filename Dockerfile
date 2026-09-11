# syntax=docker/dockerfile:1

# App: Next.js 15 (App Router) — build bằng Bun, chạy bằng `next start`.
# NEXT_PUBLIC_* được "bake" vào bundle lúc build nên phải truyền qua build-arg.
# SUPABASE_SERVICE_ROLE_KEY chỉ đọc lúc chạy (runtime env), không bake vào image.

# ---------- Build ----------
FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock* pnpm-lock.yaml* ./
RUN bun install

COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1

RUN bun run build

# ---------- Run ----------
FROM oven/bun:1 AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/package.json ./
COPY --from=builder /app/bun.lock ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 3000

CMD ["bun", "run", "start"]
