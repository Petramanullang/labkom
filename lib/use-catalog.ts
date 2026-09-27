"use client";

import { useCallback, useEffect, useState } from "react";
import { products as fallbackProducts } from "@/lib/catalog";
import { buildCategories, type MenuItem } from "@/lib/menu";
import { formatTanggal } from "@/lib/batch";

const CACHE_KEY = "labkom-catalog-v2";

/** Batch aktif yang sedang dibuka, bila admin sudah mengaturnya. */
export type ActiveBatchInfo = {
  id: string;
  name: string;
  /** Periode siap tampil, mis. "1 Sep – 21 Sep". */
  label: string;
  deliveryDate: string | null;
};

type CatalogState = {
  items: MenuItem[];
  categories: string[];
  batch: ActiveBatchInfo | null;
  loading: boolean;
  /** true bila data berasal dari server atau cache (bukan daftar cadangan). */
  orderable: boolean;
  error: string;
  reload: () => void;
};

type CacheShape = { items: MenuItem[]; batch: ActiveBatchInfo | null };

function readCache(): CacheShape | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CacheShape>;
    return Array.isArray(parsed.items) && parsed.items.length
      ? { items: parsed.items, batch: parsed.batch ?? null }
      : null;
  } catch {
    return null;
  }
}

function writeCache(payload: CacheShape) {
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...payload, savedAt: Date.now() }),
    );
  } catch {
    /* storage penuh / private mode — abaikan */
  }
}

function toBatchInfo(
  row: {
    id: string;
    name: string;
    starts_at: string;
    ends_at: string | null;
    delivery_date?: string | null;
  } | null,
) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    label: `${formatTanggal(row.starts_at)} – ${
      row.ends_at ? formatTanggal(row.ends_at) : ""
    }`,
    deliveryDate: row.delivery_date ? formatTanggal(row.delivery_date) : null,
  } satisfies ActiveBatchInfo;
}

/**
 * Mengambil menu aktif dari `/api/catalog` (tabel `menu_items`).
 * Tampilan pertama memakai cache perangkat agar katalog langsung muncul,
 * lalu data disegarkan dari server.
 */
export function useCatalog(): CatalogState {
  const [items, setItems] = useState<MenuItem[]>(fallbackProducts);
  const [batch, setBatch] = useState<ActiveBatchInfo | null>(null);
  const [orderable, setOrderable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    const cached = readCache();
    if (cached) {
      setItems(cached.items);
      setBatch(cached.batch);
      setOrderable(true);
    }
    (async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/catalog", { cache: "no-store" });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success)
          throw new Error(result?.error || "Gagal memuat menu.");
        if (!active) return;
        const serverItems =
          (result.data?.items as MenuItem[] | undefined) ?? [];
        const serverBatch = toBatchInfo(result.data?.batch ?? null);
        setBatch(serverBatch);
        if (serverItems.length) {
          setItems(serverItems);
          setOrderable(true);
          writeCache({ items: serverItems, batch: serverBatch });
        } else if (!cached) {
          setItems([]);
          setOrderable(true);
        }
        setError("");
      } catch (caught) {
        if (!active) return;
        setError(
          caught instanceof Error ? caught.message : "Gagal memuat menu.",
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [nonce]);

  return {
    items,
    categories: buildCategories(items),
    batch,
    loading,
    orderable,
    error,
    reload,
  };
}
