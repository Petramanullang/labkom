"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  Leaf,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { Skeleton, SkeletonProductGrid } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/pending-overlay";
import { useActionLock } from "@/lib/use-async-action";
import { useCatalog } from "@/lib/use-catalog";
import type { MenuItem } from "@/lib/menu";

const heroImage =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/WhatsApp%20Image%202026-09-21%20at%2018.47.53-OghWP4QhL6pNDlFdJLcAvsHjFSft34.jpeg";
const rupiah = (value: number) => `Rp${value.toLocaleString("id-ID")}`;
const orderStatusLabel = (status?: string) =>
  status === "verified"
    ? "Terverifikasi"
    : status === "rejected"
      ? "Ditolak"
      : "Menunggu verifikasi";
type Cart = Record<string, number>;
type Order = {
  id: string;
  name: string;
  pickup: string;
  whatsapp: string;
  items: MenuItem[];
  cart: Cart;
  total: number;
  fileName: string;
  createdAt: string;
  status?: string;
};

export default function Page() {
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Cart>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [receipt, setReceipt] = useState<Order | null>(null);
  const [savedOrder, setSavedOrder] = useState<Order | null>(null);
  /** false sampai keranjang & order terakhir selesai dibaca dari perangkat. */
  const [hydrated, setHydrated] = useState(false);
  /** true selama berpindah dari keranjang ke halaman checkout. */
  const [navigating, setNavigating] = useState(false);
  const { acquire, release } = useActionLock();
  const router = useRouter();
  /** Menu diambil dari tabel `menu_items` (api/catalog), bukan lagi daftar statis. */
  const catalog = useCatalog();
  const products = catalog.items;
  const categories = catalog.categories;

  useEffect(() => {
    const saved = window.localStorage.getItem("labkom-cart");
    const order = window.localStorage.getItem("labkom-last-order");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Cart;
        // Keranjang versi lama memakai id angka; menu sekarang memakai uuid.
        const legacy = Object.keys(parsed).some((key) => /^\d+$/.test(key));
        if (!legacy) setCart(parsed);
      } catch {
        /* keranjang rusak — mulai dari kosong */
      }
    }
    if (order) {
      try {
        setSavedOrder(JSON.parse(order) as Order);
      } catch {
        /* abaikan */
      }
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("labkom-cart", JSON.stringify(cart));
  }, [cart, hydrated]);

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          (activeCategory === "Semua" || product.category === activeCategory) &&
          product.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [activeCategory, query, products],
  );
  const cartItems = products.filter((product) => cart[product.id]);
  const itemCount = Object.values(cart).reduce(
    (sum, quantity) => sum + quantity,
    0,
  );
  const total = cartItems.reduce(
    (sum, item) => sum + item.price * cart[item.id],
    0,
  );
  const changeCart = (id: string, delta: number) =>
    setCart((current) => {
      const next = Math.max(0, (current[id] || 0) + delta);
      const updated = { ...current };
      if (next) updated[id] = next;
      else delete updated[id];
      return updated;
    });
  const startCheckout = () => {
    // Katalog harus berasal dari server/cache agar id menu valid saat dikirim.
    if (!catalog.orderable) return;
    // Kunci sinkron: dua kali tekan tidak akan membuka checkout dua kali.
    if (!acquire()) return;
    setNavigating(true);
    setCartOpen(false);
    router.push("/checkout");
    // Lepas kunci kalau navigasi ternyata gagal / dibatalkan.
    window.setTimeout(release, 4000);
  };

  return (
    <main className="min-h-screen bg-[#fbfaf6] text-[#173d36]">
      <header className="sticky top-0 z-40 border-b border-[#e8e5dc] bg-[#fffefa]/95 backdrop-blur-md">
        <div className="mx-auto flex h-[70px] max-w-[1240px] items-center justify-between px-4 lg:px-8">
          <a href="#beranda" className="flex items-center gap-2.5">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[#d9efe1] text-[#087253]">
              <Leaf size={25} fill="currentColor" />
            </span>
            <span className="leading-none">
              <strong className="block text-[22px] font-black tracking-[-0.06em] text-[#123f37]">
                LabKom
              </strong>
              <small className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#357467]">
                Warung Aslabkom
              </small>
            </span>
          </a>
          <nav className="hidden items-center gap-9 text-sm font-semibold md:flex">
            <a className="text-[#d83c31]" href="#beranda">
              Beranda
            </a>
            <a href="#menu">Menu</a>
            <a href="#cara-pesan">Cara Pesan</a>
            <a href="/receipt">Receipt</a>
            <a href="#tentang">Tentang</a>
          </nav>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setCartOpen(true)}
              className="relative grid h-11 w-11 place-items-center rounded-full text-[#0c5144] hover:bg-[#edf4ee]"
              aria-label="Buka keranjang"
            >
              <ShoppingCart size={23} />
              {hydrated && itemCount > 0 && (
                <span className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-[#dc4134] px-1 text-[10px] font-extrabold text-white">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>
      <section
        id="beranda"
        className="relative isolate overflow-hidden bg-[#165d4d]"
      >
        <img
          src={heroImage}
          alt="Promo menu Warung Aslabkom"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#124e42]/80 via-[#165d4d]/35 to-transparent" />
        <div className="relative mx-auto grid min-h-[425px] max-w-[1240px] items-center px-5 py-12 lg:min-h-[460px] lg:px-8">
          <div className="max-w-[560px] text-white">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#fff9e8] px-4 py-2 text-xs font-extrabold text-[#155e4b]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#0eaf60]" /> PO
              {catalog.batch
                ? `${catalog.batch.name} — ${catalog.batch.label}`
                : "Pre-order dibuka"}
            </div>
            <h1 className="max-w-[560px] text-5xl font-black uppercase leading-[.92] tracking-[-0.05em] text-[#fff2ce] drop-shadow-[3px_4px_0_#d53b31] sm:text-6xl lg:text-[76px]">
              Pre-order
              <br />
              <span className="text-[#fff8e9]">Warung Aslabkom</span>
            </h1>
            <p className="mt-5 max-w-[350px] text-base font-medium leading-6 text-white/90">
              Makanan enak, harga bersahabat, langsung di asal untuk warga
              kampus.
            </p>
            <a
              href="#menu"
              className="mt-7 inline-flex h-12 items-center gap-4 rounded-xl bg-[#e74335] px-6 text-sm font-extrabold text-white shadow-lg"
            >
              Mulai Pesan <ArrowRight size={20} />
            </a>
          </div>
        </div>
      </section>
      <section
        id="menu"
        className="mx-auto max-w-[1240px] px-4 pb-24 pt-9 lg:px-8"
      >
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[.15em] text-[#df4b3b]">
              Favorit warga lab
            </p>
            <h2 className="text-3xl font-black leading-none tracking-[-0.04em] sm:text-4xl">
              Menu Andalan
              <br />
              Warung Aslabkom
            </h2>
            <p className="mt-3 text-sm text-[#63726d]">
              Pilihan makanan dan minuman favorit untuk nemenin aktivitas
              kampusmu.
            </p>
          </div>
          <label className="flex h-12 items-center gap-3 rounded-xl border border-[#d9ded7] bg-white px-4 text-[#71807a] md:w-[360px]">
            <Search size={20} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent text-sm outline-none"
              placeholder="Cari makanan atau minuman..."
              aria-label="Cari menu"
            />
          </label>
        </div>
        <div className="mt-8 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`min-h-11 shrink-0 rounded-full px-5 text-sm font-bold ${activeCategory === category ? "bg-[#df4437] text-white" : "bg-[#f1eee4] text-[#31544a]"}`}
            >
              {category}
            </button>
          ))}
        </div>
        {catalog.error && (
          <div className="mt-5 flex items-start gap-2 rounded-2xl bg-[#fff4e2] px-4 py-3 text-sm font-semibold text-[#8a5a12]">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <span>
              {catalog.error}{" "}
              {catalog.orderable
                ? "Menu tersimpan di perangkat tetap ditampilkan."
                : "Menu di bawah hanya pratinjau dan belum bisa dipesan."}
            </span>
          </div>
        )}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {/* Sebelum keranjang selesai dibaca dari perangkat, tampilkan skeleton
              supaya grid tidak berkedip dari kosong ke terisi. */}
          {!hydrated ? (
            <SkeletonProductGrid count={10} className="col-span-full" />
          ) : (
            filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAdd={() => changeCart(product.id, 1)}
              />
            ))
          )}
        </div>
        {hydrated && filteredProducts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#cbd9d0] bg-white py-16 text-center">
            <Sparkles className="mx-auto mb-3 text-[#d8a33e]" />
            <p className="font-bold">Menu tidak ditemukan</p>
          </div>
        )}
        <section
          id="cara-pesan"
          className="mt-14 rounded-3xl bg-white p-6 shadow-sm sm:p-8"
        >
          <p className="text-xs font-bold uppercase tracking-[.15em] text-[#df4b3b]">
            Gampang banget
          </p>
          <h2 className="mt-1 text-2xl font-black sm:text-3xl">
            Cara Pesan di Warung Aslabkom
          </h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-5">
            {[
              "Pilih Menu",
              "Isi Data",
              "Scan QR / Bayar",
              "Upload Bukti",
              "Konfirmasi",
            ].map((label, i) => (
              <div
                key={label}
                className="rounded-2xl bg-[#fbfaf5] p-4 text-center"
              >
                <span className="mx-auto grid h-8 w-8 place-items-center rounded-full bg-[#df4437] text-sm font-black text-white">
                  {i + 1}
                </span>
                <div className="mt-3 text-sm font-extrabold">{label}</div>
                <p className="mt-1 text-xs leading-4 text-[#71807a]">
                  {
                    [
                      "Pilih makanan favoritmu",
                      "Lengkapi data diri",
                      "Transfer sesuai nominal",
                      "Unggah bukti pembayaran",
                      "Pesanan tercatat",
                    ][i]
                  }
                </p>
              </div>
            ))}
          </div>
        </section>
        <section
          id="tentang"
          className="mt-6 rounded-3xl bg-[#0b6c56] p-6 text-white"
        >
          <p className="text-xs font-bold uppercase tracking-[.15em] text-[#bce5c1]">
            Status Pre-Order
          </p>
          <h3 className="mt-1 text-2xl font-black">
            {catalog.batch ? `${catalog.batch.name} — OPEN` : "Pre-order dibuka"}
          </h3>
          <p className="mt-3 text-sm text-white/80">
            {catalog.batch
              ? `Periode ${catalog.batch.label}${
                  catalog.batch.deliveryDate ? ` · Pengantaran ${catalog.batch.deliveryDate}` : ""
                } · Pengambilan di LabKomputer Kampus`
              : "Jadwal batch belum diatur admin. Pesanan tetap bisa dikirim."}
          </p>
        </section>
      </section>
      <footer className="bg-[#075344] px-4 py-10 text-white">
        <div className="mx-auto grid max-w-[1240px] gap-8 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <Leaf size={28} fill="currentColor" />
              <strong className="text-2xl font-black">LabKom</strong>
            </div>
            <p className="mt-2 text-sm text-white/70">
              Makanan enak, dari aslab untuk warga kampus.
            </p>
          </div>
          <div>
            <p className="font-bold">Navigasi</p>
            <div className="mt-3 grid gap-2 text-sm text-white/70">
              <a href="#beranda">Beranda</a>
              <a href="#menu">Menu</a>
            </div>
          </div>
          <div>
            <p className="font-bold">Kontak</p>
            <div className="mt-3 grid gap-2 text-sm text-white/70">
              <span>WhatsApp +62 821-9380-7824</span>
              <span>Instagram @labkom.aslab</span>
            </div>
          </div>
        </div>
      </footer>
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-[#e8e5dc] bg-[#fffefa]/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(20,61,53,.10)] backdrop-blur-md lg:hidden"
        aria-label="Navigasi utama"
      >
        <a href="#beranda" className="mobile-nav-item">
          <Leaf size={18} />
          <span>Beranda</span>
        </a>
        <a href="#menu" className="mobile-nav-item">
          <Search size={18} />
          <span>Menu</span>
        </a>
        <button onClick={() => setCartOpen(true)} className="mobile-nav-item">
          <ShoppingCart size={18} />
          <span>Keranjang</span>
          {itemCount > 0 && <b>{itemCount}</b>}
        </button>
        <a href="/receipt" className="mobile-nav-item">
          <Check size={18} />
          <span>Receipt</span>
        </a>
        <a href="#cara-pesan" className="mobile-nav-item">
          <Sparkles size={18} />
          <span>Cara Pesan</span>
        </a>
      </nav>
      {itemCount > 0 && (
        <div className="fixed bottom-[76px] left-4 right-4 z-30 mx-auto flex max-w-[700px] items-center justify-between gap-3 rounded-2xl border border-[#e7e4db] bg-white/95 p-3 shadow-xl backdrop-blur-md lg:hidden">
          <div>
            <p className="text-xs font-bold text-[#73807b]">
              {itemCount} item di keranjang
            </p>
            <strong>{rupiah(total)}</strong>
          </div>
          <button
            onClick={() => setCartOpen(true)}
            className="h-11 rounded-xl bg-[#df4437] px-4 text-sm font-extrabold text-white"
          >
            Lihat Keranjang
          </button>
        </div>
      )}
      {cartOpen && (
        <CartPanel
          items={cartItems}
          cart={cart}
          total={total}
          onChange={changeCart}
          onClose={() => setCartOpen(false)}
          onCheckout={startCheckout}
          pending={navigating}
          disabled={!catalog.orderable}
        />
      )}
      {receipt && <Receipt order={receipt} onClose={() => setReceipt(null)} />}
      {savedOrder && !receipt && (
        <button
          onClick={() => setReceipt(savedOrder)}
          className="fixed bottom-4 left-4 z-20 rounded-full border border-[#d7e1d6] bg-white px-4 py-3 text-xs font-bold text-[#176b57] shadow-lg"
        >
          Lihat pesanan terakhir
        </button>
      )}
    </main>
  );
}

