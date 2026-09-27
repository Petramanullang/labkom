"use client";

/** Unduh data tabel sebagai CSV (Excel-friendly: dipisah titik koma). */

function escapeCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  const lines = [header, ...rows].map((row) => row.map(escapeCell).join(";"));
  // BOM agar Excel membaca huruf beraksen dengan benar.
  const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

