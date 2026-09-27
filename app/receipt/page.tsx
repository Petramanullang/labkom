"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, Download, Leaf, ReceiptText } from "lucide-react";
import { useRouter } from "next/navigation";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { AsyncButton } from "@/components/ui/async-button";

type Order = {
  id: string;
  name: string;
  whatsapp: string;
  pickup: string;
  pickupAddress?: string;
  pickupType?: string;
  dormAddress?: string;
  total: number;
  fileName: string;
  createdAt: string;
  status?: "pending" | "verified" | "rejected" | string;
  deliverySchedule?: string | null;
  /** Nama batch yang ditentukan otomatis saat order masuk. */
  batch?: string | null;
};

type ReceiptStatusResponse = {
  orderCode: string;
  status: "pending" | "verified" | "rejected";
  updatedAt: string;
  verifiedAt: string | null;
  batch: {
    name: string;
    startsAt: string | null;
    endsAt: string | null;
    deliveryDate: string | null;
    note: string | null;
  } | null;
  deliverySchedule: string | null;
};

const rupiah = (value: number) => `Rp${value.toLocaleString("id-ID")}`;
const statusClass = (status?: string) =>
  status === "verified" || status === "Accepted"
    ? "bg-[#e2f3e5] text-[#176b57]"
    : status === "rejected" || status === "Rejected"
      ? "bg-[#fde8e5] text-[#a9493e]"
      : "bg-[#fff1d9] text-[#a66b1e]";

const statusLabel = (status?: string) =>
  status === "verified" || status === "Accepted"
    ? "Terverifikasi"
    : status === "rejected" || status === "Rejected"
      ? "Ditolak"
      : "Menunggu verifikasi";

