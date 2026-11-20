import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { Icon, type IconName } from "@/components/icons";
import { PushToggle } from "@/components/push-toggle";
import { SubmitButton } from "@/components/submit-button";
import { Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/time";
import { cn } from "@/lib/util";
import { markAllRead } from "./actions";

export const metadata = { title: "การแจ้งเตือน" };

const KIND: Record<string, { icon: IconName; tone: string }> = {
  payslip: { icon: "money", tone: "bg-emerald-50 text-emerald-600" },
  request_new: { icon: "check", tone: "bg-sky-50 text-sky-600" },
  request_decided: { icon: "checkCircle", tone: "bg-brand-100 text-brand-700" },
  warning: { icon: "alert", tone: "bg-rose-50 text-rose-600" },
  system: { icon: "megaphone", tone: "bg-amber-50 text-amber-700" },
};

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const [rows, unread] = await Promise.all([
    db.select().from(notifications).where(eq(notifications.userId, u.id)).orderBy(desc(notifications.createdAt)).limit(100),
    db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.userId, u.id), isNull(notifications.readAt))),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="การแจ้งเตือน"
        subtitle={unread.length ? `ยังไม่ได้อ่าน ${unread.length} รายการ` : "อ่านครบทุกรายการแล้ว"}
        actions={
          unread.length > 0 && (
            <form action={markAllRead}>
              <SubmitButton variant="secondary">อ่านทั้งหมดแล้ว</SubmitButton>
            </form>
          )
        }
      />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="mb-5">
        <PushToggle />
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-brand-200 bg-white p-10 text-center text-stone-500">
          <span className="flex size-11 items-center justify-center rounded-full bg-brand-50 text-brand-500">
            <Icon name="bell" className="size-5" />
          </span>
          ยังไม่มีการแจ้งเตือน
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl border border-brand-200/80 bg-white shadow-card">
          {rows.map((n) => {
            const k = KIND[n.kind] ?? KIND.system;
            return (
              <li key={n.id} className="border-b border-brand-100 last:border-0">
                {/* <a> ธรรมดา (โหลดหน้าใหม่) ให้ตัวเลขบนกระดิ่งในเมนูอัปเดตทันทีหลังอ่าน */}
                <a href={`/notifications/${n.id}`} className={cn("flex gap-3 px-4 py-3.5 transition hover:bg-brand-50/60", !n.readAt && "bg-brand-50/40")}>
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl", k.tone)}>
                    <Icon name={k.icon} className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-[15px] leading-snug text-brand-900", !n.readAt && "font-semibold")}>{n.title}</span>
                    {n.body && <span className="mt-0.5 block text-sm text-stone-600">{n.body}</span>}
                    <span className="mt-1 block text-xs text-stone-400">{fmtDateTime(n.createdAt)}</span>
                  </span>
                  {!n.readAt && <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-rose-500" aria-label="ยังไม่ได้อ่าน" />}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
