import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { deletePaymentProof } from "@/lib/google-drive";

export const runtime = "nodejs";

const schema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(["pending", "verified", "rejected"]),
  /** Opsional: pindahkan order ke batch lain (null = tanpa batch). */
  batchId: z.string().uuid().nullable().optional(),
  /** Opsional: hapus file bukti bayar di Drive (mis. order ditolak). */
  deleteProof: z.boolean().optional(),
});

/** Verifikasi / tolak / kembalikan order ke pending, sekaligus atur batch. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.user)
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: 401 },
    );

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Data perubahan status tidak valid." },
      { status: 400 },
    );
  }

  const { orderId, status, batchId, deleteProof } = parsed.data;
  const supabase = createAdminClient();

  try {
    const patch: Record<string, unknown> = {
      status,
      verified_at: status === "verified" ? new Date().toISOString() : null,
      verified_by: status === "verified" ? auth.user.id : null,
    };
    if (batchId !== undefined) patch.batch_id = batchId;

    const { data, error } = await supabase
      .from("orders")
      .update(patch)
      .eq("id", orderId)
      .select("id,order_code,status,batch_id,batches:sales_batches(id,name)")
      .single();
    if (error) throw error;

    let proofDeleted = false;
    if (deleteProof) {
      const { data: row } = await supabase
        .from("orders")
        .select("payment_proof_file_id,payment_proof_path")
        .eq("id", orderId)
        .maybeSingle();
      const fileId = row?.payment_proof_file_id as string | null | undefined;
      if (fileId) {
        await deletePaymentProof(fileId);
        proofDeleted = true;
      }
      if (row?.payment_proof_path) {
        await supabase.storage
          .from("payment-proofs")
          .remove([row.payment_proof_path as string]);
      }
      await supabase
        .from("orders")
        .update({
          payment_proof_url: null,
          payment_proof_file_id: null,
          payment_proof_path: null,
          payment_proof_name: null,
          payment_proof_size: null,
        })
        .eq("id", orderId);
    }

    return NextResponse.json({
      success: true,
      data: { ...data, proofDeleted },
    });
  } catch (error) {
    console.error("update order status error", error);
    return NextResponse.json(
      { success: false, error: "Gagal memperbarui status order." },
      { status: 500 },
    );
  }
}
