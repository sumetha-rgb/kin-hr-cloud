import { RouteTabs } from "@/components/route-tabs";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export default async function RequestsLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  const approver = u.role !== "employee";
  return (
    <>
      <PageHeader title="Approve Center" subtitle="ระบบอนุมัติเอกสารออนไลน์" />
      <RouteTabs
        items={[
          ...(u.employeeId ? [{ href: "/requests/mine", label: "คำขอของฉัน" }, { href: "/requests/new", label: "+ ยื่นคำขอ" }] : []),
          ...(approver ? [{ href: "/requests/inbox", label: "รออนุมัติ" }, { href: "/requests/history", label: "ประวัติการอนุมัติ" }] : []),
        ]}
      />
      {children}
    </>
  );
}
