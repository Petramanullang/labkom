export type BatchRow = {
  id: string;
  name: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  delivery_date?: string | null;
  note?: string | null;
  is_active: boolean;
  created_at: string;
};

export type Batch = {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  deliveryDate: string | null;
  note: string | null;
  isActive: boolean;
  createdAt: string;
};

export type BatchStatus = "berjalan" | "akan-datang" | "selesai" | "nonaktif";

export const BATCH_STATUS_LABEL: Record<BatchStatus, string> = {
  berjalan: "Berjalan",
  "akan-datang": "Akan datang",
  selesai: "Selesai",
  nonaktif: "Nonaktif",
};

/** Mapping database sales_batches ke format aplikasi. */
export function toBatch(row: BatchRow): Batch {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    startDate: row.starts_at,
    endDate: row.ends_at ?? null,
    deliveryDate: row.delivery_date ?? null,
    note: row.note ?? row.description ?? null,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

/** Tanggal hari ini dalam zona Asia/Jakarta, format YYYY-MM-DD. */
export function jakartaDate(value?: string): string {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function hariIni(): string {
  return jakartaDate();
}

/** Membuat range tanggal inklusif. */
export function dateRange(from: string, to: string): string[] {
  const result: string[] = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);

  while (start <= end) {
    result.push(start.toISOString().slice(0, 10));
    start.setUTCDate(start.getUTCDate() + 1);
  }

  return result;
}

/** Membuat batas waktu Asia/Jakarta untuk query timestamptz. */
export function jakartaDayBounds(from: string, to: string) {
  return {
    start: `${from}T00:00:00+07:00`,
    end: `${to}T23:59:59+07:00`,
  };
}

export function validateBatchRange(batch: {
  startDate: string;
  endDate: string | null;
}) {
  return !batch.endDate || batch.endDate >= batch.startDate;
}

export function batchStatus(
  batch: Pick<Batch, "startDate" | "endDate" | "isActive">,
  today = hariIni(),
): BatchStatus {
  if (!batch.isActive) return "nonaktif";
  if (today < batch.startDate) return "akan-datang";
  const endDate = batch.endDate ?? batch.startDate;
  if (today > endDate) return "selesai";
  return "berjalan";
}

export function activeBatchAt<T extends Pick<Batch, "startDate" | "endDate" | "isActive">>(
  batches: T[],
  today = hariIni(),
): T | null {
  return (
    batches
      .filter((batch) => batchStatus(batch, today) === "berjalan")
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null
  );
}

export function sisaHari(
  batch: Pick<Batch, "startDate" | "endDate">,
  today = hariIni(),
): number {
  const endDate = batch.endDate ?? batch.startDate;
  const start = new Date(`${today}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Math.ceil((end - start) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export function formatTanggal(value?: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function formatPeriode(batch: {
  startDate: string;
  endDate?: string | null;
}): string {
  const endDate = batch.endDate ?? batch.startDate;
  if (batch.startDate === endDate) return formatTanggal(batch.startDate);
  return `${formatTanggal(batch.startDate)} – ${formatTanggal(endDate)}`;
}
