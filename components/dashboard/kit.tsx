"use client";

import {
  useEffect,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { X } from "lucide-react";
import { Spinner } from "@/components/ui/pending-overlay";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
 * Komponen dasar dashboard LabKom.
 * Dipakai bersama oleh halaman Ringkasan, Order, Menu, Batch, dan Laporan
 * supaya bahasa visualnya konsisten.
 * ------------------------------------------------------------------------- */

export const PALETTE = {
  ink: "#173d36",
  primary: "#176b57",
  mint: "#d9efe1",
  sand: "#f5f6f1",
  accent: "#b84f43",
  muted: "#71807a",
  line: "#e3e8e1",
} as const;

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-3xl bg-white p-5 shadow-sm sm:p-6", className)}>{children}</section>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#b84f43]">{eyebrow}</p>
        )}
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-[#66766e]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

type StatTone = "default" | "primary" | "warn" | "danger" | "muted";

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: StatTone;
}) {
  const styles: Record<StatTone, string> = {
    default: "bg-white shadow-sm",
    primary: "bg-[#176b57] text-white shadow-sm",
    warn: "bg-[#fff4e2] text-[#8a5a12]",
    danger: "bg-[#fdeceb] text-[#8f3f36]",
    muted: "bg-[#eef1ec] text-[#3f524b]",
  };
  const labelStyle = tone === "primary" ? "text-white/75" : "text-[#71807a]";
  return (
    <div className={cn("rounded-3xl p-5", styles[tone])}>
      <div className="flex items-center justify-between gap-3">
        <p className={cn("text-xs font-bold uppercase tracking-[.12em]", labelStyle)}>{label}</p>
        {icon}
      </div>
      <strong className="mt-3 block text-2xl font-black tabular-nums sm:text-[26px]">{value}</strong>
      {hint && <p className={cn("mt-1 text-xs", tone === "primary" ? "text-white/70" : "text-[#71807a]")}>{hint}</p>}
    </div>
  );
}

type BadgeTone = "neutral" | "success" | "warn" | "danger" | "info";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  const styles: Record<BadgeTone, string> = {
    neutral: "bg-[#eef1ec] text-[#4b5c56]",
    success: "bg-[#e2f3e5] text-[#176b57]",
    warn: "bg-[#fff1d9] text-[#a66b1e]",
    danger: "bg-[#fde8e5] text-[#a9493e]",
    info: "bg-[#e6eefb] text-[#33538c]",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold", styles[tone])}>
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  pending = false,
  disabled = false,
  className,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "outline" | "danger" | "ghost";
  pending?: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const styles = {
    primary: "bg-[#176b57] text-white hover:bg-[#135c4a]",
    outline: "border border-[#d9ded7] bg-white text-[#173d36] hover:border-[#176b57]",
    danger: "bg-[#b84f43] text-white hover:bg-[#a34439]",
    ghost: "text-[#176b57] hover:bg-[#eaf4ee]",
  } as const;
  return (
    <button
      type={type}
      onClick={onClick}
      title={title}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      data-pending={pending || undefined}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60",
        styles[variant],
        className,
      )}
    >
      {pending && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function IconButton({
  children,
  onClick,
  title,
  disabled,
  tone = "default",
}: {
  children: ReactNode;
  onClick?: () => void;
  title: string;
  disabled?: boolean;
  tone?: "default" | "danger" | "primary";
}) {
  const styles = {
    default: "border border-[#e1e6df] bg-white text-[#4b5c56] hover:border-[#176b57] hover:text-[#176b57]",
    danger: "border border-[#f0d6d2] bg-white text-[#b84f43] hover:bg-[#fdeceb]",
    primary: "border border-[#cfe6da] bg-[#eaf4ee] text-[#176b57] hover:bg-[#d9efe1]",
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={cn("grid h-9 w-9 place-items-center rounded-xl transition disabled:opacity-50", styles[tone])}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center rounded-3xl border border-dashed border-[#dbe2da] bg-[#fbfcf9] px-6 py-12 text-center">
      {icon && <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[#eef1ec] text-[#176b57]">{icon}</span>}
      <p className="font-black text-[#173d36]">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-[#71807a]">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({
  tone = "info",
  children,
  onClose,
}: {
  tone?: "info" | "success" | "danger" | "warn";
  children: ReactNode;
  onClose?: () => void;
}) {
  const styles = {
    info: "bg-[#eef4fb] text-[#33538c]",
    success: "bg-[#e6f4ea] text-[#176b57]",
    danger: "bg-[#fde8e5] text-[#a9493e]",
    warn: "bg-[#fff1d9] text-[#8a5a12]",
  } as const;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex items-start justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-semibold", styles[tone])}
    >
      <span>{children}</span>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Tutup pemberitahuan" className="shrink-0 opacity-70 hover:opacity-100">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-1.5 text-sm font-bold text-[#173d36]", className)}>
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-[#71807a]">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "h-11 w-full rounded-xl border border-[#d9ded7] bg-white px-3 text-sm font-normal text-[#173d36] outline-none transition focus:border-[#176b57] focus:ring-2 focus:ring-[#d9efe1]";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#0f2b25]/45 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative mx-auto my-6 w-full rounded-3xl bg-white p-5 shadow-2xl sm:p-7",
          wide ? "max-w-3xl" : "max-w-xl",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black">{title}</h2>
            {description && <p className="mt-1 text-sm text-[#71807a]">{description}</p>}
          </div>
          <IconButton title="Tutup" onClick={onClose}>
            <X size={17} />
          </IconButton>
        </div>
        <div className="mt-5">{children}</div>
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-[#eef1ec] pt-5">{footer}</div>}
      </div>
    </div>
  );
}

export function ProgressBar({ value, max, tone = "primary" }: { value: number; max: number; tone?: "primary" | "accent" }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#eef1ec]">
      <div
        className={cn("h-full rounded-full transition-all", tone === "primary" ? "bg-[#176b57]" : "bg-[#b84f43]")}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-11 rounded-xl border border-[#d9ded7] bg-white px-3 text-sm font-normal text-[#173d36] outline-none transition focus:border-[#176b57] disabled:bg-[#f4f6f2] disabled:text-[#9aa8a2]",
        className,
      )}
    >
      {children}
    </select>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-[88px] w-full rounded-xl border border-[#d9ded7] bg-white px-3 py-2 text-sm font-normal text-[#173d36] outline-none transition focus:border-[#176b57]",
        className,
      )}
    />
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm font-bold text-[#173d36]">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[#176b57]"
      />
      {label}
    </label>
  );
}

export function InlineLoader({ label = "Memuat data…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-3xl bg-white p-6 text-sm font-bold text-[#71807a] shadow-sm">
      <Spinner className="h-4 w-4 text-[#176b57]" />
      {label}
    </div>
  );
}



