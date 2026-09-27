"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  IconButton,
  Modal,
  Notice,
  PageHeader,
  Select,
  TextInput,
  Textarea,
} from "@/components/dashboard/kit";
import { Skeleton } from "@/components/ui/skeleton";
import { apiForm, apiGet, apiJson, errorMessage } from "@/lib/api";
import { rupiah } from "@/lib/order";
import { FALLBACK_CATEGORIES, type MenuItem } from "@/lib/menu";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  short: string;
  price: string;
  costPrice: string;
  category: string;
  tag: string;
  sortOrder: string;
  isActive: boolean;
  imagePath: string;
  imageUrl: string;
};

const emptyForm: FormState = {
  name: "",
  short: "",
  price: "",
  costPrice: "",
  category: "Makanan Utama",
  tag: "",
  sortOrder: "0",
  isActive: true,
  imagePath: "",
  imageUrl: "",
};

export default function MenuManagerPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<MenuItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Foto yang diunggah pada sesi form ini dan belum disimpan. */
  const freshUpload = useRef<string | null>(null);
  const lock = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await apiGet<MenuItem[]>("/api/admin/menu"));
      setError("");
    } catch (caught) {
      setError(errorMessage(caught, "Gagal memuat daftar menu."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => {
    const set = new Set<string>(FALLBACK_CATEGORIES);
    items.forEach((item) => item.category && set.add(item.category));
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return items.filter(
      (item) =>
        (!categoryFilter || item.category === categoryFilter) &&
        (!keyword || item.name.toLowerCase().includes(keyword) || item.short.toLowerCase().includes(keyword)),
    );
  }, [items, categoryFilter, search]);

  function openCreate() {
    freshUpload.current = null;
    setEditing(null);
    setForm({ ...emptyForm, sortOrder: String(items.length + 1) });
    setFormOpen(true);
  }

  function openEdit(item: MenuItem) {
    freshUpload.current = null;
    setEditing(item);
    setForm({
      name: item.name,
      short: item.short,
      price: String(item.price),
      costPrice: String(item.costPrice),
      category: item.category,
      tag: item.tag ?? "",
      sortOrder: String(item.sortOrder),
      isActive: item.isActive,
      imagePath: item.imagePath ?? "",
      imageUrl: item.image,
    });
    setFormOpen(true);
  }

  function closeForm() {
    // Bersihkan foto yang diunggah lalu batal disimpan.
    const orphan = freshUpload.current;
    freshUpload.current = null;
    if (orphan) void fetch(`/api/admin/menu/image?path=${encodeURIComponent(orphan)}`, { method: "DELETE" });
    setFormOpen(false);
    setEditing(null);
  }

  async function uploadImage(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      setError("Ukuran gambar maksimal 2 MB.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      setError("Format gambar harus JPG, PNG, WEBP, atau AVIF.");
      return;
    }
    setUploading(true);
    try {
      const data = new FormData();
      data.set("file", file);
      const result = await apiForm<{ path: string; url: string }>("/api/admin/menu/image", data);
      // Foto lama yang baru saja diunggah tapi tidak jadi dipakai dibuang.
      const previous = freshUpload.current;
      if (previous && previous !== result.path) {
        void fetch(`/api/admin/menu/image?path=${encodeURIComponent(previous)}`, { method: "DELETE" });
      }
      freshUpload.current = result.path;
      setForm((current) => ({ ...current, imagePath: result.path, imageUrl: result.url }));
      setError("");
    } catch (caught) {
      setError(errorMessage(caught, "Gagal mengunggah gambar menu."));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (lock.current) return;
    if (form.name.trim().length < 2) {
      setError("Nama menu minimal 2 karakter.");
      return;
    }
    const price = Number(form.price);
    const costPrice = Number(form.costPrice || 0);
    if (!Number.isFinite(price) || price < 0) {
      setError("Harga jual tidak valid.");
      return;
    }
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      setError("Harga beli tidak valid.");
      return;
    }
    lock.current = true;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        short: form.short.trim(),
        price,
        costPrice,
        category: form.category.trim() || "Makanan Utama",
        tag: form.tag.trim() || null,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
        imagePath: form.imagePath || null,
        imageUrl: form.imageUrl || null,
      };
      if (editing) {
        await apiJson(`/api/admin/menu/${editing.id}`, "PATCH", payload);
        setNotice(`Menu "${payload.name}" diperbarui.`);
      } else {
        await apiJson("/api/admin/menu", "POST", payload);
        setNotice(`Menu "${payload.name}" ditambahkan.`);
      }
      freshUpload.current = null;
      setFormOpen(false);
      setEditing(null);
      setError("");
      await load();
    } catch (caught) {
      setError(errorMessage(caught, "Gagal menyimpan menu."));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  async function toggleActive(item: MenuItem) {
    setBusyId(item.id);
    try {
      await apiJson(`/api/admin/menu/${item.id}`, "PATCH", { isActive: !item.isActive });
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, isActive: !entry.isActive } : entry)),
      );
      setNotice(`Menu "${item.name}" ${item.isActive ? "dinonaktifkan" : "diaktifkan"}.`);
    } catch (caught) {
      setError(errorMessage(caught, "Gagal mengubah status menu."));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: MenuItem) {
    setBusyId(item.id);
    try {
      await apiJson(`/api/admin/menu/${item.id}`, "DELETE");
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setNotice(`Menu "${item.name}" dihapus.`);
      setError("");
    } catch (caught) {
      setError(errorMessage(caught, "Gagal menghapus menu."));
    } finally {
      setBusyId(null);
      setConfirmDelete(null);
    }
  }

  async function move(item: MenuItem, direction: -1 | 1) {
    const ordered = [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const index = ordered.findIndex((entry) => entry.id === item.id);
    const neighbour = ordered[index + direction];
    if (!neighbour) return;
    setBusyId(item.id);
    try {
      await Promise.all([
        apiJson(`/api/admin/menu/${item.id}`, "PATCH", { sortOrder: neighbour.sortOrder }),
        apiJson(`/api/admin/menu/${neighbour.id}`, "PATCH", { sortOrder: item.sortOrder }),
      ]);
      await load();
    } catch (caught) {
      setError(errorMessage(caught, "Gagal mengubah urutan menu."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Menu"
        title="Kelola menu & foto"
        description="Tambah, ubah, nonaktifkan, atau hapus menu. Foto menu disimpan di Supabase Storage (bucket menu-images)."
        actions={
          <>
            <Button variant="outline" onClick={() => void load()} pending={loading}>
              <RefreshCw size={15} /> Perbarui
            </Button>
            <Button onClick={openCreate}>
              <Plus size={15} /> Menu baru
            </Button>
          </>
        }
      />

      {error && <Notice tone="danger" onClose={() => setError("")}>{error}</Notice>}
      {notice && <Notice tone="success" onClose={() => setNotice("")}>{notice}</Notice>}

      <Card className="flex flex-wrap items-end gap-3">
        <label className="grid flex-1 gap-2">
          <span className="text-xs font-bold uppercase tracking-[.14em] text-[#8b9a94]">Cari menu</span>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#95a39d]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nama menu…"
              className="h-11 w-full rounded-xl border border-[#d9ded7] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#176b57]"
            />
          </div>
        </label>
        <label className="grid gap-2">
          <span className="text-xs font-bold uppercase tracking-[.14em] text-[#8b9a94]">Kategori</span>
          <Select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="">Semua kategori</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
        </label>
        <div className="pb-1 text-sm font-bold text-[#71807a]">
          {filtered.length} dari {items.length} menu
        </div>
      </Card>

      {loading && !items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((key) => (
            <div key={key} className="rounded-3xl bg-white p-4 shadow-sm">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="mt-4 h-5 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed size={20} />}
          title={items.length ? "Tidak ada menu yang cocok" : "Belum ada menu"}
          description={
            items.length
              ? "Ubah filter kategori atau kata kunci pencarian."
              : "Tambahkan menu pertama agar bisa dipesan dari halaman toko."
          }
          action={
            <Button onClick={openCreate}>
              <Plus size={15} /> Menu baru
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <article
              key={item.id}
              className={cn(
                "flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm transition",
                !item.isActive && "opacity-70",
              )}
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#eef1ec]">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-[#95a39d]">
                    <ImagePlus size={26} />
                  </div>
                )}
                <div className="absolute left-3 top-3 flex gap-2">
                  <Badge tone={item.isActive ? "success" : "neutral"}>{item.isActive ? "Aktif" : "Nonaktif"}</Badge>
                  {item.tag && <Badge tone="info">{item.tag}</Badge>}
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-3 p-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.12em] text-[#8b9a94]">{item.category}</p>
                  <h2 className="mt-1 font-black leading-tight">{item.name}</h2>
                  {item.short && <p className="mt-1 text-xs text-[#71807a]">{item.short}</p>}
                </div>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.12em] text-[#8b9a94]">Harga jual</p>
                    <strong className="text-lg font-black text-[#176b57]">{rupiah(item.price)}</strong>
                    <p className="mt-1 text-xs font-semibold text-[#71807a]">
                      Beli {rupiah(item.costPrice)} | Bersih {rupiah(item.price - item.costPrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <IconButton title="Naikkan urutan" onClick={() => void move(item, -1)} disabled={busyId === item.id}>
                      <ArrowUp size={15} />
                    </IconButton>
                    <IconButton title="Turunkan urutan" onClick={() => void move(item, 1)} disabled={busyId === item.id}>
                      <ArrowDown size={15} />
                    </IconButton>
                    <IconButton title="Ubah menu" onClick={() => openEdit(item)} tone="primary">
                      <Pencil size={15} />
                    </IconButton>
                    <IconButton title="Hapus menu" onClick={() => setConfirmDelete(item)} tone="danger">
                      <Trash2 size={15} />
                    </IconButton>
                  </div>
                </div>
                <Button variant="outline" onClick={() => void toggleActive(item)} pending={busyId === item.id}>
                  {item.isActive ? "Nonaktifkan dari toko" : "Aktifkan di toko"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        wide
        title={editing ? `Ubah menu: ${editing.name}` : "Menu baru"}
        description="Perubahan langsung tampil di halaman toko setelah disimpan."
        footer={
          <>
            <Button variant="outline" onClick={closeForm} disabled={saving}>
              Batal
            </Button>
            <Button onClick={() => void save()} pending={saving}>
              {editing ? "Simpan perubahan" : "Tambah menu"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-[190px_1fr]">
          <div className="grid gap-2">
            <span className="text-sm font-bold">Foto menu</span>
            <div className="grid h-[150px] w-full place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-[#d5ddd4] bg-[#fbfcf9]">
              {form.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.imageUrl} alt="Pratinjau menu" className="h-full w-full object-cover" />
              ) : (
                <span className="text-center text-xs text-[#95a39d]">
                  <ImagePlus className="mx-auto mb-1" size={22} />
                  Belum ada foto
                </span>
              )}
            </div>
            <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#d9ded7] text-sm font-bold transition hover:border-[#176b57]">
              {uploading ? "Mengunggah…" : "Pilih gambar"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                disabled={uploading || saving}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadImage(file);
                  event.target.value = "";
                }}
              />
            </label>
            {form.imageUrl && (
              <Button
                variant="outline"
                onClick={() => setForm((current) => ({ ...current, imagePath: "", imageUrl: "" }))}
              >
                Hapus foto
              </Button>
            )}
            <p className="text-xs text-[#95a39d]">JPG/PNG/WEBP maksimal 2 MB.</p>
          </div>

          <div className="grid gap-4">
            <Field label="Nama menu">
              <TextInput
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Contoh: Paket Pempek + Es Kuwut"
              />
            </Field>
            <Field label="Deskripsi singkat">
              <Textarea
                value={form.short}
                onChange={(event) => setForm((current) => ({ ...current, short: event.target.value }))}
                placeholder="Mis. Pempek Palembang dengan kuah cuko"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Harga Jual (Rp)">
                <TextInput
                  value={form.price}
                  inputMode="numeric"
                  onChange={(event) => setForm((current) => ({ ...current, price: event.target.value.replace(/[^\d]/g, "") }))}
                  placeholder="28000"
                />
              </Field>
              <Field label="Harga Beli / HPP (Rp)" hint="Dipakai untuk menghitung estimasi bersih">
                <TextInput
                  value={form.costPrice}
                  inputMode="numeric"
                  onChange={(event) => setForm((current) => ({ ...current, costPrice: event.target.value.replace(/[^\d]/g, "") }))}
                  placeholder="18000"
                />
              </Field>
              <Field label="Kategori">
                <Select
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Label promosi" hint="Opsional, mis. Paling Hemat">
                <TextInput
                  value={form.tag}
                  onChange={(event) => setForm((current) => ({ ...current, tag: event.target.value }))}
                />
              </Field>
              <Field label="Urutan tampil" hint="Angka kecil tampil lebih dulu">
                <TextInput
                  value={form.sortOrder}
                  inputMode="numeric"
                  onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value.replace(/[^\d]/g, "") }))}
                />
              </Field>
            </div>
            <Checkbox
              checked={form.isActive}
              onChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
              label="Tampilkan di halaman toko"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title={`Hapus menu "${confirmDelete?.name ?? ""}"?`}
        description="Menu beserta fotonya akan dihapus. Riwayat order lama tetap tersimpan."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Batal
            </Button>
            <Button variant="danger" onClick={() => confirmDelete && void remove(confirmDelete)}>
              Ya, hapus menu
            </Button>
          </>
        }
      >
        <p className="text-sm text-[#4b5c56]">
          Tindakan ini tidak bisa dibatalkan. Jika hanya ingin menyembunyikannya sementara, gunakan tombol
          “Nonaktifkan dari toko”.
        </p>
      </Modal>
    </div>
  );
}

