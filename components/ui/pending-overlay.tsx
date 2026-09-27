import { cn } from "@/lib/utils";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

/**
 * Blok "sedang diproses" untuk menutup form selama menunggu backend.
 *
 * Dipakai supaya tidak ada adegan menunggu tanpa umpan balik: begitu tombol
 * ditekan dan request masih berjalan, area yang sedang diproses berubah jadi
 * skeleton, dan seluruh kontrol di dalamnya tidak bisa ditekan lagi.
 */
export function PendingOverlay({
  label = "Memproses…",
  detail,
  className,
}: {
  label?: string;
  detail?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-20 grid place-items-center rounded-[inherit] bg-white/80 p-6 backdrop-blur-[2px]",
        className,
      )}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="w-full max-w-xs text-center">
        <Spinner className="mx-auto text-[#176b57]" />
        <p className="mt-3 text-sm font-extrabold text-[#173d36]">{label}</p>
        {detail && <p className="mt-1 text-xs text-[#71807a]">{detail}</p>}
        <div className="mt-4 grid gap-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton blok untuk mengisi area konten yang belum siap. */
export function PendingBlock({
  label = "Memuat…",
  lines = 3,
  className,
}: {
  label?: string;
  lines?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("grid gap-3 rounded-2xl bg-[#f7f8f3] p-5", className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">{label}</span>
      <Skeleton className="h-4 w-1/3" />
      <SkeletonText lines={lines} />
    </div>
  );
}

/** Spinner kecil untuk label tombol yang sedang bekerja. */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={cn("h-4 w-4 animate-spin", className)}
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

