import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true }); const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;
  const supabase = createServerClient(url, key, { cookies: { getAll: () => request.cookies.getAll(), setAll: (all) => all.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) } });
  await supabase.auth.signOut(); return response;
}


