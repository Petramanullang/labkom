"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Coins,
  Download,
  Layers,
  Package,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Notice,
  PageHeader,
  ProgressBar,
  Select,
  StatCard,
  TextInput,
} from "@/components/dashboard/kit";

import { SalesChart } from "@/components/dashboard/sales-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, errorMessage } from "@/lib/api";
import { rupiah } from "@/lib/order";
import { addDays, jakartaDate } from "@/lib/batch";
import { downloadCsv } from "@/lib/csv";
import type {
  BatchListResponse,
  ReportData,
  ReportSeriesPoint,
} from "@/lib/admin-types";
import { cn } from "@/lib/utils";

type Mode = "harian" | "batch";

type Metric = "total" | "orders";

export default function FinancialReportsPage() {
  const today = jakartaDate();

  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);

  const [to, setTo] = useState(today);

  const [status, setStatus] = useState<"verified" | "all">("verified");

  const [batchFilter, setBatchFilter] = useState("");

  const [mode, setMode] = useState<Mode>("harian");

  const [metric, setMetric] = useState<Metric>("total");

  const [report, setReport] = useState<ReportData | null>(null);

  const [batches, setBatches] = useState<BatchListResponse | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        from,
        to,
        status,
      });

      if (batchFilter) {
        params.set("batch", batchFilter);
      }

      const [reportData, batchList] = await Promise.all([
        apiGet<ReportData>(`/api/reports?${params.toString()}`),

        apiGet<BatchListResponse>("/api/admin/batches"),
      ]);

      setReport(reportData);

      setBatches(batchList);

      setError("");
    } catch (caught) {
      setError(errorMessage(caught, "Gagal memuat laporan."));
    } finally {
      setLoading(false);
    }
  }, [from, to, status, batchFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const batchSeries = report?.sales_batches ?? [];

  const points = mode === "harian" ? (report?.daily ?? []) : batchSeries;

  const maxBatchTotal = useMemo(
    () =>
      Math.max(
        ...batchSeries.map((point: ReportSeriesPoint) => point.total),
        1,
      ),

    [batchSeries],
  );

  const grandTotal = useMemo(
    () =>
      batchSeries.reduce(
        (sum: number, point: ReportSeriesPoint) => sum + point.total,

        0,
      ),

    [batchSeries],
  );

  function applyPreset(preset: "7" | "30" | "bulan" | "lalu") {
    const now = today;

    if (preset === "7") {
      setFrom(addDays(now, -6));

      setTo(now);
    } else if (preset === "30") {
      setFrom(addDays(now, -29));

      setTo(now);
    } else if (preset === "bulan") {
      setFrom(`${now.slice(0, 7)}-01`);

      setTo(now);
    } else {
      const previousMonthEnd = addDays(`${now.slice(0, 7)}-01`, -1);

      setFrom(`${previousMonthEnd.slice(0, 7)}-01`);

      setTo(previousMonthEnd);
    }
  }

  function exportCsv() {
    if (!report) return;

    if (mode === "harian") {
      downloadCsv(
        `penjualan-harian-${from}-${to}.csv`,

        ["Tanggal", "Order", "Penjualan"],

        report.daily.map((point) => [point.key, point.orders, point.total]),
      );
    } else {
      downloadCsv(
        `penjualan-per-batch-${from}-${to}.csv`,

        ["Batch", "Order", "Penjualan", "Porsi"],

        batchSeries.map((point) => {
          return [
            point.label,
            point.orders,
            point.total,
            point.orders,
          ];
        }),
      );
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Laporan"
        title="Grafik penjualan"
        description="Bandingkan penjualan per hari atau per batch. Semua tanggal dihitung memakai zona waktu Asia/Jakarta."
        actions={
          <>
            <Button
              variant="outline"
              onClick={exportCsv}
              disabled={!report || !points.length}
            >
              <Download size={15} />
              Ekspor CSV
            </Button>

            <Button onClick={() => void load()} pending={loading}>
              <RefreshCw size={15} />
              Perbarui
            </Button>
          </>
        }
      />

      {error && (
        <Notice tone="danger" onClose={() => setError("")}>
          {error}
        </Notice>
      )}

      <Card className="grid gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-2">
            <span className="text-xs font-bold uppercase tracking-[.14em] text-[#8b9a94]">
              Dari tanggal
            </span>

            <TextInput
              type="date"
              value={from}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
              className="w-[170px]"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-bold uppercase tracking-[.14em] text-[#8b9a94]">
              Sampai tanggal
            </span>

            <TextInput
              type="date"
              value={to}
              min={from}
              onChange={(event) => setTo(event.target.value)}
              className="w-[170px]"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-bold uppercase tracking-[.14em] text-[#8b9a94]">
              Batch
            </span>

            <Select
              value={batchFilter}
              onChange={(event) => setBatchFilter(event.target.value)}
              className="w-[210px]"
            >
              <option value="">Semua batch</option>

              <option value="none">Tanpa batch</option>

              {(batches?.batches ?? []).map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </Card>

      {loading && !report ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Penjualan kotor"
              value={rupiah(report?.summary.gross ?? 0)}
              hint={`${report?.range.days ?? 0} hari dalam rentang`}
              tone="primary"
              icon={<Wallet size={18} className="text-white/80" />}
            />

            <StatCard
              label="Order"
              value={String(report?.summary.orders ?? 0)}
              hint={`${report?.summary.itemsSold ?? 0} porsi terjual`}
              icon={<Package size={18} className="text-[#176b57]" />}
            />

            <StatCard
              label="Rata-rata / order"
              value={rupiah(report?.summary.averageOrderValue ?? 0)}
              hint={
                report?.summary.pendingOrders
                  ? `${report.summary.pendingOrders} order belum diverifikasi`
                  : "Semua order pada rentang ini sudah diverifikasi"
              }
              icon={<TrendingUp size={18} className="text-[#176b57]" />}
            />

            <StatCard
              label="Estimasi bersih"
              value={rupiah(report?.summary.net ?? 0)}
              hint={`Harga beli/HPP ${rupiah(
                report?.summary.costOfGoods ?? 0,
              )} | margin ${Math.round((report?.summary.profitMargin ?? 0) * 100)}%`}
              icon={<Coins size={18} className="text-[#176b57]" />}
            />
          </div>

          <Card>
            <SalesChart
              points={points}
              metric={metric}
              orientation={mode === "harian" ? "vertical" : "horizontal"}
              onSelect={
                mode === "batch"
                  ? (key) => setBatchFilter(key === batchFilter ? "" : key)
                  : undefined
              }
              selectedKey={mode === "batch" ? batchFilter : null}
              emptyLabel={
                mode === "harian" ? "Belum ada penjualan." : "Belum ada batch."
              }
            />
          </Card>

          <Card>
            <h2 className="text-lg font-black">Rincian per batch</h2>

            {(batchSeries ?? []).length === 0 ? (
              <EmptyState
                icon={<Layers size={20} />}
                title="Belum ada data batch"
                description="Belum ada penjualan berdasarkan batch."
              />
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {batchSeries.map((point) => (
                    <tr key={point.key}>
                      <td>{point.label}</td>

                      <td className="text-right">{point.orders}</td>

                      <td className="text-right font-bold">
                        {rupiah(point.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
