"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Layers, Pencil, Plus, RefreshCw, Sparkles, Trash2, Truck } from "lucide-react";
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
  StatCard,
  TextInput,
  Textarea,
} from "@/components/dashboard/kit";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, apiJson, errorMessage } from "@/lib/api";
import { rupiah } from "@/lib/order";
import {
  BATCH_STATUS_LABEL,
  batchStatus,
  formatPeriode,
  hariIni,
  jakartaDate,
  sisaHari,
} from "@/lib/batch";
import type { BatchListItem, BatchListResponse } from "@/lib/admin-types";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  startDate: string;
  endDate: string;
  deliveryDate: string;
  note: string;
  isActive: boolean;
  allowOverlap: boolean;
};

const statusTone = { berjalan: "success", "akan-datang": "info", selesai: "neutral", nonaktif: "neutral" } as const;

function newForm(): FormState {
  const today = jakartaDate();
  const endOfMonth = `${today.slice(0, 7)}-${new Date(
    Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0),
  ).getUTCDate()}`;
  return {
    name: "",
    startDate: today,
    endDate: endOfMonth,
    deliveryDate: endOfMonth,
    note: "",
    isActive: true,
    allowOverlap: false,
  };
}

export default function BatchesPage() {
  const [data, setData] = useState<BatchListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BatchListItem | null>(null);
  const [form, setForm] = useState<FormState>(newForm);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<BatchListItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const lock = useRef(false);
  const today = hariIni();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await apiGet<BatchListResponse>("/api/admin/batches"));
      setError("");
    } catch (caught) {
      setError(errorMessage(caught, "Gagal memuat daftar batch."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const batches = data?.batches ?? [];
  const active = useMemo(() => batches.filter((batch) => batchStatus(batch, today) === "berjalan"), [batches, today]);
  const totalGross = useMemo(() => batches.reduce((sum, batch) => sum + batch.stats.gross, 0), [batches]);

  function openCreate() {
    setEditing(null);
    setForm(newForm());
    setFormOpen(true);
  }

  function openEdit(batch: BatchListItem) {
    setEditing(batch);
    setForm({
      name: batch.name,
      startDate: batch.startDate,
      endDate: batch.endDate ?? "",
      deliveryDate: batch.deliveryDate ?? "",
      note: batch.note ?? "",
      isActive: batch.isActive,
      allowOverlap: false,
    });
    setFormOpen(true);
  }

  async function save() {
    if (lock.current) return;
    const payload = {
      name: form.name.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      deliveryDate: form.deliveryDate || null,
      note: form.note.trim() || null,
      isActive: form.isActive,
      allowOverlap: form.allowOverlap,
    };
    if (payload.name.length < 2) {
      setError("Nama batch minimal 2 karakter.");
      return;
    }
    if (payload.endDate < payload.startDate) {
      setError("Tanggal selesai tidak boleh lebih awal dari tanggal mulai.");
      return;
    }
    lock.current = true;
    setSaving(true);
    try {
      if (editing) {
        await apiJson(`/api/admin/batches/${editing.id}`, "PATCH", payload);
        setNotice(`Batch "${payload.name}" diperbarui.`);
      } else {
        await apiJson("/api/admin/batches", "POST", payload);
        setNotice(`Batch "${payload.name}" dibuat.`);
      }
      setFormOpen(false);
      setEditing(null);
      setError("");
      await load();
    } catch (caught) {
      setError(errorMessage(caught, "Gagal menyimpan batch."));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  async function toggleActive(batch: BatchListItem) {
    setBusyId(batch.id);
    try {
      await apiJson(`/api/admin/batches/${batch.id}`, "PATCH", { isActive: !batch.isActive });
      await load();
    } catch (caught) {
      setError(errorMessage(caught, "Gagal mengubah status batch."));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(batch: BatchListItem) {
    setBusyId(batch.id);
    try {
      const result = await apiJson<{ releasedOrders: number }>(`/api/admin/batches/${batch.id}`, "DELETE");
      setNotice(
        result.releasedOrders
          ? `Batch dihapus. ${result.releasedOrders} order menjadi tanpa batch.`
          : "Batch dihapus.",
      );
      setConfirmDelete(null);
      await load();
    } catch (caught) {
      setError(errorMessage(caught, "Gagal menghapus batch."));
    } finally {
      setBusyId(null);
    }
  }

  async function reassign() {
    setAssigning(true);
    try {
      const result = await apiJson<{ updated: number; message: string }>("/api/admin/batches/assign", "POST");
      setNotice(result.message);
      await load();
    } catch (caught) {
      setError(errorMessage(caught, "Gagal menerapkan ulang batch."));
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Batch"
        title="Atur batch pre-order"
        description="Tentukan sendiri periode tiap batch. Order yang masuk otomatis masuk ke batch yang mencakup tanggalnya."
        actions={
          <>
            <Button variant="outline" onClick={() => void reassign()} pending={assigning}>
              <Sparkles size={15} /> Terapkan ke order tanpa batch
            </Button>
            <Button variant="outline" onClick={() => void load()} pending={loading}>
              <RefreshCw size={15} /> Perbarui
            </Button>
            <Button onClick={openCreate}>
              <Plus size={15} /> Batch baru
            </Button>
          </>
        }
      />

      {error && <Notice tone="danger" onClose={() => setError("")}>{error}</Notice>}
      {notice && <Notice tone="success" onClose={() => setNotice("")}>{notice}</Notice>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Batch berjalan" value={String(active.length)} tone="primary" icon={<Layers size={18} className="text-white/80" />} />
        <StatCard label="Total batch" value={String(batches.length)} />
        <StatCard label="Omzet semua batch" value={rupiah(totalGross)} />
        <StatCard
          label="Order tanpa batch"
          value={String(data?.unassigned.orders ?? 0)}
          hint="Klik “Terapkan ke order tanpa batch” untuk mencocokkan."
          tone={data?.unassigned.orders ? "warn" : "muted"}
        />
      </div>

      {loading && !batches.length ? (
        <div className="grid gap-4">
          {[0, 1, 2].map((key) => (
            <div key={key} className="rounded-3xl bg-white p-5 shadow-sm">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="mt-3 h-4 w-72" />
            </div>
          ))}
        </div>
      ) : batches.length === 0 ? (
        <EmptyState
          icon={<Layers size={20} />}
          title="Belum ada batch"
          description="Batch memudahkan pemisahan penjualan per periode pre-order, mis. Batch 1 sampai Batch 4."
          action={
            <Button onClick={openCreate}>
              <Plus size={15} /> Batch baru
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {batches.map((batch) => {
            const status = batchStatus(batch, today);
            return (
              <article
                key={batch.id}
                className={cn(
                  "rounded-3xl bg-white p-5 shadow-sm",
                  status === "berjalan" && "ring-2 ring-[#176b57]/25",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black">{batch.name}</h2>
                      <Badge tone={statusTone[status]}>{BATCH_STATUS_LABEL[status]}</Badge>
                      {status === "berjalan" && (
                        <span className="text-xs font-bold text-[#176b57]">
                          sisa {Math.max(sisaHari(batch, today), 0)} hari
                        </span>
                      )}
                    </div>
                    <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#71807a]">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays size={14} /> {formatPeriode(batch)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Truck size={14} /> Kirim: {batch.deliveryDate ? formatPeriode({ startDate: batch.deliveryDate, endDate: batch.deliveryDate }) : "belum diatur"}
                      </span>
                    </p>
                    {batch.note && <p className="mt-2 text-sm text-[#4b5c56]">{batch.note}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <IconButton title="Ubah batch" onClick={() => openEdit(batch)} tone="primary">
                      <Pencil size={15} />
                    </IconButton>
                    <IconButton title="Hapus batch" onClick={() => setConfirmDelete(batch)} tone="danger">
                      <Trash2 size={15} />
                    </IconButton>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  {[
                    { label: "Order", value: String(batch.stats.orders) },
                    { label: "Terverifikasi", value: String(batch.stats.verifiedOrders) },
                    { label: "Porsi", value: String(batch.stats.itemsSold) },
                    { label: "Omzet", value: rupiah(batch.stats.gross) },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-2xl bg-[#f7faf7] p-3.5">
                      <p className="text-xs font-bold uppercase tracking-[.12em] text-[#8b9a94]">{stat.label}</p>
                      <strong className="mt-1 block text-lg font-black tabular-nums">{stat.value}</strong>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <Button variant="outline" onClick={() => void toggleActive(batch)} pending={busyId === batch.id}>
                    {batch.isActive ? "Nonaktifkan batch" : "Aktifkan batch"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        wide
        title={editing ? `Ubah batch: ${editing.name}` : "Batch baru"}
        description="Order otomatis dikelompokkan ke batch ini berdasarkan tanggal masuknya (WIB)."
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={() => void save()} pending={saving}>
              {editing ? "Simpan perubahan" : "Buat batch"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Nama batch" hint="Mis. Batch 1, Batch Ramadan, Batch UAS">
            <TextInput
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Batch 1"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Mulai">
              <TextInput
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
              />
            </Field>
            <Field label="Selesai" hint="Termasuk hari ini">
              <TextInput
                type="date"
                value={form.endDate}
                onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
              />
            </Field>
            <Field label="Tanggal pengantaran" hint="Opsional">
              <TextInput
                type="date"
                value={form.deliveryDate}
                onChange={(event) => setForm((current) => ({ ...current, deliveryDate: event.target.value }))}
              />
            </Field>
          </div>
          <Field label="Catatan" hint="Opsional, tampil di dashboard">
            <Textarea
              value={form.note}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
              placeholder="Mis. Pre-order dibuka sampai tanggal 28, pengantaran serentak."
            />
          </Field>
          <div className="grid gap-3 rounded-2xl bg-[#f7faf7] p-4">
            <Checkbox
              checked={form.isActive}
              onChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
              label="Batch aktif (order baru dicocokkan ke batch ini)"
            />
            <Checkbox
              checked={form.allowOverlap}
              onChange={(checked) => setForm((current) => ({ ...current, allowOverlap: checked }))}
              label="Izinkan tumpang tindih dengan batch aktif lain"
            />
            <p className="text-xs text-[#71807a]">
              Bila dua batch aktif memiliki periode yang bertabrakan, order akan masuk ke batch dengan tanggal mulai
              paling akhir. Sistem menolak penumpukan ini kecuali kamu mencentang opsi di atas.
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title={`Hapus batch "${confirmDelete?.name ?? ""}"?`}
        description="Order yang pernah masuk ke batch ini tidak dihapus — hanya kehilangan penanda batch."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Batal
            </Button>
            <Button variant="danger" onClick={() => confirmDelete && void remove(confirmDelete)}>
              Ya, hapus batch
            </Button>
          </>
        }
      >
        <p className="text-sm text-[#4b5c56]">
          {confirmDelete?.stats.orders
            ? `${confirmDelete.stats.orders} order akan menjadi “tanpa batch” dan bisa dicocokkan ulang lewat tombol “Terapkan ke order tanpa batch”.`
            : "Batch ini belum memiliki order."}
        </p>
      </Modal>
    </div>
  );
}

