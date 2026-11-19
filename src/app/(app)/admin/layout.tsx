import { RouteTabs } from "@/components/route-tabs";
import { PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin", "hr");
  return (
    <>
      <PageHeader title="ดูแลระบบ" subtitle="ตรวจความพร้อม จัดการบัญชีผู้ใช้ ดูประวัติการใช้งาน และตั้งค่าระบบ" />
      <RouteTabs
        items={[
          { href: "/admin/overview", label: "ภาพรวม & สิ่งที่ต้องทำ" },
          { href: "/admin/users", label: "บัญชีผู้ใช้" },
          { href: "/admin/audit", label: "ประวัติการใช้งาน" },
          { href: "/admin/settings", label: "ตั้งค่าระบบ" },
        ]}
      />
      {children}
    </>
  );
}
