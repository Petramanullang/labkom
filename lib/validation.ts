import { z } from "zod";

/** Skema validasi menu. */
export const menuSchema = z.object({
  name: z.string().trim().min(2).max(120),
  short: z.string().trim().max(240).optional().default(""),
  price: z.coerce.number().min(0).max(10_000_000),
  costPrice: z.coerce.number().min(0).max(10_000_000).default(0),
  category: z.string().trim().min(1).max(60).default("Makanan Utama"),
  tag: z.string().trim().max(40).nullable().optional(),
  imagePath: z.string().trim().max(300).nullable().optional(),
  imageUrl: z.string().trim().max(1000).nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export type MenuInput = z.infer<typeof menuSchema>;

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid.")
  .nullable()
  .optional();

/** Skema batch sesuai tabel sales_batches. */
const batchBaseSchema = z.object({
  name: z.string().trim().min(2).max(80),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal mulai tidak valid."),
  endDate: optionalDate,
  deliveryDate: optionalDate,
  description: z.string().trim().max(240).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().default(true),
  allowOverlap: z.boolean().optional().default(false),
});

export const batchSchema = batchBaseSchema.refine(
  (value) => !value.endDate || value.endDate >= value.startDate,
  {
    message: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.",
    path: ["endDate"],
  },
);

export const batchPatchSchema = batchBaseSchema.partial().refine(
  (value) =>
    !value.startDate || !value.endDate || value.endDate >= value.startDate,
  {
    message: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.",
    path: ["endDate"],
  },
);

export type BatchInput = z.infer<typeof batchSchema>;
