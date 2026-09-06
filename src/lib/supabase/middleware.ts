import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";

const PUBLIC_PATHS = ["/login", "/auth"];

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

  // Server Action POST (có header `Next-Action`): KHÔNG redirect ở middleware khi
  // hết session. Nếu redirect 307 ở đây, fetch của Next theo redirect sang trang
  // /login (HTML) → client không nhận được RSC → toast vô nghĩa
  // "An unexpected response was received from the server."
  // Thay vào đó, để action tự chặn qua requireManager()/requireProfile() —
  // redirect() ném TRONG action được client router xử lý đúng (x-action-redirect
  // → điều hướng sang /login), và mọi action bảo vệ đều đã tự gọi guard.
  const isServerAction = request.method === "POST" && request.headers.has("next-action");

  if (!user && !isPublic && !isServerAction) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
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
