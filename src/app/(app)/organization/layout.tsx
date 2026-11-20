import { PageHeader } from "@/components/ui";
import { RouteTabs } from "@/components/route-tabs";
import { requireRole } from "@/lib/auth";

export default async function OrgLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin", "hr");
  return (
    <>
      <PageHeader title="ตั้งค่าองค์กร" subtitle="สาขา แผนก ตำแหน่ง กะการทำงาน วันหยุด ประเภทการลา และใบเตือน" />
      <RouteTabs
        items={[
          { href: "/organization/branches", label: "สาขาและจุดลงเวลา" },
          { href: "/organization/departments", label: "แผนกและตำแหน่ง" },
          { href: "/organization/shifts", label: "กะการทำงาน" },
          { href: "/organization/holidays", label: "วันหยุด" },
          { href: "/organization/leave-types", label: "ประเภทการลา" },
          { href: "/organization/warnings", label: "ใบเตือน" },
          { href: "/organization/settings", label: "ข้อมูลบริษัท / ประกันสังคม" },
        ]}
      />
      {children}
    </>
  );
}
