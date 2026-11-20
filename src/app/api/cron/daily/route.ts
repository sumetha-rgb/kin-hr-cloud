import { runDailyJobs } from "@/lib/daily-jobs";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron เรียกทุกวัน 08:00 น. (ดู vercel.json)
 * ถ้าตั้ง CRON_SECRET ใน Vercel ไว้ ต้องส่ง Authorization: Bearer <CRON_SECRET> (Vercel ส่งให้อัตโนมัติ)
 * ไม่ได้ตั้ง → เรียกได้ แต่รันได้แค่วันละครั้งอยู่แล้ว
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authorized = !secret || req.headers.get("authorization") === `Bearer ${secret}`;
  if (!authorized) return new Response("unauthorized", { status: 401 });
  const force = !!secret && new URL(req.url).searchParams.get("force") === "1";
  const result = await runDailyJobs({ force });
  return Response.json(result);
}
