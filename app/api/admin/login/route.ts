import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6).max(200),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { success: false, error: "Email dan password tidak valid." },
      { status: 400 },
    );
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    return NextResponse.json(
      { success: false, error: "Konfigurasi Supabase belum lengkap." },
      { status: 500 },
    );
  const response = NextResponse.json({
    success: true,
    redirectTo: "/dashboard",
  });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (all) =>
        all.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        ),
    },
  });
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user)
    return NextResponse.json(
      { success: false, error: "Email atau password salah." },
      { status: 401 },
    );
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    await supabase.auth.signOut();
    return NextResponse.json(
      { success: false, error: "Akun ini tidak memiliki akses admin." },
      { status: 403 },
    );
  }
  return response;
}


