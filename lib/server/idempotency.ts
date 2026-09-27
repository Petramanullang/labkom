/**
 * Pengaman idempotensi di sisi server.
 *
 * Kunci UI (double click) hanya menahan klik cepat di satu tab. Kalau request
 * sudah terkirim dua kali — retry jaringan, dua tab, atau user menekan tombol
 * sebelum render ulang — server tetap harus menolak transaksi kedua.
 *
 * `withIdempotency(key, fn)`:
 *  - request kedua dengan kunci sama yang datang saat request pertama masih
 *    jalan akan menunggu hasil yang sama (tidak memanggil Apps Script lagi);
 *  - request kedua setelah request pertama selesai akan menerima hasil yang
 *    di-cache selama TTL (tidak membuat transaksi baru).
 *
 * Catatan: cache ini in-memory (per instance). Untuk jaminan penuh lintas
 * instance, kirim `client_ref` yang sama ke Apps Script dan tolak duplikatnya
 * di sheet — lihat PERBAIKAN.md.
 */
type Entry<T> =
  | { status: "pending"; promise: Promise<T> }
  | { status: "done"; value: T; expiresAt: number };

const TTL_MS = 15 * 60 * 1000; // 15 menit
const MAX_ENTRIES = 500;

// Simpan di globalThis supaya tidak hilang saat modul di-reload (dev/hot reload).
const globalStore = globalThis as unknown as {
  __labkomIdempotency?: Map<string, Entry<unknown>>;
};
const store: Map<string, Entry<unknown>> =
  globalStore.__labkomIdempotency ?? new Map();
globalStore.__labkomIdempotency = store;

function prune() {
  const now = Date.now();
  store.forEach((entry, key) => {
    if (entry.status === "done" && entry.expiresAt < now) store.delete(key);
  });
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

export async function withIdempotency<T>(
  key: string,
  action: () => Promise<T>,
): Promise<{ value: T; duplicated: boolean }> {
  if (!key) return { value: await action(), duplicated: false };

  prune();
  const existing = store.get(key) as Entry<T> | undefined;

  if (existing?.status === "pending") {
    return { value: await existing.promise, duplicated: true };
  }
  if (existing?.status === "done") {
    return { value: existing.value, duplicated: true };
  }

  const promise = action();
  store.set(key, { status: "pending", promise });
  try {
    const value = await promise;
    store.set(key, { status: "done", value, expiresAt: Date.now() + TTL_MS });
    return { value, duplicated: false };
  } catch (error) {
    // Gagal: buang kunci supaya user bisa mencoba lagi.
    store.delete(key);
    throw error;
  }
}


