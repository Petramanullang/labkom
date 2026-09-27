import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { orderCode } from "@/lib/order";
import {
  driveConfig,
  isDriveConfigured,
  proofStorageMode,
  uploadPaymentProof,
  deletePaymentProof,
  DriveError,
} from "@/lib/google-drive";

export const runtime = "nodejs";

const PROOF_BUCKET = "payment-proofs"; // hanya dipakai bila mode penyimpanan = supabase
const types = new Set(["image/jpeg", "image/png", "application/pdf"]);
const MAX_PROOF_BYTES = 5 * 1024 * 1024;

const schema = z.object({
  clientRef: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  whatsapp: z.string().trim().min(8).max(30),
  pickupType: z.enum(["campus", "dorm"]).optional(),
  address: z.string().trim().min(5).max(500),
  menu: z.string().trim().min(2).max(2000),
  quantity: z.coerce.number().int().positive().max(100),
  total: z.coerce.number().positive().max(100000000),
  items: z
    .array(
      z.object({
        // Identifier menu baru (uuid dari tabel menu_items).
        menuItemId: z.string().uuid().optional(),
        // Identifier lama (integer) — tetap diterima agar data lama tidak pecah.
        productId: z.coerce.number().int().positive().optional(),
        productName: z.string().trim().min(1).max(200),
        unitPrice: z.coerce.number().nonnegative(),
        quantity: z.coerce.number().int().positive().max(100),
      }),
    )
    .min(1)
    .max(50),
});

type BatchRef = {
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  delivery_date: string | null;
  note: string | null;
};

type OrderRow = {
  id: string;
  order_code: string;
  status: string;
  created_at: string;
  batch_id: string | null;
  sales_batches: BatchRef | BatchRef[] | null;
};

function normalizeBatch(batch: BatchRef | BatchRef[] | null | undefined) {
  return Array.isArray(batch) ? (batch[0] ?? null) : (batch ?? null);
}

