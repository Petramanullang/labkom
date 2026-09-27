import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/shell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard admin · LabKom",
};

/**
 * Mengambil email admin yang sedang masuk.
 *
 * `requireAdmin()` dibungkus try/catch agar kesalahan konfigurasi Supabase
 * berujung pada pengalihan ke halaman login. Penting: `redirect()` TIDAK boleh
 * dipanggil di dalam blok try — ia melempar sinyal NEXT_REDIRECT yang akan
 * tertangkap catch dan membuat admin yang sah ikut terlempar keluar.
 */
async function currentAdminEmail(): Promise<string | null> {
  try {
    const { user } = await requireAdmin();
    if (!user) return null;
    return user.email ?? "admin";
  } catch {
    return null;
  }
}

/** Penjaga seluruh halaman dashboard: hanya admin yang boleh masuk. */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const email = await currentAdminEmail();
  if (!email) redirect("/admin-login");

  return <DashboardShell email={email}>{children}</DashboardShell>;
}

