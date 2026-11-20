"use client";

import { usePathname } from "next/navigation";
import { RouteTabs } from "@/components/route-tabs";
import { PageHeader } from "@/components/ui";

/**
 * หน้าคำขอแยกเป็น 2 ส่วนตามเมนู:
 *  - คำขอของฉัน  (/requests/mine, /requests/new)       — เรื่องของตัวเอง
 *  - อนุมัติคำขอ (/requests/inbox, /requests/history)  — ทำให้คนอื่น (หัวหน้า/HR)
 */
export function RequestsNav({ canSubmit, approver, hr }: { canSubmit: boolean; approver: boolean; hr: boolean }) {
  const path = usePathname();
  const approving = path.startsWith("/requests/inbox") || path.startsWith("/requests/history");

  if (approving && approver)
    return (
      <>
        <PageHeader title="อนุมัติคำขอ" subtitle={hr ? "ลา OT และแก้เวลาของพนักงานที่รอคุณอนุมัติ" : "ลา OT และแก้เวลาของลูกทีมที่รอคุณอนุมัติ"} />
        <RouteTabs
          items={[
            { href: "/requests/inbox", label: "รออนุมัติ" },
            { href: "/requests/history", label: "ประวัติการอนุมัติ" },
          ]}
        />
      </>
    );

  return (
    <>
      <PageHeader title={approver ? "คำขอของฉัน" : "ยื่นลา / OT"} subtitle="ยื่นลา ขอ OT ขอแก้ไขเวลา และติดตามว่าถึงขั้นไหนแล้ว" />
      {canSubmit && (
        <RouteTabs
          items={[
            { href: "/requests/mine", label: "คำขอของฉัน" },
            { href: "/requests/new", label: "+ ยื่นคำขอ" },
          ]}
        />
      )}
    </>
  );
}
