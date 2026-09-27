import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { jakartaDate } from "@/lib/batch";

export const runtime = "nodejs";

/**
 * Terapkan ulang aturan batch ke order yang belum punya batch.
 *
 * Berguna setelah admin mengubah/menambah periode batch: order lama yang
 * tadinya "tanpa batch" akan dicocokkan ke batch yang mencakup tanggalnya.
 */
export async function POST() {
  const auth = await requireAdmin();
  if (!auth.user)
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: 401 },
    );

  const supabase = createAdminClient();
  try {
    const { data: batches, error: batchError } = await supabase
      .from("sales_batches")
      .select("id,name,starts_at,ends_at")
      .eq("is_active", true)
      .order("starts_at", { ascending: false });
    if (batchError) throw batchError;
    if (!batches?.length) {
      return NextResponse.json({
        success: true,
        data: { updated: 0, message: "Belum ada batch aktif." },
      });
    }

    const { data: orders, error: orderError } = await supabase
      .from("orders")
      .select("id,created_at")
      .is("batch_id", null);
    if (orderError) throw orderError;

    let updated = 0;
    for (const order of orders ?? []) {
      const date = jakartaDate(order.created_at as string);
      const match = batches.find(
        (batch) =>
          date >= String(batch.starts_at) && date <= String(batch.ends_at ?? batch.starts_at),
      );
      if (!match) continue;
      const { error } = await supabase
        .from("orders")
        .update({ batch_id: match.id })
        .eq("id", order.id);
      if (!error) updated += 1;
    }

    return NextResponse.json({
      success: true,
      data: {
        updated,
        scanned: orders?.length ?? 0,
        message: updated
          ? `${updated} order dipindahkan ke batch yang sesuai.`
          : "Semua order sudah punya batch.",
      },
    });
  } catch (error) {
    console.error("assign batches error", error);
    return NextResponse.json(
      { success: false, error: "Gagal menerapkan ulang batch." },
      { status: 500 },
    );
  }
}
