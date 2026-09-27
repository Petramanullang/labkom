"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Leaf } from "lucide-react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { PendingOverlay, Spinner } from "@/components/ui/pending-overlay";
import { useActionLock } from "@/lib/use-async-action";
import { useCatalog } from "@/lib/use-catalog";
import type { MenuItem } from "@/lib/menu";

const rupiah = (value: number) => `Rp${value.toLocaleString("id-ID")}`;
type Cart = Record<string, number>;

export default function CheckoutPage() {
  const router = useRouter();
  /** Menu aktif diambil dari tabel menu_items (lihat /api/catalog). */
  const catalog = useCatalog();
  const [cart, setCart] = useState<Cart>({});
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [pickupType, setPickupType] = useState<"campus" | "dorm">("campus");
  const [pickup, setPickup] = useState("");
  const [dormAddress, setDormAddress] = useState("");
  const [error, setError] = useState("");
  /** false sampai keranjang selesai dibaca dari localStorage. */
  const [hydrated, setHydrated] = useState(false);
  /** true selama berpindah ke halaman pembayaran. */
  const [navigating, setNavigating] = useState(false);
  /** Kunci sinkron: cegah dua kali tekan pada tombol lanjut. */
  const { acquire, release } = useActionLock();
  useEffect(() => {
    const saved = window.localStorage.getItem("labkom-cart");
    if (saved) {
      try {
        setCart(JSON.parse(saved) as Cart);
      } catch {
        setCart({});
      }
    }
    setHydrated(true);
  }, []);
  const items = useMemo(
    () => catalog.items.filter((item: MenuItem) => cart[item.id]),
    [cart, catalog.items],
  );
  const total = items.reduce(
    (sum, item) => sum + item.price * cart[item.id],
    0,
  );
  const valid =
    name.trim().length >= 2 &&
    whatsapp.trim().length >= 8 &&
    items.length > 0 &&
    (pickupType === "campus"
      ? pickup.trim().length >= 5
      : dormAddress.trim().length >= 8);
  const continueToPayment = () => {
    // Kunci sinkron: klik kedua diabaikan walau render ulang belum terjadi.
    if (!acquire()) return;
    setError("");
    if (!catalog.orderable && items.length) {
      setError("Katalog menu belum tersambung ke server. Muat ulang halaman lalu coba lagi.");
      release();
      return;
    }
    if (!valid) {
      setError(
        items.length
          ? "Lengkapi data diri dan lokasi penerimaan terlebih dahulu."
          : "Keranjang masih kosong. Pilih menu dari halaman utama.",
      );
      release();
      return;
    }
    setNavigating(true);
    window.localStorage.setItem(
      "labkom-checkout-info",
      JSON.stringify({
        name: name.trim(),

        whatsapp: whatsapp.trim(),

        pickupType,

        pickup: pickupType === "dorm" ? "Deliver to Dorm" : "Pick Up on Campus",

        pickupAddress:
          pickupType === "dorm" ? dormAddress.trim() : pickup.trim(),

        dormAddress: pickupType === "dorm" ? dormAddress.trim() : "",

        items,

        total,

        cart,
      }),
    );
    router.push("/checkout/payment");
  };
  return (
    <main className="min-h-screen bg-[#fbfaf6] px-4 pb-12 text-[#173d36] sm:px-6">
      <header className="mx-auto flex max-w-3xl items-center justify-between py-5">
        <button
          onClick={() => router.push("/")}
          disabled={navigating}
          className="flex items-center gap-2 text-sm font-bold text-[#176b57] disabled:opacity-50"
        >
          <ArrowLeft size={18} /> Kembali ke menu
        </button>
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#d9efe1] text-[#176b57]">
            <Leaf size={19} fill="currentColor" />
          </span>
          <strong className="text-lg font-black">LabKom</strong>
        </div>
      </header>
      <section className="mx-auto max-w-3xl">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#b84f43]">
            Langkah 1 dari 2
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Data pemesan
          </h1>
          <p className="mt-2 text-sm text-[#66766e]">
            Isi informasi personal dan lokasi penerimaan sebelum pembayaran.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            continueToPayment();
          }}
          className="relative grid gap-5 rounded-3xl bg-white p-5 shadow-sm sm:p-7"
        >
          {navigating && (
            <PendingOverlay
              label="Menyiapkan pembayaran…"
              detail="Membuka halaman QRIS dan ringkasan pesanan."
            />
          )}
          <label className="grid gap-2 text-sm font-extrabold">
            Nama pemesan
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={navigating}
              className="h-12 rounded-xl border border-[#d9ded7] bg-[#fffefa] px-4 font-normal outline-none focus:border-[#176b57]"
              placeholder="Contoh: Aimee"
              autoComplete="name"
            />
          </label>
          <label className="grid gap-2 text-sm font-extrabold">
            Nomor WhatsApp
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              disabled={navigating}
              className="h-12 rounded-xl border border-[#d9ded7] bg-[#fffefa] px-4 font-normal outline-none focus:border-[#176b57]"
              placeholder="08xxxxxxxxxx"
              inputMode="tel"
              autoComplete="tel"
            />
          </label>
          <fieldset className="grid gap-3 text-sm font-extrabold" disabled={navigating}>
            <legend>Metode penerimaan</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label
                className={`cursor-pointer rounded-2xl border p-4 transition ${pickupType === "campus" ? "border-[#176b57] bg-[#edf6ef]" : "border-[#d9ded7]"}`}
              >
                <input
                  type="radio"
                  name="pickupType"
                  checked={pickupType === "campus"}
                  onChange={() => setPickupType("campus")}
                  className="sr-only"
                />
                <span className="block">Pick Up on Campus</span>
                <small className="mt-1 block font-normal text-[#71807a]">
                  Tentukan titik pengambilan
                </small>
              </label>
              <label
                className={`cursor-pointer rounded-2xl border p-4 transition ${pickupType === "dorm" ? "border-[#176b57] bg-[#edf6ef]" : "border-[#d9ded7]"}`}
              >
                <input
                  type="radio"
                  name="pickupType"
                  checked={pickupType === "dorm"}
                  onChange={() => setPickupType("dorm")}
                  className="sr-only"
                />
                <span className="block">Deliver to Dorm</span>
                <small className="mt-1 block font-normal text-[#71807a]">
                  Masukkan alamat asrama
                </small>
              </label>
            </div>
          </fieldset>
          {pickupType === "campus" ? (
            <label className="grid gap-2 text-sm font-extrabold">
              Lokasi Pick Up on Campus
              <input
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                className="h-12 rounded-xl border border-[#d9ded7] bg-[#fffefa] px-4 font-normal outline-none focus:border-[#176b57]"
                placeholder="Contoh: LabKomputer Kampus, lobi utama"
              />
            </label>
          ) : (
            <label className="grid gap-2 text-sm font-extrabold">
              Alamat Deliver to Dorm
              <input
                value={dormAddress}
                onChange={(e) => setDormAddress(e.target.value)}
                className="h-12 rounded-xl border border-[#d9ded7] bg-[#fffefa] px-4 font-normal outline-none focus:border-[#176b57]"
                placeholder="Contoh: Dorm A, lantai 2, kamar 204"
                autoComplete="street-address"
              />
            </label>
          )}
          <div className="flex items-center justify-between border-t border-[#edf0e9] pt-5">
            <div>
              <p className="text-xs text-[#71807a]">Total pesanan</p>
              {hydrated ? (
                <strong className="text-xl font-black">{rupiah(total)}</strong>
              ) : (
                <Skeleton className="mt-1 h-6 w-28" />
              )}
            </div>
            <button
              type="submit"
              disabled={navigating}
              aria-busy={navigating || undefined}
              data-pending={navigating || undefined}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#176b57] px-6 font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {navigating && <Spinner />}
              {navigating ? "Menyiapkan…" : "Lanjut ke pembayaran"}
            </button>
          </div>
          {error && <p className="text-sm font-bold text-[#b84f43]">{error}</p>}
        </form>
      </section>
    </main>
  );
}












