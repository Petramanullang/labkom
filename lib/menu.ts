/** Tipe & helper menu yang dipakai bersama storefront dan dashboard. */

export type MenuItem = {
  id: string;
  name: string;
  short: string;
  /** Harga jual yang tampil ke pembeli. */
  price: number;
  /** Harga beli atau HPP per porsi. Dipakai untuk estimasi bersih. */
  costPrice: number;
  category: string;
  tag: string | null;
  /** URL foto menu (Supabase Storage `menu-images`, atau URL luar untuk data lama). */
  image: string;
  /** Path di bucket `menu-images` bila foto diunggah dari dashboard. */
  imagePath: string | null;
  isActive: boolean;
  sortOrder: number;
};

export type MenuRow = {
  id: string;
  name: string;
  short_description: string | null;
  price: number | string;
  cost_price?: number | string | null;
  category: string;
  tag: string | null;
  image_path: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
};

export const FALLBACK_CATEGORIES = ["Paket", "Makanan Utama", "Minuman", "Snack", "Dessert"];

export function toMenuItem(row: MenuRow): MenuItem {
  return {
    id: row.id,
    name: row.name,
    short: row.short_description ?? "",
    price: Number(row.price ?? 0),
    costPrice: Number(row.cost_price ?? 0),
    category: row.category || "Makanan Utama",
    tag: row.tag,
    image: row.image_url ?? "",
    imagePath: row.image_path,
    isActive: row.is_active,
    sortOrder: row.sort_order ?? 0,
  };
}

/** Kategori untuk filter katalog: bawaan + kategori apa pun yang dipakai menu aktif. */
export function buildCategories(items: Pick<MenuItem, "category">[]): string[] {
  const seen = new Set<string>();
  const list: string[] = ["Semua"];
  [...FALLBACK_CATEGORIES, ...items.map((item) => item.category)].forEach((category) => {
    const value = (category || "").trim();
    if (!value || seen.has(value.toLowerCase())) return;
    seen.add(value.toLowerCase());
    list.push(value);
  });
  return list;
}

