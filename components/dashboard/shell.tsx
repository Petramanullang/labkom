"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  Layers,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu as MenuIcon,
  Store,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { Spinner } from "@/components/ui/pending-overlay";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Ringkasan", hint: "Kondisi hari ini", icon: LayoutDashboard },
  { href: "/dashboard/orders", label: "Order masuk", hint: "Verifikasi pembayaran", icon: ClipboardList },
  { href: "/dashboard/menu", label: "Menu", hint: "Tambah · ubah · hapus", icon: UtensilsCrossed },
  { href: "/dashboard/batches", label: "Batch", hint: "Atur periode pre-order", icon: Layers },
  { href: "/dashboard/financial-reports", label: "Laporan", hint: "Harian & per batch", icon: BarChart3 },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardShell({ email, children }: { email: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Tutup drawer setiap kali pindah halaman.
  useEffect(() => setOpen(false), [pathname]);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      router.push("/admin-login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const current = NAV.find((item) => isActive(pathname, item.href));

  const nav = (
    <nav className="grid gap-1.5">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-start gap-3 rounded-2xl px-3 py-2.5 transition",
              active ? "bg-[#176b57] text-white shadow-sm" : "text-[#3f524b] hover:bg-[#eef4ef]",
            )}
          >
            <span
              className={cn(
                "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl",
                active ? "bg-white/15 text-white" : "bg-[#eef1ec] text-[#176b57] group-hover:bg-white",
              )}
            >
              <Icon size={17} />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-bold">{item.label}</span>
              <span className={cn("text-[11px]", active ? "text-white/70" : "text-[#8b9a94]")}>{item.hint}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );

  const sidebarInner = (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href="/dashboard" className="flex items-center gap-3 px-1 py-1">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#d9efe1] text-[#087253]">
          <Leaf size={22} fill="currentColor" />
        </span>
        <span className="leading-none">
          <strong className="block text-lg font-black tracking-tight text-[#123f37]">LabKom</strong>
          <small className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#357467]">Panel admin</small>
        </span>
      </Link>

      {nav}

      <div className="mt-auto grid gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-2xl border border-[#e1e6df] px-3 py-2.5 text-sm font-bold text-[#3f524b] transition hover:border-[#176b57] hover:text-[#176b57]"
        >
          <Store size={16} /> Lihat halaman toko
        </Link>
        <div className="rounded-2xl bg-[#f5f6f1] p-3">
          <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#8b9a94]">Masuk sebagai</p>
          <p className="mt-1 truncate text-sm font-bold" title={email}>
            {email}
          </p>
          <button
            type="button"
            onClick={() => void logout()}
            disabled={loggingOut}
            className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-bold text-[#b84f43] shadow-sm transition hover:bg-[#fdeceb] disabled:opacity-60"
          >
            {loggingOut ? <Spinner className="h-4 w-4" /> : <LogOut size={15} />}
            {loggingOut ? "Keluar…" : "Keluar"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f6f1] text-[#173d36] lg:flex">
      {/* Sidebar tetap untuk layar besar */}
      <aside className="sticky top-0 hidden h-screen w-[272px] shrink-0 border-r border-[#e7ebe4] bg-white lg:block">
        {sidebarInner}
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[#e7ebe4] bg-white/95 px-4 backdrop-blur lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Buka navigasi"
              className="grid h-10 w-10 place-items-center rounded-xl border border-[#e1e6df] text-[#173d36] lg:hidden"
            >
              <MenuIcon size={18} />
            </button>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-bold uppercase tracking-[.16em] text-[#b84f43]">
                Dashboard admin
              </p>
              <p className="truncate text-sm font-black">{current?.label ?? "LabKom"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden max-w-[180px] truncate rounded-full bg-[#eef1ec] px-3 py-1.5 text-xs font-bold text-[#4b5c56] sm:block">
              {email}
            </span>
            <button
              type="button"
              onClick={() => void logout()}
              disabled={loggingOut}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#e1e6df] px-3 text-sm font-bold text-[#3f524b] transition hover:border-[#b84f43] hover:text-[#b84f43] disabled:opacity-60"
            >
              {loggingOut ? <Spinner className="h-4 w-4" /> : <LogOut size={15} />}
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>

      {/* Drawer navigasi untuk layar kecil */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Tutup navigasi"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[#0f2b25]/45 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#eef1ec] px-4 py-3">
              <span className="text-sm font-black">Navigasi</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup navigasi"
                className="grid h-9 w-9 place-items-center rounded-xl border border-[#e1e6df]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="h-[calc(100%-57px)] overflow-y-auto">{sidebarInner}</div>
          </div>
        </div>
      )}
    </div>
  );
}

