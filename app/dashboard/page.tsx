"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  ClipboardList,
  Clock,
  Layers,
  Package,
  RefreshCw,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, Notice, PageHeader, ProgressBar, StatCard } from "@/components/dashboard/kit";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { SkeletonOrderList, SkeletonStatCard } from "@/components/ui/skeleton";
import { apiGet, errorMessage } from "@/lib/api";
import { rupiah } from "@/lib/order";
import {
  BATCH_STATUS_LABEL,
  activeBatchAt,
  batchStatus,
  formatPeriode,
  jakartaDate,
  sisaHari,
} from "@/lib/batch";
import {
  ORDER_STATUS_LABEL,
  type AdminOrder,
  type BatchListResponse,
  type ReportData,
  type SystemStatus,
} from "@/lib/admin-types";

const statusTone = { pending: "warn", verified: "success", rejected: "danger" } as const;

export default function DashboardOverviewPage() {
  const today = jakartaDate();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [report, setReport] = useState<ReportData | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [batchData, setBatchData] = useState<BatchListResponse | null>(null);
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reportData, orderList, batches, status] = await Promise.all([
        apiGet<ReportData>(`/api/reports?from=${monthStart}&to=${today}`),
        apiGet<AdminOrder[]>("/api/transactions?limit=12"),
        apiGet<BatchListResponse>("/api/admin/batches"),
        apiGet<SystemStatus>("/api/admin/system"),
      ]);
      setReport(reportData);
      setOrders(orderList);
      setBatchData(batches);
      setSystem(status);
      setError("");
    } catch (caught) {
      setError(errorMessage(caught, "Gagal memuat ringkasan dashboard."));
    } finally {
      setLoading(false);
    }
  }, [monthStart, today]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeBatch = useMemo(
    () => activeBatchAt(batchData?.batches ?? [], today),
    [batchData, today],
  );
  const todayPoint = report?.daily.find((point) => point.key === today);
  const chartPoints = useMemo(() => report?.daily.slice(-14) ?? [], [report]);
  const pendingOrders = useMemo(() => orders.filter((order) => order.status === "pending"), [orders]);
  const maxBatchGross = useMemo(
    () => Math.max(...(batchData?.batches.map((batch) => batch.stats.gross) ?? [0]), 1),
    [batchData],
  );

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Ringkasan"
        title={`Selamat datang, hari ini ${new Intl.DateTimeFormat("id-ID", {
          timeZone: "UTC",
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date(`${today}T00:00:00Z`))}`}
        description="Pantau order yang perlu diverifikasi, penjualan bulan ini, dan batch yang sedang berjalan."
        actions={
          <>
            <Button variant="outline" onClick={() => void load()} pending={loading}>
              <RefreshCw size={15} /> Perbarui
            </Button>
            <Link
              href="/dashboard/orders"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#176b57] px-4 text-sm font-bold text-white transition hover:bg-[#135c4a]"
            >
              Verifikasi order <ArrowUpRight size={15} />
            </Link>
          </>
        }
      />

      {error && <Notice tone="danger" onClose={() => setError("")}>{error}</Notice>}

      {loading && !report ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((key) => (
            <SkeletonStatCard key={key} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Menunggu verifikasi"
            value={String(report?.statusBreakdown.pending ?? 0)}
            hint={`${report?.summary.verifiedOrders ?? 0} order terverifikasi bulan ini`}
            tone="warn"
            icon={<Clock size={18} className="text-[#a66b1e]" />}
          />
          <StatCard
            label="Penjualan bulan ini"
            value={rupiah(report?.summary.gross ?? 0)}
            hint={`${report?.summary.orders ?? 0} order · ${report?.summary.itemsSold ?? 0} porsi`}
            tone="primary"
            icon={<Wallet size={18} className="text-white/80" />}
          />
          <StatCard
            label="Penjualan hari ini"
            value={rupiah(todayPoint?.total ?? 0)}
            hint={`${todayPoint?.orders ?? 0} order tercatat hari ini`}
            icon={<TrendingUp size={18} className="text-[#176b57]" />}
          />
          <StatCard
            label="Estimasi bersih"
            value={rupiah(report?.summary.net ?? 0)}
            hint={`Penjualan dikurangi harga beli ${rupiah(report?.summary.costOfGoods ?? 0)}`}
            icon={<BarChart3 size={18} className="text-[#176b57]" />}
          />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">Grafik penjualan 14 hari terakhir</h2>
              <p className="mt-1 text-sm text-[#71807a]">
                Arahkan kursor ke batang untuk melihat nominal dan jumlah order.
              </p>
            </div>
            <Link href="/dashboard/financial-reports" className="text-sm font-bold text-[#176b57]">
              Laporan lengkap →
            </Link>
          </div>
          <div className="mt-6">
            <SalesChart points={chartPoints} metric="total" />
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">Batch aktif</h2>
              <p className="mt-1 text-sm text-[#71807a]">Periode pre-order yang sedang dibuka.</p>
            </div>
            <Badge tone={activeBatch ? "success" : "neutral"}>
              {activeBatch ? BATCH_STATUS_LABEL[batchStatus(activeBatch, today)] : "Tidak ada"}
            </Badge>
          </div>

          {activeBatch ? (
            <div className="rounded-2xl bg-[#f7faf7] p-4">
              <p className="font-black text-[#173d36]">{activeBatch.name}</p>
              <p className="mt-1 text-sm text-[#71807a]">
                {formatPeriode(activeBatch)} · sisa {Math.max(sisaHari(activeBatch, today), 0)} hari
              </p>
              {activeBatch.deliveryDate && (
                <p className="mt-1 text-sm text-[#71807a]">
                  Pengantaran:{" "}
                  {new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", day: "numeric", month: "long" }).format(
                    new Date(`${activeBatch.deliveryDate}T00:00:00Z`),
                  )}
                </p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.12em] text-[#8b9a94]">Order</p>
                  <strong className="mt-1 block text-xl font-black">{activeBatch.stats.orders}</strong>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.12em] text-[#8b9a94]">Omzet</p>
                  <strong className="mt-1 block text-xl font-black">{rupiah(activeBatch.stats.gross)}</strong>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Layers size={20} />}
              title="Belum ada batch berjalan"
              description="Buat periode batch agar setiap order otomatis dikelompokkan."
              action={
                <Link
                  href="/dashboard/batches"
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#176b57] px-4 text-sm font-bold text-white"
                >
                  Atur batch <ArrowUpRight size={15} />
                </Link>
              }
            />
          )}

          {batchData && batchData.batches.length > 0 && (
            <div className="grid gap-2">
              {batchData.batches.slice(0, 3).map((batch) => (
                <div key={batch.id}>
                  <div className="flex items-center justify-between text-xs font-bold text-[#4b5c56]">
                    <span className="truncate">{batch.name}</span>
                    <span className="tabular-nums text-[#71807a]">{rupiah(batch.stats.gross)}</span>
                  </div>
                  <div className="mt-1">
                    <ProgressBar value={batch.stats.gross} max={maxBatchGross} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">Order terbaru</h2>
              <p className="mt-1 text-sm text-[#71807a]">
                {pendingOrders.length ? `${pendingOrders.length} order menunggu verifikasi.` : "Semua order terbaru sudah diproses."}
              </p>
            </div>
            <Link href="/dashboard/orders" className="text-sm font-bold text-[#176b57]">
              Lihat semua →
            </Link>
          </div>
          <div className="mt-5">
            {loading && !orders.length ? (
              <SkeletonOrderList count={3} />
            ) : orders.length === 0 ? (
              <EmptyState
                icon={<Package size={20} />}
                title="Belum ada order"
                description="Order dari halaman toko akan muncul di sini."
              />
            ) : (
              <ul className="grid gap-2.5">
                {orders.slice(0, 6).map((order) => (
                  <li
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#eef1ec] p-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold">{order.customer_name}</p>
                      <p className="mt-0.5 truncate text-xs text-[#71807a]">
                        {order.menu_summary} · {order.batches?.name ?? "tanpa batch"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <strong className="text-sm tabular-nums">{rupiah(order.total_amount)}</strong>
                      <Badge tone={statusTone[order.status]}>{ORDER_STATUS_LABEL[order.status]}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <div className="grid gap-5">
          <Card>
            <h2 className="text-lg font-black">Aksi cepat</h2>
            <div className="mt-4 grid gap-2">
              {[
                { href: "/dashboard/orders", label: "Verifikasi bukti bayar", icon: ClipboardList },
                { href: "/dashboard/menu", label: "Kelola menu & foto", icon: UtensilsCrossed },
                { href: "/dashboard/batches", label: "Atur batch pre-order", icon: Layers },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-2xl border border-[#eef1ec] px-3.5 py-3 text-sm font-bold transition hover:border-[#176b57] hover:text-[#176b57]"
                >
                  <item.icon size={16} /> {item.label}
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-black">Status penyimpanan</h2>
            <p className="mt-1 text-sm text-[#71807a]">Pembagian file agar kuota Supabase tetap kecil.</p>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#71807a]">Bukti pembayaran</dt>
                <dd>
                  <Badge tone={system?.driveConfigured ? "success" : "warn"}>
                    {system?.driveConfigured ? "Google Drive" : "Belum dikonfigurasi"}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#71807a]">Foto menu</dt>
                <dd>
                  <Badge tone="info">Supabase · menu-images</Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#71807a]">Jumlah menu aktif</dt>
                <dd className="font-bold tabular-nums">
                  {system?.activeMenuCount ?? 0}/{system?.menuCount ?? 0}
                </dd>
              </div>
            </dl>
            {system && !system.driveConfigured && (
              <p className="mt-4 rounded-xl bg-[#fff4e2] p-3 text-xs font-semibold text-[#8a5a12]">
                Isi GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, dan GOOGLE_DRIVE_FOLDER_ID di .env.local
                supaya bukti bayar tersimpan di Drive.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}





