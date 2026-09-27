"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Mengunci aksi yang memanggil backend supaya:
 * 1. Tombol tidak bisa memicu proses dua kali (double click / double tap).
 * 2. UI selalu tahu kapan proses sedang berjalan, sehingga skeleton bisa tampil.
 *
 * Kunci memakai `useRef` (bukan state) supaya klik kedua yang datang di tick
 * yang sama tetap ditolak — state React baru ter-update setelah render berikutnya,
 * jadi guard berbasis state masih kebobolan pada klik ganda cepat.
 */
export function useAsyncAction<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result> | Result,
  options?: {
    /** Dipanggil saat aksi gagal. Default: pesan error disimpan ke `error`. */
    onError?: (error: unknown) => void;
  },
) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const lockRef = useRef(false);
  const mountedRef = useRef(true);
  const actionRef = useRef(action);
  actionRef.current = action;
  const onErrorRef = useRef(options?.onError);
  onErrorRef.current = options?.onError;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(async (...args: Args): Promise<Result | undefined> => {
    // Guard sinkron — ini yang mencegah transaksi dobel.
    if (lockRef.current) return undefined;
    lockRef.current = true;
    setPending(true);
    setError("");
    try {
      return await actionRef.current(...args);
    } catch (err) {
      if (onErrorRef.current) onErrorRef.current(err);
      else setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
      return undefined;
    } finally {
      lockRef.current = false;
      if (mountedRef.current) setPending(false);
    }
  }, []);

  return { run, pending, error, setError, isLocked: () => lockRef.current };
}

/**
 * Kunci global berbasis `ref` untuk aksi di luar React (mis. handler di dalam
 * komponen anak yang di-remount). Dipakai halaman order admin.
 */
export function useActionLock() {
  const lockRef = useRef(false);
  const acquire = useCallback(() => {
    if (lockRef.current) return false;
    lockRef.current = true;
    return true;
  }, []);
  const release = useCallback(() => {
    lockRef.current = false;
  }, []);
  return { acquire, release };
}

