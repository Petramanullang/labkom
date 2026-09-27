import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  dateRange,
  jakartaDate,
  jakartaDayBounds,
  type BatchRow,
} from "@/lib/batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type OrderLite = {
  id: string;
  batch_id: string | null;
  total_amount: number | string;
  quantity: number | string;
  status: string;
  created_at: string;
};

export type ReportSeriesPoint = {
  key: string;
  label: string;
  total: number;
  orders: number;
};

/**
 * Laporan penjualan.
 *
 * Grafik bisa diminta **per hari** maupun **per batch** (lihat field `daily`
 * dan `batches` pada respons) — admin yang menentukan batchnya lewat CRUD batch.
 * Semua tanggal dihitung memakai zona waktu Asia/Jakarta.
 *
 * Query:
 *   from, to   (YYYY-MM-DD, wajib)
 *   batch      (uuid | 'none' | kosong = semua batch)
 *   status     ('verified' default | 'all')
 */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.user)
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: 401 },
    );

  const url = new URL(request.url);
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || to < from) {
    return NextResponse.json(
      { success: false, error: "Rentang tanggal tidak valid." },
      { status: 400 },
    );
  }
  const batchParam = url.searchParams.get("batch") || "";
  const onlyVerified = (url.searchParams.get("status") || "verified") !== "all";
  try {
    const supabase = createAdminClient();
    const bounds = jakartaDayBounds(from, to);

    let ordersQuery = supabase
      .from("orders")
      .select("id,batch_id,total_amount,quantity,status,created_at")
      .gte("created_at", bounds.start)
      .lt("created_at", bounds.end);
    if (batchParam === "none") ordersQuery = ordersQuery.is("batch_id", null);
    else if (batchParam) ordersQuery = ordersQuery.eq("batch_id", batchParam);

    const [ordersResult, batchesResult] = await Promise.all([
      ordersQuery,
      supabase
        .from("sales_batches")
        .select("id,name,description,starts_at,ends_at,is_active,created_at")
        .order("starts_at", { ascending: true }),
    ]);
    if (ordersResult.error) throw ordersResult.error;
    if (batchesResult.error) throw batchesResult.error;

    const allOrders = (ordersResult.data ?? []) as unknown as OrderLite[];
    const batches = (batchesResult.data ?? []) as unknown as BatchRow[];

    // Hitungan status selalu dari seluruh order pada rentang (bukan hasil filter),
    // supaya admin tahu ada berapa order yang masih menunggu verifikasi.
    const statusBreakdown = { pending: 0, verified: 0, rejected: 0 };
    allOrders.forEach((order) => {
      if (order.status === "pending") statusBreakdown.pending += 1;
      else if (order.status === "verified") statusBreakdown.verified += 1;
      else if (order.status === "rejected") statusBreakdown.rejected += 1;
    });

    const orders = onlyVerified
      ? allOrders.filter((order) => order.status === "verified")
      : allOrders;

    // ---- Ringkasan angka -------------------------------------------------
    const gross = orders.reduce(
      (sum, order) => sum + Number(order.total_amount ?? 0),
      0,
    );
    const itemsSold = orders.reduce(
      (sum, order) => sum + Number(order.quantity ?? 0),
      0,
    );

    // ---- Seri harian (semua tanggal pada rentang, termasuk 0) -----------
    const perDay = new Map<string, { total: number; orders: number }>();
    orders.forEach((order) => {
      const date = jakartaDate(order.created_at);
      const bucket = perDay.get(date) ?? { total: 0, orders: 0 };
      bucket.total += Number(order.total_amount ?? 0);
      bucket.orders += 1;
      perDay.set(date, bucket);
    });
    const daily: ReportSeriesPoint[] = dateRange(from, to).map((date) => {
      const bucket = perDay.get(date) ?? { total: 0, orders: 0 };
      return {
        key: date,
        label: new Intl.DateTimeFormat("id-ID", {
          timeZone: "UTC",
          day: "numeric",
          month: "short",
        }).format(new Date(`${date}T00:00:00Z`)),
        total: bucket.total,
        orders: bucket.orders,
      };
    });

    // ---- Seri per batch ---------------------------------------------------
    const batchMap = new Map(batches.map((batch) => [batch.id, batch]));
    const perBatch = new Map<
      string,
      { total: number; orders: number; itemsSold: number }
    >();
    orders.forEach((order) => {
      const key = order.batch_id ?? "";
      const bucket = perBatch.get(key) ?? { total: 0, orders: 0, itemsSold: 0 };
      bucket.total += Number(order.total_amount ?? 0);
      bucket.orders += 1;
      bucket.itemsSold += Number(order.quantity ?? 0);
      perBatch.set(key, bucket);
    });

    const rangeStart = from;
    const rangeEnd = to;

    const batchSeries: ReportSeriesPoint[] = [];

    let unassignedTotal = 0;
    let unassignedOrders = 0;

    batches.forEach((batch) => {
      const bucket = perBatch.get(batch.id);

      const batchStart = batch.starts_at;

      const batchEnd = batch.ends_at ?? batch.starts_at;

      const intersects = batchStart <= rangeEnd && batchEnd >= rangeStart;

      if (!bucket && !intersects) {
        return;
      }

      batchSeries.push({
        key: batch.id,

        label: batch.name,

        total: bucket?.total ?? 0,

        orders: bucket?.orders ?? 0,
      });
    });

    const unassignedBucket = perBatch.get("");
    if (unassignedBucket) {
      unassignedTotal = unassignedBucket.total;
      unassignedOrders = unassignedBucket.orders;
      batchSeries.push({
        key: "",
        label: "Tanpa batch",
        total: unassignedTotal,
        orders: unassignedOrders,
      });
    }
    batchSeries.sort((a, b) => b.total - a.total);

    // ---- Menu terlaris dan estimasi laba ---------------------------------
    const orderIds = orders.map((order) => order.id);
    let costOfGoods = 0;
    const menuCostMap = new Map<string, number>();
    const topItemsMap = new Map<
      string,
      { quantity: number; total: number; cost: number }
    >();
    for (let index = 0; index < orderIds.length; index += 300) {
      const chunk = orderIds.slice(index, index + 300);
      if (!chunk.length) continue;
      const { data, error } = await supabase
        .from("order_items")
        .select("product_name,unit_price,cost_price,quantity,menu_item_id")
        .in("order_id", chunk);
      if (error) throw error;
      const missingCostMenuIds = Array.from(
        new Set(
          (data ?? [])
            .map((item) => String(item.menu_item_id ?? ""))
            .filter((id) => id && !menuCostMap.has(id)),
        ),
      );
      if (missingCostMenuIds.length) {
        const { data: menuRows, error: menuError } = await supabase
          .from("menu_items")
          .select("id,cost_price")
          .in("id", missingCostMenuIds);
        if (menuError) throw menuError;
        (menuRows ?? []).forEach((menu) => {
          menuCostMap.set(String(menu.id), Number(menu.cost_price ?? 0));
        });
      }
      (data ?? []).forEach((item) => {
        const name = String(item.product_name ?? "Menu");
        const quantity = Number(item.quantity ?? 0);
        const unitPrice = Number(item.unit_price ?? 0);
        const itemCostPrice = Number(item.cost_price ?? 0);
        const menuCostPrice = item.menu_item_id
          ? (menuCostMap.get(String(item.menu_item_id)) ?? 0)
          : 0;
        const costPrice = itemCostPrice || menuCostPrice;
        const bucket =
          topItemsMap.get(name) ?? { quantity: 0, total: 0, cost: 0 };
        bucket.quantity += quantity;
        bucket.total += unitPrice * quantity;
        bucket.cost += costPrice * quantity;
        costOfGoods += costPrice * quantity;
        topItemsMap.set(name, bucket);
      });
    }
    const topItems = Array.from(topItemsMap, ([name, value]) => ({
      name,
      ...value,
      net: value.total - value.cost,
    }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);

    const net = gross - costOfGoods;
    const summary = {
      orders: orders.length,
      itemsSold,
      gross,
      costOfGoods,
      operational: costOfGoods,
      net,
      operationalRate: gross ? costOfGoods / gross : 0,
      profitMargin: gross ? net / gross : 0,
      averageOrderValue: orders.length ? Math.round(gross / orders.length) : 0,
      verifiedOrders: statusBreakdown.verified,
      pendingOrders: statusBreakdown.pending,
      rejectedOrders: statusBreakdown.rejected,
    };

    // ---- Batch terpilih (untuk info header) ------------------------------
    const selectedBatch =
      batchParam && batchParam !== "none"
        ? (batchMap.get(batchParam) ?? null)
        : null;
    const best = daily.reduce<ReportSeriesPoint | null>(
      (acc, point) =>
        point.total > 0 && (!acc || point.total > acc.total) ? point : acc,
      null,
    );

    return NextResponse.json({
      success: true,
      data: {
        range: { from, to, days: daily.length },
        filter: {
          status: onlyVerified ? "verified" : "all",
          batchId: batchParam || null,
          batchName:
            selectedBatch?.name ??
            (batchParam === "none" ? "Tanpa batch" : null),
        },
        summary,
        statusBreakdown,
        daily,
        dailyTotal: daily.reduce((sum, point) => sum + point.total, 0),
        bestDay: best,
        sales_batches: batchSeries,
        unassigned: { total: unassignedTotal, orders: unassignedOrders },
        topItems,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("reports error", error);
    return NextResponse.json(
      { success: false, error: "Gagal memuat laporan." },
      { status: 500 },
    );
  }
}
