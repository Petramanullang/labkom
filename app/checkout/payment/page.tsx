"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, FileUp, Leaf, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { PendingOverlay, Spinner } from "@/components/ui/pending-overlay";
import { useAsyncAction } from "@/lib/use-async-action";
import { createTransaction } from "@/lib/create-transaction";
import { resetCheckoutRef } from "@/lib/client-ref";
import type { MenuItem } from "@/lib/menu";

type Info = {
  name: string;
  whatsapp: string;
  pickupType: "campus" | "dorm";
  pickup: string;
  pickupAddress: string;
  total: number;
  items: MenuItem[];
  cart: Record<string, number>;
};

const rupiah = (n: number) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
const MAX_BYTES = 5 * 1024 * 1024;

export default function PaymentPage() {
  const router = useRouter();
  const [info, setInfo] = useState<Info | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [batchName, setBatchName] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("labkom-checkout-info");
      if (raw) setInfo(JSON.parse(raw) as Info);
    } catch {
      setInfo(null);
    }
    setHydrated(true);
  }, []);

  const lines = useMemo(
    () =>
      (info?.items ?? [])
        .map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: Number(info?.cart[item.id] || 0),
        }))
        .filter((line) => line.quantity > 0),
    [info],
  );

  const { run, pending } = useAsyncAction(
    async () => {
      if (!info || !file) throw new Error("Unggah bukti pembayaran terlebih dahulu.");
      const items = lines.map((line) => ({
        menuItemId: line.id,
        productName: line.name,
        unitPrice: line.price,
        quantity: line.quantity,
      }));
      const result = await createTransaction({
        name: info.name,
        whatsapp: info.whatsapp,
        pickupType: info.pickupType,
        address: info.pickupAddress,
        menu: items.map((item) => `${item.productName} x${item.quantity}`).join(", "),
        quantity: items.reduce((sum, item) => sum + item.quantity, 0),
        total: info.total,
        items,
        proof: file,
      });

      localStorage.setItem(
        "labkom-last-order",
        JSON.stringify({
          id: result.transaction_id,
          name: info.name,
          whatsapp: info.whatsapp,
          pickup: info.pickup,
          pickupAddress: info.pickupAddress,
          total: info.total,
          fileName: file.name,
          createdAt: new Date(result.created_at).toLocaleString("id-ID"),
          status: result.status,
          batch: result.batch?.name ?? null,
        }),
      );
      localStorage.removeItem("labkom-cart");
      localStorage.removeItem("labkom-checkout-info");
      resetCheckoutRef();
      setBatchName(result.batch?.name ?? null);
      setSubmitted(true);
    },
    {
      onError: (caught) =>
        setError(caught instanceof Error ? caught.message : "Gagal mengirim pembayaran."),
    },
  );

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] || null;
    if (selected && selected.size > MAX_BYTES) {
      setError("Ukuran bukti pembayaran maksimal 5 MB.");
      event.target.value = "";
      return;
    }
    setFile(selected);
    setError("");
  }

  if (!hydrated) {
    return <main className="grid min-h-screen place-items-center bg-[#fbfaf6]">Memuat pembayaran…</main>;
  }

  if (!info) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fbfaf6] px-4">
        <button
          onClick={() => router.push("/")}
          className="h-12 rounded-xl bg-[#176b57] px-6 font-bold text-white"
        >
          Checkout belum dimulai — kembali ke menu
        </button>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fbfaf6] p-4 text-[#173d36]">
        <section className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <Check className="mx-auto text-[#176b57]" size={42} />
          <h1 className="mt-4 text-3xl font-black">Pembayaran terkirim</h1>
          <p className="mt-3 text-sm text-[#71807a]">
            Pesanan sedang menunggu verifikasi admin. Bukti bayar sudah tersimpan aman.
          </p>
          {batchName && (
            <p className="mt-3 rounded-xl bg-[#eaf4ee] p-3 text-sm font-bold text-[#176b57]">
              Masuk ke {batchName}
            </p>
          )}
          <button
            onClick={() => router.push("/receipt")}
            className="mt-6 h-12 w-full rounded-xl bg-[#176b57] font-bold text-white"
          >
            Lihat receipt
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbfaf6] px-4 pb-12 text-[#173d36] sm:px-6">
      <header className="mx-auto flex max-w-3xl items-center justify-between py-5">
        <button
          onClick={() => router.push("/checkout")}
          disabled={pending}
          className="flex items-center gap-2 text-sm font-bold text-[#176b57] disabled:opacity-50"
        >
          <ArrowLeft size={18} /> Data pemesan
        </button>
        <div className="flex items-center gap-2">
          <Leaf className="text-[#176b57]" />
          <strong>LabKom</strong>
        </div>
      </header>

      <section className="mx-auto max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[#b84f43]">Langkah 2 dari 2</p>
        <h1 className="mt-2 text-3xl font-black">Pembayaran</h1>

        <div className="relative mt-7 rounded-3xl bg-white p-5 shadow-sm sm:p-8">
          {pending && <PendingOverlay label="Mengirim pembayaran…" detail="Jangan tutup halaman ini." />}

          <div className="grid gap-6 sm:grid-cols-[180px_1fr] sm:items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/QR.jpeg"
              alt="QRIS LabKom"
              className="aspect-square w-full rounded-2xl object-contain"
            />
            <div>
              <p className="text-sm text-[#71807a]">Total yang harus dibayar</p>
              <strong className="mt-1 block text-3xl font-black text-[#b84f43]">{rupiah(info.total)}</strong>
              <p className="mt-3 text-sm text-[#66766e]">Scan QRIS lalu unggah bukti pembayaran.</p>
            </div>
          </div>

          <div className="mt-7 rounded-2xl bg-[#f7faf7] p-4">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#8b9a94]">Rincian pesanan</p>
            <ul className="mt-3 grid gap-2 text-sm">
              {lines.map((line) => (
                <li key={line.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {line.name} <span className="text-[#71807a]">× {line.quantity}</span>
                  </span>
                  <strong className="shrink-0 tabular-nums">{rupiah(line.price * line.quantity)}</strong>
                </li>
              ))}
            </ul>
          </div>

          <label className="mt-6 grid cursor-pointer gap-2 rounded-2xl border-2 border-dashed border-[#b9cfc0] bg-[#f8fbf6] p-5 text-center transition hover:border-[#176b57]">
            <FileUp className="mx-auto text-[#176b57]" />
            <span className="font-bold">Upload bukti pembayaran</span>
            <span className="text-xs text-[#71807a]">PNG, JPG, atau PDF maksimal 5 MB</span>
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={choose}
              disabled={pending}
              className="sr-only"
            />
          </label>

          {file && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[#eaf4ee] px-3 py-2 text-sm font-bold text-[#176b57]">
              <span className="min-w-0 truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => setFile(null)}
                aria-label="Hapus file"
                className="shrink-0 opacity-70 hover:opacity-100"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-[#fff0ed] p-3 text-sm font-semibold text-[#a9493e]">
              {error}
            </p>
          )}

          <button
            onClick={() => void run()}
            disabled={pending || !file}
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#176b57] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending && <Spinner />}
            {pending ? "Mengirim pembayaran…" : "Kirim pembayaran"}
          </button>

          <p className="mt-4 flex items-start gap-2 text-xs text-[#71807a]">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#176b57]" />
            Bukti bayar disimpan di penyimpanan arsip khusus (bukan di database), jadi hanya admin yang bisa
            membukanya.
          </p>
        </div>
      </section>
    </main>
  );
}

