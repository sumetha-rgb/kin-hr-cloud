import { and, count, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export const LOCK_MAX = 5; // ใส่รหัสผิดได้กี่ครั้ง
export const LOCK_MIN = 15; // ภายในกี่นาที (และล็อกนานเท่านี้)

/** ชื่อผู้ใช้ที่ถูกล็อกอยู่ตอนนี้: ผิด ≥ LOCK_MAX ครั้งใน LOCK_MIN นาที นับเฉพาะหลังการปลดล็อกครั้งล่าสุด */
export async function lockedUsernames(): Promise<Set<string>> {
  const rows = await db
    .select({ username: auditLogs.entityId })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.action, "login_failed"),
        gte(auditLogs.createdAt, new Date(Date.now() - LOCK_MIN * 60_000)),
        sql`${auditLogs.createdAt} > coalesce((select max(u2.created_at) from audit_logs u2 where u2.action = 'unlock' and u2.entity_id = ${auditLogs.entityId}), 'epoch'::timestamptz)`,
      ),
    )
    .groupBy(auditLogs.entityId)
    .having(sql`count(*) >= ${LOCK_MAX}`);
  return new Set(rows.map((r) => r.username).filter((u): u is string => !!u));
}

/** จำนวนครั้งที่ผิดของชื่อผู้ใช้นี้ในช่วงล็อก (หลังการปลดล็อกล่าสุด) */
export async function failedAttempts(username: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.action, "login_failed"),
        eq(auditLogs.entityId, username),
        gte(auditLogs.createdAt, new Date(Date.now() - LOCK_MIN * 60_000)),
        sql`${auditLogs.createdAt} > coalesce((select max(u2.created_at) from audit_logs u2 where u2.action = 'unlock' and u2.entity_id = ${username}), 'epoch'::timestamptz)`,
      ),
    );
  return n;
}
