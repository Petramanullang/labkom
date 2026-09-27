"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/pending-overlay";
import { useAsyncAction } from "@/lib/use-async-action";

type AsyncButtonProps = {
  /** Aksi yang memanggil backend. Dijalankan sekali saja per klik. */
  onAction: () => Promise<unknown> | unknown;
  children: ReactNode;
  /** Label yang tampil selama proses berjalan. */
  pendingLabel?: string;
  pendingClassName?: string;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  /** Ditampilkan di atas tombol saat proses berjalan (opsional). */
  onPendingChange?: (pending: boolean) => void;
  spinner?: boolean;
  "aria-label"?: string;
};

/**
 * Tombol yang mengunci dirinya sendiri saat memanggil backend.
 *
 * - Klik kedua diabaikan (kunci berbasis ref, tahan double click/double tap).
 * - Selama proses: `disabled`, `aria-busy`, label berubah + spinner.
 * Ini pengaman anti-transaksi-dobel di sisi UI; backend tetap punya
 * pengaman idempotensi sendiri.
 */
export function AsyncButton({
  onAction,
  children,
  pendingLabel = "Memproses…",
  className,
  pendingClassName,
  disabled,
  type = "button",
  onPendingChange,
  spinner = true,
  ...rest
}: AsyncButtonProps) {
  const { run, pending } = useAsyncAction(onAction, {
    onError: (error) => console.error("AsyncButton error:", error),
  });

  const handleClick = () => {
    if (pending) return;
    onPendingChange?.(true);
    void (async () => {
      try {
        await run();
      } finally {
        onPendingChange?.(false);
      }
    })();
  };

  return (
    <button
      {...rest}
      type={type}
      onClick={handleClick}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      data-pending={pending || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 transition disabled:cursor-not-allowed disabled:opacity-60",
        className,
        pending && pendingClassName,
      )}
    >
      {pending && spinner && <Spinner />}
      {pending ? pendingLabel : children}
    </button>
  );
}

