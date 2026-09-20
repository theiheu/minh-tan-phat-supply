import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";

const PUBLIC_PATHS = [
  "/login",
  "/auth",
  "/opengraph-image",
  "/twitter-image",
  "/manifest",
  "/robots.txt",
  "/sitemap.xml",
  "/@powersync",
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getPublicEnv();
  const supabase = createServerClient<import("@/types/database.types").Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  // Server Action POST (có header `Next-Action`) hoặc API routes (`/api/*`):
  // KHÔNG redirect 307 sang HTML /login ở middleware khi chưa có session.
  // Để API routes và Actions tự trả về JSON (401 Unauthorized / Error) hoặc tự xử lý auth guard.
  const isServerAction = request.method === "POST" && request.headers.has("next-action");
  const isApiRoute = path.startsWith("/api/");

  if (!user && !isPublic && !isServerAction && !isApiRoute) {
    const url = request.nextUrl.clone();
    const fullRedirectPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", fullRedirectPath);
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
