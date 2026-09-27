"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Layers,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  InlineLoader,
  Modal,
  Notice,
  PageHeader,
  Select,
  StatCard,
} from "@/components/dashboard/kit";
import { SkeletonOrderList } from "@/components/ui/skeleton";
import { apiGet, apiJson, errorMessage } from "@/lib/api";
import { rupiah } from "@/lib/order";
import { formatTanggal } from "@/lib/batch";
import { downloadCsv } from "@/lib/csv";
import { ORDER_STATUS_LABEL, type AdminOrder, type BatchListResponse, type OrderStatus } from "@/lib/admin-types";
import { cn } from "@/lib/utils";

type Filter = "all" | OrderStatus;

const TABS: { value: Filter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "pending", label: "Menunggu" },
  { value: "verified", label: "Terverifikasi" },
  { value: "rejected", label: "Ditolak" },
];

const statusTone = { pending: "warn", verified: "success", rejected: "danger" } as const;

export default function OrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [batches, setBatches] = useState<BatchListResponse | null>(null);
  const [status, setStatus] = useState<Filter>("all");
  const [batchFilter, setBatchFilter] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState<{ order: AdminOrder; mode: "reject" | "deleteProof" } | null>(null);
  const lock = useRef(false);

  // Pencarian ditunda sedikit agar tidak memanggil API pada tiap ketikan.
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "300" });
      if (status !== "all") params.set("status", status);
      if (batchFilter) params.set("batch", batchFilter);
      if (query) params.set("q", query);
      const [orderList, batchList] = await Promise.all([
        apiGet<AdminOrder[]>(`/api/transactions?${params.toString()}`),
        apiGet<BatchListResponse>("/api/admin/batches"),
      ]);
      setOrders(orderList);
      setBatches(batchList);
      setError("");
    } catch (caught) {
      setError(errorMessage(caught, "Gagal memuat daftar order."));
    } finally {
      setLoading(false);
    }
  }, [status, batchFilter, query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeStatus(order: AdminOrder, next: OrderStatus, body: Record<string, unknown> = {}) {
    if (lock.current) return;
    lock.current = true;
    setBusyId(order.id);
    try {
      await apiJson(`/api/transaction/status`, "POST", { orderId: order.id, status: next, ...body });
      setNotice(
        next === "verified"
          ? `Order ${order.order_code} diverifikasi.`
          : next === "rejected"
            ? `Order ${order.order_code} ditolak.`
            : `Order ${order.order_code} dikembalikan ke menunggu verifikasi.`,
      );
      setError("");
      await load();
    } catch (caught) {
      setError(errorMessage(caught, "Gagal memperbarui status order."));
    } finally {
      lock.current = false;
      setBusyId(null);
    }
  }

  async function moveBatch(order: AdminOrder, batchId: string) {
    if (lock.current || batchId === (order.batch_id ?? "")) return;
    lock.current = true;
    setBusyId(order.id);
    try {
      await apiJson(`/api/transaction/status`, "POST", {
        orderId: order.id,
        status: order.status,
        batchId: batchId || null,
      });
      setNotice("Batch order diperbarui.");
      setError("");
      await load();
    } catch (caught) {
      setError(errorMessage(caught, "Gagal memindahkan order."));
    } finally {
      lock.current = false;
      setBusyId(null);
    }
  }

  const counts = useMemo(() => {
    const base = { pending: 0, verified: 0, rejected: 0 };
    orders.forEach((order) => {
      base[order.status] += 1;
    });
    return base;
  }, [orders]);

  const filteredTotal = useMemo(
    () => orders.filter((order) => order.status === "verified").reduce((sum, order) => sum + Number(order.total_amount), 0),
    [orders],
  );

  function exportCsv() {
    downloadCsv(
      `order-labkom-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Kode", "Tanggal", "Nama", "WhatsApp", "Batch", "Menu", "Jumlah", "Total", "Status", "Lokasi"],
      orders.map((order) => [
        order.order_code,
        new Date(order.created_at).toLocaleString("id-ID"),
        order.customer_name,
        order.whatsapp,
        order.batches?.name ?? "Tanpa batch",
        order.menu_summary,
        order.quantity,
        order.total_amount,
        ORDER_STATUS_LABEL[order.status],
        order.pickup_address,
      ]),
    );
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Order masuk"
        title="Penerimaan & verifikasi order"
        description="Periksa bukti pembayaran (tersimpan di Google Drive), lalu verifikasi atau tolak order."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={!orders.length}>
              <Download size={15} /> Ekspor CSV
            </Button>
            <Button onClick={() => void load()} pending={loading}>
              <RefreshCw size={15} /> Perbarui
            </Button>
          </>
        }
      />

      {error && <Notice tone="danger" onClose={() => setError("")}>{error}</Notice>}
      {notice && <Notice tone="success" onClose={() => setNotice("")}>{notice}</Notice>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Menunggu" value={String(counts.pending)} tone="warn" />
        <StatCard label="Terverifikasi" value={String(counts.verified)} tone="primary" />
        <StatCard label="Ditolak" value={String(counts.rejected)} tone="danger" />
        <StatCard label="Nilai terverifikasi" value={rupiah(filteredTotal)} tone="muted" />
      </div>

      <Card className="grid gap-4 lg:grid-cols-[1fr_auto_auto]">
        <div className="grid gap-2">
          <span className="text-xs font-bold uppercase tracking-[.14em] text-[#8b9a94]">Cari order</span>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#95a39d]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nama, kode order, WhatsApp, atau menu…"
              className="h-11 w-full rounded-xl border border-[#d9ded7] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#176b57]"
            />
          </div>
        </div>
        <label className="grid gap-2">
          <span className="text-xs font-bold uppercase tracking-[.14em] text-[#8b9a94]">Batch</span>
          <Select value={batchFilter} onChange={(event) => setBatchFilter(event.target.value)} className="h-11">
            <option value="">Semua batch</option>
            <option value="none">Tanpa batch</option>
            {(batches?.batches ?? []).map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </Select>
        </label>
        <div className="grid gap-2">
          <span className="text-xs font-bold uppercase tracking-[.14em] text-[#8b9a94]">Status</span>
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatus(tab.value)}
                className={cn(
                  "h-11 rounded-xl px-3.5 text-sm font-bold transition",
                  status === tab.value
                    ? "bg-[#176b57] text-white"
                    : "border border-[#e1e6df] bg-white text-[#4b5c56] hover:border-[#176b57]",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {loading && !orders.length ? (
        <SkeletonOrderList count={3} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<FileText size={20} />}
          title="Tidak ada order pada filter ini"
          description="Ubah status, batch, atau kata kunci pencarian untuk melihat order lain."
        />
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => {
            const busy = busyId === order.id;
            return (
              <article key={order.id} className="rounded-3xl bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black">{order.customer_name}</h2>
                      <Badge tone={statusTone[order.status]}>{ORDER_STATUS_LABEL[order.status]}</Badge>
                      {order.batches ? (
                        <Badge tone="info">
                          <Layers size={12} /> {order.batches.name}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">Tanpa batch</Badge>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-[#71807a]">
                      {order.order_code} · {new Date(order.created_at).toLocaleString("id-ID")} · {order.whatsapp}
                    </p>
                  </div>
                  <strong className="text-xl font-black tabular-nums">{rupiah(order.total_amount)}</strong>
                </div>

                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-2xl bg-[#f7faf7] p-3.5">
                    <p className="text-xs font-bold uppercase tracking-[.12em] text-[#8b9a94]">Pesanan</p>
                    <p className="mt-1 text-[#173d36]">{order.menu_summary}</p>
                    <p className="mt-1 text-xs text-[#71807a]">{order.quantity} porsi</p>
                  </div>
                  <div className="rounded-2xl bg-[#f7faf7] p-3.5">
                    <p className="text-xs font-bold uppercase tracking-[.12em] text-[#8b9a94]">Penerimaan</p>
                    <p className="mt-1 text-[#173d36]">
                      {order.pickup_type === "dorm" ? "Deliver to Dorm" : "Pick Up on Campus"}
                    </p>
                    <p className="mt-1 text-xs text-[#71807a]">{order.pickup_address}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {order.proof_url ? (
                    <a
                      href={order.proof_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d9ded7] bg-white px-3.5 text-sm font-bold transition hover:border-[#176b57] hover:text-[#176b57]"
                    >
                      <ExternalLink size={15} /> Lihat bukti bayar
                    </a>
                  ) : (
                    <span className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#fdeceb] px-3.5 text-sm font-bold text-[#a9493e]">
                      Bukti bayar tidak tersedia
                    </span>
                  )}
                  <span className="text-xs text-[#8b9a94]">
                    {order.payment_proof_provider === "google_drive" ? "Google Drive" : "Supabase"}
                    {order.payment_proof_name ? ` · ${order.payment_proof_name}` : ""}
                  </span>

                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Select
                      aria-label="Pindahkan batch"
                      value={order.batch_id ?? ""}
                      disabled={busy}
                      onChange={(event) => void moveBatch(order, event.target.value)}
                      className="h-10 text-sm"
                    >
                      <option value="">Tanpa batch</option>
                      {(batches?.batches ?? []).map((batch) => (
                        <option key={batch.id} value={batch.id}>
                          {batch.name}
                        </option>
                      ))}
                    </Select>

                    {order.status !== "verified" && (
                      <Button onClick={() => void changeStatus(order, "verified")} pending={busy}>
                        <CheckCircle2 size={15} /> Verifikasi
                      </Button>
                    )}
                    {order.status !== "rejected" && (
                      <Button variant="danger" onClick={() => setConfirm({ order, mode: "reject" })} disabled={busy}>
                        <XCircle size={15} /> Tolak
                      </Button>
                    )}
                    {order.status !== "pending" && (
                      <Button variant="outline" onClick={() => void changeStatus(order, "pending")} disabled={busy}>
                        <RotateCcw size={15} /> Kembalikan
                      </Button>
                    )}
                    {order.proof_url && (
                      <Button
                        variant="outline"
                        onClick={() => setConfirm({ order, mode: "deleteProof" })}
                        disabled={busy}
                        title="Hapus file bukti bayar di penyimpanan"
                      >
                        <Trash2 size={15} /> Hapus bukti
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {loading && orders.length > 0 && <InlineLoader label="Menyegarkan daftar order…" />}

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm?.mode === "reject" ? "Tolak order ini?" : "Hapus file bukti bayar?"}
        description={
          confirm?.mode === "reject"
            ? `Order ${confirm?.order.order_code} akan ditandai ditolak. Riwayat order tetap tersimpan.`
            : `File bukti bayar order ${confirm?.order.order_code} akan dihapus dari penyimpanan dan tidak bisa dikembalikan.`
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const target = confirm;
                setConfirm(null);
                if (!target) return;
                if (target.mode === "reject") void changeStatus(target.order, "rejected");
                else void changeStatus(target.order, target.order.status, { deleteProof: true });
              }}
            >
              {confirm?.mode === "reject" ? "Ya, tolak order" : "Ya, hapus file"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[#4b5c56]">
          {confirm?.mode === "reject"
            ? "Pastikan kamu sudah memeriksa bukti pembayarannya sebelum menolak."
            : "Setelah dihapus, order tetap ada namun tanpa lampiran bukti bayar."}
        </p>
      </Modal>
    </div>
  );
}

