import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request }); const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;
  const supabase = createServerClient(url, key, { cookies: { getAll: () => request.cookies.getAll(), setAll: (all) => all.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) } });
  const { data: { user } } = await supabase.auth.getUser();
  return user ? response : NextResponse.redirect(new URL("/admin-login", request.url));
}
export const config = { matcher: ["/dashboard/:path*"] };
