export const rupiah = (value: number) =>
  `Rp${Number(value || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;

export const orderCode = () =>
  `LK-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
