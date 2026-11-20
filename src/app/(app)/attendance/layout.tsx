import { RouteTabs } from "@/components/route-tabs";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export default async function AttendanceLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  const mgr = u.role !== "employee";
  const hr = u.role === "admin" || u.role === "hr";
  return (
    <>
      <PageHeader title="เวลาทำงาน" subtitle="ดูการเข้า-ออกงาน มาสาย ขาด ลา ของพนักงาน" />
      {mgr && (
        <RouteTabs
          items={[
            { href: "/attendance/board", label: "สรุปการมาทำงาน" },
            ...(hr ? [{ href: "/attendance/logs", label: "รายการสแกนเข้า-ออก" }] : []),
            { href: "/attendance/me", label: "ปฏิทินรายเดือนรายคน" },
          ]}
        />
      )}
      {children}
    </>
  );
}
