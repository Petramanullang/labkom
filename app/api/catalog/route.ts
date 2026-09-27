import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toMenuItem, type MenuRow } from "@/lib/menu";
import { jakartaDate } from "@/lib/batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Katalog publik untuk storefront.
 * Hanya menu dengan `is_active = true` yang dikirim.
 */
export async function GET() {
  try {
    const supabase = createAdminClient();
    const today = jakartaDate();
    const [menuResult, batchResult] = await Promise.all([
      supabase
        .from("menu_items")
        .select(
          "id,name,short_description,price,category,tag,image_path,image_url,is_active,sort_order",
        )
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      // Batch aktif yang mencakup hari ini (diatur admin di dashboard).
      supabase
        .from("sales_batches")
        .select("id,name,starts_at,ends_at,delivery_date")
        .eq("is_active", true)
        .lte("starts_at", today)
        .or(`ends_at.is.null,ends_at.gte.${today}`)
        .order("starts_at", { ascending: false })
        .limit(1),
    ]);
    if (menuResult.error) throw menuResult.error;
    return NextResponse.json({
      success: true,
      data: {
        items: ((menuResult.data ?? []) as MenuRow[]).map(toMenuItem),
        batch: batchResult.data?.[0] ?? null,
      },
    });
  } catch (error) {
    console.error("catalog error", error);
    return NextResponse.json(
      { success: false, error: "Gagal memuat katalog menu." },
      { status: 500 },
    );
  }
}
