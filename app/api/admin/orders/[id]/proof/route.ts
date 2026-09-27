import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readPaymentProof, getProofLink } from "@/lib/google-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROOF_BUCKET = "payment-proofs";

/**
 * Menampilkan bukti bayar hanya untuk admin yang sudah login.
 *
 * - File di Google Drive → di-stream lewat server (file Drive tetap privat,
 *   tidak perlu dijadikan "anyone with the link").
 * - File lama di Supabase Storage → dialihkan ke signed URL.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  const { id } = await params;
  const supabase = createAdminClient();

  try {
    const { data: order, error } = await supabase
      .from("orders")
      .select("order_code,payment_proof_file_id,payment_proof_path,payment_proof_name")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!order) return NextResponse.json({ success: false, error: "Order tidak ditemukan." }, { status: 404 });

    if (order.payment_proof_file_id) {
      const file = await readPaymentProof(String(order.payment_proof_file_id));
      return new Response(file.stream, {
        headers: {
          "Content-Type": file.mimeType,
          "Content-Disposition": `inline; filename="${encodeURIComponent(file.name)}"`,
          "Cache-Control": "private, no-store",
          ...(file.size ? { "Content-Length": String(file.size) } : {}),
        },
      });
    }

    if (order.payment_proof_path) {
      // Kalau link Drive lama belum tersimpan, ambil ulang dari Drive.
      if (String(order.payment_proof_path).startsWith("google-drive/")) {
        const fileId = String(order.payment_proof_path).replace("google-drive/", "");
        const link = await getProofLink(fileId);
        return NextResponse.redirect(link);
      }
      const signed = await supabase.storage.from(PROOF_BUCKET).createSignedUrl(String(order.payment_proof_path), 600);
      if (signed.data?.signedUrl) return NextResponse.redirect(signed.data.signedUrl);
    }

    return NextResponse.json({ success: false, error: "Order ini tidak memiliki bukti bayar." }, { status: 404 });
  } catch (error) {
    console.error("proof proxy error", error);
    return NextResponse.json({ success: false, error: "Gagal membuka bukti pembayaran." }, { status: 500 });
  }
}

