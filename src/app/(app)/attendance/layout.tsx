import { RouteTabs } from "@/components/route-tabs";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export default async function AttendanceLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  const mgr = u.role !== "employee";
  const hr = u.role === "admin" || u.role === "hr";
  return (
    <>
      <PageHeader title="Time Attendance" subtitle="ระบบลงเวลาเข้าออกของพนักงาน" />
      {mgr && (
        <RouteTabs
          items={[
            { href: "/attendance/board", label: "สรุปรายวัน" },
            ...(hr ? [{ href: "/attendance/logs", label: "บันทึกการสแกน" }] : []),
            { href: "/attendance/me", label: "รายเดือน (รายบุคคล)" },
          ]}
        />
      )}
      {children}
    </>
  );
}
