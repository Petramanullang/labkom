import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { toMenuItem, type MenuRow } from "@/lib/menu";
import { menuSchema } from "@/lib/validation";

export const runtime = "nodejs";
const MENU_BUCKET = "menu-images";

/** Ubah menu. Foto lama di Supabase Storage dibersihkan bila diganti. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  const { id } = await params;
  const parsed = menuSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Data menu tidak valid." }, { status: 400 });
  }
  const input = parsed.data;
  const supabase = createAdminClient();

  try {
    const { data: current } = await supabase
      .from("menu_items")
      .select("image_path")
      .eq("id", id)
      .maybeSingle();

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.short !== undefined) patch.short_description = input.short || null;
    if (input.price !== undefined) patch.price = input.price;
    if (input.costPrice !== undefined) patch.cost_price = input.costPrice;
    if (input.category !== undefined) patch.category = input.category;
    if (input.tag !== undefined) patch.tag = input.tag || null;
    if (input.imagePath !== undefined) patch.image_path = input.imagePath || null;
    if (input.imageUrl !== undefined) patch.image_url = input.imageUrl || null;
    if (input.isActive !== undefined) patch.is_active = input.isActive;
    if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;

    if (!Object.keys(patch).length) {
      return NextResponse.json({ success: false, error: "Tidak ada perubahan yang dikirim." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("menu_items")
      .update(patch)
      .eq("id", id)
      .select("id,name,short_description,price,cost_price,category,tag,image_path,image_url,is_active,sort_order")
      .single();
    if (error) throw error;

    const oldPath = current?.image_path as string | null | undefined;
    if (oldPath && patch.image_path !== undefined && oldPath !== patch.image_path) {
      await supabase.storage.from(MENU_BUCKET).remove([oldPath]);
    }

    return NextResponse.json({ success: true, data: toMenuItem(data as MenuRow) });
  } catch (error) {
    const message = (error as { code?: string }).code === "23505"
      ? "Nama menu itu sudah dipakai menu lain."
      : "Gagal memperbarui menu.";
    console.error("update menu error", error);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

/** Hapus menu beserta fotonya. Riwayat order lama tetap utuh (nama disimpan di order_items). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  const { id } = await params;
  const supabase = createAdminClient();
  try {
    const { data: current } = await supabase.from("menu_items").select("image_path").eq("id", id).maybeSingle();
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) throw error;
    const imagePath = current?.image_path as string | null | undefined;
    if (imagePath) await supabase.storage.from(MENU_BUCKET).remove([imagePath]);
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("delete menu error", error);
    return NextResponse.json({ success: false, error: "Gagal menghapus menu." }, { status: 500 });
  }
}