function ProductCard({
  product,
  onAdd,
}: {
  product: MenuItem;
  onAdd: () => void;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  return (
    <article className="overflow-hidden rounded-2xl border border-[#e7e6de] bg-white shadow-sm">
      <div className="relative aspect-[1.12] overflow-hidden bg-[#e9eee5]">
        {/* skeleton sampai foto menu selesai diunduh */}
        {!imageLoaded && (
          <Skeleton
            rounded="sm"
            className="absolute inset-0 h-full w-full rounded-none"
          />
        )}
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(true)}
          className={`h-full w-full object-cover transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
        />
        {product.tag && (
          <span className="absolute left-2 top-2 rounded-full bg-[#e84737] px-2.5 py-1 text-[10px] font-black text-white">
            {product.tag}
          </span>
        )}
      </div>
      <div className="p-3.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#84a18f]">
          {product.category === "Semua" ? "Paket Hemat" : product.category}
        </span>
        <h3 className="mt-1 line-clamp-1 text-sm font-extrabold">
          {product.name}
        </h3>
        <p className="mt-1 line-clamp-1 text-xs text-[#7a8580]">
          {product.short}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <strong className="text-base font-black">
            {rupiah(product.price)}
          </strong>
          <button
            onClick={onAdd}
            className="grid h-10 w-10 place-items-center rounded-xl bg-[#0d725a] text-white active:scale-90"
            aria-label={`Tambah ${product.name}`}
          >
            <Plus size={20} />
          </button>
        </div>
      </div>
    </article>
  );
}

function CartPanel({
  items,
  cart,
  total,
  onChange,
  onClose,
  onCheckout,
  pending,
  disabled = false,
}: {
  items: MenuItem[];
  cart: Cart;
  total: number;
  onChange: (id: string, delta: number) => void;
  onClose: () => void;
  onCheckout: () => void;
  /** true selama berpindah ke halaman checkout. */
  pending?: boolean;
  /** true bila katalog belum berhasil dimuat dari server. */
  disabled?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Tutup keranjang"
        onClick={onClose}
        className="absolute inset-0 bg-[#143d35]/35 backdrop-blur-sm"
      />
      <aside className="absolute bottom-0 right-0 top-0 w-full max-w-[440px] overflow-y-auto bg-[#fffefa] p-5 shadow-2xl sm:p-7">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#df4437]">
              Pesananmu
            </p>
            <h2 className="mt-1 text-2xl font-black">Keranjang</h2>
          </div>
          <button
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-full bg-[#f1f2eb]"
            aria-label="Tutup"
          >
            <X size={20} />
          </button>
        </div>
        <div className="my-6 border-t border-dashed border-[#cfd8d0]" />
        {items.length === 0 ? (
          <div className="py-16 text-center">
            <ShoppingCart className="mx-auto mb-3 text-[#97b29f]" size={40} />
            <p className="font-bold">Keranjangmu masih kosong</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3">
                <img
                  src={item.image}
                  alt=""
                  className="h-20 w-20 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-extrabold">{item.name}</h3>
                  <p className="mt-1 text-sm font-bold text-[#df4437]">
                    {rupiah(item.price)}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      onClick={() => onChange(item.id, -1)}
                      className="grid h-8 w-8 place-items-center rounded-lg bg-[#edf1e9]"
                    >
                      <Minus size={15} />
                    </button>
                    <span>{cart[item.id]}</span>
                    <button
                      onClick={() => onChange(item.id, 1)}
                      className="grid h-8 w-8 place-items-center rounded-lg bg-[#dff0e2] text-[#087253]"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
                <strong>{rupiah(item.price * cart[item.id])}</strong>
              </div>
            ))}
          </div>
        )}
        <div className="my-6 border-t border-dashed border-[#cfd8d0]" />
        <div className="flex items-center justify-between">
          <span className="text-[#73807b]">Total</span>
          <strong className="text-2xl">{rupiah(total)}</strong>
        </div>
        {disabled && (
          <p className="mt-5 rounded-xl bg-[#fff4e2] p-3 text-xs font-bold text-[#8a5a12]">
            Katalog belum tersambung ke server. Coba muat ulang halaman sebelum memesan.
          </p>
        )}
        <button
          disabled={!items.length || pending || disabled}
          onClick={onCheckout}
          aria-busy={pending || undefined}
          data-pending={pending || undefined}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#df4437] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? (
            <>
              <Spinner /> Menyiapkan checkout…
            </>
          ) : (
            <>
              Lanjut Checkout <ArrowRight size={18} />
            </>
          )}
        </button>
      </aside>
    </div>
  );
}

function Receipt({ order, onClose }: { order: Order; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-[#143d35]/45 p-4 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-3xl bg-[#fffefa] p-6 shadow-2xl sm:p-8">
        <div className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#dff0e2] text-[#176b57]">
            <Check size={30} />
          </span>
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-[#df4437]">
            Pesanan berhasil
          </p>
          <h2 className="mt-1 text-3xl font-black">
            Terima kasih, {order.name}
          </h2>
          <p className="mt-2 text-sm text-[#75817d]">
            Simpan struk ini sebagai bukti pesanan.
          </p>
        </div>
        <div className="my-6 border-t border-dashed border-[#bfcfc2]" />
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-[#75817d]">
            ID Transaksi
          </p>
          <strong className="mt-1 block text-2xl font-black text-[#176b57]">
            {order.id}
          </strong>
        </div>
        <div className="my-6 grid gap-3 rounded-2xl bg-[#f7f6ef] p-4 text-sm">
          <div className="flex justify-between">
            <span>Nama</span>
            <strong>{order.name}</strong>
          </div>
          <div className="flex justify-between">
            <span>Pengambilan</span>
            <strong>{order.pickup}</strong>
          </div>
          <div className="flex justify-between">
            <span>Total</span>
            <strong>{rupiah(order.total)}</strong>
          </div>
          <div className="flex justify-between">
            <span>Status</span>
            <strong className="text-[#176b57]">{orderStatusLabel(order.status)}</strong>
          </div>
          <div className="flex justify-between">
            <span>Bukti</span>
            <strong className="max-w-[170px] truncate">{order.fileName}</strong>
          </div>
        </div>
        <p className="text-center text-xs text-[#75817d]">{order.createdAt}</p>
        <button
          onClick={onClose}
          className="mt-6 h-12 w-full rounded-xl bg-[#176b57] font-extrabold text-white"
        >
          Selesai
        </button>
      </section>
    </div>
  );
}





























