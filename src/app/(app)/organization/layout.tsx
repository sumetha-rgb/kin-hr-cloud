import { PageHeader } from "@/components/ui";
import { RouteTabs } from "@/components/route-tabs";
import { requireRole } from "@/lib/auth";

export default async function OrgLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin", "hr");
  return (
    <>
      <PageHeader title="Organization" subtitle="ระบบจัดการองค์กร" />
      <RouteTabs
        items={[
          { href: "/organization/branches", label: "สาขา / จุดลงเวลา" },
          { href: "/organization/departments", label: "แผนก & ตำแหน่ง" },
          { href: "/organization/shifts", label: "กะการทำงาน" },
          { href: "/organization/holidays", label: "วันหยุด" },
          { href: "/organization/leave-types", label: "ประเภทการลา" },
          { href: "/organization/settings", label: "ตั้งค่าบริษัท" },
        ]}
      />
      {children}
    </>
  );
}
