"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type ChartPoint = { key: string; label: string; total: number; orders: number };

const compact = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}jt`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}rb`;
  return String(value);
};

const rupiahShort = (value: number) => `Rp${compact(value)}`;
const fullRupiah = (value: number) => `Rp${Number(value || 0).toLocaleString("id-ID")}`;

/**
 * Grafik penjualan.
 *
 * - `orientation="vertical"` untuk deret harian (batang per tanggal).
 * - `orientation="horizontal"` untuk deret per batch (nama batch panjang,
 *   jadi lebih enak dibaca sebagai baris).
 * - Klik salah satu batang untuk memfilter laporan (opsional lewat `onSelect`).
 */
export function SalesChart({
  points,
  metric,
  orientation = "vertical",
  emptyLabel = "Belum ada penjualan pada periode ini.",
  selectedKey = null,
  onSelect,
}: {
  points: ChartPoint[];
  metric: "total" | "orders";
  orientation?: "vertical" | "horizontal";
  emptyLabel?: string;
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const value = (point: ChartPoint) => (metric === "total" ? point.total : point.orders);
  const max = useMemo(() => Math.max(...points.map(value), 1), [points, metric]);
  const format = metric === "total" ? fullRupiah : (n: number) => `${n} order`;
  const formatAxis = metric === "total" ? rupiahShort : (n: number) => String(n);

  if (!points.length) {
    return (
      <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-[#dbe2da] bg-[#fbfcf9] p-6 text-center text-sm text-[#71807a]">
        {emptyLabel}
      </div>
    );
  }

  if (orientation === "horizontal") {
    const total = points.reduce((sum, point) => sum + value(point), 0) || 1;
    return (
      <ul className="grid gap-3">
        {points.map((point) => {
          const width = Math.max((value(point) / max) * 100, value(point) > 0 ? 3 : 0);
          const share = Math.round((value(point) / total) * 100);
          const isSelected = selectedKey === point.key;
          return (
            <li key={point.key || "tanpa-batch"}>
              <button
                type="button"
                onClick={() => onSelect?.(point.key)}
                disabled={!onSelect}
                className={cn(
                  "w-full rounded-2xl border p-3 text-left transition",
                  isSelected ? "border-[#176b57] bg-[#eef7f1]" : "border-[#eef1ec] bg-white",
                  onSelect && "hover:border-[#bcd9c9]",
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-bold text-[#173d36]">{point.label}</span>
                  <span className="shrink-0 text-sm font-black tabular-nums text-[#176b57]">{format(value(point))}</span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#eef1ec]">
                    <div className="h-full rounded-full bg-[#176b57]" style={{ width: `${width}%` }} />
                  </div>
                  <span className="w-24 shrink-0 text-right text-xs text-[#71807a]">
                    {metric === "total" ? `${point.orders} order` : `${share}% dari total`}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  const gridLines = [1, 0.75, 0.5, 0.25, 0];

  return (
    <div className="w-full">
      <div className="flex gap-3">
        <div className="flex w-12 shrink-0 flex-col justify-between py-1 text-right text-[10px] font-bold text-[#95a39d]">
          {gridLines.map((line) => (
            <span key={line}>{formatAxis(Math.round(max * line))}</span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-x-0 top-1 bottom-6 flex flex-col justify-between">
            {gridLines.map((line) => (
              <span key={line} className={cn("block border-t", line === 0 ? "border-[#cfd8d0]" : "border-[#eef1ec]")} />
            ))}
          </div>
          <div className="relative flex h-56 items-end gap-1 sm:gap-2">
            {points.map((point) => {
              const height = Math.max((value(point) / max) * 100, value(point) > 0 ? 4 : 1.5);
              const isSelected = selectedKey === point.key;
              return (
                <button
                  key={point.key}
                  type="button"
                  onClick={() => onSelect?.(point.key)}
                  onMouseEnter={() => setHovered(point.key)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(point.key)}
                  onBlur={() => setHovered(null)}
                  disabled={!onSelect}
                  title={`${point.label} — ${format(value(point))}`}
                  className="group relative flex h-full flex-1 flex-col items-center justify-end"
                >
                  {hovered === point.key && (
                    <span className="pointer-events-none absolute -top-1 z-10 w-max rounded-xl bg-[#173d36] px-3 py-2 text-left text-[11px] font-bold text-white shadow-lg">
                      {point.label}
                      <span className="mt-0.5 block font-normal text-white/80">{format(value(point))}</span>
                      <span className="block font-normal text-white/60">{point.orders} order</span>
                    </span>
                  )}
                  <span
                    className={cn(
                      "w-full rounded-t-lg transition-all",
                      isSelected ? "bg-[#b84f43]" : "bg-[#176b57] group-hover:bg-[#1c8168]",
                      value(point) === 0 && "bg-[#e3e8e1] group-hover:bg-[#d5ddd4]",
                    )}
                    style={{ height: `${height}%` }}
                  />
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex gap-1 sm:gap-2">
            {points.map((point) => (
              <span
                key={point.key}
                className={cn(
                  "flex-1 truncate text-center text-[10px] font-bold",
                  selectedKey === point.key ? "text-[#b84f43]" : "text-[#8b9a94]",
                )}
              >
                {point.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

