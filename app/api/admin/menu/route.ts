import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { toMenuItem, type MenuRow } from "@/lib/menu";
import { menuSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Daftar semua menu (termasuk yang nonaktif) untuk halaman dashboard. */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  try {
    const { data, error } = await createAdminClient()
      .from("menu_items")
      .select("id,name,short_description,price,cost_price,category,tag,image_path,image_url,is_active,sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ success: true, data: ((data ?? []) as MenuRow[]).map(toMenuItem) });
  } catch (error) {
    console.error("list menu error", error);
    return NextResponse.json({ success: false, error: "Gagal memuat daftar menu." }, { status: 500 });
  }
}

/** Tambah menu baru. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  const parsed = menuSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Data menu tidak valid." }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const { data, error } = await createAdminClient()
      .from("menu_items")
      .insert({
        name: input.name,
        short_description: input.short || null,
        price: input.price,
        cost_price: input.costPrice,
        category: input.category || "Makanan Utama",
        tag: input.tag || null,
        image_path: input.imagePath || null,
        image_url: input.imageUrl || null,
        is_active: input.isActive,
        sort_order: input.sortOrder,
      })
      .select("id,name,short_description,price,cost_price,category,tag,image_path,image_url,is_active,sort_order")
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, data: toMenuItem(data as MenuRow) }, { status: 201 });
  } catch (error) {
    const message = (error as { code?: string }).code === "23505"
      ? "Nama menu itu sudah ada. Gunakan nama lain."
      : "Gagal menyimpan menu baru.";
    console.error("create menu error", error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}



