"use client";

/** Pemanggil API dashboard yang seragam untuk semua halaman admin. */

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function parse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new ApiError(payload?.error || "Permintaan gagal diproses.", response.status);
  }
  return payload.data as T;
}

export async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  return parse<T>(response);
}

export async function apiJson<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE" | "PUT",
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parse<T>(response);
}

export async function apiForm<T>(url: string, form: FormData, method: "POST" | "PATCH" = "POST"): Promise<T> {
  const response = await fetch(url, { method, body: form });
  return parse<T>(response);
}

export function errorMessage(error: unknown, fallback = "Terjadi kesalahan."): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

