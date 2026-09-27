/**
 * Data katalog.
 *
 * Sumber utama menu sekarang adalah tabel `menu_items` di Supabase (lihat
 * `/api/catalog`). Daftar di bawah hanya dipakai sebagai tampilan cadangan
 * ketika perangkat belum pernah memuat katalog dari server (offline total).
 */
import type { MenuItem } from "@/lib/menu";

export const products: MenuItem[] = [
  {
    id: "offline-1",
    name: "Paket Pempek + Es Kuwut",
    short: "Pempek + Es Kuwut",
    price: 28000,
    costPrice: 18000,
    category: "Paket",
    tag: "Paling Hemat",
    image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=700&q=85",
    imagePath: null,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: "offline-2",
    name: "Pempek",
    short: "Pempek Palembang dengan kuah cuko",
    price: 23000,
    costPrice: 15000,
    category: "Makanan Utama",
    tag: null,
    image: "https://images.unsplash.com/photo-1625398407796-82650a8c135f?auto=format&fit=crop&w=700&q=85",
    imagePath: null,
    isActive: true,
    sortOrder: 2,
  },
  {
    id: "offline-3",
    name: "Es Kuwut",
    short: "Minuman segar dengan jeruk & selasih",
    price: 7000,
    costPrice: 4000,
    category: "Minuman",
    tag: null,
    image: "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=700&q=85",
    imagePath: null,
    isActive: true,
    sortOrder: 3,
  },
  {
    id: "offline-4",
    name: "Mie Goreng Spesial",
    short: "Mie dengan topping telur dan sayuran",
    price: 13000,
    costPrice: 8000,
    category: "Makanan Utama",
    tag: null,
    image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=700&q=85",
    imagePath: null,
    isActive: true,
    sortOrder: 4,
  },
  {
    id: "offline-5",
    name: "Chicken Katsu",
    short: "Ayam krispi dengan saus pilihan",
    price: 18000,
    costPrice: 12000,
    category: "Makanan Utama",
    tag: null,
    image: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=700&q=85",
    imagePath: null,
    isActive: true,
    sortOrder: 5,
  },
  {
    id: "offline-6",
    name: "Pisang Coklat",
    short: "Camilan manis, renyah di luar",
    price: 10000,
    costPrice: 6000,
    category: "Snack",
    tag: null,
    image: "https://images.unsplash.com/photo-1621303837174-89787a7d4729?auto=format&fit=crop&w=700&q=85",
    imagePath: null,
    isActive: true,
    sortOrder: 6,
  },
];

export const categories = ["Semua", "Paket", "Makanan Utama", "Minuman", "Snack", "Dessert"];

export const rupiah = (value: number) => `Rp${Number(value || 0).toLocaleString("id-ID")}`;

