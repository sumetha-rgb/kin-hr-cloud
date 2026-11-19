import { eq } from "drizzle-orm";
import { db } from "@/db";
import { employeePhotos } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

/** รูปโปรไฟล์พนักงาน — เฉพาะผู้ที่เข้าสู่ระบบแล้ว (URL มี ?v= เปลี่ยนทุกครั้งที่อัปเดตรูป จึง cache ได้นาน) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return new Response("Unauthorized", { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return new Response("Not found", { status: 404 });
  const [p] = await db.select().from(employeePhotos).where(eq(employeePhotos.employeeId, id));
  if (!p) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(p.data, "base64"), {
    headers: { "content-type": p.mime, "cache-control": "private, max-age=31536000, immutable" },
  });
}
