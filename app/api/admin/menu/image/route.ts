import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MENU_BUCKET = "menu-images";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — cukup untuk foto menu
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/**
 * Unggah foto menu ke Supabase Storage (`menu-images`).
 * Ini satu-satunya file yang disimpan di Supabase — bukti bayar ada di Drive.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Pilih file gambar terlebih dahulu." }, { status: 400 });
    }
    const ext = EXT[file.type];
    if (!ext) {
      return NextResponse.json({ success: false, error: "Format harus JPG, PNG, WEBP, atau AVIF." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, error: "Ukuran gambar maksimal 2 MB." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const path = `menu/${randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(MENU_BUCKET).upload(path, file, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) throw error;

    const { data } = supabase.storage.from(MENU_BUCKET).getPublicUrl(path);
    return NextResponse.json({ success: true, data: { path, url: data.publicUrl } }, { status: 201 });
  } catch (error) {
    console.error("upload menu image error", error);
    return NextResponse.json({ success: false, error: "Gagal mengunggah gambar menu." }, { status: 500 });
  }
}

/** Hapus foto menu yang batal dipakai (mis. form dibatalkan). */
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  const path = new URL(request.url).searchParams.get("path");
  if (!path || !path.startsWith("menu/")) {
    return NextResponse.json({ success: false, error: "Path gambar tidak valid." }, { status: 400 });
  }
  try {
    const { error } = await createAdminClient().storage.from(MENU_BUCKET).remove([path]);
    if (error) throw error;
    return NextResponse.json({ success: true, data: { path } });
  } catch (error) {
    console.error("delete menu image error", error);
    return NextResponse.json({ success: false, error: "Gagal menghapus gambar." }, { status: 500 });
  }
}

