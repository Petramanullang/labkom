/**
 * Kunci idempotensi untuk satu sesi checkout.
 *
 * Satu sesi pengisian form = satu `client_ref`. Kalau user menekan tombol dua
 * kali (atau koneksi putus lalu di-retry), backend dan Apps Script memakai
 * `client_ref` yang sama sehingga transaksi kedua ditolak sebagai duplikat.
 */
const STORAGE_KEY = "labkom-checkout-ref";

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ref-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Ambil kunci yang sedang aktif, buat kalau belum ada. */
export function getCheckoutRef(): string {
  if (typeof window === "undefined") return createId();
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const created = createId();
    window.localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    return createId();
  }
}

/** Panggil setelah transaksi sukses, supaya order berikutnya memakai kunci baru. */
export function resetCheckoutRef(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

