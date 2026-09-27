"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

/**
 * Halaman login lama. Dulu tidak mengimpor `useRouter` sehingga error saat
 * dibuka, dan hanya berupa GET ke /dashboard tanpa cek password.
 * Sekarang diarahkan ke halaman login resmi `/admin-login` yang sudah
 * memverifikasi kredensial lewat `/api/admin/login`.
 */
export default function LegacyDashboardLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin-login");
  }, [router]);

  return (
    <main
      className="grid min-h-screen place-items-center bg-[#f5f6f1] px-4 text-[#173d36]"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Mengalihkan ke halaman login…</span>
      <div className="w-full max-w-md rounded-[2rem] bg-white p-7 shadow-xl sm:p-9">
        <div className="flex items-center gap-3">
          <Skeleton rounded="2xl" className="h-12 w-12" />
          <div className="grid gap-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-6 w-40" />
          </div>
        </div>
        <div className="mt-7 grid gap-4">
          <SkeletonText lines={2} />
          <Skeleton rounded="xl" className="h-12 w-full" />
          <Skeleton rounded="xl" className="h-12 w-full" />
          <Skeleton rounded="xl" className="h-12 w-full" />
        </div>
      </div>
    </main>
  );
}

