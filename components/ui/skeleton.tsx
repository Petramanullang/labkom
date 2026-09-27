import { cn } from "@/lib/utils";

type Rounded = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full";

const radius: Record<Rounded, string> = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  "3xl": "rounded-3xl",
  full: "rounded-full",
};

/**
 * Blok skeleton dasar. Warnanya mengikuti palet LabKom (hijau sage + krem),
 * jadi tidak muncul sebagai kotak abu-abu asing di tengah desain.
 */
export function Skeleton({
  className,
  rounded = "md",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { rounded?: Rounded }) {
  return (
    <div
      aria-hidden="true"
      data-slot="skeleton"
      className={cn("labkom-skeleton", radius[rounded], className)}
      {...props}
    />
  );
}

/** Beberapa baris teks skeleton dengan lebar yang mengecil di baris terakhir. */
export function SkeletonText({
  lines = 3,
  className,
  lineClassName,
}: {
  lines?: number;
  className?: string;
  lineClassName?: string;
}) {
  return (
    <div className={cn("grid gap-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn(
            "h-3.5",
            index === lines - 1 ? "w-2/3" : "w-full",
            lineClassName,
          )}
        />
      ))}
    </div>
  );
}

/** Skeleton untuk satu kartu produk di katalog. */
export function SkeletonProductCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-[#e7e6de] bg-white shadow-sm",
        className,
      )}
      aria-hidden="true"
    >
      <Skeleton rounded="sm" className="aspect-[1.12] w-full rounded-none" />
      <div className="grid gap-2.5 p-3.5">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
        <div className="mt-2 flex items-center justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton rounded="xl" className="h-10 w-10" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton grid katalog — dipakai sebelum data keranjang selesai dibaca. */
export function SkeletonProductGrid({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4",
        className,
      )}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Memuat daftar menu…</span>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonProductCard key={index} />
      ))}
    </div>
  );
}

/** Skeleton kartu order di dashboard admin. */
export function SkeletonOrderCard({ className }: { className?: string }) {
  return (
    <section
      className={cn("rounded-3xl bg-white p-5 shadow-sm", className)}
      aria-hidden="true"
    >
      <div className="flex justify-between gap-4">
        <div className="grid flex-1 gap-2.5">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-1 h-5 w-32" />
        </div>
        <Skeleton rounded="full" className="h-6 w-20" />
      </div>
      <div className="mt-5 grid gap-2.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="mt-1.5 h-3 w-20" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="mt-5 flex gap-3">
        <Skeleton rounded="xl" className="h-9 w-28" />
        <Skeleton rounded="xl" className="h-9 w-24" />
        <Skeleton rounded="xl" className="h-9 w-24" />
      </div>
    </section>
  );
}

/** Beberapa kartu order skeleton sekaligus. */
export function SkeletonOrderList({ count = 3 }: { count?: number }) {
  return (
    <div
      className="grid gap-5"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Memuat daftar order…</span>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonOrderCard key={index} />
      ))}
    </div>
  );
}

/** Skeleton kartu statistik (laporan keuangan). */
export function SkeletonStatCard({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-3xl bg-white p-5 shadow-sm", className)}
      aria-hidden="true"
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-6 w-32" />
    </div>
  );
}

/** Skeleton baris item (keranjang / ringkasan checkout). */
export function SkeletonCartRow() {
  return (
    <div className="flex items-center gap-4" aria-hidden="true">
      <Skeleton rounded="xl" className="h-16 w-16 shrink-0" />
      <div className="grid flex-1 gap-2">
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

