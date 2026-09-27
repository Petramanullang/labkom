import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROOF_BUCKET = "payment-proofs";
const STATUSES = new Set(["pending", "verified", "rejected"]);

type OrderRow = {
  id: string;
  payment_proof_provider: string | null;
  payment_proof_file_id: string | null;
  payment_proof_path: string | null;
  [key: string]: unknown;
};

/**
 * Daftar order untuk dashboard.
 * Mendukung filter status, batch, dan pencarian, serta mengembalikan
 * `proof_url` yang aman: file Drive dibuka lewat proxy admin, file lama
 * (Supabase Storage) memakai signed URL.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.user)
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: 401 },
    );

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const batch = url.searchParams.get("batch");
  const search = (url.searchParams.get("q") || "")
    .replace(/[%,()*]/g, " ")
    .trim();
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || 200, 1),
    500,
  );

  try {
    const supabase = createAdminClient();
    let query = supabase
      .from("orders")
      .select(
        "id,order_code,customer_name,whatsapp,pickup_type,pickup_address,menu_summary,quantity,total_amount,status,payment_proof_provider,payment_proof_file_id,payment_proof_path,payment_proof_name,payment_proof_size,created_at,batch_id,batches:sales_batches(id,name,starts_at,ends_at)",
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status && STATUSES.has(status)) query = query.eq("status", status);
    if (batch === "none") query = query.is("batch_id", null);
    else if (batch) query = query.eq("batch_id", batch);
    if (search) {
      query = query.or(
        `customer_name.ilike.%${search}%,order_code.ilike.%${search}%,whatsapp.ilike.%${search}%,menu_summary.ilike.%${search}%`,
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as unknown as OrderRow[];
    const orders = await Promise.all(
      rows.map(async (row) => {
        let proofUrl: string | null = null;
        if (row.payment_proof_file_id) {
          // File ada di Google Drive → selalu lewat proxy agar tetap privat.
          proofUrl = `/api/admin/orders/${row.id}/proof`;
        } else if (row.payment_proof_path) {
          const signed = await supabase.storage
            .from(PROOF_BUCKET)
            .createSignedUrl(row.payment_proof_path, 600);
          proofUrl = signed.data?.signedUrl ?? null;
        }
        return { ...row, proof_url: proofUrl };
      }),
    );

    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    console.error("list orders error", error);
    return NextResponse.json(
      { success: false, error: "Gagal memuat data order." },
      { status: 500 },
    );
  }
}
