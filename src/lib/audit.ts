import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export async function audit(userId: number | null, action: string, entity: string, entityId?: string | number, detail?: unknown) {
  await db.insert(auditLogs).values({
    userId,
    action,
    entity,
    entityId: entityId === undefined ? null : String(entityId),
    detail: detail === undefined ? null : (detail as object),
  });
}