export default function ReceiptPage() {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  /** false selama receipt masih dibaca dari perangkat. */
  const [hydrated, setHydrated] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem("labkom-last-order");
    if (saved) {
      try {
        setOrder(JSON.parse(saved) as Order);
      } catch {
        setOrder(null);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!order?.id || !order.whatsapp) return;

    const controller = new AbortController();

    const refreshStatus = async () => {
      setRefreshingStatus(true);
      setStatusError("");
      try {
        const params = new URLSearchParams({
          orderCode: order.id,
          whatsapp: order.whatsapp,
        });
        const response = await fetch(`/api/receipt/status?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || "Gagal memperbarui status receipt.");
        }

        const data = payload.data as ReceiptStatusResponse;
        setOrder((current) => {
          if (!current || current.id !== data.orderCode) return current;
          const updated: Order = {
            ...current,
            status: data.status,
            batch: data.batch?.name ?? current.batch ?? null,
            deliverySchedule: data.deliverySchedule ?? current.deliverySchedule ?? null,
          };
          window.localStorage.setItem("labkom-last-order", JSON.stringify(updated));
          return updated;
        });
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setStatusError(
          caught instanceof Error ? caught.message : "Gagal memperbarui status receipt.",
        );
      } finally {
        if (!controller.signal.aborted) setRefreshingStatus(false);
      }
    };

    void refreshStatus();
    const interval =
      !order.status || order.status === "pending"
        ? window.setInterval(() => void refreshStatus(), 10_000)
        : undefined;
    const onFocus = () => void refreshStatus();
    window.addEventListener("focus", onFocus);

    return () => {
      controller.abort();
      if (interval) window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [order?.id, order?.whatsapp, order?.status]);

  const downloadReceipt = () => {
    if (!order) return;
    const text = [
      "LABKOM RECEIPT",
      `ID Transaksi: ${order.id}`,
      `Nama: ${order.name}`,
      `WhatsApp: ${order.whatsapp}`,
      `Metode: ${order.pickup}`,
      `Lokasi: ${order.pickupAddress || order.dormAddress || "-"}`,
      `Total: ${rupiah(order.total)}`,
      `Status: ${statusLabel(order.status)}`,
      `Batch: ${order.batch || "Belum ditentukan"}`,
      `Jadwal: ${order.deliverySchedule || "Menunggu persetujuan panitia"}`,
      `Dibuat: ${order.createdAt}`,
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `receipt-${order.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-[#fbfaf6] px-4 pb-12 text-[#173d36] sm:px-6">
      <header className="mx-auto flex max-w-2xl items-center justify-between py-5">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-sm font-bold text-[#176b57]"
        >
          <ArrowLeft size={18} /> Kembali ke menu
        </button>
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#d9efe1] text-[#176b57]">
            <Leaf size={19} fill="currentColor" />
          </span>
          <strong className="text-lg font-black">LabKom</strong>
        </div>
      </header>
      <section className="mx-auto max-w-2xl">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#b84f43]">
            Bukti pesanan
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Receipt</h1>
          <p className="mt-2 text-sm text-[#66766e]">
            Receipt tersimpan di perangkat ini sebagai bukti pesanan.
          </p>
        </div>

        {!hydrated ? (
          <article
            className="rounded-3xl bg-white p-6 shadow-sm sm:p-8"
            role="status"
            aria-busy="true"
            aria-live="polite"
          >
            <span className="sr-only">Memuat receipt…</span>
            <div className="flex items-start justify-between border-b border-dashed border-[#c9d8cc] pb-5">
              <div className="grid gap-3">
                <Skeleton rounded="full" className="h-12 w-12" />
                <Skeleton className="h-6 w-44" />
              </div>
              <Skeleton rounded="full" className="h-6 w-24" />
            </div>
            <div className="grid gap-3 py-6">
              <Skeleton className="mx-auto h-3 w-24" />
              <Skeleton className="mx-auto h-7 w-40" />
            </div>
            <div className="grid gap-4 rounded-2xl bg-[#f7f6ef] p-4">
              <SkeletonText lines={5} />
            </div>
            <Skeleton rounded="xl" className="mt-6 h-12 w-full" />
          </article>
        ) : !order ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
            <ReceiptText className="mx-auto text-[#9bb4a4]" size={44} />
            <h2 className="mt-4 text-xl font-black">Belum ada receipt</h2>
            <button
              onClick={() => router.push("/")}
              className="mt-6 h-12 rounded-xl bg-[#176b57] px-6 font-extrabold text-white"
            >
              Pesan sekarang
            </button>
          </div>
        ) : (
          <article className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start justify-between border-b border-dashed border-[#c9d8cc] pb-5">
              <div>
                <span className="grid h-12 w-12 place-items-center rounded-full bg-[#dff0e2] text-[#176b57]">
                  <Check size={25} />
                </span>
                <h2 className="mt-4 text-2xl font-black">Pesanan tercatat</h2>
                <p className="mt-2 text-xs font-semibold text-[#71807a]">
                  {refreshingStatus ? "Memperbarui status…" : "Status tersinkron dengan server."}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(order.status)}`}
              >
                {statusLabel(order.status)}
              </span>
            </div>
            {statusError && (
              <p className="mt-4 rounded-xl bg-[#fff4e2] p-3 text-xs font-bold text-[#8a5a12]">
                {statusError}
              </p>
            )}
            <div className="py-5 text-center">
              <p className="text-xs uppercase tracking-widest text-[#75817d]">
                ID Transaksi
              </p>
              <strong className="mt-1 block text-2xl font-black text-[#176b57]">
                {order.id}
              </strong>
            </div>
            <div className="grid gap-3 rounded-2xl bg-[#f7f6ef] p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span>Nama</span>
                <strong>{order.name}</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span>Metode</span>
                <strong className="text-right">{order.pickup}</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span>Lokasi</span>
                <strong className="text-right">
                  {order.pickupAddress || order.dormAddress || "-"}
                </strong>
              </div>
              <div className="flex justify-between gap-4">
                <span>Batch</span>
                <strong className="text-right">{order.batch || "Belum ditentukan"}</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span>Total</span>
                <strong>{rupiah(order.total)}</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span>Status</span>
                <strong className="text-right">{statusLabel(order.status)}</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span>Jadwal</span>
                <strong className="text-right">
                  {order.deliverySchedule || "Menunggu persetujuan panitia"}
                </strong>
              </div>
            </div>
            <AsyncButton
              onAction={downloadReceipt}
              pendingLabel="Menyiapkan file…"
              className="mt-6 h-12 w-full rounded-xl bg-[#176b57] font-extrabold text-white transition hover:bg-[#0f5143] disabled:opacity-70"
            >
              <Download size={18} /> Download receipt
            </AsyncButton>
          </article>
        )}
      </section>
    </main>
  );
}