export async function POST(request: Request) {
  let uploadedDriveFileId: string | null = null;
  let uploadedSupabasePath: string | null = null;
  let createdOrderId: string | null = null;

  try {
    const form = await request.formData();
    let itemsRaw: unknown = [];
    try {
      itemsRaw = JSON.parse(String(form.get("items") || "[]"));
    } catch {
      itemsRaw = [];
    }

    const parsed = schema.safeParse({
      clientRef: form.get("client_ref"),
      name: form.get("name"),
      whatsapp: form.get("whatsapp"),
      pickupType: form.get("pickup_type") || undefined,
      address: form.get("address"),
      menu: form.get("menu"),
      quantity: form.get("qty"),
      total: form.get("total"),
      items: itemsRaw,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Data pesanan tidak valid." },
        { status: 400 },
      );
    }

    const proof = form.get("proof");
    if (!(proof instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Bukti pembayaran wajib diunggah." },
        { status: 400 },
      );
    }
    if (!types.has(proof.type)) {
      return NextResponse.json(
        { success: false, error: "File harus PNG, JPG, atau PDF." },
        { status: 400 },
      );
    }
    if (proof.size > MAX_PROOF_BYTES) {
      return NextResponse.json(
        { success: false, error: "Ukuran file maksimal 5 MB." },
        { status: 400 },
      );
    }

    const input = parsed.data;
    const supabase = createAdminClient();

    console.log("SUPABASE URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);

    // Idempotensi: client_ref yang sama tidak membuat order kedua.
    const { data: existing, error: existingError } = await supabase
      .from("orders")
      .select("order_code,status,created_at,batch_id,sales_batches(name,starts_at,ends_at,delivery_date,note)")
      .eq("client_ref", input.clientRef)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      const existingBatch = normalizeBatch(existing.sales_batches);
      return NextResponse.json({
        success: true,
        data: {
          transaction_id: existing.order_code,
          status: existing.status,
          created_at: existing.created_at,
          duplicated: true,
          batch: existingBatch
            ? {
                name: existingBatch.name,
                starts_at: existingBatch.starts_at,
                ends_at: existingBatch.ends_at,
                delivery_date: existingBatch.delivery_date,
                note: existingBatch.note,
              }
            : null,
        },
      });
    }

    // Harga & nama diambil ulang dari database bila menu masih ada, sehingga
    // total tidak bisa diubah dari sisi browser.
    const menuIds = input.items
      .map((item) => item.menuItemId)
      .filter((id): id is string => Boolean(id));
    const priceMap = new Map<string, { name: string; price: number; costPrice: number }>();
    if (menuIds.length) {
      const { data: menuRows, error: menuError } = await supabase
        .from("menu_items")
        .select("id,name,price,cost_price,is_active")
        .in("id", menuIds);
      if (menuError) throw menuError;
      (menuRows ?? []).forEach((row) => {
        priceMap.set(String(row.id), {
          name: String(row.name),
          price: Number(row.price),
          costPrice: Number(row.cost_price ?? 0),
        });
      });
    }

    const items = input.items.map((item) => {
      const fromDb = item.menuItemId
        ? priceMap.get(item.menuItemId)
        : undefined;
      return {
        menuItemId: item.menuItemId ?? null,
        productId: item.productId ?? null,
        productName: fromDb?.name ?? item.productName,
        unitPrice: fromDb?.price ?? item.unitPrice,
        costPrice: fromDb?.costPrice ?? 0,
        quantity: item.quantity,
      };
    });
    const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const total = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );

    // ---- Unggah bukti bayar -------------------------------------------------
    const mode = proofStorageMode();
    const useDrive = mode === "google_drive" && isDriveConfigured();
    const code = orderCode();
    const buffer = Buffer.from(await proof.arrayBuffer());

    let proofMeta: {
      provider: string;
      path: string | null;
      fileId: string | null;
      url: string | null;
      name: string;
      size: number;
    };

    if (useDrive) {
      const uploaded = await uploadPaymentProof({
        buffer,
        fileName: proof.name,
        mimeType: proof.type,
        orderCode: code,
        clientRef: input.clientRef,
      });
      uploadedDriveFileId = uploaded.fileId;
      proofMeta = {
        provider: "google_drive",
        path: `google-drive/${uploaded.fileId}`, // kolom lama tetap diisi agar mudah dilacak
        fileId: uploaded.fileId,
        url: uploaded.url,
        name: uploaded.name,
        size: uploaded.size ?? proof.size,
      };
    } else if (mode === "google_drive") {
      // Mode Drive dipilih tetapi kredensialnya belum lengkap → jangan diam-diam
      // menyimpan ke Supabase, beri tahu admin supaya konfigurasinya dibenahi.
      if (!driveConfig()) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Penyimpanan bukti bayar (Google Drive) belum dikonfigurasi. Hubungi admin.",
          },
          { status: 503 },
        );
      }
      throw new Error("unreachable");
    } else {
      const path = `pending/${input.clientRef}/${Date.now()}-${proof.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage
        .from(PROOF_BUCKET)
        .upload(path, proof, { contentType: proof.type, upsert: false });
      if (uploadError) throw uploadError;
      uploadedSupabasePath = path;
      proofMeta = {
        provider: "supabase",
        path,
        fileId: null,
        url: null,
        name: proof.name,
        size: proof.size,
      };
    }

    // ---- Simpan order (batch ditentukan otomatis oleh trigger di database) ---
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_code: code,
        client_ref: input.clientRef,
        customer_name: input.name,
        whatsapp: input.whatsapp,
        pickup_type: input.pickupType || null,
        pickup_address: input.address,
        menu_summary: input.menu,
        quantity,
        total_amount: total,
        payment_proof_path: proofMeta.path,
        payment_proof_provider: proofMeta.provider,
        payment_proof_file_id: proofMeta.fileId,
        payment_proof_url: proofMeta.url,
        payment_proof_name: proofMeta.name,
        payment_proof_size: proofMeta.size,
        status: "pending",
      })
      .select(
        "id,order_code,status,created_at,batch_id,sales_batches(name,starts_at,ends_at,delivery_date,note)",
      )
      .single();
    if (orderError || !order)
      throw orderError || new Error("Gagal menyimpan order.");
    createdOrderId = order.id;
    const saved = order as unknown as OrderRow;

    const { error: itemsError } = await supabase.from("order_items").insert(
      items.map((item) => ({
        order_id: saved.id,
        menu_item_id: item.menuItemId,
        product_id: item.productId,
        product_name: item.productName,
        unit_price: item.unitPrice,
        cost_price: item.costPrice,
        quantity: item.quantity,
      })),
    );
    if (itemsError) throw itemsError;

    const savedBatch = normalizeBatch(saved.sales_batches);

    return NextResponse.json(
      {
        success: true,
        data: {
          transaction_id: saved.order_code,
          status: saved.status,
          created_at: saved.created_at,
          duplicated: false,
          batch: savedBatch
            ? {
                name: savedBatch.name,
                starts_at: savedBatch.starts_at,
                ends_at: savedBatch.ends_at,
                delivery_date: savedBatch.delivery_date,
                note: savedBatch.note,
              }
            : null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("create transaction error", error);
    // Bersihkan sisa data supaya tidak ada order/file menggantung.
    try {
      const supabase = createAdminClient();
      if (createdOrderId)
        await supabase.from("orders").delete().eq("id", createdOrderId);
      if (uploadedSupabasePath)
        await supabase.storage
          .from(PROOF_BUCKET)
          .remove([uploadedSupabasePath]);
    } catch (cleanupError) {
      console.error("cleanup error", cleanupError);
    }
    if (uploadedDriveFileId) {
      try {
        await deletePaymentProof(uploadedDriveFileId);
      } catch (cleanupError) {
        console.error("drive cleanup error", cleanupError);
      }
    }
    return NextResponse.json(
      {
        success: false,
        error: "Gagal menyimpan transaksi. Silakan coba lagi.",
      },
      { status: 500 },
    );
  }
}
