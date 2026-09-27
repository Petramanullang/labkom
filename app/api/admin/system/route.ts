import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  driveConfig,
  isDriveConfigured,
  proofStorageMode,
} from "@/lib/google-drive";
import { jakartaDate } from "@/lib/batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ringkasan konfigurasi agar admin bisa memastikan pembagian penyimpanan:
 * foto menu di Supabase Storage, bukti bayar di Google Drive.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.user)
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: 401 },
    );

  try {
    const supabase = createAdminClient();
    const today = jakartaDate();
    const [menu, activeMenu, batches] = await Promise.all([
      supabase.from("menu_items").select("id", { count: "exact", head: true }),
      supabase
        .from("menu_items")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      supabase
        .from("sales_batches")
        .select("name")
        .eq("is_active", true)
        .lte("starts_at", today)
        .or(`ends_at.is.null,ends_at.gte.${today}`)
        .limit(1),
    ]);

    const config = driveConfig();
    return NextResponse.json({
      success: true,
      data: {
        proofStorage: proofStorageMode(),
        driveConfigured: isDriveConfigured(),
        driveFolderConfigured: Boolean(config?.folderId),
        menuBucket: "menu-images",
        menuCount: menu.count ?? 0,
        activeMenuCount: activeMenu.count ?? 0,
        batchCount: batches.data?.length ?? 0,
        activeBatchName: batches.data?.[0]?.name ?? null,
      },
    });
  } catch (error) {
    console.error("system status error", error);
    return NextResponse.json(
      { success: false, error: "Gagal memuat status sistem." },
      { status: 500 },
    );
  }
}
