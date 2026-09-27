import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { batchPatchSchema } from "@/lib/validation";
import { toBatch, type BatchRow } from "@/lib/batch";

export const runtime = "nodejs";

/** Ubah batch. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.user) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: 401 },
    );
  }

  const { id } = await params;
  const parsed = batchPatchSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message || "Data batch tidak valid.",
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.startDate !== undefined) patch.starts_at = input.startDate;
  if (input.endDate !== undefined) patch.ends_at = input.endDate || null;
  if (input.deliveryDate !== undefined) {
    patch.delivery_date = input.deliveryDate || null;
  }
  if (input.description !== undefined) {
    patch.description = input.description || null;
  }
  if (input.note !== undefined) patch.note = input.note || null;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  if (!Object.keys(patch).length) {
    return NextResponse.json(
      { success: false, error: "Tidak ada perubahan yang dikirim." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  try {
    const { data: current, error: currentError } = await supabase
      .from("sales_batches")
      .select("id,starts_at,ends_at")
      .eq("id", id)
      .single();
    if (currentError) throw currentError;

    const startDate = String(patch.starts_at ?? current.starts_at);
    const endDate = (patch.ends_at ?? current.ends_at) as string | null;
    if (endDate && endDate < startDate) {
      return NextResponse.json(
        {
          success: false,
          error: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.",
        },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("sales_batches")
      .update(patch)
      .eq("id", id)
      .select(
        "id,name,description,starts_at,ends_at,delivery_date,note,is_active,created_at",
      )
      .single();
    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: toBatch(data as BatchRow),
    });
  } catch (error) {
    const message =
      (error as { code?: string }).code === "23505"
        ? "Nama batch itu sudah dipakai."
        : "Gagal memperbarui batch.";
    console.error("update batch error", error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 },
    );
  }
}

/** Hapus batch. Order tetap ada, batch_id menjadi null lewat ON DELETE SET NULL. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.user) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: 401 },
    );
  }

  const { id } = await params;
  const supabase = createAdminClient();
  try {
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", id);
    const { error } = await supabase
      .from("sales_batches")
      .delete()
      .eq("id", id);
    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: { id, releasedOrders: count ?? 0 },
    });
  } catch (error) {
    console.error("delete batch error", error);
    return NextResponse.json(
      { success: false, error: "Gagal menghapus batch." },
      { status: 500 },
    );
  }
}
