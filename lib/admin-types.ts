/** Tipe data bersama untuk halaman dashboard. */

export type OrderStatus = "pending" | "verified" | "rejected";

export type OrderBatchRef = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string | null;
} | null;

export type AdminOrder = {
  id: string;
  order_code: string;
  customer_name: string;
  whatsapp: string;
  pickup_type: string | null;
  pickup_address: string;
  menu_summary: string;
  quantity: number;
  total_amount: number;
  status: OrderStatus;
  created_at: string;
  batch_id: string | null;
  batches: OrderBatchRef;
  proof_url: string | null;
  payment_proof_provider: string | null;
  payment_proof_name: string | null;
  payment_proof_size: number | null;
};

export type SeriesPoint = {
  key: string;
  label: string;
  total: number;
  orders: number;
};

export type ReportData = {
  range: { from: string; to: string; days: number };
  filter: {
    status: "verified" | "all";
    batchId: string | null;
    batchName: string | null;
  };
  summary: {
    orders: number;
    itemsSold: number;
    gross: number;
    costOfGoods: number;
    /** Alias lama. Sekarang nilainya sama dengan costOfGoods. */
    operational: number;
    net: number;
    /** Alias lama. Sekarang nilainya rasio HPP terhadap omzet. */
    operationalRate: number;
    profitMargin: number;
    averageOrderValue: number;
    verifiedOrders: number;
    pendingOrders: number;
    rejectedOrders: number;
  };
  statusBreakdown: { pending: number; verified: number; rejected: number };
  daily: SeriesPoint[];
  dailyTotal: number;
  bestDay: SeriesPoint | null;
  sales_batches: SeriesPoint[];
  unassigned: { total: number; orders: number };
  topItems: { name: string; quantity: number; total: number; cost: number; net: number }[];
  generatedAt: string;
};

export type BatchStats = {
  orders: number;
  verifiedOrders: number;
  gross: number;
  itemsSold: number;
};

export type BatchListItem = {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  deliveryDate: string | null;
  note: string | null;
  isActive: boolean;
  createdAt: string;
  stats: BatchStats;
};

export type BatchListResponse = {
  batches: BatchListItem[];
  unassigned: BatchStats;
};

export type SystemStatus = {
  proofStorage: "google_drive" | "supabase";
  driveConfigured: boolean;
  driveFolderConfigured: boolean;
  menuBucket: string;
  menuCount: number;
  activeMenuCount: number;
  batchCount: number;
  activeBatchName: string | null;
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Menunggu verifikasi",
  verified: "Terverifikasi",
  rejected: "Ditolak",
};

export type ReportSeriesPoint = {
  key: string;
  label: string;
  total: number;
  orders: number;
};
