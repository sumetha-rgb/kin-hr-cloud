import { z } from "zod";

/** แปลง FormData เป็น object (ค่าว่าง = undefined) แล้ว validate ด้วย zod */
export function parseForm<T extends z.ZodType>(schema: T, fd: FormData): { ok: true; data: z.infer<T> } | { ok: false; error: string } {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("$ACTION")) continue;
    raw[k] = typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v;
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    const i = r.error.issues[0];
    return { ok: false, error: `${i.path.join(".") || "ข้อมูล"}: ${i.message}` };
  }
  return { ok: true, data: r.data };
}

export const zBool = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
export const zOptInt = z.coerce.number().int().optional();
export const zMoney = z.coerce.number().min(0).default(0).transform((n) => n.toFixed(2));
export const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง");
export const zTime = z.string().regex(/^\d{2}:\d{2}$/, "รูปแบบเวลาไม่ถูกต้อง (HH:MM)");
