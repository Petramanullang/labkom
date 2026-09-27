"use client";

import { getCheckoutRef } from "@/lib/client-ref";

export type TransactionResult = {
  transaction_id: string;
  status: string;
  created_at: string;
  duplicated?: boolean;
  /** Batch yang ditentukan otomatis oleh database saat order masuk. */
  batch?: {
    name: string;
    starts_at: string | null;
    ends_at: string | null;
    delivery_date?: string | null;
    note?: string | null;
  } | null;
};

export type TransactionItem = {
  /** id menu (uuid) dari tabel menu_items. */
  menuItemId?: string;
  productName: string;
  unitPrice: number;
  quantity: number;
};

export async function createTransaction(input: {
  name: string;
  whatsapp: string;
  pickupType: "campus" | "dorm";
  address: string;
  menu: string;
  quantity: number;
  total: number;
  items: TransactionItem[];
  proof: File;
}): Promise<TransactionResult> {
  const form = new FormData();
  form.set("client_ref", getCheckoutRef());
  form.set("name", input.name);
  form.set("whatsapp", input.whatsapp);
  form.set("pickup_type", input.pickupType);
  form.set("address", input.address);
  form.set("menu", input.menu);
  form.set("qty", String(input.quantity));
  form.set("total", String(input.total));
  form.set("items", JSON.stringify(input.items));
  form.set("proof", input.proof);
  const response = await fetch("/api/transaction", { method: "POST", body: form });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) throw new Error(result?.error || "Gagal mengirim transaksi.");
  return result.data as TransactionResult;
}

