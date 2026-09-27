import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type BatchRef = {
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  delivery_date: string | null;
  note: string | null;
} | null;

type ReceiptOrderRow = {
  order_code: string;
  whatsapp: string;
  status: "pending" | "verified" | "rejected";
  created_at: string;
  updated_at: string | null;
  verified_at: string | null;
  batch_id: string | null;
  sales_batches: BatchRef;
};

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

function deliverySchedule(batch: BatchRef): string | null {
  if (!batch) return null;

  const deliveryDate = formatDate(batch.delivery_date);
  if (deliveryDate) return `Pengambilan: ${deliveryDate}`;

  const startsAt = formatDate(batch.starts_at);
  const endsAt = formatDate(batch.ends_at);
  if (startsAt && endsAt && startsAt !== endsAt) return `Periode: ${startsAt} - ${endsAt}`;
  if (startsAt) return `Periode: ${startsAt}`;

  return batch.note || null;
}

/**
 * Endpoint publik terbatas untuk menyegarkan status receipt pembeli.
 * Pembeli harus membawa kode order dan nomor WhatsApp yang sama dengan order.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderCode = url.searchParams.get("orderCode")?.trim();
  const whatsapp = url.searchParams.get("whatsapp")?.trim();

  if (!orderCode || !whatsapp) {
    return NextResponse.json(
      { success: false, error: "Kode order dan WhatsApp wajib diisi." },
      { status: 400 },
    );
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("orders")
      .select(
        "order_code,whatsapp,status,created_at,updated_at,verified_at,batch_id,sales_batches(name,starts_at,ends_at,delivery_date,note)",
      )
      .eq("order_code", orderCode)
      .eq("whatsapp", whatsapp)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { success: false, error: "Receipt tidak ditemukan." },
        { status: 404 },
      );
    }

    const order = data as unknown as ReceiptOrderRow;
    const batch = order.sales_batches;

    return NextResponse.json({
      success: true,
      data: {
        orderCode: order.order_code,
        status: order.status,
        updatedAt: order.updated_at ?? order.created_at,
        verifiedAt: order.verified_at,
        batch: batch
          ? {
              name: batch.name,
              startsAt: batch.starts_at,
              endsAt: batch.ends_at,
              deliveryDate: batch.delivery_date,
              note: batch.note,
            }
          : null,
        deliverySchedule: deliverySchedule(batch),
      },
    });
  } catch (error) {
    console.error("receipt status error", error);
    return NextResponse.json(
      { success: false, error: "Gagal memuat status receipt." },
      { status: 500 },
    );
  }
}
